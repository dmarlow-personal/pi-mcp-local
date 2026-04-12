# pi-mcp-local

Pi agent package for connecting to a local MCP documentation server via llama.cpp.

## What's Included

### Extensions
- **mcp-docs** — MCP bridge: discovers tools from the docs server, registers them as native pi tools with `docs_` prefix, handles session management, response truncation, argument auto-correction, retry logic, and temperature capping
- **sys-monitor** — Real-time CPU/RAM monitor in the pi footer bar with multi-gradient bars
- **approve-edits** — Approval gate for edit/write/bash tool calls (toggle by renaming the file)

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
  "defaultModel": "gemma-4-31B-it-UD-Q6_K_XL.gguf"
}
```

## Configuration

The MCP extension reads connection details from constants at the top of `extensions/mcp-docs/index.ts`:

```typescript
const MCP_URL = "http://M1-S1.local:8765/mcp";
const MCP_TOKEN = "your-bearer-token";
```

Update these for your environment. The model provider config in `models.example.json` should also be adjusted for your llama.cpp endpoint.

## Requirements

- [pi-coding-agent](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) v0.66+
- llama.cpp server with OpenAI-compatible API
- MCP documentation server (mcp-local) with Streamable HTTP transport
