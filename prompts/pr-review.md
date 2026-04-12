---
description: Deep PR review with test enforcement and lint gates
---

Orchestrate a PR review for: $@

## Phase 0: Scope Detection

1. If argument is a branch: `git diff main...<branch> --name-only`
2. If `--staged`: `git diff --cached --name-only`
3. Default: `git diff main...HEAD --name-only`

Capture: changed files, full diff, diff stats, branch name.

## Phase 1: Deterministic Gates [BLOCKING]

**1a. Secret scan** the diff for:
- API keys, passwords, tokens, credentials
- Private keys, AWS keys, connection strings

If matched: BLOCK. Report file, line, pattern.

**1b. Lint enforcement:**
Run pre-commit or linting. If it fails: BLOCK. Do NOT suggest `# noqa` or suppression.

**1c. Ratchet check:**
If any new `# noqa` or `# type: ignore` comments appear in the diff, BLOCK.

## Phase 2: Context Gathering

For each changed file:
- `docs_search_symbols(module="<changed_file>")` -- all symbols
- `docs_get_dependencies(module="<changed_file>")` -- imports and dependents
- Read targeted code slices only

Check existing knowledge:
- `docs_vault_search(query="<module name>")` -- architecture notes
- `docs_semantic_search(query="<pattern relevant to change>")` -- authoritative patterns
- `docs_vault_document_read(file_path, section="...")` -- full text

## Phase 3: Diff Analysis

**3a. Classification**: new feature / refactor / bug fix / config / test / docs / dependency
**3b. Correctness**: logic errors, race conditions, resource leaks, type safety
**3c. Coverage gaps**: cross-reference changed symbols with test directory
**3d. Security**: input validation, injection vectors, hardcoded values, insecure defaults

## Phase 4: Test Enforcement [BLOCKING]

For untested changes:
- Generate tests validating intended behavior
- Follow existing test patterns and conventions
- Run and verify tests pass
- NEVER modify a test to simply pass

## Phase 5: Report

```markdown
## PR Review: [branch]

### Verdict: [APPROVE | CONCERNS | BLOCK]

### Quality Gates
| Gate | Status | Details |
|------|--------|---------|

### MUST Fix (blocking merge)
### SHOULD Fix (before merge if possible)
### Advisory

### Tests Generated
| File | Function Tested | Status |

### Action Plan
```
