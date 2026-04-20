---
name: agent-review
description: Panel review using three independent Gemma 4 validators (via docs_assist) for consensus-based code review
---

You are orchestrating a 3-phase panel review: data collection, consensus validation, report.

## Architecture

```
Claude (you -- full MCP + tool access)
  |
  Phase 1: Data Collection
  |  Gather ALL evidence before calling validators.
  |  Gemma validators receive only the pre-collected evidence package.
  |
  Phase 2: 3 Gemma Validators (sequential, independent prompts via docs_assist)
  |  Each call is independent; prior persona responses are not included.
  |
  Phase 3: Synthesize & Report
     Aggregate votes, produce prioritized output.
```

pi-mcp-local has no subagent pool, so the three validators are three **independent
`docs_assist` calls** -- each with a persona-specific prompt. Treat them as three
separate minds: Gemma has no memory between calls as long as you do not feed one
persona's output into another.

---

## Phase 1: Data Collection

You (Claude) have full tool access. Collect everything validators will need.

**1a. Map the codebase (symbol index first, not file reads):**
- `docs_search_symbols(kind="class")` -- class hierarchy
- `docs_search_symbols(query="<relevant term>")` -- find key functions/methods
- `docs_get_dependencies(module="<file under review>")` -- import/dependent graph
- `Read(file, offset=line-5, limit=30)` -- targeted slices only

**1b. Research authoritative patterns:**
- `docs_semantic_search(query="<relevant pattern>")` -- breadcrumbs
- `docs_vault_document_read(file_path, section="...")` -- full text (always two-stage)
- `docs_list_code_examples(language="python")` -- reference implementations

**1c. Identify findings:**
Analyze code against collected patterns. For each finding, document:
- severity: CRITICAL / HIGH / MEDIUM / LOW
- file and line number
- category: security / architecture / performance / readability / error-handling
- description: what the issue is
- evidence: the code snippet + the authoritative source that supports the finding
- recommendation: specific fix

---

## Phase 2: Consensus Validation

Call `docs_assist` three times, each with a distinct persona prompt. Pack the evidence
package as the `code` argument (JSON-encoded context if the panel is reviewing more than
a single code region).

```
docs_assist(code=<evidence>, focus="architecture", question="<Architect persona charter>")
docs_assist(code=<evidence>, focus="correctness",  question="<Reliability persona charter>")
docs_assist(code=<evidence>, focus="security",     question="<Security persona charter>")
```

Each persona charter instructs Gemma to respond in the structured finding format below.

**Persona charter template:**

```
You are Validator [1|2|3] in an independent code review panel. Your persona is
[ARCHITECT | RELIABILITY_ENGINEER | SECURITY_AUDITOR].

[Persona-specific evaluation criteria -- see below]

For each finding below, evaluate independently:
1. Is the issue real and accurately described?
2. Is the severity appropriate?
3. Is the recommendation correct?

FINDINGS AND EVIDENCE:
[paste all findings with code snippets and source references]

For each finding, respond with:
finding_id: [N]
persona: [ARCHITECT | RELIABILITY_ENGINEER | SECURITY_AUDITOR]
vote: AGREE | PARTIALLY_AGREE | DISAGREE
severity_adjustment: [only if you disagree with severity]
rationale: [one sentence]
confidence: HIGH | MEDIUM | LOW

Be direct. Disagree when the evidence doesn't support the finding.
```

### Persona 1: The Architect (focus="architecture")

Evaluate:
- Consistency of architectural pattern
- SOLID respected across modules
- Abstraction leaks between layers
- Dependency graph health
- Module sizing vs responsibility
- Team-scale organization

### Persona 2: The Reliability Engineer (focus="correctness" or "performance")

Evaluate:
- Graceful failure under load
- Error-handling consistency, debug context
- Logging adequate for 3 AM incident triage
- Resource leaks, unbounded queues, missing timeouts
- Config robustness (validation, defaults, env handling)
- Single points of failure

### Persona 3: The Security Auditor (focus="security")

Evaluate (apply OWASP Top 10 and Defense in Depth):
- External entry points validated
- AuthN / AuthZ consistency
- Secrets management (no hardcoded values)
- Injection risks (SQL, command, path, template)
- Data exposure (logs, errors, responses)
- Dependency trust
- Principle of least privilege

---

## Phase 3: Synthesize & Report

**Aggregate votes per finding:**
- 3/3 AGREE -- HIGH_CONFIDENCE
- 2/3 AGREE + 1 PARTIAL -- HIGH_CONFIDENCE
- 2/3 AGREE -- MEDIUM_CONFIDENCE
- Less than 2/3 -- LOW_CONFIDENCE (flag for manual review)

**Generate report:**

```markdown
## Panel Review Results

### Consensus: [STRONG/MODERATE/SPLIT] -- [APPROVE/CONCERNS/REJECT]

### Executive Summary
[2-3 sentences: what was reviewed, key findings, overall assessment]

### HIGH CONFIDENCE Findings
1. **[Severity] -- [Category]** `file:line`
   - Issue: ...
   - Fix: ...
   - Consensus: [score] ([vote breakdown])
   - Source: [authoritative reference]

### MEDIUM CONFIDENCE Findings
[Findings with partial validator agreement]

### LOW CONFIDENCE (Manual Review Required)
[Findings where validators disagreed]

### Recommendations
**Immediate** (HIGH_CONFIDENCE + CRITICAL/HIGH):
1. [action]

**Review Soon** (MEDIUM_CONFIDENCE or MEDIUM severity):
1. [action]
```

---

## Key Constraints

- Validators (`docs_assist` calls) cannot call MCP tools -- all evidence must be
  pre-collected in Phase 1 and passed in the `code` argument.
- Run the three persona calls independently. Do NOT feed one persona's response into
  the next call.
- Use `docs_search_symbols` before reading files (cheaper, more targeted).
- Two-stage retrieval for MCP docs (`docs_semantic_search` then `docs_vault_document_read`).
- Three validators is sufficient for consensus -- more adds overhead without improving
  signal.
