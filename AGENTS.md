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
performance over the session. Do not skip ahead.

Non-trivial tasks require research before code. Trivial tasks (typo, rename, one-liner) skip this.

## For code tasks

**Step 0 -- Symbol search FIRST** (mandatory before reading code)
Do not read files to orient yourself. The symbol index exists to prevent that.

- `docs_search_symbols(query="handler")` -- find classes, functions, methods by name
- `docs_search_symbols(kind="class", module="src/adapters")` -- map all classes in a module
- `docs_get_dependencies(module="src/server.py")` -- see imports and dependents

Pattern: search symbols -> read that specific line range -> get_dependencies if needed.
Never read an entire file to "understand the codebase".

## For research tasks

**Step 1 -- MCP docs** (patterns, principles, architecture)
Two-stage retrieval, always:
  `docs_semantic_search(query="CQRS event sourcing patterns", max_results=5)` -- returns breadcrumbs
  `docs_vault_document_read(file_path="Books/microservice-pattern.pdf", section="Using the CQRS pattern")` -- returns full text
  `docs_vault_document_read(file_path="Books/microservice-pattern.pdf", page=228)` -- or by page number
Never skip stage two. Breadcrumbs alone lack implementation detail.
ALWAYS pass section as a plain string. ALWAYS specify section OR page.

**Step 2 -- Keyword search** (exact terms, error messages, function names)
- `docs_search_all_docs(query="CQRS")` -- FTS5 keyword search
- Returns snippets with page numbers. Use page numbers in step 1's vault_document_read.

**Step 3 -- Web search** (fill gaps, live docs, current APIs)
Use when MCP docs lack coverage. Validates and reinforces, doesn't replace.

**Enforcement:** Non-trivial tasks with step 1 skipped --
output "I need to research before implementing. Proceed with search?"

Query construction -- use 3-5 specific keywords, not vague single words.
Good: "dependency inversion interface abstraction layers"
Bad: "architecture"

---

# Tools Reference

All MCP tools are prefixed `docs_` and available via the MCP docs extension.

Document library (books, papers, articles -- the research pipeline):
- `docs_semantic_search` -- AI embedding + CrossEncoder reranking, concepts and patterns
- `docs_vault_document_read` -- full section retrieval after semantic_search identifies a document
- `docs_search_all_docs` -- FTS5 keyword search, exact errors and identifiers
- `docs_list_code_examples` -- code from authoritative books, filter by language
- `docs_list_documents` -- document inventory by category

Codebase navigation:
- `docs_search_symbols` -- FTS5 on symbol names, signatures, docstrings
- `docs_get_dependencies` -- module import/dependent graph

Personal notes (user's Obsidian vault -- NOT part of the research pipeline):
- `docs_vault_search` -- "do I have a note on X?" lookup by content/tags
- `docs_vault_read` -- read a specific vault note with metadata
- `docs_vault_list` -- browse note domains and inventory
- `docs_vault_write` -- create or update vault notes (title, content, path, tags as SEPARATE params)
- `docs_vault_move` -- move or rename vault notes

LSP (TypeScript language intelligence -- use for navigating code without reading whole files):
- `lsp_diagnostics` -- type errors and warnings for a file. Use after edits to verify correctness.
- `lsp_definition` -- go to definition of a symbol at line:character
- `lsp_hover` -- type signature and docs at a position
- `lsp_references` -- find all usages of a symbol across the project

Precision editing:
- `hash_edit` -- edit using line content hashes as anchors. Each line in read output has a 6-char hash prefix. Use when standard edit has whitespace or ambiguity issues.

## Critical: vault_read vs vault_document_read

These are DIFFERENT tools for DIFFERENT things:
- `docs_vault_read` -- small vault NOTES only (pi/, development/, reference files/ domains)
- `docs_vault_document_read` -- BOOKS and DOCUMENTS (library/ domain, PDFs). Always use section= or page=.
- If a path contains `library/Books/` -- use `docs_vault_document_read`, never `docs_vault_read`.

---

# Project Rules

- Cite sources in conversation when applying principles (never in code comments)
- No emojis in code, comments, or documentation
- No git commands unless explicitly requested
- Use `/spec` for structured research (loads `/skill:resources`, enforces full research order)
