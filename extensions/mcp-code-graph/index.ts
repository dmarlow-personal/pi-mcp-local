import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, type TSchema } from "@sinclair/typebox";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

// Load .env from repo root (two levels up from extensions/mcp-code-graph/)
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

const MCP_URL = process.env.PI_CODE_GRAPH_URL || "http://127.0.0.1:4753/mcp";

// Resolve token: explicit env var wins, otherwise auto-read the local
// code-graph daemon's token file. The file is created by `code-graph
// serve` on the same machine -- works without manual config when pi
// and code-graph share a host (M1-S1 single-box layout). The fallback
// is silent: when running pi against a remote code-graph server the
// user is expected to set PI_CODE_GRAPH_TOKEN explicitly.
function resolveToken(): string {
  if (process.env.PI_CODE_GRAPH_TOKEN) return process.env.PI_CODE_GRAPH_TOKEN;
  const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  const tokenPath = join(xdg, "code-graph", "mcp-token");
  if (existsSync(tokenPath)) {
    try {
      return readFileSync(tokenPath, "utf8").trim();
    } catch { /* fall through */ }
  }
  return "";
}

const MCP_TOKEN = resolveToken();
if (!MCP_TOKEN) console.warn("[mcp-code-graph] no token (set PI_CODE_GRAPH_TOKEN or run code-graph locally) -- requests will fail with 401");

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
        clientInfo: { name: "pi-mcp-code-graph", version: "1.0.0" },
      },
      id: ++requestId,
    }),
  });
  if (!res.ok) throw new Error(`MCP initialize returned ${res.status}: ${await res.text()}`);
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessionId = sid;
  await res.text();

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
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessionId = sid;
  const text = await res.text();
  return parseResponse(text);
}

function jsonSchemaToTypebox(schema: Record<string, unknown>): TSchema {
  return Type.Unsafe(schema);
}

// Hard cap: truncate responses to ~30k chars to protect context window.
// cg_reachability with high depth and cg_community on large clusters
// can return large payloads; users can narrow via depth/limit.
const MAX_RESPONSE_CHARS = 30000;

function truncateResponse(text: string): string {
  if (text.length <= MAX_RESPONSE_CHARS) return text;
  return text.slice(0, MAX_RESPONSE_CHARS) +
    "\n\n--- TRUNCATED (response exceeded 30k chars). Narrow the query: lower `depth` on cg_reachability, lower `limit` on cg_search / cg_search_communities, or paginate cg_community via members_offset. ---";
}

// Per-tool guidelines to steer the model toward safe usage patterns
const toolGuidelines: Record<string, string[]> = {
  cg_search: [
    "FTS5 substring search over symbol names + signatures. Trigram tokenizer requires query length >= 3.",
    "First call after IDE-context shifts: use cg_current_selection() to anchor on what the user is looking at, then cg_search for related symbols.",
    "Empty results / 'code-graph not reachable' for a known symbol means the target repo is not enrolled. Fall through to lsp_* or Grep.",
    "Capture the returned `id` AND `stable_id`. Use stable_id for cached references across re-indexes; id rotates on each rebuild.",
  ],
  cg_get_symbol: [
    "Pass either `id` (current session) or `stable_id` (durable). Returns full card + 1-hop neighborhood (callers, callees, siblings).",
    "Pair with `Read(file, offset=line-5, limit=30)` for the actual code slice -- never read the whole file to 'orient'.",
  ],
  cg_reachability: [
    "N-hop call-graph flood. `direction=backward` = callers (fan-in, blast radius). `direction=forward` = callees (downstream effects).",
    "Default depth=20 is generous. Lower depth (3-5) for tight neighborhood; raise only when you need full reach.",
    "Critical for review skills (scrutinize Pass 4, pr-review, security-audit) -- a dangerous primitive with zero project-side callers is a different threat tier than one wired into request-handling.",
  ],
  cg_current_selection: [
    "What the user is currently looking at in the code-graph UI (visual deixis). Use as the default starting move when no explicit target was given ('debug this', 'review this').",
    "Returns null if no selection -- fall through to asking the user.",
  ],
  cg_communities_for_symbol: [
    "Which subsystems (communities) does this symbol belong to. Levels: 0=fine, 1=mid, 2=coarse.",
    "Loop over a few seed symbols from changed files to scope a review to the right architectural cluster.",
  ],
  cg_search_communities: [
    "Semantic/BM25 search over community summaries. Use for 'what subsystems handle X' queries instead of searching individual symbols.",
    "Needs `code-graph build-embeddings` to have been run on the enrolled repo.",
  ],
  cg_community: [
    "Full member list + touched files for one community. Members are paginated (default 50/call) -- use members_offset for further pages on large clusters.",
  ],
};

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      await mcpInitialize();
      const response = await mcpRequest("tools/list", {});
      if (response.error) {
        ctx.ui.notify(`code-graph MCP tools/list error: ${response.error.message}`, "error");
        return;
      }
      const tools = response.result?.tools ?? [];
      let registered = 0;

      // Allow-list of cg_* tools to expose to pi. Read-only navigation
      // is always on; write tools (set_community_summary, set_community_keyterms)
      // are also exposed but should be invoked through /skill:code-graph
      // for the curation loop.
      const allowTools = new Set([
        "cg_search",
        "cg_get_symbol",
        "cg_reachability",
        "cg_adjacency",
        "cg_orphans",
        "cg_unused_exports",
        "cg_current_selection",
        "cg_communities_for_symbol",
        "cg_community",
        "cg_search_communities",
        "cg_stale_communities",
        "cg_set_community_summary",
        "cg_set_community_keyterms",
      ]);

      for (const tool of tools) {
        const toolName = tool.name;
        if (!allowTools.has(toolName)) continue;

        // No prefix wrap: code-graph tools already namespace under cg_.
        // Keeps pi prompts readable (cg_search vs docs_cg_search) and
        // mirrors mcp-local's mcp__code-graph__cg_* server-name namespace.
        const piName = toolName;

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
          async execute(toolCallId, params, signal) {
            const attempt = async (retry: boolean): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> => {
              try {
                const response = await mcpRequest("tools/call", {
                  name: toolName,
                  arguments: params,
                }, signal);

                if (response.error) {
                  if (retry && (response.error.code === -32600 || response.error.code === -32000)) {
                    sessionId = null;
                    if (!reinitializing) reinitializing = mcpInitialize().finally(() => { reinitializing = null; });
                    await reinitializing;
                    return attempt(false);
                  }
                  return {
                    content: [{ type: "text" as const, text: `code-graph error: ${response.error.message}\n\nRecovery: For cg_search, ensure query length >= 3. For cg_get_symbol / cg_reachability, pass numeric id from a prior cg_search hit.` }],
                    isError: true,
                  };
                }

                const resultContent = response.result?.content ?? [];
                const textParts = resultContent
                  .filter((c) => c.type === "text")
                  .map((c) => c.text)
                  .join("\n");

                return {
                  content: [{ type: "text" as const, text: truncateResponse(textParts) || "(empty response -- target repo may not be enrolled in code-graph)" }],
                  isError: response.result?.isError ?? false,
                };
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                if (retry && (msg.includes("fetch") || msg.includes("ECONNREFUSED") || msg.includes("socket"))) {
                  sessionId = null;
                  try {
                    if (!reinitializing) reinitializing = mcpInitialize().finally(() => { reinitializing = null; });
                    await reinitializing;
                    return attempt(false);
                  } catch { /* fall through to error */ }
                }
                return {
                  content: [{ type: "text" as const, text: `code-graph MCP call failed: ${msg}\n\nRecovery: The code-graph daemon may not be running. Fall back to lsp_* (TypeScript only) or Grep for symbol navigation.` }],
                  isError: true,
                };
              }
            };
            return attempt(true);
          },
        });
        registered++;
      }

      ctx.ui.notify(`MCP: registered ${registered} code-graph tools`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.ui.notify(`code-graph MCP discovery failed: ${msg}`, "error");
    }
  });
}
