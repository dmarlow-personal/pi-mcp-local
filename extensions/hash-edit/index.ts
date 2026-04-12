import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

// Per-line hash: first 6 hex chars of SHA-256 of trimmed content
function lineHash(content: string): string {
  return createHash("sha256").update(content.trimEnd()).digest("hex").slice(0, 6);
}

// Cache: file_path -> array of { hash, content } indexed by 0-based line number
const hashCache = new Map<string, Array<{ hash: string; content: string }>>();

function cacheFile(filePath: string, lines: string[]): void {
  hashCache.set(filePath, lines.map((line) => ({ hash: lineHash(line), content: line })));
}

function findLineByHash(filePath: string, anchorHash: string): { line: number; content: string } | null {
  const cached = hashCache.get(filePath);
  if (!cached) return null;
  for (let i = 0; i < cached.length; i++) {
    if (cached[i].hash === anchorHash) return { line: i, content: cached[i].content };
  }
  return null;
}

export default function (pi: ExtensionAPI) {
  // Intercept read tool results to annotate with line hashes
  pi.on("tool_result", async (event) => {
    if (event.toolName !== "read") return;
    if (event.isError) return;

    const textParts = event.content
      ?.filter((c: any) => c.type === "text")
      .map((c: any) => c.text) || [];
    const text = textParts.join("\n");
    if (!text) return;

    // Extract file path from the read tool's input
    const filePath = (event as any).input?.file_path || (event as any).input?.filePath;
    if (!filePath || typeof filePath !== "string") return;

    // Parse cat -n formatted output: "     1\tline content"
    const outputLines = text.split("\n");
    const rawLines: string[] = [];
    const annotated: string[] = [];

    for (const line of outputLines) {
      // Match cat -n format: optional spaces, number, tab, content
      const match = line.match(/^\s*(\d+)\t(.*)$/);
      if (match) {
        const lineNum = match[1];
        const content = match[2];
        rawLines.push(content);
        const hash = lineHash(content);
        annotated.push(`${hash} | ${lineNum}\t${content}`);
      } else {
        // Non-numbered lines (e.g., truncation messages) pass through
        annotated.push(line);
      }
    }

    if (rawLines.length > 0) {
      cacheFile(filePath, rawLines);
      return { content: [{ type: "text" as const, text: annotated.join("\n") }] };
    }
  });

  // Register the hash_edit tool
  pi.registerTool({
    name: "hash_edit",
    label: "hash anchored edit",
    description: "Edit a file using line content hashes as anchors. More reliable than text matching for edits where whitespace or context is ambiguous.",
    parameters: Type.Object({
      file_path: Type.String({ description: "Absolute path to the file to edit" }),
      edits: Type.Array(
        Type.Object({
          anchor_hash: Type.String({ description: "6-character hash from the leftmost column of read output" }),
          old_text: Type.String({ description: "Text to find on the anchored line (partial match OK)" }),
          new_text: Type.String({ description: "Replacement text" }),
        }),
        { description: "Array of edits to apply, each anchored by a line hash" },
      ),
    }),
    promptGuidelines: [
      "Use the 6-character hash from the LEFT column of read output to anchor edits.",
      "If a hash doesn't match, the file changed since you last read it -- re-read first.",
      "You can still use the regular edit tool -- hash_edit is for precision when text matching is ambiguous.",
      "Each edit targets ONE line identified by its hash. For multi-line changes, use one edit per line.",
    ],
    async execute(_toolCallId, params: { file_path: string; edits: Array<{ anchor_hash: string; old_text: string; new_text: string }> }) {
      const { file_path, edits } = params;

      // Read the current file
      let fileContent: string;
      try {
        fileContent = await readFile(file_path, "utf8");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Cannot read file: ${msg}` }], isError: true };
      }

      const lines = fileContent.split("\n");
      // Recompute hashes from current file to detect staleness
      const currentHashes = lines.map((l) => lineHash(l));

      const results: string[] = [];
      let modified = false;

      for (const edit of edits) {
        // Find line by hash in current file
        let targetLine = -1;
        for (let i = 0; i < currentHashes.length; i++) {
          if (currentHashes[i] === edit.anchor_hash) {
            targetLine = i;
            break;
          }
        }

        if (targetLine === -1) {
          // Check if it exists in cache but not current file (file changed)
          const cached = findLineByHash(file_path, edit.anchor_hash);
          if (cached) {
            results.push(`STALE: hash ${edit.anchor_hash} was at line ${cached.line + 1} but file has changed. Re-read the file.`);
          } else {
            results.push(`NOT FOUND: hash ${edit.anchor_hash} not found. Re-read the file to get current hashes.`);
          }
          continue;
        }

        const line = lines[targetLine];
        if (!line.includes(edit.old_text)) {
          results.push(`MISMATCH at line ${targetLine + 1} (hash ${edit.anchor_hash}): old_text "${edit.old_text}" not found in line content.`);
          continue;
        }

        lines[targetLine] = line.replace(edit.old_text, edit.new_text);
        results.push(`OK: line ${targetLine + 1} edited (hash ${edit.anchor_hash}).`);
        modified = true;
      }

      if (modified) {
        const newContent = lines.join("\n");
        await writeFile(file_path, newContent, "utf8");
        // Update cache with new content
        cacheFile(file_path, lines);
        results.push(`\nFile written. ${edits.length} edit(s) processed.`);
      }

      return { content: [{ type: "text" as const, text: results.join("\n") }] };
    },
  });
}
