# Code Quality

Principles -- each with WHY so you can generalize to edge cases.

**One thing well.** Functions, classes, modules do one thing.
WHY: mixed concerns hide bugs and resist testing.

**Exceptions over return codes.** Separate error handling from business logic.
WHY: return-code checking clutters the caller, easy to forget.

**Fail fast at boundaries.** Validate user input and external APIs. Trust internal code.
WHY: defensive coding inside trusted boundaries adds noise without preventing real failures.

**DRY, not dogmatically.** Eliminate duplication through abstraction -- but three similar lines
beat a premature abstraction.
WHY: over-decomposition creates indirection without value. Even SRP can be taken too far.

**No speculative design.** Don't add features, configurability, or abstractions beyond what was asked.
No helpers for one-time operations. No future-proofing.
WHY: wrong abstractions are harder to fix than duplication.

**Minimal diff.** Bug fix means fix the bug. Don't clean surrounding code, add docstrings to
unchanged functions, or refactor adjacent modules.
WHY: scope creep obscures review and introduces risk.

**Broken windows.** Bad code tempts more bad code. If you touch a file, leave it no worse.

**Read before write.** Never propose changes to unread code. Understand existing patterns first.

Anti-patterns -- things that trigger rework:
- Error handling for scenarios that can't happen
- Backwards-compat shims when you can change the code
- Comments or docstrings on code you didn't change
- Mocking databases in integration tests (unless asked)
- Renaming unused `_vars` or `// removed` markers -- delete cleanly
- Creating helpers/utilities for one-time operations

---

# Research Workflow

Context is the scarcest resource. Every file read, every broad search burns tokens that degrade
performance over the session. The search order below is ranked by cost -- cheapest and most
targeted first, broadest last. Do not skip ahead.

Non-trivial tasks require research before code. Trivial tasks (typo, rename, one-liner) skip this.

## Step 0 -- Symbol search FIRST (mandatory before reading code)

Do not read files to orient yourself. The symbol index exists to prevent that.
Use it to find exact locations, then read only the specific lines you need.

Navigate code (before opening any file):
- `docs_search_symbols(query="handler")` -- find classes, functions, methods by name, line, signature
- `docs_search_symbols(kind="class", module="src/adapters")` -- map classes in a module without reading it
- `docs_get_dependencies(module="src/server.ts")` -- see imports and dependents before tracing call chains

The pattern:
1. `docs_search_symbols` to find the symbol and its exact location
2. `Read(file, offset=line-5, limit=30)` to see only the relevant code
3. `docs_get_dependencies` if you need to understand what connects to it

Never: `Read` an entire file to "understand the codebase". Always: search symbols, read the slice.

## Step 1 -- MCP docs (patterns, principles, architecture)

Two-stage retrieval, always:
```
docs_semantic_search(query="CQRS event sourcing patterns", max_results=5)   -- breadcrumbs
docs_vault_document_read(file_path="Books/microservice-pattern.pdf",
                         section="Using the CQRS pattern")                  -- full text
docs_vault_document_read(file_path="Books/microservice-pattern.pdf",
                         page=228)                                          -- or by page
```

Never skip stage two. Breadcrumbs alone lack implementation detail.
ALWAYS pass section as a plain string. ALWAYS specify section OR page.

## Step 1.5 -- Graph exploration (entity + community layer, GraphRAG)

Route by query shape, not as a default override:
- User names a specific person / technique / concept ->
  `docs_entity_lookup(name)` FIRST for a typed identity card, before chunk retrieval.
- Broad topical survey ("what does the corpus say about X")? ->
  `docs_search_communities(query)` FIRST. Each hit is a pre-condensed LLM summary of a cluster --
  one call often replaces 10+ `docs_semantic_search` + `docs_vault_document_read` pairs.
- "What else relates to X?" / "Who introduced Y?" ->
  `docs_entity_neighbors(name=...)`, optionally filtered by `rel_type`.
- "Which documents discuss X?" -> `docs_documents_mentioning(name=...)` -- density-sorted list.
- Anchored chunk retrieval: once you know the entity, use
  `docs_semantic_search(query=..., entity=X)` -- the entity filter prunes ~90% of chunks before
  the reranker, sharpening the shortlist.

Graph tools return nothing useful until extraction has run against the corpus -- if they're
empty, fall through to Step 1. Nothing here writes; these are all read tools.

## Step 2 -- Keyword search (exact terms, error messages, function names)

- `docs_search_all_docs(query="CQRS")` -- FTS5 keyword search
- Returns snippets with page numbers. Use page numbers in Step 1's `vault_document_read`.

## Step 3 -- Context7 (library APIs, framework syntax)

Skip if Step 1 gave complete implementation details with code examples.
- `mcp__plugin_context7_context7__resolve-library-id(name)` then `query-docs(id, question)`
Especially valuable for TypeScript stacks: Vite, React, Node APIs, type-system idioms.
Not for: architecture decisions, design patterns (use MCP docs for those).

## Step 4 -- Web search (fill gaps, live docs, current APIs)

Use when MCP docs and Context7 lack coverage. Validates and reinforces, doesn't replace.
- `web_search(query="SearXNG API JSON format", max_results=10)` -- Google/DuckDuckGo/Brave/Wikipedia/GitHub
- `web_fetch(url="https://example.com/docs")` -- fetch and extract text from a URL

## Enforcement

Non-trivial tasks with Steps 0-1 skipped --
output "I need to research before implementing. Proceed with search?"

Query construction -- use 3-5 specific keywords, not vague single words.
Good: "dependency inversion interface abstraction layers"
Bad: "architecture"

---

# Tools Reference

All MCP docs tools are prefixed `docs_` and available via the MCP docs extension.

## Document library (books, papers, articles -- the research pipeline)

- `docs_semantic_search` -- AI embedding + CrossEncoder reranking, concepts and patterns.
  Filters: `entity=X` restricts to docs mentioning an entity; `link_boost=true` favors
  entity-dense chunks in the rerank.
- `docs_vault_document_read` -- full section or page retrieval after semantic_search identifies a document
- `docs_search_all_docs` -- FTS5 keyword search, exact errors and identifiers
- `docs_list_code_examples` -- code from authoritative books, filter by language
- `docs_list_documents` -- document inventory by category
- `docs_get_document_metadata` -- document details (pages, size, frontmatter)

## Graph / community layer (GraphRAG -- read-only, use by query shape)

- `docs_entity_lookup` -- typed entity card (name, type, mention count, first-seen doc)
- `docs_entities_in_document` -- who/what index for one doc (optional section scope)
- `docs_entity_neighbors` -- one-hop traversal over typed relations (INTRODUCES, CITES, REPLACES, ...)
- `docs_documents_mentioning` -- distinct docs that mention an entity, density-sorted
- `docs_entity_community` -- which Leiden communities contain an entity, with summaries
- `docs_search_communities` -- semantic search over community summaries (cheap topical orientation)

## Codebase navigation

- `docs_search_symbols` -- FTS5 on symbol names, signatures, docstrings
- `docs_get_dependencies` -- module import/dependent graph
- `docs_analyze_codebase` -- full codebase analysis, persists to index (skill-gated via `/skill:symbols`)
- `docs_extract_symbols` -- ephemeral tree-sitter parse (skill-gated via `/skill:symbols`)
- `docs_capture_status` -- diff vault notes against symbol index hashes

## Personal notes (user's Obsidian vault -- NOT part of the research pipeline)

- `docs_vault_search` -- "do I have a note on X?" lookup by content/tags
- `docs_vault_read` -- read a specific vault NOTE with metadata
- `docs_vault_list` -- browse note domains and inventory
- `docs_vault_write` -- create or update vault notes (skill-gated via `/skill:vault`)
- `docs_vault_move` -- move or rename vault notes (skill-gated via `/skill:vault`)

## Peer review (second-opinion LLM)

- `docs_assist` -- local Gemma 4 code reviewer via llama-server (skill-gated via `/skill:assist`).
  Replaces subagent panel reviewers in `/pr-review` and `/codebase-review`.

## Security audit

- `docs_audit_repo_security` -- full dependency security audit (skill-gated via `/skill:security-audit`)

## LSP (TypeScript language intelligence -- navigate code without reading whole files)

- `lsp_diagnostics` -- type errors and warnings for a file. Use after edits to verify correctness.
- `lsp_definition` -- go to definition of a symbol at line:character
- `lsp_hover` -- type signature and docs at a position
- `lsp_references` -- find all usages of a symbol across the project

## Precision editing

- `hash_edit` -- edit using line content hashes as anchors. Each line in read output has a
  6-char hash prefix. Use when standard edit has whitespace or ambiguity issues.

## Web (SearXNG metasearch -- local, no API keys)

- `web_search` -- search Google, DuckDuckGo, Brave, Wikipedia, GitHub. Returns titles, URLs, snippets.
  Params: query (required), max_results (default 10), categories ("general", "it", "science", "news").
- `web_fetch` -- fetch a URL and extract text content. Use after `web_search` to read full pages.
  Params: url (required), max_length (default 15000).

## External peer LLM (adversarial review)

- `gemini` CLI -- used by `/skill:gemini` and the adversarial phases of `/pr-review`, `/codebase-review`,
  `/research`, and `/prompt-review`. Runs in a fresh context with filesystem access and ~1M-token window.

## Critical: vault_read vs vault_document_read

These are DIFFERENT tools for DIFFERENT things:
- `docs_vault_read` -- small vault NOTES only (pi/, development/, reference files/ domains)
- `docs_vault_document_read` -- BOOKS and DOCUMENTS (library/ domain, PDFs). Always use section= or page=.
- If a path contains `library/Books/` -- use `docs_vault_document_read`, never `docs_vault_read`.

---

# Skill Invocation Reference

Available skills (loaded from `skills/`, invoked via `/skill:<name>`):

- `/skill:resources` -- MCP docs library reference: book inventory, search strategies, domain mapping
- `/skill:vault` -- write / move vault notes (gates `docs_vault_write`, `docs_vault_move`)
- `/skill:symbols` -- tree-sitter extraction (gates `docs_extract_symbols`, `docs_analyze_codebase`)
- `/skill:assist` -- local Gemma 4 peer reviewer (gates `docs_assist`)
- `/skill:security-audit` -- dependency security audit (gates `docs_audit_repo_security`)
- `/skill:gemini` -- query Gemini CLI for peer review or alternative perspectives
- `/skill:scrutinize` -- single source of truth for the 7-pass adversarial review methodology
- `/skill:agent-check` -- structural checklist for ADK agent repos
- `/skill:agent-review` -- 3-persona consensus review via local Gemma panels

Available prompts (slash commands, registered from `prompts/`):

- `/capture` -- extract codebase knowledge into Obsidian vault
- `/codebase-review` -- 9-phase codebase audit delegating to `/skill:scrutinize`
- `/debug` -- systematic debugging (Agans 9 Rules, Zeller scientific method)
- `/pr-review` -- deep PR review with deterministic gates, scrutinize 7-pass, test enforcement
- `/prompt-review` -- analyze prompts for redundancy, weak enforcement, verbosity
- `/research` -- multi-source research pipeline (MCP docs -> articles -> web -> Gemini)
- `/spec` -- enter specification mode with structured research workflow

---

# Project Rules

- Cite sources in conversation when applying principles (never in code comments)
- No emojis in code, comments, or documentation
- No git commands unless explicitly requested
- Use `/spec` for structured research (loads `/skill:resources`, enforces full research order)
- `/scrutinize` is the single source of truth for adversarial review -- edits propagate to
  `/codebase-review` and `/pr-review` which delegate to it
