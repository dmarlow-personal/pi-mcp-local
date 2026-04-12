---
description: Deep codebase review with architectural analysis and test adequacy
---

Orchestrate a codebase review for: $@

## Arguments
```
/codebase-review                # review entire src/ directory
/codebase-review <path>         # review specific module
/codebase-review --focus=<area> # focus: architecture | security | testing | performance
```

## Phase 1: Deep Reconnaissance

Map the ENTIRE codebase before reading any files.

**1a. Symbol index (mandatory first step):**
- `docs_search_symbols(kind="class")` -- all classes
- `docs_search_symbols(kind="function")` -- all top-level functions
- `docs_search_symbols(kind="protocol")` -- interfaces and contracts

**1b. Dependency graph:**
For each module: `docs_get_dependencies(module="<file>")`
Map cross-module relationships. Identify circular dependencies.
Calculate coupling: Ca (afferent), Ce (efferent), Instability = Ce / (Ca + Ce)

**1c. Research patterns:**
- `docs_semantic_search(query="clean architecture dependency rule boundaries")`
- `docs_semantic_search(query="error handling exception patterns")`
- `docs_vault_document_read(file_path, section="...")` -- always two-stage

## Phase 2: Architectural Analysis

- Single Responsibility: modules >500 lines, classes >300 lines
- Coupling: modules with >10 dependents or >10 imports
- Layer boundaries: infrastructure leaking into domain
- API design: minimal interfaces, consistent patterns

## Phase 3: Cross-Cutting Concerns

- Error handling: bare except, missing context, inconsistent patterns
- Logging: levels, structured format, sensitive data
- Security boundaries: entry points, validation, secrets
- Configuration: side effects at import, hardcoded values

## Phase 4: Code Quality

- Dead code, duplication, complexity (>30 line functions, >3 nesting)
- Naming clarity, consistent conventions

## Phase 5: Test Adequacy

Run coverage analysis. For modules <70%, assess test quality.
Identify missing test categories: unit, integration, edge case, error path.

## Phase 6: Report

```markdown
## Codebase Review: [project/scope]

### Health Score: [0-100]
### Module Health Map
| Module | Lines | Coverage | Instability | Findings | Health |

### Findings by Confidence
### Test Adequacy
### Action Plan
- Immediate (CRITICAL/HIGH)
- Next Sprint (MEDIUM)
- Backlog (architectural debt)
```
