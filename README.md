# pi-mcp-local

Pi agent package for connecting to a local MCP documentation server via llama.cpp.

## What's Included

### Extensions
- **mcp-docs** — MCP bridge: discovers tools from the docs server, registers them as native pi tools with `docs_` prefix, handles session management, response truncation, argument auto-correction, retry logic, and temperature capping
- **web-search** — Web search (`web_search`) and page fetching (`web_fetch`) via local SearXNG metasearch (Google, DuckDuckGo, Brave, Wikipedia, GitHub). No API keys required.
- **normalize-messages** — Merges consecutive same-role messages before provider requests to prevent Jinja chat template role-alternation errors
- **sys-monitor** — Real-time CPU/GPU/RAM monitor in the pi footer bar
- **approve-edits** — Approval gate for edit/write/bash tool calls (toggle by renaming the file)
- **lsp** — TypeScript Language Server integration: diagnostics, go-to-definition, hover, find references via `lsp_*` tools
- **hash-edit** — Hash-anchored edits: annotates read output with per-line content hashes, registers `hash_edit` tool for precision edits

### Skills
- **resources** — Book inventory (17 books), domain mapping, search strategies
- **vault** — Obsidian vault management (write/move operations)

### Prompt Templates
- `/research` — Multi-source research workflow
- `/debug` — Systematic debugging (Agans' 9 Rules)
- `/capture` — Codebase knowledge extraction to vault
- `/spec` — Structured specification mode
- `/pr-review` — PR review with lint gates and test enforcement
- `/codebase-review` — Deep architectural review
- `/prompt-review` — Prompt optimization analysis

### Context File
- `AGENTS.md` — Code quality principles, research workflow, tool reference. Copy to `~/.pi/agent/AGENTS.md` for auto-loading.

## Installation

### From local path

```bash
pi install /path/to/pi-mcp-local
```

### From git

```bash
pi install git:github.com/dallasmarlow/pi-mcp-local
```

### Manual setup

1. Copy `AGENTS.md` to `~/.pi/agent/AGENTS.md`
2. Copy `models.example.json` to `~/.pi/agent/models.json` and adjust the endpoint URL
3. Add to `~/.pi/agent/settings.json`:

```json
{
  "defaultProvider": "m1s1",
  "defaultModel": "Qwen3.5-122B-A10B-UD-Q4_K_XL.gguf"
}
```

## Configuration

### MCP Connection

Set via environment variables or a `.env` file in the project root:

```bash
PI_MCP_URL=http://M1-S1.local:8765/mcp
PI_MCP_TOKEN=your-bearer-token-here
```

Copy `.env.example` to `.env` and fill in your values. The extension falls back to `PI_MCP_URL=http://M1-S1.local:8765/mcp` if unset.

### Model Provider

The model provider config in `models.example.json` should be adjusted for your llama.cpp endpoint.

## Dependencies

External tools are listed in `deps.json` and installed via `make deps` (also runs as part of `make install`):

- **typescript-language-server** — Required by the LSP extension
- **typescript** — Required by typescript-language-server

## Requirements

- [pi-coding-agent](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) v0.66+
- llama.cpp server with OpenAI-compatible API
- MCP documentation server (mcp-local) with Streamable HTTP transport
- Node.js 18+ (for LSP and hash-edit extensions)
