---
description: Multi-source research combining MCP docs, GraphRAG, web search, and Gemini validation
---

Perform comprehensive, multi-source research on: $@

Six phases executed in order. Each builds on the previous.

---

## Phase 1: MCP Documentation Search

**1a0. Graph-first routing (GraphRAG)** -- before constructing prose queries, route by topic shape:

- **Topical survey** ("what does the corpus say about X")?
  Start with `docs_search_communities(query="...")`. Each hit is a pre-condensed LLM
  summary of a Leiden-clustered entity community. One call often replaces 10+
  `docs_semantic_search` + `docs_vault_document_read` pairs for orientation. Drill into
  specific passages with `docs_semantic_search` only after the right community is identified.
- **Named entity** (a specific person, technique, or concept)?
  Call `docs_entity_lookup(name="...")` for a typed identity card, then
  `docs_entity_neighbors(name="...")` to expand relational context.
  Use `docs_semantic_search(query=..., entity=X)` to restrict chunk retrieval to docs
  that mention X.
- **Coverage question** ("which books discuss X")?
  `docs_documents_mentioning(name="...")` returns a density-sorted list much tighter
  than a semantic search.

Graph tools return nothing useful until entity extraction has populated the index. If
the query returns empty results, fall through to the standard two-stage pattern in 1c.

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
"distributed authentication session management"
```

**1c. Two-stage retrieval:**
```
docs_semantic_search(query="...", max_results=10, hybrid=true)
docs_vault_document_read(file_path="...", section="heading from results")
```

For exact phrases / identifiers / error strings:
`docs_search_all_docs(query="exact phrase", rewrite=false)`. The default
`rewrite=true` rewrites the query into prose via local LLM -- pass
`rewrite=false` for true exact-text matching.

**1d. Extract findings:** principles, patterns, best practices, trade-offs, citations.

---

## Phase 2: AI Research Articles (if topic is AI-related)

Search curated articles from industry leaders:
```
docs_semantic_search(query="<topic> + AI context", file_type="md", max_results=15, hybrid=true)
```

Filter to `article_type: webcrawl` in frontmatter. Extract:
- Research findings and benchmark data
- Architectural patterns from production
- Recent developments (2024-2026)
- Source context (Anthropic, OpenAI, Google, IBM, NVIDIA, Intel)

Synthesize with Phase 1: how do articles apply book principles?

---

## Phase 3: Web Search (fill gaps)

Search for what MCP docs and articles don't cover:
- Recent developments, tool-specific implementations
- Industry trends, framework updates, community consensus

```
web_search(query="focused query 2026 latest")
web_fetch(url="<result URL>")
```

For library API questions, consider `/skill:gemini`-less routing through Context7:
```
mcp__plugin_context7_context7__resolve-library-id(name="<library>")
mcp__plugin_context7_context7__query-docs(id, question="<specific API question>")
```

---

## Phase 4: Gemini Validation

Build structured JSON context with all findings. Send to Gemini with role:
- Validate MCP findings for accuracy
- Cross-reference books vs web findings
- Identify conflicts between sources
- Synthesize unified perspective
- Recommend with confidence levels

See `/skill:gemini` for the full invocation pattern. Invoke Gemini from the repo root:

```bash
cat /tmp/research_context.json | \
  GOOGLE_CLOUD_PROJECT=gen-lang-client-0060471158 \
  GOOGLE_CLOUD_LOCATION=us-central1 \
  gemini -m gemini-2.5-pro -p "<validation prompt>"
```

Gemini runs in a fresh context and can independently read files cited in the findings.
Treat missed findings (things the MCP corpus and web search didn't surface) as at least
as valuable as contradictions.

---

## Phase 5: Report

Structure (findings first, citations last):

```markdown
# Research Report: [Topic]
**Date**: YYYY-MM-DD | **Query**: [original query]

## 1. Executive Summary
- Key finding (one sentence)
- Confidence: High/Medium/Low
- Primary sources: [top 2-3]
- Top 3 recommendations (priority order)

## 2. Key Findings
- [Category] -- [finding] -- Source: [book/paper] -- Confidence: [H/M/L]
(repeat for each finding)

## 3. Implementation Guide
- Recommended approach with code examples
- Decision framework (if multiple options)
- Common pitfalls

## 4. Detailed Analysis
- 4.1 Authoritative sources (books + white papers)
- 4.2 Industry practices (articles + web)
- 4.3 Synthesis and validation

## 5. Context and Assumptions

## 6. Citations
- Books referenced
- White papers
- Web resources
- Additional reading

## 7. Research Methodology (appendix)
- Queries executed with result counts
```

---

## Phase 6: Persist

Save to `docs/research/YYYY-MM-DD_topic-slug.md`.

If findings are generalizable, optionally write a sanitized summary to the vault via
`/skill:vault`:
```
docs_vault_write(
    path="development/research/<slug>.md",
    title="...",
    content="...",
    tags=[...],
    source="<docs/research file>"
)
```

---

## Search Behavior Reference

- No `file_type` filter -- all documents (books + white papers + articles)
- `file_type="pdf"` -- books and white papers
- `file_type="md"` -- markdown articles only

---

## Format Principles

- Lead with findings, not methodology
- Tables and bullets over narrative prose
- Citations at end (academic style)
- Implementation guide front-loaded (section 3, not section 6)
- No repeated information across sections
