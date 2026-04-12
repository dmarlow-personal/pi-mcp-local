---
description: Extract codebase knowledge into Obsidian vault as organized, cross-linked notes
---

Extract development knowledge from the current codebase into the Obsidian vault.

**Input**: $ARGUMENTS -- path to target repo (defaults to current directory).

## Data Sanitization

All notes MUST be company-agnostic. The vault is personal.

**Exclude:** company/team names, internal URLs/IPs, proprietary logic, credentials.
**Capture (generalized):** architectural patterns, tech stack, code conventions, testing strategies.
Replace company names with generic terms. Focus on "how" and "why", not "who" or "where".

## Stage 1: Reconnaissance

1.1: Read project metadata in parallel: `pyproject.toml`, `package.json`, `go.mod`, `Makefile`, `README.md`, `docker-compose.yml`

1.2: Scan directory structure via glob patterns

1.3: Analyze codebase (if Python/Rust):
`docs_analyze_codebase(path=".", language="<detected>")`

1.4: Detect patterns: project slug, language/framework, architecture, key subsystems

1.5: Propose 5-15 note topics:
- Overview, Architecture, Components (2-6), Configuration, Dev Workflow

## Stage 2: Plan (CHECKPOINT -- user approval required)

Show: project metadata, proposed notes, detected sensitive entities, estimated wikilinks.
Ask: approve / change domain / modify notes / cancel.

## Stage 3: Extraction and Writing

For each topic, read only relevant files. Write notes:
```
docs_vault_write(
    path="{domain}/{slug}/{slug}-{topic}.md",
    title="{Project} - {Topic}",
    content="...",
    tags=[...],
    source_modules=["src/file.py", ...],
    source_hashes={"src/file.py": "<hash>"}
)
```

Tag strategy: `project/{slug}`, `tech/{name}`, concept tags. Max 8 per note.
Wikilinks: overview as hub, cross-references, "See Also" sections.
Include Mermaid diagrams for architecture notes.

## Stage 4: Summary

Report: notes written, total words, wikilinks, tags, source coverage.

## Variations

```
/capture                          # Default: analyze current codebase
/capture --domain infrastructure  # Different vault domain
/capture --dry-run                # Stages 1-2 only, no writes
/capture --status                 # Check stale notes via docs_capture_status
/capture --update                 # Selective update of stale notes
```
