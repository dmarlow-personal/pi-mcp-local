---
description: Systematic debugging workflow using proven methodologies
---

Guide systematic debugging of: $@

## Sources

Search MCP docs for methodology details:
- `docs_semantic_search(query="debugging rules divide conquer make it fail")`
- `docs_semantic_search(query="delta debugging scientific method hypothesis")`

Use `docs_vault_document_read(file_path, section)` for full text after search.

## Phase 1: Understand the Problem

- What exactly is failing? (error, wrong output, crash)
- When did it start? Has it ever worked? What changed?
- Expected vs actual behavior
- Can you reproduce consistently?
- Logs, error messages, stack traces

## Phase 2: Apply the 9 Rules

**Rule 1 -- Understand the System**: Map via symbol index first:
- `docs_search_symbols(query="<error class or function>")` to locate definition
- `docs_get_dependencies(module="<suspect file>")` for imports and dependents

**Rule 2 -- Make It Fail**: Create minimal reproduction case.

**Rule 3 -- Quit Thinking and Look**: Observe actual behavior. Add logging. Check actual values.
For exact errors: `docs_search_all_docs(query="exact error message")`

**Rule 4 -- Divide and Conquer**: Binary search through code/data. `git bisect` for breaking commit.

**Rule 5 -- Change One Thing at a Time**: One change, test, observe. Revert if it doesn't help.

**Rule 6 -- Keep an Audit Trail**: Document hypotheses, changes, results.

**Rule 7 -- Check the Plug**: Service running? Path correct? Env var set? Right file?

**Rule 8 -- Get a Fresh View**: Rubber duck debugging. Read code bottom to top.

**Rule 9 -- If You Didn't Fix It, It Ain't Fixed**: Test original case + edge cases. Run full test suite.

## Phase 3: Resolution

- Implement fix
- Add regression tests
- Run linting and tests
- Document root cause and prevention
