---
description: Extract codebase knowledge into Obsidian vault as organized, cross-linked notes
---

Extract development knowledge from the current codebase into the Obsidian vault.

**Input**: `$ARGUMENTS` -- path to target repo (defaults to current directory).

**Skills required:**
```
/skill:vault
/skill:symbols
```
Stop after each call. Wait for tool results.

---

## Data Sanitization

All notes MUST be company-agnostic. The vault is personal.

**Exclude:** company/team/employee names, internal URLs/IPs, proprietary business logic,
client data, ticket IDs, credentials, infrastructure details (AWS accounts, cluster names).

**Capture (generalized):** architectural patterns, tech stack choices, code conventions,
testing strategies, deployment patterns, configuration patterns.

**Rules:** Replace company names with generic terms. Replace internal URLs with `example.com`.
Describe patterns abstractly. Focus on "how" and "why", not "who" or "where". When in
doubt, omit.

---

## Stage 1: Reconnaissance (automated)

### 1.1: Read project metadata
Try in parallel: `pyproject.toml`, `package.json`, `go.mod`, `Cargo.toml`, `Makefile`,
`README.md` (first 100 lines), `docker-compose.yml`, `.env.example`.
Extract: project name, language, dependencies, scripts.

### 1.2: Scan directory structure
Glob patterns to map major modules: `src/**/*.py`, `lib/**/*.ts`, `cmd/**/*.go`.

### 1.3: Analyze codebase (symbols + dependencies)
If supported language (Python `.py`, Rust `.rs`):

**Local mode** (default): Try `docs_analyze_codebase(path=".", language="<detected>")` first.

**Remote fallback**: If path-based analysis fails with "Directory not found" or "Path not
found" (happens when Claude Code runs on a different machine than the MCP server), switch
to sources-based extraction:
1. Glob for source files matching the detected language
2. Read each file's content (respect limits: max 500 files, 10 MB per file)
3. Build a sources dict mapping relative paths to file content
4. Call `docs_analyze_codebase(sources={...}, language="<detected>", project_root="<project-name>")`

**Force remote** (`--remote` flag): Skip the local attempt, go directly to sources-based mode.

Store dependency edges, module symbol counts, public API symbols for Stage 3.

### 1.4: Detect patterns
From metadata and structure, identify: project slug (lowercase, hyphenated, 1-3 words),
language/framework, architecture pattern, key subsystems, testing approach, build tooling.

### 1.5: Scan for sensitive entities
Before proceeding, scan for company names, internal URLs, employee names, API keys.
Record as redaction list for Stage 2.

### 1.6: Propose 5-15 note topics

Core set:
- Overview -- purpose, tech stack, structure, key concepts (1 note)
- Architecture -- layers, patterns, data flow, key decisions (1 note)
- Components -- major subsystems worth own note (2-6 notes)
- Configuration -- env vars, deployment, containers (1 note)
- Dev Workflow -- testing, linting, CI/CD (1 note)

Detection-driven add-ons (only when files match):
- **Knowledge-graph layer** (1 note) -- when codebase contains entity/community
  detection (e.g., `entity_index`, `community_builder`, Leiden, GraphRAG).
- **Eval / benchmark harness** (1 note) -- when `eval/`, `benchmarks/`, or `tests/eval/`
  exists. Document gold-set schema, metric definitions, baseline capture, regression gate.
- **External services** (1 note) -- when codebase orchestrates multiple long-running
  processes (containers, sidecars, llama-server / vLLM endpoints, separate inference
  services). Pull out of Configuration when 3+ distinct services exist.
- **MCP / agent tool surface** (1 note) -- when codebase exposes tools via FastMCP,
  Anthropic SDK, or similar. Document tool inventory, arg-validation pattern,
  registry/handler dispatch.

Merge topics with <200 words. Split topics with >1500 words.

---

## Stage 2: Plan Presentation (CHECKPOINT -- user approval required)

Show:
1. Project metadata (name, slug, domain, language, framework)
2. Proposed notes (filename, description, tags per note)
3. Detected sensitive entities (with redaction plan)
4. Estimated wikilink count

Ask user: approve / change domain / modify notes / cancel.

---

## Stage 3: Extraction and Writing (automated)

### Strategic file reading
Do NOT read every file. Per topic:
- Overview: entry points, main module, README
- Architecture: core interfaces, base classes, DI setup
- Components: only files relevant to that component
- Config: config files, env templates, docker files
- Dev workflow: CI config, test config, Makefile

### Naming
Pattern: `{project-slug}-{topic-slug}.md`
- Lowercase, hyphenated, 1-3 words per slug, max 5 words total
- Never single-word filenames

### Folder structure
`{domain}/{project-slug}/` with flat notes inside. No deeper nesting.

### Write each note
```
docs_vault_write(
    path="{domain}/{slug}/{slug}-{topic}.md",
    title="{Project} - {Topic}",
    content="...",
    tags=[...],
    aliases=[...],
    source_modules=["src/file.py", ...],
    source_hashes={"src/file.py": "<hash>"}
)
```

Source tracking: query the symbol index for each module's content hash. Enables
incremental updates via `docs_capture_status`.

Report progress: `[1/8] Wrote {slug}-overview.md (425 words, 5 outgoing links)`.

### Tag strategy (3 tiers, auto-derived)
- `project/{slug}` + `status/automated` on every note
- `tech/{name}` from dependency files
- `{concept}` inferred from code patterns
- Max 8 tags per note

### Wikilink strategy
- Overview note is the hub -- links to all others
- Every non-overview note links back to overview
- Cross-references between related notes
- Every note gets "See Also" section at bottom

### Mermaid diagrams
For architecture and data flow notes, include Mermaid diagrams (Obsidian renders
natively). Generate for: component/layer diagrams, sequence/flowcharts, processing
stage diagrams.

### Symbol tables
Append Symbol Index section to component notes. Query `docs_search_symbols(module="...")`
for each covered module. Include public symbols only (classes, functions, constants).
Cap at 20 symbols per note.

### Source coverage report
After all notes: `Source Coverage: 45/52 modules (87%)`.

### Graph-aware enrichment (post-write, optional)

When the document corpus's entity graph has been built, each newly-written note can be
enriched with "Related entities" wikilinks pointing at the broader knowledge graph.

For each written note:
1. Call `docs_entities_in_document(doc_id="<vault-relative path>")`. If the extraction
   pipeline has already processed this note's chunks, this returns the typed entity cast.
2. Filter to entities with mention_count >= 2 across the corpus (skip one-off name
   drops).
3. For each surviving entity, call `docs_entity_lookup(name=...)` and append:

```markdown
## Related Entities
- [[person-<slug>|<Name>]] -- <description> (<mention_count> mentions)
- [[technique-<slug>|<Name>]] -- <description>
```

4. *Optional, when >=3 entities resolve to the same community*:
   call `docs_entity_community(name=<top-mention entity>)` and append a one-line
   community pointer.

Fall through gracefully: if `docs_entities_in_document` returns empty, skip the
enrichment section rather than emitting a stub. Best-effort; never blocks note writing.

---

## Stage 4: Summary

Report: project name, domain, notes written, total words, wikilinks created, tags used.
If replacing previous capture, offer to clean up old notes via `docs_vault_move`.

---

## User Variations

```bash
/capture                          # Default: analyze current codebase
/capture --domain infrastructure  # Different vault domain
/capture --slug my-api            # Override project slug
/capture --dry-run                # Stages 1-2 only, no writes
/capture --status                 # Check stale notes (read-only via docs_capture_status)
/capture --update                 # Selective update of stale notes only
/capture --remote                 # Force sources-based extraction (remote MCP server)
```

---

## Error Handling

- `docs_vault_write` fails: report which note failed, continue with remaining, summarize
  at end
- Sparse metadata: fall back to directory structure analysis, ask user for project name
- Existing notes found: ask user -- overwrite, merge, or skip
