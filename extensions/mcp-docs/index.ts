import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, type TSchema } from "@sinclair/typebox";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from repo root (two levels up from extensions/mcp-docs/)
try {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");
  const envContent = readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env file is optional */ }

const MCP_URL = process.env.PI_MCP_URL || "http://M1-S1.local:8765/mcp";
const MCP_TOKEN = process.env.PI_MCP_TOKEN || "";
if (!MCP_TOKEN) console.warn("[mcp-docs] PI_MCP_TOKEN is not set -- requests will be unauthenticated");

interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: { tools?: McpToolDef[]; content?: { type: string; text: string }[]; isError?: boolean };
  error?: { code: number; message: string };
}

let requestId = 0;
let sessionId: string | null = null;
let reinitializing: Promise<void> | null = null;

function parseResponse(text: string): JsonRpcResponse {
  // Handle SSE-style streaming responses (streamable HTTP transport)
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    const data = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
    if (!data || data === "") continue;
    try {
      const parsed = JSON.parse(data);
      if (parsed.jsonrpc && parsed.id !== undefined) return parsed;
    } catch {
      continue;
    }
  }
  return JSON.parse(text);
}

async function mcpInitialize(): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${MCP_TOKEN}`,
  };
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "pi-mcp-docs", version: "1.0.0" },
      },
      id: ++requestId,
    }),
  });
  if (!res.ok) throw new Error(`MCP initialize returned ${res.status}: ${await res.text()}`);
  // Capture session ID from response header
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessionId = sid;
  // Parse the initialize response (we don't need it, just complete the handshake)
  await res.text();

  // Send initialized notification
  const notifHeaders: Record<string, string> = { ...headers };
  if (sessionId) notifHeaders["Mcp-Session-Id"] = sessionId;
  await fetch(MCP_URL, {
    method: "POST",
    headers: notifHeaders,
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
}

async function mcpRequest(method: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<JsonRpcResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${MCP_TOKEN}`,
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: ++requestId }),
    signal,
  });
  if (!res.ok) throw new Error(`MCP server returned ${res.status}: ${await res.text()}`);
  // Update session ID if server sends a new one
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessionId = sid;
  const text = await res.text();
  return parseResponse(text);
}

function jsonSchemaToTypebox(schema: Record<string, unknown>): TSchema {
  return Type.Unsafe(schema);
}

// Hard cap: truncate responses to ~30k chars (~8k tokens) to protect context window
const MAX_RESPONSE_CHARS = 30000;

function truncateResponse(text: string): string {
  if (text.length <= MAX_RESPONSE_CHARS) return text;
  return text.slice(0, MAX_RESPONSE_CHARS) +
    "\n\n--- TRUNCATED (response exceeded 30k chars). Use the `section` or `page` parameter to retrieve a specific portion, or narrow your search query. ---";
}

// Per-tool guidelines to steer the model toward safe usage patterns
const toolGuidelines: Record<string, string[]> = {
  docs_vault_document_read: [
    "THIS is the tool for reading BOOKS and DOCUMENTS (PDFs, large files). NOT vault_read.",
    "ALWAYS specify a `section` heading OR `page` number. NEVER call without one -- full documents are 100k+ tokens and WILL overflow context.",
    "The `file_path` comes from search results (semantic_search or search_all_docs). The `section` comes from the Section breadcrumb in those results.",
    "For PDFs: use `page` to read one page at a time (e.g., page=228 for CQRS on page 228).",
    "For markdown: use `section` with the exact heading text from search results.",
    "If you get 'Full text not yet captured', try using `page` instead of `section`.",
  ],
  docs_vault_read: [
    "ONLY for small Obsidian vault NOTES (development/, pi/, reference files/ domains). These are curated summaries, NOT books.",
    "NEVER use this for books or documents in the library/ domain. Use docs_vault_document_read with section/page instead.",
    "If a path starts with 'library/Books/' -- STOP. Use docs_vault_document_read, not this tool.",
  ],
  docs_vault_search: [
    "Searches vault NOTES, not books. Results from library/ domain give you file paths and snippets -- use those with docs_vault_document_read(file_path=..., section=...) to read the actual content.",
    "Use broad separate keywords, not hyphenated slugs. Good: 'CQRS event sourcing'. Bad: 'cqrs-event-sourcing-pattern'.",
  ],
  docs_semantic_search: [
    "Use max_results of 5-10, not more. Results are BREADCRUMBS with file_path and Section info.",
    "After getting results, read the actual content with docs_vault_document_read(file_path=..., section='exact heading from results').",
    "Two-step pattern: (1) semantic_search to find WHERE, (2) vault_document_read to read WHAT.",
    "Use 3-5 specific keywords, not vague single words.",
  ],
  docs_search_all_docs: [
    "Fast FTS5 keyword search. Returns snippets with page numbers and section headings.",
    "Use these page numbers/sections with docs_vault_document_read to read full content.",
    "Prefer this over semantic_search for exact terms, error messages, and function names.",
  ],
  docs_list_documents: [
    "Do NOT set expand_all=true unless the user explicitly asks for it. Returns thousands of lines.",
  ],
  docs_vault_list: [
    "Always specify a `domain` to narrow results. Calling without a domain lists everything.",
  ],
  docs_list_code_examples: [
    "Keep max_results at 5-10. Always specify a language filter.",
  ],
  docs_vault_write: [
    "ALWAYS provide title, content, path, and tags as SEPARATE parameters.",
    "title is a plain string like title=\"My Note Title\".",
    "tags is an ARRAY of strings like tags=[\"tag1\", \"tag2\"]. NOT a string, NOT embedded in content.",
    "Do NOT embed tags as #hashtags at the end of content.",
    "Do NOT stuff title inside the tags parameter.",
  ],
};

export default function (pi: ExtensionAPI) {
  // Discover and register MCP tools at session start
  pi.on("session_start", async (_event, ctx) => {
    try {
      // Initialize MCP session (handshake + session ID)
      await mcpInitialize();
      const response = await mcpRequest("tools/list", {});
      if (response.error) {
        ctx.ui.notify(`MCP tools/list error: ${response.error.message}`, "error");
        return;
      }
      const tools = response.result?.tools ?? [];
      let registered = 0;

      // Only register tools pi actually needs — allowlist approach
      const allowTools = new Set([
        "semantic_search",
        "search_all_docs",
        "vault_document_read",
        "list_code_examples",
        "list_documents",
        "search_symbols",
        "get_dependencies",
        "vault_search",
        "vault_read",
        "vault_write",
        "vault_list",
        "vault_move",
      ]);

      for (const tool of tools) {
        const toolName = tool.name;
        if (!allowTools.has(toolName)) continue;

        // Prefix with docs_ for namespacing in pi
        const piName = `docs_${toolName}`;

        const parameters = tool.inputSchema
          ? jsonSchemaToTypebox(tool.inputSchema as Record<string, unknown>)
          : Type.Object({});

        const guidelines = toolGuidelines[piName];

        pi.registerTool({
          name: piName,
          label: piName.replace(/_/g, " "),
          description: tool.description,
          parameters,
          ...(guidelines ? { promptGuidelines: guidelines } : {}),
          prepareArguments(args: Record<string, unknown>) {
            // Fix common model mistakes with object-wrapped values
            for (const key of Object.keys(args)) {
              const val = args[key];
              if (val && typeof val === "object" && !Array.isArray(val)) {
                const entries = Object.entries(val as Record<string, unknown>);
                if (entries.length === 1) {
                  const [innerKey, innerVal] = entries[0];
                  // section: {page: 261} → move page to top level, clear section
                  if (key === "section" && innerKey === "page") {
                    args["page"] = typeof innerVal === "string" ? parseInt(innerVal, 10) : innerVal;
                    args["section"] = null;
                  // section: {text: "..."} or section: {heading: "..."} → unwrap to string
                  } else if (typeof innerVal === "string") {
                    args[key] = innerVal;
                  }
                }
              }
            }
            // Coerce page to integer — model often sends "262", "{\"262\"}", etc.
            if ("page" in args && args["page"] !== null && args["page"] !== undefined) {
              let p = args["page"];
              if (typeof p === "string") {
                // Strip any JSON encoding artifacts: "{\"262\"}" -> "262"
                p = p.replace(/[{}"\\]/g, "").trim();
                args["page"] = parseInt(p as string, 10) || null;
              }
            }
            // Coerce max_results to integer
            if ("max_results" in args && typeof args["max_results"] === "string") {
              args["max_results"] = parseInt(args["max_results"] as string, 10) || 10;
            }

            // vault_write-specific fixes
            if (piName === "docs_vault_write") {
              // Fix mangled tags: extract title if embedded, parse to string[]
              let tags = args["tags"];
              if (typeof tags === "string") {
                const tagStr = tags as string;
                // Extract title if stuffed into tags string: ,title:"Some Title"} or title:"Some Title"
                if (!args["title"] && tagStr.includes("title:")) {
                  const titleMatch = tagStr.match(/title:\s*"([^"]+)"/);
                  if (titleMatch) args["title"] = titleMatch[1];
                }
                // Parse quoted terms from malformed string like "{\"arch\",\"patterns\"}"
                const quoted = tagStr.match(/"([^"]+)"/g);
                if (quoted) {
                  const cleanTags = quoted
                    .map((q) => q.slice(1, -1))
                    .filter((t) => !t.includes(":") && t.length > 0);
                  args["tags"] = cleanTags.length > 0 ? cleanTags : null;
                } else {
                  // Try comma-separated: "arch, patterns, cqrs"
                  const parts = tagStr.replace(/[{}"\\]/g, "").split(",").map((s) => s.trim()).filter(Boolean);
                  const filtered = parts.filter((t) => !t.includes(":"));
                  args["tags"] = filtered.length > 0 ? filtered : null;
                }
              }

              // Strip trailing hashtag lines from content and merge into tags
              if (args["content"] && typeof args["content"] === "string") {
                const lines = (args["content"] as string).split("\n");
                const extractedTags: string[] = [];
                // Walk backwards to find trailing hashtag-only lines
                let cutFrom = lines.length;
                for (let i = lines.length - 1; i >= 0; i--) {
                  const trimmed = lines[i].trim();
                  if (trimmed === "") { cutFrom = i; continue; }
                  if (/^#[\w-]+(\s+#[\w-]+)*\s*$/.test(trimmed)) {
                    const hashes = trimmed.match(/#([\w-]+)/g) || [];
                    hashes.forEach((h) => extractedTags.push(h.slice(1)));
                    cutFrom = i;
                  } else {
                    break;
                  }
                }
                if (extractedTags.length > 0) {
                  args["content"] = lines.slice(0, cutFrom).join("\n").trimEnd();
                  const existing = Array.isArray(args["tags"]) ? (args["tags"] as string[]) : [];
                  args["tags"] = Array.from(new Set([...existing, ...extractedTags]));
                }
              }

              // Infer title if still missing
              if (!args["title"] || args["title"] === "") {
                if (args["content"] && typeof args["content"] === "string") {
                  const heading = (args["content"] as string).match(/^#+\s+(.+)/m);
                  if (heading) args["title"] = heading[1].trim().slice(0, 120);
                }
                if (!args["title"] && args["path"] && typeof args["path"] === "string") {
                  const slug = (args["path"] as string).split("/").pop()?.replace(/\.md$/, "") || "Untitled";
                  args["title"] = slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                }
              }
            }

            return args;
          },
          async execute(toolCallId, params, signal) {
            const attempt = async (retry: boolean): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> => {
              try {
                const response = await mcpRequest("tools/call", {
                  name: toolName,
                  arguments: params,
                }, signal);

                if (response.error) {
                  // Retry once on transient errors (session expired, etc.)
                  if (retry && (response.error.code === -32600 || response.error.code === -32000)) {
                    sessionId = null;
                    if (!reinitializing) reinitializing = mcpInitialize().finally(() => { reinitializing = null; });
                    await reinitializing;
                    return attempt(false);
                  }
                  return {
                    content: [{ type: "text" as const, text: `MCP error: ${response.error.message}\n\nRecovery: Check your parameters. For vault_document_read, pass section as a plain string (not an object) or use page=N.` }],
                    isError: true,
                  };
                }

                const resultContent = response.result?.content ?? [];
                const textParts = resultContent
                  .filter((c) => c.type === "text")
                  .map((c) => c.text)
                  .join("\n");

                return {
                  content: [{ type: "text" as const, text: truncateResponse(textParts) || "(empty response)" }],
                  isError: response.result?.isError ?? false,
                };
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                // Retry once on network/connection errors
                if (retry && (msg.includes("fetch") || msg.includes("ECONNREFUSED") || msg.includes("socket"))) {
                  sessionId = null;
                  try {
                    if (!reinitializing) reinitializing = mcpInitialize().finally(() => { reinitializing = null; });
                    await reinitializing;
                    return attempt(false);
                  } catch { /* fall through to error */ }
                }
                return {
                  content: [{ type: "text" as const, text: `MCP call failed: ${msg}\n\nRecovery: The MCP server may be unreachable. Try again or use a different approach.` }],
                  isError: true,
                };
              }
            };
            return attempt(true);
          },
        });
        registered++;
      }

      ctx.ui.notify(`MCP: registered ${registered} docs tools from M1:S1`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.ui.notify(`MCP discovery failed: ${msg}`, "error");
    }
  });

  // Lower temperature to reduce degenerate tool call outputs
  pi.on("before_provider_request", (event) => {
    const payload = event.payload as Record<string, unknown>;
    if (payload.temperature === undefined || (payload.temperature as number) > 0.7) {
      return { ...payload, temperature: 0.7 };
    }
  });

  // Intercept failed tool results and add recovery guidance
  pi.on("tool_result", async (event) => {
    if (!event.isError) return;
    const toolName = event.toolName;
    if (!toolName.startsWith("docs_")) return;

    const original = event.content
      ?.filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n") || "";

    // Already has recovery text from our execute function
    if (original.includes("Recovery:")) return;

    let recovery = "Try the call again with corrected parameters.";
    if (toolName === "docs_vault_document_read") {
      recovery = "Pass section as a plain string like section=\"Chapter Name\" or use page=N instead. Do NOT wrap section in an object.";
    } else if (toolName === "docs_semantic_search") {
      recovery = "Use 3-5 specific keywords and max_results=5. Example: docs_semantic_search(query=\"CQRS event sourcing microservice\", max_results=5)";
    }

    return {
      content: [{ type: "text" as const, text: `${original}\n\nRecovery: ${recovery}` }],
    };
  });
}
