import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface Message {
  role: string;
  content?: unknown;
  tool_calls?: unknown[];
  tool_call_id?: string;
  [key: string]: unknown;
}

// Merge content fields that may be strings or arrays of content parts.
function mergeContent(a: unknown, b: unknown): unknown {
  if (Array.isArray(a) || Array.isArray(b)) {
    const toParts = (v: unknown) =>
      Array.isArray(v) ? v : [{ type: "text", text: String(v ?? "") }];
    return [...toParts(a), ...toParts(b)];
  }
  return String(a ?? "") + "\n\n" + String(b ?? "");
}

// Collapse consecutive messages with the same role (excluding tool messages,
// which are allowed to appear in sequence after an assistant tool_calls turn).
function normalizeMessages(messages: Message[]): Message[] {
  const out: Message[] = [];

  for (const msg of messages) {
    const prev = out[out.length - 1];

    // Never merge tool-role messages -- each one maps to a specific tool_call_id.
    if (!prev || msg.role === "tool" || prev.role === "tool" || msg.role !== prev.role) {
      out.push({ ...msg });
      continue;
    }

    // Same non-tool role back-to-back: merge into the earlier message.
    prev.content = mergeContent(prev.content, msg.content);

    if (msg.tool_calls) {
      prev.tool_calls = [...(prev.tool_calls || []), ...msg.tool_calls];
    }
  }

  return out;
}

export default function (pi: ExtensionAPI) {
  pi.on("before_provider_request", (event) => {
    const payload = event.payload as Record<string, unknown>;
    const messages = payload.messages;

    if (!Array.isArray(messages) || messages.length === 0) return;

    const normalized = normalizeMessages(messages as Message[]);

    // Only return a modified payload when something actually changed.
    if (normalized.length !== messages.length) {
      return { ...payload, messages: normalized };
    }
  });
}
