---
description: Enter specification mode with structured research workflow and clarification
---

Enter specification mode for: $@

## Quick Reference

```
1. /skill:resources                   # Load resources [STOP -- await result]
2. Clarify problem                    # Before research
3. Write search plan                  # Document approach
4. Research IN ORDER:
   0. Code probe (only if spec touches existing code)
      docs_cg_search -> on hit /skill:code-graph; on miss LSP/Grep
   a. Articles (file_type="md")       # New developments
   b. White Papers (file_type="pdf")  # Technical analysis
   c. Books (file_type="pdf")         # Best practices
   d. Code Examples                   # Validation
   e. Web Search                      # Reinforce
5. Deepen as needed                   # Search again for context
6. Verify completeness checklist
7. Write spec to docs/plans/
```

---

## Core Principles

1. **Problem-First**: Understand the problem space before implementation
2. **Progressive Refinement**: Each research phase builds on the previous
3. **Clarify Early**: Ask questions when ambiguity blocks progress
4. **Iterative Deepening**: If a finding is incomplete, search deeper

**Note:** Research requirements (MCP Docs + GraphRAG routing) are defined in `AGENTS.md`.
This command extends that workflow.

---

## Step 1: Load Resources

Load the resources skill for domain mapping and research methodology:

```
/skill:resources
```

**STOP after this call.** Wait for tool result before proceeding.

---

## Step 2: Clarify the Problem

Before searching, check existing knowledge:
- `docs_vault_search(query="<topic keywords>")` for prior research
- If relevant vault notes exist, read them to avoid redundant work

Resolve ambiguities by asking the user:

| Area | Example Questions |
|------|-------------------|
| Scope | What's in/out of scope? |
| Constraints | Performance requirements? Compatibility? |
| Success Criteria | What defines "done"? |

If proceeding with uncertainty, mark explicitly:
```
[ASSUMPTION]: Using existing auth patterns
[NEEDS CLARIFICATION]: Concurrent access support
```

Limit: 3 unresolved ambiguities maximum before pausing.

---

## Step 3: Write Search Plan

Document before searching:

```
=== SEARCH PLAN ===
Problem Domain: [what we're solving]
Key Concepts: [terms, patterns to explore]
Research Phases: [what to find in each phase]
Open Questions: [things needing clarification]
```

---

## Step 4: Execute Research

### Code probe (when the spec touches existing code)

If the spec involves changes to existing code, locate the affected symbols
*before* researching patterns to apply:

```
docs_cg_search(query="<known symbol>")
  -> "code-graph not reachable" / empty -> bridge unavailable;
     fall through to LSP (TypeScript) or Grep. Don't retry.
  -> hits returned -> /skill:code-graph to unlock cg_get_symbol,
                      cg_reachability, cg_communities_for_files, etc.
```

Skip this phase entirely if the spec is greenfield.

### Graph-first routing

Before prose queries, route by topic shape (see AGENTS.md Step 1.5):
- Topical survey -> `docs_search_communities(query="...")`
- Named entity -> `docs_entity_lookup(name="...")` then `docs_entity_neighbors`
- Coverage question -> `docs_documents_mentioning(name="...")`

Fall through to the prose phases below if the graph tools return empty.

### Articles

**Purpose**: New developments, emerging patterns, current industry thinking
**Tool**: `docs_semantic_search(query, file_type="md")`
**After**: Summarize key findings before proceeding

### White Papers

**Purpose**: Empirical data, benchmarks, technical analysis
**Tool**: `docs_semantic_search(query, file_type="pdf")` (returns books + papers;
filter by frontmatter to focus on papers)

### Books

**Purpose**: Best practices, foundational principles, proven patterns
**Tool**: `docs_semantic_search(query, file_type="pdf")`
**Note**: Refer to `/skill:resources` for domain-to-book mapping

### Code Examples

**Purpose**: Validate approach against real implementations
**Tool**: `docs_list_code_examples(language="...")` filtered by language

### Web Search

**Purpose**: Validate findings, fill gaps, get latest info
**Tools**: `web_search` for general, `web_fetch` for specific URLs
For library APIs: `mcp__plugin_context7_context7__query-docs`

---

## Step 5: Iterative Deepening

If you find something interesting but incomplete, search again:

1. Same source type, refined query
2. Different source type (article concept -> book principles)
3. Web expansion for live documentation

Track deepening:
```
Original finding: [what sparked interest]
Deepening: [query] -> [source] -> [result]
Resolution: [what you now understand]
```

---

## Step 6: Verify Completeness

Before writing the spec:

```
=== RESEARCH COMPLETENESS ===
[ ] Articles: minimum 2 searches
[ ] White Papers: minimum 1 search
[ ] Books: minimum 2 searches (different books)
[ ] Code Examples: validated implementations
[ ] Web Search: validated/reinforced findings
[ ] Clarifications: blocking ambiguities resolved
[ ] Deepening: interesting findings explored
```

If any missing, go back and search more.

---

## Step 7: Write Specification

Save to `docs/plans/YYYY-MM-DD_topic.md`:

```markdown
# Specification: [Topic]

## Problem Statement
[What we're solving and why]

## Research Summary

### Key Findings
- [Finding 1] (Source: [book/article/paper])
- [Finding 2] (Source: [book/article/paper])

### Approach Decision
[Chosen approach and rationale]

### Trade-offs Accepted
[What we're trading off and why]

## Implementation Plan

### Principles to Follow
- [Principle 1] (Source: [book])

### Patterns to Apply
- [Pattern 1]: [how it applies]

### Anti-patterns to Avoid
- [Anti-pattern 1]: [why to avoid]

## Task Checklist
- [ ] Task 1
- [ ] Task 2

## Files to Modify
- `path/to/file.ts`: [what changes]

## Verification Steps
- [ ] How to verify it works
- [ ] Edge cases to test
```

### Optional: Persist to Vault

If findings are reusable beyond this project, write a sanitized, company-agnostic
summary via `/skill:vault`:
```
docs_vault_write(
    path="development/specs/<slug>.md",
    title="...",
    content="...",
    tags=[...],
    source="<docs/plans file>"
)
```

---

**To begin, execute Step 1: `/skill:resources`**
