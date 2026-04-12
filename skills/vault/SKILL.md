---
name: vault
description: Obsidian vault management for structured knowledge storage
---

# Vault Skill

Manages an Obsidian vault as a structured knowledge base with domain isolation.

**Read-only tools** (always available): `docs_vault_list`, `docs_vault_read`, `docs_vault_search`
**Write tools** (this skill): `docs_vault_write`, `docs_vault_move`

## Tools

### docs_vault_write
Create or update a note with auto-generated frontmatter.
```
docs_vault_write(path="agents/adk/tool-patterns.md", title="ADK Tool Patterns",
                 content="...", tags=["adk", "tools"], source="https://...")
```

### docs_vault_move
Move or rename a note with automatic link updates.
```
docs_vault_move(source="agents/old.md", destination="agents/new.md", update_links=true)
```

## Domain Isolation

Top-level folders are independent knowledge silos:
```
Knowledge/
  agents/           # Domain
    adk/
      getting-started.md
  cooking/          # Separate domain
  _templates/       # Excluded from enforcement
```

Rules:
- Top-level folders (excluding `.obsidian/` and `_`-prefixed) are domains
- Wikilinks validated within same domain
- Cross-domain links produce advisory warnings

## Frontmatter Schema

Auto-generated:
```yaml
---
title: "Getting Started with ADK"
domain: agents/adk
tags: [adk, agents]
created: 2026-03-13T10:30:00+00:00
modified: 2026-03-13T10:30:00+00:00
source: ""
aliases: []
---
```
