---
name: code-graph
description: code-graph reference. Symbol search, call-graph navigation, code communities, community curation. Read-only navigation tools are exposed by the mcp-code-graph extension and callable directly -- load this skill only when you need the write tools (cg_set_community_*) or want the full reference.
---

# code-graph

Symbol-level navigation, call-graph traversal, code-community summaries,
and curation writes for the active repository. Tools are served by a
dedicated MCP server (default `http://127.0.0.1:4753/mcp`, configured
via `PI_CODE_GRAPH_URL` + `PI_CODE_GRAPH_TOKEN`) and exposed by the
`mcp-code-graph` extension with bare `cg_` prefix (no `docs_` wrap).

pi-mcp-local also has LSP available for TypeScript code intel
(`lsp_diagnostics`, `lsp_definition`, `lsp_hover`, `lsp_references`).
code-graph complements LSP -- LSP is per-file and TypeScript-specific,
while code-graph is whole-repo, cross-language, and call-graph aware.

---

## Loading discipline

Two paths:

1. **Read-only navigation** (the common case): the `cg_*` read-only tools
   live directly in the agent's allowed-tools through the extension
   registration. Just call them -- no skill load needed.
2. **Community curation writes or full reference**: load this skill only
   when you need `cg_set_community_summary` / `cg_set_community_keyterms`,
   or when you want the full pattern catalogue and degradation table
   below.

A `cg_search(query="<known symbol>")` returning hits confirms code-graph
is reachable for this repo. If a probe ever returns "code-graph not
reachable" or empty for a known symbol, the target repo isn't enrolled
-- fall back to `lsp_*` (TypeScript) or `Grep` + targeted `Read` for
that session.

---

## Tools by capability

### Symbol navigation (always available when code-graph is reachable)

- `cg_current_selection()` -- what file/symbol the user is looking at in
  the code-graph UI (visual deixis). Default starting move when no
  explicit target was given.
- `cg_search(query, limit=25)` -- FTS5 substring search over symbol
  names + signatures. Requires query length >= 3. Returns `id` +
  `stable_id` + `file:line` + signature.
- `cg_get_symbol(id=N)` or `cg_get_symbol(stable_id=...)` -- full
  symbol card + 1-hop neighborhood (incoming/outgoing edges). Stable
  ids survive re-indexes; numeric ids do not -- prefer `stable_id` for
  cached references.
- `cg_reachability(id, direction, depth=20)` -- N-hop call-graph flood.
  `direction="forward"` = transitive callees (fan-out).
  `direction="backward"` = transitive callers (fan-in / blast radius).
  `direction="both"` = both.
- `cg_adjacency(id)` -- siblings sharing callers. Surfaces "we already
  have a util for this" candidates before rebuilding.
- `cg_orphans()` / `cg_unused_exports()` -- dead-code filters.
  Symbols with zero in/out edges, and exports never imported.

### Code communities (after `code-graph build-communities` + `build-summaries`)

- `cg_communities_for_symbol(id=N, level=null)` -- which subsystem(s)
  does this symbol belong to. Levels: 0=fine, 1=mid, 2=coarse.
- `cg_community(id=N)` or `cg_community(stable_id=...)` -- full member
  list + touched files for one community. Members are paginated
  (default 50/call); use `members_offset` for further pages on large
  clusters.
- `cg_search_communities(query, level=null, limit=10)` -- BM25/FTS5
  search over LLM-generated community summaries + keyterms. Needs
  `code-graph build-embeddings`.
- `cg_stale_communities(level=null, limit=20)` -- communities whose
  `summary_status` is not "fresh", sorted by `member_count DESC`.
  Drives the interactive curation refresh loop.

### Community curation writes (load `/skill:code-graph` to use)

- `cg_set_community_summary(stable_id, summary)` -- overwrite a
  community summary. Flips `summary_status="fresh"` and refreshes the
  FTS index. Idempotent.
- `cg_set_community_keyterms(stable_id, terms)` -- replace the keyterm
  rows for a community with the given `(term, weight)` list. Refreshes
  FTS. Wholesale-replace semantics: existing rows are wiped, even
  those originally written by `build-communities`.

### Cross-graph linking

Moved out-of-band when the in-process bridge retired. Now run via the
CLI on the docs-server host: `mcp-docs-extract-entities
link-cross-graph --code-repo-root <path>`. The previous `cg_links_*`
MCP tools were removed.

---

## Common patterns

**Locate a symbol and read its slice:**
```
cg_current_selection()              # if user said "this"
cg_search(query="<term>")           # -> capture id
cg_get_symbol(id=N)                 # full card + neighborhood
Read(file, offset=line-5, limit=30)
```

**Blast-radius for a signature change:**
```
cg_reachability(id=N, direction="backward")  # fan-in callers
```

**"What subsystem does this symbol live in?":**
```
cg_communities_for_symbol(id=N, level=1)
```

**Curation loop (load this skill first for the write tools):**
```
cg_stale_communities(level=1, limit=20)      # pick a target
cg_community(stable_id=...)                  # inspect members
cg_set_community_summary(stable_id=..., summary="...")
cg_set_community_keyterms(stable_id=..., terms=[{"term":"...","weight":1.0}])
```

---

## When the relevant build hasn't been run

Each capability layer is gated on a separate build step:
- Symbol navigation requires `code-graph index` on the target repo (mandatory).
- Communities require `code-graph build-communities`. Without it,
  `cg_communities_for_symbol` / `cg_community` work but summaries show
  "(no summary yet)". Run `build-summaries` to fill them.
- `cg_search_communities` additionally requires `build-embeddings`.
- Cross-graph links require `mcp-docs-extract-entities link-cross-graph`
  on the docs-server host.

Tools degrade gracefully: missing build = empty result with a hint. Don't
block the workflow on missing builds -- surface the gap and continue with
what's available.

---

## code-graph vs LSP -- when to use which

Both surfaces help you avoid reading whole files. Pick by what you're asking:

| Question | Use |
|---|---|
| "Where is symbol X defined?" | `lsp_definition` (TypeScript only) or `cg_search` + `cg_get_symbol` |
| "What's the type signature here?" | `lsp_hover` |
| "Who calls X across the project?" | `lsp_references` (TypeScript only) or `cg_reachability(direction="backward")` |
| "Type errors in this file?" | `lsp_diagnostics` |
| "What subsystem is X part of?" | `cg_communities_for_symbol` (LSP can't do this) |
| "What other utils share my callers?" | `cg_adjacency` (LSP can't do this) |
| "Cross-language symbol search" | `cg_search` (LSP is per-language) |
| "Dead code detection" | `cg_orphans` / `cg_unused_exports` |
| "What's the user looking at?" | `cg_current_selection` (visual deixis) |

**Rule of thumb:** prefer LSP for in-file TypeScript work; reach for
code-graph for whole-repo / cross-language / architectural questions.
