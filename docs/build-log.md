# Pi MCP Local — Build Log

Session date: 2026-04-11
Built with: Claude Opus 4.6 (1M context) via Claude Code

---

## What We Built

A complete pi-coding-agent setup connecting Gemma 4 31B (running on M1:S1 via llama.cpp) to a local MCP documentation server with 17 books, 310+ white papers, and curated AI research articles.

## Decisions Made (chronological)

### 1. Model Provider Setup
- Created `models.json` with m1s1 provider pointing at `http://M1-S1.lan:8081/v1`
- OpenAI-compatible API, `apiKey: "sk-dummy"` (llama.cpp ignores it)
- `supportsDeveloperRole: false`, `supportsReasoningEffort: false` — llama.cpp compat
- Set `contextWindow: 262144` (256k) — initially defaulted to 128k
- Set as default provider/model in `settings.json`

### 2. MCP Docs Extension (`extensions/mcp-docs/index.ts`)
- Pi doesn't support MCP natively — built a bridge extension
- First attempt failed: 406 "Client must accept both application/json and text/event-stream"
  - Fix: added `Accept: application/json, text/event-stream` header
- Second attempt failed: 400 "Missing session ID"
  - Fix: implemented full MCP Streamable HTTP handshake (initialize → capture Mcp-Session-Id → notifications/initialized)
- Tool names changed from `mcp__docs__*` to bare names (e.g., `semantic_search`) after a server update
  - Fix: updated allowlist and prefix logic
- Switched from blocklist to **allowlist** of 12 tools to reduce system prompt bloat (was 27)
  - Dropped: assist, instance_probe, verify_probe, analyze_codebase, extract_symbols, capture_status, audit_repo_security, crawl_websites, search_arxiv, search_pubmed, personal_vault_* (unified into vault tools with `personal` param)

### 3. Argument Auto-Correction (`prepareArguments`)
Gemma 4 31B consistently makes these tool call mistakes:
- `section: {text: "CQRS"}` instead of `section: "CQRS"` — unwrap single-key string objects
- `section: {heading: "CQRS"}` — same pattern, different key name
- `section: {page: 261}` — wrong param nested in section, move to `page`, null section
- `page: "262"` — string instead of integer, parse to int
- `page: "{\"262\"}"` — double-encoded JSON, strip artifacts then parse
- `max_results: "5"` — string instead of int, coerce

### 4. Response Truncation
- Hard cap at 30k chars (~8k tokens) per tool response
- Model tried to read entire books via `vault_read` (wrong tool) or `vault_document_read` without section/page
- Truncation message tells model to use section or page parameter

### 5. Per-Tool Prompt Guidelines
Added `promptGuidelines` to critical tools so the model sees usage rules in the system prompt:
- `vault_document_read`: ALWAYS use section or page, this is for BOOKS not notes
- `vault_read`: ONLY for small vault notes, NEVER for library/Books/ paths
- `semantic_search`: max_results 5-10, two-step pattern (search then read)
- `search_all_docs`: results are pointers, follow up with vault_document_read
- `list_documents`: never expand_all=true
- `vault_list`: always specify domain

### 6. Resilience Features
- **Auto-retry**: on session errors or connection failures, resets session ID, re-initializes MCP, retries once
- **Temperature cap**: `before_provider_request` handler caps at 0.7 (server default was 1.0) to reduce degenerate tool call outputs
- **Error recovery guidance**: `tool_result` handler appends recovery instructions to failed calls

### 7. System Monitor (`extensions/sys-monitor.ts`)
- Started as `setWidget` (belowEditor) — created awkward vertical gap
- Moved to `setStatus` — right region but couldn't center
- Final: `setFooter` replacing default footer, replicating stock layout with monitor centered between token stats and model name
- Multi-gradient bars: `muted` <70%, `warning` 70-90%, `error` >90%
- Thin `▕▏` caps (reliably single-width unlike box-drawing chars which threw off centering)
- `borderAccent`/`borderMuted` for fill/empty initially too bright, toned to `muted`/`dim`

### 8. Approval Gate (`extensions/approve-edits.ts`)
- Pi has no built-in permission mode like Claude Code
- Simple extension: `tool_call` event intercepts edit/write/bash, shows Yes/No select dialog
- Toggle by renaming/deleting the file

### 9. AGENTS.md (equivalent of CLAUDE.md)
- Initially put in a skill (`mcp-local/SKILL.md`) — WRONG, skills load on demand
- Pi auto-loads `AGENTS.md` (or `CLAUDE.md`) from `~/.pi/agent/` — same as Claude Code's CLAUDE.md
- Moved content to `~/.pi/agent/AGENTS.md`
- Research workflow went through several iterations:
  - v1: vault notes → keyword search → read source → semantic search → web (WRONG — model was doing vault search first for book lookups)
  - v2: semantic_search → vault_document_read → vault notes → keyword → web (vault notes shouldn't be in research pipeline at all)
  - v3 (final): semantic_search → vault_document_read → keyword search → web

### 10. Skills & Prompts Ported from Claude Code
- Commands → `prompts/*.md` (invoked via `/name`)
- Skills → `skills/*/SKILL.md` (loaded via `/skill:name`)
- Removed: assist (redundant), reindex (simple bash), crawl/arxiv/pubmed (larger model tasks), security-audit, symbols, agent-check, briefing, security-intel
- Kept: resources, vault, research, debug, capture, spec, pr-review, codebase-review, prompt-review
- Adaptations: `mcp__docs__` → `docs_` prefix, removed multi-agent panel reviews, removed Gemini adversarial phases, removed Skill()/Agent()/AskUserQuestion calls

### 11. Auto-Start Extension (removed)
- Tried `sendUserMessage("Ready.")` — model treated it as user input and waited
- Tried `ctx.ui.notify()` — worked but added complexity
- Removed entirely — was interfering with session loading

## Known Issues

1. **Degenerate tool call output** — Gemma 4 31B occasionally generates raw `<|tool_call>` tokens instead of structured calls, especially after a failed call or mid-thought. Temperature cap at 0.7 helps but doesn't eliminate it.
2. **vault_read vs vault_document_read confusion** — despite explicit guidelines, the model sometimes uses `vault_read` for books. The guidelines help but a 31B model doesn't always follow them.
3. **Object-wrapped parameters** — the `prepareArguments` shim catches most patterns but new variants may appear.

## File Locations

### Repository
`~/Documents/Development/typescript/pi-mcp-local/`

### Live config (installed)
- `~/.pi/agent/AGENTS.md`
- `~/.pi/agent/models.json`
- `~/.pi/agent/settings.json`
- `~/.pi/agent/extensions/mcp-docs/index.ts`
- `~/.pi/agent/extensions/sys-monitor.ts`
- `~/.pi/agent/extensions/approve-edits.ts`
- `~/.pi/agent/skills/resources/SKILL.md`
- `~/.pi/agent/skills/vault/SKILL.md`
- `~/.pi/agent/prompts/*.md` (7 files)

### Vault documentation
`pi/` domain in Knowledge vault (7 notes)

## What's Next

- Push repo to GitHub for portable installs (`pi install git:github.com/dallasmarlow/pi-mcp-local`)
- Consider making MCP_URL and MCP_TOKEN configurable via env vars instead of hardcoded
- Monitor the `prepareArguments` shim for new argument mangling patterns
- Test with other models as they become available on M1:S1
