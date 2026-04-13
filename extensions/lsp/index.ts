import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

interface LspRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

let server: ChildProcess | null = null;
let requestId = 0;
let initialized = false;
const pending = new Map<number, LspRequest>();
let buffer = "";
let rootUri = "";

function contentLengthEncode(obj: unknown): string {
  const body = JSON.stringify(obj);
  return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
}

function sendRequest(method: string, params: unknown): Promise<unknown> {
  if (!server?.stdin) return Promise.reject(new Error("LSP server not running"));
  const id = ++requestId;
  const msg = { jsonrpc: "2.0", id, method, params };
  server.stdin.write(contentLengthEncode(msg));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`LSP request ${method} timed out after 15s`));
      }
    }, 15000);
    pending.set(id, { resolve, reject, timer });
  });
}

function sendNotification(method: string, params: unknown): void {
  if (!server?.stdin) return;
  const msg = { jsonrpc: "2.0", method, params };
  server.stdin.write(contentLengthEncode(msg));
}

function handleData(chunk: string): void {
  buffer += chunk;
  if (buffer.length > 2 * 1024 * 1024) { buffer = ""; return; }
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) break;
    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) { buffer = buffer.slice(headerEnd + 4); continue; }
    const len = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + len) break;
    const body = buffer.slice(bodyStart, bodyStart + len);
    buffer = buffer.slice(bodyStart + len);
    try {
      const msg = JSON.parse(body);
      if (msg.id !== undefined && pending.has(msg.id)) {
        const req = pending.get(msg.id)!;
        pending.delete(msg.id);
        clearTimeout(req.timer);
        if (msg.error) req.reject(new Error(msg.error.message));
        else req.resolve(msg.result);
      }
    } catch { /* ignore parse errors */ }
  }
}

function fileUri(filePath: string): string {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  return `file://${abs}`;
}

function severityLabel(s: number): string {
  return s === 1 ? "error" : s === 2 ? "warning" : s === 3 ? "info" : "hint";
}

async function startServer(cwd: string): Promise<void> {
  if (server) return;
  rootUri = `file://${cwd}`;

  const bin = "typescript-language-server";
  server = spawn(bin, ["--stdio"], { cwd, stdio: ["pipe", "pipe", "pipe"] });

  server.stdout!.setEncoding("utf8");
  server.stdout!.on("data", handleData);
  server.stderr!.setEncoding("utf8");
  server.on("exit", () => { server = null; initialized = false; });

  const initResult = await sendRequest("initialize", {
    processId: process.pid,
    rootUri,
    capabilities: {
      textDocument: {
        publishDiagnostics: { relatedInformation: true },
        hover: { contentFormat: ["plaintext", "markdown"] },
        definition: {},
        references: {},
      },
    },
  });

  sendNotification("initialized", {});
  initialized = true;
}

function stopServer(): void {
  if (!server) return;
  try {
    sendNotification("shutdown", null);
    sendNotification("exit", null);
  } catch { /* ignore */ }
  setTimeout(() => { server?.kill(); server = null; }, 2000);
  initialized = false;
}

async function openFile(filePath: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(filePath, "utf8");
  sendNotification("textDocument/didOpen", {
    textDocument: {
      uri: fileUri(filePath),
      languageId: filePath.endsWith(".ts") || filePath.endsWith(".tsx") ? "typescript"
        : filePath.endsWith(".js") || filePath.endsWith(".jsx") ? "javascript"
        : "plaintext",
      version: 1,
      text: content,
    },
  });
  return content;
}

interface Diagnostic {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  severity?: number;
  message: string;
  source?: string;
}

interface Location {
  uri: string;
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    try {
      const cwd = process.cwd();
      await startServer(cwd);
      ctx.ui.notify("LSP: typescript-language-server connected", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.ui.notify(`LSP startup failed: ${msg}`, "error");
    }
  });

  pi.on("session_shutdown", async () => { stopServer(); });

  // --- lsp_diagnostics ---
  pi.registerTool({
    name: "lsp_diagnostics",
    label: "LSP diagnostics",
    description: "Get TypeScript/JavaScript type errors and warnings for a file",
    parameters: Type.Object({
      file_path: Type.String({ description: "Absolute path to the file to check" }),
    }),
    promptGuidelines: [
      "Use after editing a file to check for type errors before moving on.",
      "Returns line numbers, severity, and error messages.",
    ],
    async execute(_toolCallId, params: { file_path: string }) {
      if (!initialized) return { content: [{ type: "text" as const, text: "LSP server not running. It may still be starting up -- try again in a moment." }], isError: true };
      await openFile(params.file_path);
      // Give the server a moment to compute diagnostics
      await new Promise((r) => setTimeout(r, 2000));
      const result = await sendRequest("textDocument/diagnostic", {
        textDocument: { uri: fileUri(params.file_path) },
      }) as { items?: Diagnostic[] } | null;
      const items = (result as any)?.items ?? (result as any)?.diagnostics ?? [];
      if (items.length === 0) return { content: [{ type: "text" as const, text: "No diagnostics -- file is clean." }] };
      const lines = items.map((d: Diagnostic) => {
        const loc = `${d.range.start.line + 1}:${d.range.start.character + 1}`;
        const sev = severityLabel(d.severity ?? 1);
        return `${loc} [${sev}] ${d.message}${d.source ? ` (${d.source})` : ""}`;
      });
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  });

  // --- lsp_definition ---
  pi.registerTool({
    name: "lsp_definition",
    label: "LSP go to definition",
    description: "Find the definition location of a symbol at a given position in a file",
    parameters: Type.Object({
      file_path: Type.String({ description: "Absolute path to the file" }),
      line: Type.Number({ description: "1-based line number" }),
      character: Type.Number({ description: "1-based column number" }),
    }),
    promptGuidelines: [
      "Use to navigate to where a function, class, or variable is defined.",
      "line and character are 1-based (as shown in read output).",
    ],
    async execute(_toolCallId, params: { file_path: string; line: number; character: number }) {
      if (!initialized) return { content: [{ type: "text" as const, text: "LSP server not running." }], isError: true };
      await openFile(params.file_path);
      const result = await sendRequest("textDocument/definition", {
        textDocument: { uri: fileUri(params.file_path) },
        position: { line: params.line - 1, character: params.character - 1 },
      });
      const locations: Location[] = Array.isArray(result) ? result : result ? [result as Location] : [];
      if (locations.length === 0) return { content: [{ type: "text" as const, text: "No definition found at that position." }] };
      const lines = locations.map((loc) => {
        const file = loc.uri.replace("file://", "");
        return `${file}:${loc.range.start.line + 1}:${loc.range.start.character + 1}`;
      });
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    },
  });

  // --- lsp_hover ---
  pi.registerTool({
    name: "lsp_hover",
    label: "LSP hover",
    description: "Get type information and documentation for a symbol at a given position",
    parameters: Type.Object({
      file_path: Type.String({ description: "Absolute path to the file" }),
      line: Type.Number({ description: "1-based line number" }),
      character: Type.Number({ description: "1-based column number" }),
    }),
    promptGuidelines: [
      "Use to inspect type signatures and documentation without navigating away.",
    ],
    async execute(_toolCallId, params: { file_path: string; line: number; character: number }) {
      if (!initialized) return { content: [{ type: "text" as const, text: "LSP server not running." }], isError: true };
      await openFile(params.file_path);
      const result = await sendRequest("textDocument/hover", {
        textDocument: { uri: fileUri(params.file_path) },
        position: { line: params.line - 1, character: params.character - 1 },
      }) as { contents?: { value?: string; kind?: string } | string } | null;
      if (!result || !result.contents) return { content: [{ type: "text" as const, text: "No hover information at that position." }] };
      const contents = result.contents;
      const text = typeof contents === "string" ? contents
        : typeof contents === "object" && "value" in contents ? (contents as { value: string }).value
        : JSON.stringify(contents);
      return { content: [{ type: "text" as const, text }] };
    },
  });

  // --- lsp_references ---
  pi.registerTool({
    name: "lsp_references",
    label: "LSP find references",
    description: "Find all references to a symbol at a given position across the project",
    parameters: Type.Object({
      file_path: Type.String({ description: "Absolute path to the file" }),
      line: Type.Number({ description: "1-based line number" }),
      character: Type.Number({ description: "1-based column number" }),
    }),
    promptGuidelines: [
      "Use to understand impact before renaming or modifying a function/variable.",
      "Returns file paths and line numbers for all usages.",
    ],
    async execute(_toolCallId, params: { file_path: string; line: number; character: number }) {
      if (!initialized) return { content: [{ type: "text" as const, text: "LSP server not running." }], isError: true };
      await openFile(params.file_path);
      const result = await sendRequest("textDocument/references", {
        textDocument: { uri: fileUri(params.file_path) },
        position: { line: params.line - 1, character: params.character - 1 },
        context: { includeDeclaration: true },
      });
      const locations: Location[] = Array.isArray(result) ? result : [];
      if (locations.length === 0) return { content: [{ type: "text" as const, text: "No references found." }] };
      const lines = locations.map((loc) => {
        const file = loc.uri.replace("file://", "");
        return `${file}:${loc.range.start.line + 1}:${loc.range.start.character + 1}`;
      });
      return { content: [{ type: "text" as const, text: `${locations.length} references:\n${lines.join("\n")}` }] };
    },
  });
}
