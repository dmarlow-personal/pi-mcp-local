---
description: Deep PR review with deterministic gates, scrutinize 7-pass on the diff, test enforcement, 3-persona Gemma panel, and Gemini adversarial validation
---

Orchestrate a 9-phase PR review of: $@

Deterministic gates first, reconnaissance, context, `/skill:scrutinize` 7-pass on the
diff, test enforcement, 3-persona Gemma panel via `docs_assist`, adversarial test
generation, Gemini adversarial review, interactive report.

**Prerequisite:** `/skill:scrutinize` must be installed. Phase 4 delegates to it.

```
Phase 1: Deterministic Gates [BLOCKING -- no LLM cost]
  |  Secret scan, lint, types, ratchet check.
  |  FAIL HERE = stop. Fix first.
  |
Phase 2: Reconnaissance [conventions, history]
  |  AGENTS.md / CLAUDE.md, git log, neighbouring files.
  |
Phase 3: Context Gathering [symbol search, vault, MCP docs]
  |  Map changed code. Research authoritative patterns.
  |
Phase 4: Scrutinize 7-Pass on the Diff [/skill:scrutinize Phase 3]
  |  Hallucination Hunt, Architecture, Security, Error paths,
  |  Over-engineering, Test Quality, Convention fit.
  |
Phase 5: Test Enforcement [BLOCKING]
  |  Generate tests for untested changes. Run them. Verify behavior.
  |  NEVER modify tests to simply pass.
  |
Phase 6: Panel Review [3 Gemma personas via docs_assist -- independent calls]
  |  Saboteur, New Hire, Security Auditor.
  |
Phase 7: Adversarial Test Generation
  |  Up to 5 tests designed to break the diff. One-line names.
  |
Phase 8: Adversarial Review [Gemini -- fresh context, independent file reads]
  |  Challenge panel findings. Find what they missed.
  |
Phase 9: Report & User Review
   Verdict, gates table, MUST/SHOULD/Advisory, action plan.
```

## Arguments

```
/pr-review              # review current branch vs main
/pr-review <branch>     # review specific branch vs main
/pr-review --staged     # review staged changes only
```

---

## Phase 0: Scope Detection

Determine what to review:

1. If argument is a branch: `git diff main...<branch> --name-only`
2. If `--staged`: `git diff --cached --name-only`
3. Default: `git diff main...HEAD --name-only`

Capture:
- List of changed files (store for all phases)
- Full diff content
- Diff stats (`git diff --stat`)
- Current branch name

If no changes found, report "Nothing to review" and stop.

---

## Phase 1: Deterministic Gates [BLOCKING]

Cheap, fast, deterministic. If ANY gate fails, STOP and report. Do not proceed to
expensive LLM analysis on code that fails basic quality.

**1a. Secret scan:**
Scan the diff output for:
- `(?i)(api[_-]?key|secret|password|token|credential)\s*[:=]\s*['"][^'"]{8,}`
- `-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----`
- `AKIA[0-9A-Z]{16}`
- `(?i)(mysql|postgres|mongodb|redis)://[^@]+@`

If matched: **BLOCK**. Report file, line, pattern. Do not proceed.

**1b. Lint and type enforcement:**
Run the project's pre-commit or linting pipeline.

If exit code != 0:
- Parse which hooks failed and on which files.
- Report every failure with file:line and violation.
- **BLOCK**: the code must be fixed, not the linter silenced.
- Do NOT suggest `// @ts-ignore`, `// eslint-disable`, `# noqa`, or `# type: ignore` as a fix.
- The ONLY acceptable response to a lint failure is fixing the code.

**1c. Ratchet check:**
If any new suppression comment (`// @ts-ignore`, `// eslint-disable`, `# noqa`,
`# type: ignore`, etc.) appears in the diff that was NOT present on the base branch,
**BLOCK** and report. Suppressions require explicit human justification in the PR
description.

Proceed to Phase 2 ONLY if all gates pass.

---

## Phase 2: Reconnaissance

Five minutes of context before the deep review saves thirty minutes of wrong critique.
The most common AI-code failure is code that is correct in isolation but ignores the
conventions of the surrounding codebase.

1. Read `README.md`, `AGENTS.md`, `CLAUDE.md`, and any `ARCHITECTURE.md` if present.
2. `!git log --oneline -20 <changed-paths>` -- change history of affected files.
3. For each changed file, read 2-3 neighbouring files in the same directory to learn
   local conventions:
   - Naming patterns
   - Error handling style (exceptions vs returns, custom exception hierarchy?)
   - Logging style (structured? log levels? what is logged where?)
   - Test patterns (fixture style, assertion style, mocking approach)
4. Identify the entry points into each changed file. Who calls it? What does it call?
   (Phase 3 builds the actual caller map by grepping for imports and references.)

Record what you learned. This seeds Phase 4 Pass 7 (Integration & Convention Fit) and
biases Phase 6's New Hire persona.

---

## Phase 3: Context Gathering

You have full tool access. Gather everything the Gemma panel will need.

**3a. Map changed code (grep before full-file reads):**

For each changed file:
- `Grep(pattern="^(class |def |function |interface |enum |const )", path=<file>)` --
  enumerate declarations in the file
- `Grep(pattern="^(import|from|require)", path=<file>)` -- imports the file brings in
- `Grep(pattern="from ['\"]<module>|import.*<module>|require\\(['\"]<module>", path=<src-dir>)` --
  callers of the changed module
- `Read(file, offset=<changed_line-10>, limit=40)` -- targeted slices only. Never read
  full files to orient.

**3b. Research authoritative patterns:**

For each non-trivial change:
- `docs_semantic_search(query="<pattern relevant to change>")` -- breadcrumbs
- `docs_vault_document_read(file_path, section="...")` -- full text (always two-stage)

For named concepts (e.g., a service or pattern name) use GraphRAG first:
- `docs_entity_lookup(name="<concept>")` for a typed identity card before prose searches
- `docs_entity_neighbors(name="<concept>")` for adjacent techniques

**3c. Map downstream impact:**
- Use the caller grep from 3a to identify which modules import each changed file
- Identify callers that could break from signature/behavior changes
- Note interface changes that affect downstream consumers

**3d. Check vault for prior review findings:**
- `docs_vault_search(query="<module name>")` for architecture notes about the area

---

## Phase 4: Scrutinize 7-Pass on the Diff

Apply `/skill:scrutinize` **Phase 3 -- Seven-Pass Adversarial Review** methodology
scoped to the diff. All seven passes, in order, without merging. The output feeds the
Phase 6 panel; it is not the final report.

See `skills/scrutinize/SKILL.md` for the full pass definitions. Summary of what to find
per pass:

- **Pass 1 (Hallucination Hunt)** -- imports, method signatures, env vars, config keys,
  DB columns that don't exist or were renamed.
- **Pass 2 (Architecture & Design Coherence)** -- abstractions with one implementation,
  factory wrappers, "god" modules re-emerging as `utils/`.
- **Pass 3 (Security & Trust Boundaries)** -- input validation, injection, output
  encoding, AuthN/AuthZ, secrets, crypto, unsafe deserialization, SSRF / path traversal.
- **Pass 4 (Error & Edge-Path Analysis)** -- swallowed exceptions, partial-failure
  state, concurrency, resource leaks, unbounded retries/waits, unicode/boundary inputs.
- **Pass 5 (Over-Engineering & Dead Weight)** -- justify-its-existence test applied to
  every new symbol introduced.
- **Pass 6 (Test Quality)** -- behavior vs mock-return assertions, tautological tests,
  coupling to implementation.
- **Pass 7 (Integration & Convention Fit)** -- seeded by Phase 2 reconnaissance.

---

## Phase 5: Test Enforcement [BLOCKING]

Using Pass 6 findings plus coverage-gap detection from Phase 3:

**5a. Identify untested changes.** Cross-reference changed public symbols with test
directory:
- `Grep(pattern="<function_name>", path="tests/")` for each changed symbol.
- Build `untested_changes = [{file, symbol, line, reason}]`.

**5b. Generate tests.**
- Write tests validating INTENDED BEHAVIOR of the working component.
- Follow existing patterns in `tests/` and fixtures from `tests/conftest.py`.
- Match project conventions (test framework, naming).
- Tests must be clean, well-named, meaningful -- not coverage padding.

**5c. Run and verify:**
- Tests MUST pass with the current code.
- If a test fails because your test logic was wrong, fix the test.
- If a test fails because the production code has a bug, report the bug as a finding.

**5d. Test integrity -- CRITICAL CONSTRAINT:**
- **NEVER modify a test to simply pass.**
- If expected output changed due to code changes, update expected values to match the
  NEW intended behavior -- but verify the new behavior is correct first.
- If you cannot determine intended behavior, flag for human review.
- Every test must assert something meaningful about the function's contract.

**5e. Coverage check:**
- All new public functions / methods / classes must have at least one test.
- Changed lines should have >= 80% coverage.
- Zero tolerance for new public APIs with 0% coverage.

If coverage requirements cannot be met and test generation failed, **BLOCK** and report
which symbols need tests and why generation failed.

---

## Phase 6: Panel Review [3 GEMMA PERSONAS via docs_assist]

pi-mcp-local has no subagent pool. Replace the 3-Sonnet panel with three **independent
calls** to `docs_assist` (Gemma 4). Each call carries only the evidence package and a
persona charter -- no persona receives the others' responses.

**Evidence package you prepare (pass as the `code` argument, JSON-encoded):**
- Complete diff
- Symbol map of changed files (from Phase 3a)
- Dependency graph of changed modules (from Phase 3c)
- Phase 2 reconnaissance notes (conventions, history)
- Phase 4 scrutinize findings (all 7 passes)
- Test results from Phase 5
- MCP docs research findings (from Phase 3b)
- Prior review findings from vault (if present)

Gemma (via `docs_assist`) cannot call MCP tools. All evidence must be pre-collected.

### Persona 1: The Saboteur

```
docs_assist(
    code=<evidence_package_json>,
    focus="correctness",
    question="""You are The Saboteur -- your job is to break this code in production.

For every change, actively try to find:
- Unvalidated input that could crash or corrupt state
- Inconsistent state from partial failures or interrupted operations
- Concurrent access issues (race conditions, deadlocks, TOCTOU)
- Swallowed exceptions hiding real failures
- Resource leaks (unclosed files, connections, cursors, locks)
- Edge cases: empty input, None, zero, negative, boundary values, unicode

You MUST find at least one fragility. Finding nothing means insufficient depth.

For each finding respond EXACTLY:
finding_id: [N]
persona: SABOTEUR
severity: CRITICAL | HIGH | MEDIUM | LOW
file: [path:line]
category: correctness | error-handling | concurrency | resource-management
issue: [what breaks and how to trigger it]
evidence: [code snippet showing the problem]
recommendation: [specific fix with code]
confidence: HIGH | MEDIUM | LOW
"""
)
```

### Persona 2: The New Hire

```
docs_assist(
    code=<evidence_package_json>,
    focus="readability",
    question="""You are The New Hire -- zero context, reading this code for the first time.

For every change, evaluate:
- Can you understand it without reading 3+ other files?
- Are names clear and self-documenting? Any cryptic abbreviations?
- Magic numbers or unexplained constants?
- Does it follow existing project patterns and conventions?
- Is each function/class doing ONE thing (SRP)?
- Missing type annotations on public interfaces?
- Duplicated logic that belongs in a shared abstraction?

If understanding a change requires reading more than 2 other files, that IS a finding.

For each finding respond EXACTLY:
finding_id: [N]
persona: NEW_HIRE
severity: CRITICAL | HIGH | MEDIUM | LOW
file: [path:line]
category: readability | naming | SRP | duplication | conventions | types
issue: [what is confusing or wrong]
evidence: [code snippet]
recommendation: [specific improvement with code]
confidence: HIGH | MEDIUM | LOW
"""
)
```

### Persona 3: The Security Auditor

```
docs_assist(
    code=<evidence_package_json>,
    focus="security",
    question="""You are The Security Auditor -- OWASP-informed analysis of every change.

Examine:
- Injection: SQL, command, path traversal, template, LDAP, XPath
- Authentication/authorization gaps or bypasses
- Data exposure: sensitive data in logs, responses, error messages, URLs
- Insecure defaults: permissive configs, missing validation, open binds
- Access control: IDOR, privilege escalation, missing checks
- Secrets: hardcoded credentials, PII, API keys, connection strings
- Crypto: weak algorithms, predictable randomness, key management
- Dependencies: new imports from untrusted or unmaintained packages
- Unsafe deserialization: unsafe loaders on untrusted input

For each finding respond EXACTLY:
finding_id: [N]
persona: SECURITY_AUDITOR
severity: CRITICAL | HIGH | MEDIUM | LOW
file: [path:line]
category: injection | auth | data-exposure | access-control | secrets | crypto | dependencies
issue: [the vulnerability and attack vector]
evidence: [code snippet showing the weakness]
recommendation: [specific remediation with code]
confidence: HIGH | MEDIUM | LOW
"""
)
```

---

## Phase 7: Adversarial Test Generation

Before handing to Gemini, propose **up to 5 tests designed to break the diff**. Focus
on inputs the author almost certainly did not consider:

- Empty collections and zero-value inputs
- Unicode edge cases (combining characters, RTL, zero-width, emoji, NFC vs NFD)
- Boundary values (max int, min int, empty string, 1-byte string, 10 MB string)
- Concurrent access and interleavings
- Partial failures (network mid-request, disk full, OOM, killed process)
- Malformed or adversarial inputs at trust boundaries

Describe each test as a one-line name plus one line of expected behavior. Do not write
the full test bodies unless asked.

If the diff cannot be broken by any of these, say so. That is itself useful signal.

---

## Phase 8: Consensus & Gemini Adversarial Review

**8a. Aggregate Gemma panel votes.**

Merge findings across the three persona calls. For overlapping findings (same file,
same issue):
- 3/3 personas flagged -> HIGH_CONFIDENCE
- 2/3 personas flagged -> MEDIUM_CONFIDENCE + severity promoted one level
- 1/3 persona flagged -> LOW_CONFIDENCE (include, note single-source)

Weighted consensus scoring:
- HIGH confidence vote = 1.0
- MEDIUM confidence vote = 0.7
- LOW confidence vote = 0.4
- Total >= 2.4 -> HIGH_CONFIDENCE
- Total >= 1.5 -> MEDIUM_CONFIDENCE
- Total < 1.5  -> LOW_CONFIDENCE

**8b. Gemini adversarial review.**

Gemini is the only reviewer in this pipeline with **independent evidence gathering**.
Gemma (via `docs_assist`) is limited to the evidence package you packed; Gemini CLI
runs with filesystem access and a ~1M-token context window. It can and should read the
full files touched by the diff (not just the diff itself) and their immediate
neighbours for convention context. Treat missed findings as at least as valuable as
severity downgrades.

Write structured JSON to a temp file. Pipe to Gemini from the repo root so the CLI can
resolve relative paths:

```bash
cat /tmp/pr_review_context.json | \
  GOOGLE_CLOUD_PROJECT=gen-lang-client-0060471158 \
  GOOGLE_CLOUD_LOCATION=us-central1 \
  gemini -m gemini-2.5-pro -p "<adversarial prompt below>"
```

Adversarial prompt:

```
You are the fourth reviewer on this PR. Unlike the three Gemma panel personas
-- which are limited to the evidence package -- you can read files directly.
Use that. Before evaluating panel findings, independently read the full source
of every file in the changed-files list (not just the diff hunks), plus 1-2
neighbouring files from the same directory for convention context. Changed-files
list is below.

Then do five things, in order:

1. INDEPENDENT FINDINGS: What did the panel miss? Bugs, security issues,
   convention drift, broken callers, missing edge cases. Findings the panel did
   not catch are at least as important as ones they overstated. Cite file:line.

2. VERIFY THE PANEL: Spot-check HIGH/CRITICAL findings against the actual code.
   Mark any that misread the diff as FALSE_POSITIVE with a specific correction.

3. CHALLENGE SEVERITY: Is each finding really CRITICAL or is the panel overreacting?
   Downgrade where actual risk is lower than claimed.

4. CHALLENGE RECOMMENDATIONS: Is the proposed fix over-engineered? Suggest simpler
   alternatives.

5. EVALUATE TEST QUALITY: Are generated tests testing meaningful behavior or are
   they coverage padding?

Be specific. Every claim cites file:line. No vibes, no hedges.

PANEL FINDINGS AND EVIDENCE:
{all_findings_json}

SCRUTINIZE 7-PASS FINDINGS:
{scrutinize_findings}

ADVERSARIAL TESTS PROPOSED:
{adversarial_tests}

CHANGED FILES (read these independently, plus neighbours):
{changed_files_list}

FULL DIFF:
{diff_content}

TEST RESULTS:
{test_output}
```

---

## Phase 9: Report & User Review

```markdown
## PR Review: [branch]

### Verdict: [APPROVE | CONCERNS | BLOCK]

### Executive Summary
[2-3 sentences: what was reviewed, key findings, overall assessment]

### Quality Gates
| Gate | Status | Details |
|------|--------|---------|
| Secrets | PASS/FAIL | [details] |
| Lint | PASS/FAIL | [N violations] |
| Types | PASS/FAIL | [N errors] |
| Spelling | PASS/FAIL | [details] |
| Ratchet | PASS/FAIL | [new suppressions?] |
| Test coverage | PASS/FAIL | [N% diff coverage] |

### MUST Fix (blocking merge)
[HIGH_CONFIDENCE + CRITICAL/HIGH severity]
1. **[Severity] [Category]** `file:line`
   - Issue: ...
   - Panel: [vote breakdown, consensus score]
   - Adversarial: [Gemini agrees/disagrees and why]
   - Fix: [specific code change]
   - Source: [authoritative reference if applicable]

### SHOULD Fix (before merge if possible)
[MEDIUM_CONFIDENCE or MEDIUM severity]

### Advisory
[LOW_CONFIDENCE or LOW severity -- informational only]

### Tests Generated
| File | Function Tested | Assertions | Status |
|------|----------------|------------|--------|

### Adversarial Tests Proposed
1. <name> -- <expected behavior>
2. ...

### Adversarial Counterpoints
[Where Gemini disagreed with the Gemma panel -- present both arguments]

### Action Plan
**Immediate** (blocks merge):
1. ...

**Before merge** (should address):
1. ...

**Follow-up** (create tickets):
1. ...
```

**Present report to user. Ask:**
- Which findings to act on now?
- Which to defer to follow-up tickets?
- Should any generated tests be revised?
- Ready to proceed with fixes, or need deeper investigation?

User makes the final call. This review is advisory for SHOULD/Advisory items; MUST
items and failed quality gates require resolution.

---

## Key Constraints

- **Phase 1 gates are BLOCKING** -- never skip or soften them.
- **Gemma (`docs_assist`) cannot call MCP tools** -- evidence pre-collected in Phase 3.
- **Run the three Gemma persona calls independently** -- do NOT feed one persona's
  response into another call.
- **NEVER suggest lint/type suppressions as fixes** -- the code must change.
- **NEVER modify tests to simply pass** -- tests verify correct behavior.
- **Grep before full-file reads** -- cheaper, more targeted than opening whole files.
- **Two-stage MCP doc retrieval** -- `docs_semantic_search` then `docs_vault_document_read`.
- **Gemini review runs in FRESH context** -- no conversation history leaks.
- **No fabricated findings** -- empty severity buckets are valid signal.
- **Lower severity when ambiguous** -- calibration rule from `/skill:scrutinize`.
- **Cite file and line for every finding** -- no line = no finding.
- **Do not suggest a full rewrite** -- name the flaw and the direction of the fix.
- **Present BOTH panel and adversarial perspectives** to the user.
- **User makes final decisions** on all non-blocking findings.

---

## Principles

1. **`/skill:scrutinize` is the reviewer; this prompt wraps it with gates and
   validation.** The 7-pass methodology lives in `/skill:scrutinize` and is applied
   here in Phase 4. Deterministic gates, test enforcement, panel, and Gemini are the
   PR-review-specific layers around it.
2. **Gates first, analysis second.** Expensive LLM work only runs on code that already
   passes secrets/lint/types/ratchet.
3. **Test enforcement is non-negotiable.** New public APIs without tests block the
   merge. A PR that ships untested public surface is a PR that ships untested behaviour.
