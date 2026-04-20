---
name: symbols
description: Tree-sitter AST symbol extraction and codebase intelligence
---

# Symbols Skill

Extracts AST symbols from source code using tree-sitter and maintains a persistent,
searchable symbol index with dependency graph.

**Note:** `docs_search_symbols` and `docs_get_dependencies` are always available (no skill
invocation needed). This skill is only required for `docs_extract_symbols` and
`docs_analyze_codebase` which perform compute-intensive AST parsing and index writes.

---

## Available Tools

### docs_extract_symbols

Parse source files and return all symbols as structured JSON grouped by module
(ephemeral, no persistence).

```
docs_extract_symbols(
    path: str,                # Directory or single file to extract from
    language: str = "python"  # Programming language: "python" | "rust"
)
```

### docs_analyze_codebase

Full codebase analysis: symbols + imports + dependency graph. Persists results to the
symbol index.

```
docs_analyze_codebase(
    path: str = ".",           # Project root directory
    language: str = "python",  # Programming language: "python" | "rust"
    force: bool = False        # Re-index all files even if unchanged
)
```

**Returns:** JSON summary with module list, dependency edges, and public API count.

### docs_search_symbols (always available)

Query the persistent symbol index using FTS5 full-text search.

```
docs_search_symbols(
    query: str | None = None,      # FTS5 search on name/docstring/signature
    kind: str | None = None,       # Filter: class, function, method, constant, etc.
    module: str | None = None,     # Filter by module path (substring match)
    public_only: bool = True,      # Only public symbols
    max_results: int = 30          # Maximum results
)
```

**Returns:** Markdown table of matching symbols with stable IDs.

### docs_get_dependencies (always available)

Query dependency relationships for a module.

```
docs_get_dependencies(
    module: str,                   # Module relative path (e.g., "src/server.ts")
    direction: str = "both"        # "imports", "imported_by", or "both"
)
```

**Returns:** List of dependent/dependency modules with imported names.

---

## Always-On Index

The symbol index auto-populates on server startup. No need to call `docs_analyze_codebase`
before querying -- `docs_search_symbols` and `docs_get_dependencies` work immediately.

The index is incremental: only changed files are re-parsed on startup.

Invoke this skill when you need to **force** a full reindex or run an ephemeral extraction
against files outside the standard project root.

---

## Symbol Kinds

| Kind | Description | Detection |
|------|-------------|-----------|
| `class` | Regular class | class_definition |
| `dataclass` | @dataclass decorated class | @dataclass decorator |
| `protocol` | Protocol subclass | Protocol in bases |
| `enum` | Enum subclass | Enum/StrEnum/IntEnum in bases |
| `function` | Module-level function | function_definition at module level |
| `method` | Class method | function_definition inside class |
| `constant` | Module-level UPPER_CASE assignment | UPPER_CASE name pattern |
| `type_alias` | Python 3.12+ type alias | type_alias_statement |

---

## Integration with /capture

The `/capture` command uses `docs_analyze_codebase` for richer notes:

1. Calls `docs_analyze_codebase(path=".")` for full CodebaseMap with dependency graph
2. Uses dependency edges to auto-detect component boundaries
3. Generates Mermaid diagrams from real dependency data
4. Uses `docs_search_symbols` and `docs_get_dependencies` per component note

**Symbol table format in notes:**
```markdown
## Symbol Index

Auto-generated via tree-sitter AST extraction.

| Symbol | Kind | Signature |
|--------|------|-----------|
| `VectorStore` | class | `class VectorStore(persist_dir, collection_name)` |
| `search` | method | `def search(query, n_results) -> list[dict]` |
```

**Lookup:** `docs_vault_search(tags=["symbol/class", "project/mcp-server"])`

---

## Composing with the Knowledge Graph

`docs_search_symbols` and the GraphRAG entity tools (`docs_entity_lookup`,
`docs_entity_neighbors`, `docs_documents_mentioning`) live in **separate indexes** and
serve different questions:

| Question | Tool | Index |
|----------|------|-------|
| "Where is class `VectorStore` defined?" | `docs_search_symbols(query="VectorStore")` | tree-sitter symbol index (this codebase) |
| "What does the corpus say about Aggregate?" | `docs_entity_lookup(name="Aggregate")` | extracted-entity SQLite (book/paper corpus) |

When auditing a codebase that *also* discusses concepts the corpus covers, use both:
`docs_search_symbols` for code locations, `docs_entity_lookup` + `docs_semantic_search(entity=...)`
for the conceptual prose. They do not overlap -- names that look the same are not the same record.

---

## Capture Status (Incremental Update Detection)

### docs_capture_status

Check which vault notes are stale after source code changes. Compares `source_hashes` in
vault note frontmatter against current symbol index hashes.

```
docs_capture_status(
    domain: str,           # Vault domain to check (e.g., "development/mcp-server")
    verbose: bool = False  # Show per-module details for stale notes
)
```

**Returns:** Markdown report with stale notes, fresh notes, uncovered modules, and legacy
notes (notes without source tracking).

**Used by:** `/capture --status` (read-only check) and `/capture --update` (selective rewrite).
