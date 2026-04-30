---
name: code-graph
description: Code-graph bridge toolkit. Symbol search, call-graph navigation, code communities, cross-graph linking. Loaded on demand by other skills after they probe the bridge with docs_cg_search and confirm it is up. Most repos do NOT have the bridge configured -- never load this skill without confirming the probe succeeded.
---

# Code-Graph Bridge

Optional toolkit for repositories enrolled in code-graph (the upstream MCP
server has `CODE_GRAPH_URL` set, and `code-graph index` has been run on the
target repo). Most repos won't have it.

pi-mcp-local also has LSP available for TypeScript code intel
(`lsp_diagnostics`, `lsp_definition`, `lsp_hover`, `lsp_references`). The
code-graph bridge complements LSP -- LSP is per-file and TypeScript-specific,
while code-graph is whole-repo, cross-language, and call-graph aware.

---

## Loading discipline

Don't `/skill:code-graph` blindly. Probe first:

```
docs_cg_search(query="<a symbol you expect to exist>")
  -> "code-graph not reachable" / empty for known symbol
       -> bridge unavailable. Stay in LSP + Grep + Read fallback.
          Don't load this skill.
  -> hits returned -> bridge is up. /skill:code-graph to unlock the rest.
```

Loading this skill before the probe wastes context on tools you can't use.

---

## Tools by capability

### Symbol navigation (always available when bridge is up)

- `docs_cg_search(query, limit=25)` -- FTS5 substring search over symbol
  names + signatures. Returns `id` + `stable_id` + `file:line` + signature.
- `docs_cg_get_symbol(id=N)` or `docs_cg_get_symbol(stable_id=...)` -- full
  symbol card + 1-hop neighborhood (incoming/outgoing edges). Stable ids
  survive re-indexes; numeric ids do not.
- `docs_cg_reachability(id, direction, depth=20)` -- N-hop call-graph flood.
  `direction="forward"` = transitive callees (fan-out).
  `direction="backward"` = transitive callers (fan-in / blast radius).
  `direction="both"` = both.
- `docs_cg_adjacency(id)` -- siblings sharing callers. Surfaces "we already
  have a util for this" candidates before rebuilding.
- `docs_cg_orphans()` / `docs_cg_unused_exports()` -- dead-code filters.
  Symbols with zero in/out, and exports never imported.

### Code communities (after `code-graph build-communities` + `build-summaries`)

- `docs_cg_communities_at_level(level=1, limit=20)` -- browse subsystems.
  L0 = coarse (10-25 broad subsystems), L1 = medium (sweet spot for
  "show me the architecture"), L2 = fine (tight cliques).
- `docs_cg_community(community_id=N)` -- full member list + files for one
  community.
- `docs_cg_symbol_community(id=N, level=null)` -- which subsystem(s) does
  this symbol belong to.
- `docs_cg_communities_for_files(files=[...], level=1)` -- given paths,
  which subsystems do they touch.
- `docs_cg_search_communities(query, level=null, limit=5)` -- semantic
  search over LLM-generated community summaries. Needs `code-graph
  build-embeddings`.

### Cross-graph (after `mcp-docs-extract-entities link-cross-graph`)

- `docs_cg_links_for_community(community_stable_id, code_repo_root=null)`
  -- doc-side entities + communities linked to a code subsystem by
  embedding similarity.
- `docs_cg_links_for_doc(name=..., doc_id=..., doc_kind="entity"|"community")`
  -- reverse: code subsystems implementing a doc concept.

---

## Common patterns

**Locate a symbol and read its slice:**
```
docs_cg_search(query="<term>")           -> capture id
docs_cg_get_symbol(id=N)                 -> full card + neighborhood
Read(file, offset=line-5, limit=30)
```

**Blast-radius for a signature change:**
```
docs_cg_reachability(id=N, direction="backward")  # fan-in callers
```

**"What subsystem does this code live in?":**
```
docs_cg_communities_for_files(files=["src/foo.ts", "src/bar.ts"], level=1)
```

**"Where does the codebase implement <doc concept>?" (cross-graph):**
```
docs_cg_links_for_doc(name="Saga", doc_kind="entity")
```

---

## When the relevant build hasn't been run

Each capability layer is gated on a separate build step:
- Symbol navigation requires `code-graph index` on the target repo (mandatory).
- Communities require `code-graph build-communities`. Without it,
  `docs_cg_symbol_community` / `docs_cg_community` / `docs_cg_communities_at_level`
  work but summaries show "(no summary yet)". Run `build-summaries` to fill them.
- `docs_cg_search_communities` additionally requires `build-embeddings`.
- Cross-graph (`docs_cg_links_*`) requires `mcp-docs-extract-entities
  link-cross-graph --code-repo-root <path>`.

Tools degrade gracefully: missing build = empty result with a hint. Don't
block the workflow on missing builds -- surface the gap and continue with
what's available.

---

## Bridge vs LSP -- when to use which

Both surfaces help you avoid reading whole files. Pick by what you're asking:

| Question | Use |
|---|---|
| "Where is symbol X defined?" | `lsp_definition` (TypeScript only) or `docs_cg_search` + `docs_cg_get_symbol` |
| "What's the type signature here?" | `lsp_hover` |
| "Who calls X across the project?" | `lsp_references` (TypeScript only) or `docs_cg_reachability(direction="backward")` |
| "Type errors in this file?" | `lsp_diagnostics` |
| "What subsystem is X part of?" | `docs_cg_symbol_community` (LSP can't do this) |
| "What other utils share my callers?" | `docs_cg_adjacency` (LSP can't do this) |
| "Cross-language symbol search" | `docs_cg_search` (LSP is per-language) |
| "Dead code detection" | `docs_cg_orphans` / `docs_cg_unused_exports` |
| "Doc concepts implemented here" | `docs_cg_links_for_doc` (cross-graph) |

**Rule of thumb:** prefer LSP for in-file TypeScript work; reach for the
bridge for whole-repo / cross-language / architectural questions.
