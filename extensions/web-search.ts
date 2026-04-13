import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const SEARXNG_URL = process.env.SEARXNG_URL || "http://127.0.0.1:8888";

interface SearxResult {
  title: string;
  url: string;
  content: string;
  engine: string;
}

interface SearxResponse {
  results: SearxResult[];
  query: string;
  number_of_results: number;
}

async function fetchPage(url: string): Promise<string> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  const html = await resp.text();

  // Extract text from HTML: strip tags, decode entities, collapse whitespace
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "web search",
    description:
      "Search the web using SearXNG metasearch. Returns titles, URLs, and snippets from multiple search engines (Google, DuckDuckGo, Brave, Wikipedia, GitHub).",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      max_results: Type.Optional(
        Type.Number({ description: "Maximum results to return (default 10)", default: 10 })
      ),
      categories: Type.Optional(
        Type.String({
          description:
            'Comma-separated categories: "general", "it", "science", "files", "news". Default: "general"',
          default: "general",
        })
      ),
    }),
    async execute(
      _toolCallId: string,
      params: { query: string; max_results?: number; categories?: string }
    ) {
      const maxResults = params.max_results ?? 10;
      const categories = params.categories ?? "general";
      const url = `${SEARXNG_URL}/search?q=${encodeURIComponent(params.query)}&format=json&categories=${encodeURIComponent(categories)}`;

      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!resp.ok) {
          return {
            content: [{ type: "text" as const, text: `SearXNG error: HTTP ${resp.status}` }],
            isError: true,
          };
        }

        const data = (await resp.json()) as SearxResponse;
        const results = data.results.slice(0, maxResults);

        if (results.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No results found for: ${params.query}` }],
          };
        }

        const formatted = results
          .map(
            (r, i) =>
              `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content || "(no snippet)"}\n   [${r.engine}]`
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${data.number_of_results} results for "${params.query}" (showing ${results.length}):\n\n${formatted}`,
            },
          ],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Web search failed: ${msg}` }],
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: "web_fetch",
    label: "fetch web page",
    description:
      "Fetch a web page and extract its text content. Use after web_search to read full page content from a URL.",
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch" }),
      max_length: Type.Optional(
        Type.Number({
          description: "Maximum characters to return (default 15000)",
          default: 15000,
        })
      ),
    }),
    async execute(_toolCallId: string, params: { url: string; max_length?: number }) {
      const maxLen = params.max_length ?? 15000;

      try {
        const text = await fetchPage(params.url);
        const truncated = text.length > maxLen ? text.slice(0, maxLen) + "\n\n[truncated]" : text;

        return {
          content: [
            {
              type: "text" as const,
              text: `Content from ${params.url} (${text.length} chars):\n\n${truncated}`,
            },
          ],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Fetch failed: ${msg}` }],
          isError: true,
        };
      }
    },
  });
}
