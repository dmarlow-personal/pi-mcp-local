---
description: Advanced research workflow combining MCP docs and web search
---

Perform comprehensive, multi-source research on: $@

## Phase 1: MCP Documentation Search

**1a. Identify domain** -- map topic to relevant books:
- Python: Fluent Python
- Debugging: Agans, Zeller
- Architecture: Clean Architecture, Clean Code
- Distributed: DDIA
- Microservices: Microservice Patterns
- Security: Full Stack Python Security
- Git: Pro Git
- Theory: SICP

**1b. Construct 2-4 queries** (3-5 specific keywords each, varied perspectives):
```
"microservice authentication authorization OAuth JWT token"
"API gateway authentication service mesh security"
```

**1c. Two-stage retrieval:**
```
docs_semantic_search(query="...", max_results=10, hybrid=true)
docs_vault_document_read(file_path="...", section="heading from results")
```

For exact phrases: `docs_search_all_docs(query="exact phrase")`

**1d. Extract findings:** principles, patterns, best practices, trade-offs, citations.

## Phase 2: AI Research Articles (if topic is AI-related)

Search curated articles from industry leaders:
```
docs_semantic_search(query="topic + AI context", file_type="md", max_results=15, hybrid=true)
```

Filter to webcrawl articles. Extract: research findings, benchmark data, recent developments.
Synthesize with Phase 1: how do articles apply book principles?

## Phase 3: Web Search (fill gaps)

Search for what MCP docs don't cover:
- Recent developments, tool-specific implementations
- Industry trends, framework updates

## Phase 4: Report

Structure (findings first, citations last):

```markdown
# Research Report: [Topic]
**Date**: YYYY-MM-DD | **Query**: [original query]

## 1. Executive Summary
## 2. Key Findings
## 3. Implementation Guide
## 4. Detailed Analysis
## 5. Citations
## 6. Research Methodology (appendix)
```

## Phase 5: Persist

Optionally write sanitized summary to vault via `docs_vault_write`.

---

## Search Behavior Reference

- No file_type filter -- all documents (books + white papers + articles)
- `file_type="pdf"` -- books and white papers
- `file_type="md"` -- markdown articles only

## Format Principles

- Lead with findings, not methodology
- Tables and bullets over narrative prose
- Citations at end (academic style)
- Implementation guide front-loaded
- No repeated information across sections
