---
name: vault
description: Obsidian vault management for structured knowledge storage
---

# Vault Skill

Manages an Obsidian vault as a structured knowledge base with domain isolation.
Top-level folders are independent knowledge silos.

**Read-only tools** (always available, no skill needed): `docs_vault_list`, `docs_vault_read`, `docs_vault_search`
**Write tools** (require this skill): `docs_vault_write`, `docs_vault_move`

---

## Tools

### docs_vault_write

Create or update a note with auto-generated frontmatter.

```
docs_vault_write(
    path="agents/adk/tool-patterns.md",
    title="ADK Tool Patterns",
    content="...",
    tags=["adk", "tools"],
    source="https://...",
    aliases=[...],
    source_modules=["src/file.ts", ...],
    source_hashes={"src/file.ts": "<hash>"}
)
```

- Generates YAML frontmatter (title, domain, tags, timestamps)
- On update: preserves `created`, updates `modified`
- Validates wikilinks within domain, warns on cross-domain
- `source_modules` + `source_hashes` enable `docs_capture_status` to detect stale notes

### docs_vault_move

Move or rename a note with automatic link updates.

```
docs_vault_move(source="agents/old.md", destination="agents/new.md", update_links=true)
```

- Rewrites inbound wikilinks in other notes
- Updates frontmatter domain
- Warns on cross-domain moves

---

## Domain Isolation

```
~/Documents/Obsidian/Knowledge/
  agents/           # Domain
    adk/
      getting-started.md
  development/      # Separate domain (no cross-links by default)
  library/          # Books and documents (read via docs_vault_document_read)
  _templates/       # Excluded from domain enforcement
  .obsidian/        # Never touched
```

Rules:
- Top-level folders (excluding `.obsidian/` and `_`-prefixed) are domains
- Wikilinks validated within same domain
- Cross-domain links produce advisory warnings (not blocking)

---

## Frontmatter Schema

Auto-generated on every note:
```yaml
---
title: "Getting Started with ADK"
domain: agents/adk
tags: [adk, agents]
created: 2026-03-13T10:30:00+00:00
modified: 2026-03-13T10:30:00+00:00
source: ""
aliases: []
source_modules: []
source_hashes: {}
---
```

`source_modules` and `source_hashes` are populated by `/capture` and consumed by
`docs_capture_status` to detect which notes have gone stale relative to the code.

---

## Critical: vault_read vs vault_document_read

- `docs_vault_read` -- small vault NOTES (this skill's domain)
- `docs_vault_document_read` -- BOOKS and DOCUMENTS (library/ domain, PDFs).
  Always use `section=` or `page=`.
- If a path contains `library/Books/` -- use `docs_vault_document_read`, never `docs_vault_read`.
