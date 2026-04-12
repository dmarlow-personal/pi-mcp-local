---
description: Enter specification mode with structured research workflow
---

Enter specification mode for: $@

## Quick Reference
```
1. Load /skill:resources             # Load domain mapping
2. Clarify problem                   # Before research
3. Write search plan                 # Document approach
4. Research IN ORDER:
   a. Articles (file_type="md")      # New developments
   b. White Papers (file_type="pdf") # Technical analysis
   c. Books (file_type="pdf")        # Best practices
   d. Code Examples                  # Validation
   e. Web Search                     # Reinforce
5. Deepen as needed
6. Verify completeness checklist
7. Write spec
```

## Step 1: Load Resources

Load the resources skill for domain mapping and methodology: `/skill:resources`

## Step 2: Clarify the Problem

Check existing knowledge:
- `docs_vault_search(query="<topic keywords>")` for prior research
- If relevant vault notes exist, read them to avoid redundant work

Resolve ambiguities before searching. Limit: 3 unresolved ambiguities max.

## Step 3: Write Search Plan

```
=== SEARCH PLAN ===
Problem Domain: [what we're solving]
Key Concepts: [terms, patterns to explore]
Research Phases: [what to find in each phase]
```

## Step 4: Execute Research

**Articles**: `docs_semantic_search(query, file_type="md")` -- new developments
**White Papers**: `docs_semantic_search(query, file_type="pdf")` -- benchmarks
**Books**: `docs_semantic_search(query, file_type="pdf")` -- best practices
**Code Examples**: `docs_list_code_examples(language="...")` -- validation
**Web Search**: fill gaps, live documentation

## Step 5: Iterative Deepening

If a finding is incomplete, search deeper: same source refined, different source type, web expansion.

## Step 6: Verify Completeness

```
[ ] Articles: minimum 2 searches
[ ] White Papers: minimum 1 search
[ ] Books: minimum 2 searches (different books)
[ ] Code Examples: validated implementations
[ ] Web Search: validated/reinforced findings
```

## Step 7: Write Specification

```markdown
# Specification: [Topic]
## Problem Statement
## Research Summary
### Key Findings
### Approach Decision
### Trade-offs Accepted
## Implementation Plan
## Task Checklist
## Files to Modify
## Verification Steps
```

Optionally persist reusable findings to vault via `docs_vault_write`.
