---
description: Codebase-wide audit orchestrator. Segments the codebase into blocks, applies /skill:scrutinize per block, runs a 3-persona Gemma panel and Gemini adversarial validation, synthesizes cross-block patterns, and gates refactor recommendations on test coverage. Persistent and resumable via .audit/.
argument-hint: [path | "resume" | "synthesize" | "coverage <block-id>" | --focus=<area>]
---

Orchestrate a 9-phase codebase audit of: $@

`/skill:scrutinize` is the reviewer. This prompt is the review **lead**: it decides
what to review, in what order, tracks progress in `.audit/`, synthesizes cross-block
patterns, and refuses to recommend refactors on untested code.

**Prerequisite:** `/skill:scrutinize` must be installed. Phase 4 delegates to it.

```
Phase 0: Scope & Resume Check
  |  Detect .audit/ state. Scope the review.
  |
Phase 1: Block Segmentation [symbol index, dependencies]
  |  Break the codebase into coherent blocks. Confirm plan.
  |
Phase 2: Initialize Tracking
  |  Create .audit/ durable record. Resumable.
  |
Phase 3: Coverage Assessment [per block]
  |  REFACTOR-READY | COVERAGE-GAP | TEST-DESERT classification.
  |
Phase 4: Per-Block Deep Review [/skill:scrutinize 7-pass, block isolation]
  |  Apply scrutinize methodology. Write findings/<block-id>.md.
  |
Phase 5: Panel Review [3 Gemma personas via docs_assist -- independent calls]
  |  Architect, Reliability Engineer, Security Auditor.
  |
Phase 6: Cross-Block Synthesis [durable]
  |  [SYSTEMIC] [COUPLING] [DRIFT] [ASSUMPTION] [ARCH] patterns.
  |
Phase 7: Adversarial Review [Gemini -- fresh context, independent file reads]
  |  Challenge panel + synthesis findings. Prioritize ruthlessly.
  |
Phase 8: Consensus & Refactor Readiness
  |  Score panel votes. Apply coverage gate. Block unsafe refactors.
  |
Phase 9: Report & User Review
   Health score, action plan, Refactor Readiness. User decides priorities.
```

## Arguments

```
/codebase-review                      # audit entire src/ directory
/codebase-review <path>               # audit specific module or directory
/codebase-review --focus=<area>       # focus: architecture | security | testing | performance
/codebase-review resume               # continue from .audit/progress.md
/codebase-review synthesize           # re-run Phase 6 against existing findings
/codebase-review coverage <block-id>  # re-run Phase 3 for one block
```

---

## Phase 0: Scope & Resume Check

**Before anything else:** check whether `.audit/progress.md` exists.

- If it exists AND `$ARGUMENTS` is `resume` or `synthesize`: load `progress.md`, skip
  to the appropriate phase.
- If it exists AND `$ARGUMENTS` is not `resume`/`synthesize`: ask the user whether to
  **resume** or **archive** to `.audit/archive/<ISO-timestamp>/` and start fresh. Never
  silently overwrite prior findings.
- If it does not exist: proceed to Phase 1.

**Reconcile progress.md against findings/ before doing anything else.** On any resume
path (and between blocks in Phase 4), walk `findings/` and overwrite each block's
status in `progress.md` to match ground truth: a block with a `findings/<id>.md` file
is `done` regardless of what the inventory table claims. Report any drift you correct
in the Log section. A stale `progress.md` silently poisons Phase 5/6/7 because they key
off block metadata.

**Scope detection:**

1. If path argument: scope to that directory/module.
2. If `--focus=<area>`: weight the Gemma panel toward the focus area.
3. Default: entire `src/` directory.

**Initial inventory (for the Phase 1 plan):**
- Count of source files and total production lines.
- Module listing with file counts per directory.
- `!git log --oneline -20` for recent change context.

---

## Phase 1: Block Segmentation

A **block** is a coherent unit of code that can be reviewed in isolation without
constantly reaching for other files. Good blocks have:

- A single, nameable responsibility ("auth session management", not "utils").
- 200-800 lines of production code. Split larger; merge smaller adjacent ones.
- Identifiable entry points and a bounded set of external dependencies.
- A natural correspondence to the codebase's structure -- a package, module, bounded
  context, or architectural layer.

**Map the codebase with Grep before reading full files.**

- `Grep(pattern="^(class |def |function |interface |enum )", path=<dir>)` -- enumerate
  top-level declarations per module
- `Grep(pattern="^(import|from|require)", path=<dir>)` -- trace cross-module imports

Then the dependency graph (built by hand from the import grep):

- Map ALL cross-module relationships
- Flag circular dependencies (always a finding)
- Compute per-module coupling metrics:
  - Ca (afferent): how many modules depend on this one
  - Ce (efferent): how many modules this one depends on
  - Instability: Ce / (Ca + Ce) -- 0.0 stable, 1.0 unstable

Prefer targeted `Read(file, offset, limit)` slices over whole-file reads once Grep has
told you which lines matter.

**Choose the segmentation strategy that fits this repository:**

1. **Monorepo / workspace-based** -> one block per workspace / package, sub-chunk any
   workspace larger than 800 LOC.
2. **Layered architecture (MVC, hexagonal, clean)** -> blocks = layer x bounded
   context (`orders.domain`, `orders.persistence`, `orders.api`).
3. **Domain-driven / feature-foldered** -> one block per bounded context or feature folder.
4. **Flat / legacy** -> cluster by import graph. Group strongly-connected components.

**Always skip** generated code, vendored deps, lockfiles, migrations after they are
applied, third-party snapshots. Announce what was skipped and why.

**Order blocks leaves-first.** A block is a leaf if it has no internal dependencies on
other project code. Leaves set the vocabulary the rest of the code uses.

**Output of this phase:** a Block Inventory table (written into `progress.md` in Phase 2):

```
| # | ID  | Name            | Path              | Layer     | Deps         | LOC | Coverage | Status  |
|---|-----|-----------------|-------------------|-----------|--------------|-----|----------|---------|
| 1 | B01 | token-crypto    | src/auth/crypto/  | leaf      | --           | 312 | ?        | pending |
| 2 | B02 | session-store   | src/auth/store/   | data      | B01          | 487 | ?        | pending |
| 3 | B03 | auth-middleware | src/auth/mw/      | interface | B01, B02     | 204 | ?        | pending |
```

**Confirm the block plan with the user before proceeding.** If they disagree,
re-segment -- a wrong plan wastes hours.

---

## Phase 2: Initialize Tracking

Create, at the repo root (not in the user's home):

```
.audit/
├── progress.md              # block inventory, statuses, finding counts, patterns
├── coverage-baseline.json   # coverage snapshot at audit start -- never overwrite
├── findings/                # one file per block
│   └── <block-id>.md
├── synthesis.md             # cross-block patterns (written in Phase 6)
└── archive/                 # prior audits moved here on restart
```

Also write `.audit/.gitignore` containing only `!*` so the audit trail is committed.
The audit trail is part of the deliverable.

**Git commits are user-initiated.** AGENTS.md prohibits unrequested git commands. This
prompt writes the `.audit/` directory but does not run `git add` or `git commit`. Note
in `progress.md` that commits are expected after each block, and suggest the commit
message template ("audit: B03 reviewed -- 0C / 2H / 5M / 1L").

The `progress.md` schema is defined in **Tracking File Schema** at the bottom.

---

## Phase 3: Coverage Assessment (per block)

Before reviewing a block, assess its test coverage. This does **not** gate the review
-- you review regardless. It gates the refactor recommendations in Phase 8.

For each block:

1. Locate its tests. Search `tests/`, `__tests__/`, `*_test.*`, `*.spec.*`, and
   whatever convention the repo uses.
2. Run them with coverage.
3. Capture pass/fail, line coverage, branch coverage.
4. Read a sample of the tests. **Critical:** tests that assert mock return values, or
   tests that cannot fail, count as **no coverage**. A green coverage number on
   tautological tests is worse than a red number -- it lies.

Classify each block:

- **REFACTOR-READY** -- meaningful tests exist, they run, they pass, they pin the
  public behavior. Refactor recommendations allowed in Phase 8.
- **COVERAGE-GAP** -- some real tests exist but important behaviors are unpinned.
  Refactor recommendations restricted to the covered surface.
- **TEST-DESERT** -- no tests, or only tautological tests. **Refactor recommendations
  blocked entirely.**

Record the classification in `progress.md`. Include numeric coverage if you have it,
but do not treat the number as authoritative -- the qualitative tests-actually-pin-behavior
check overrides.

Save baseline coverage to `coverage-baseline.json` **once**, at the start of the audit.
Never overwrite it.

---

## Phase 4: Per-Block Deep Review

For each block, in leaves-first order:

1. **Mark the block `in-progress`** in `progress.md`.
2. **Re-read the block's own code and its immediate neighbours.** Ignore findings
   already in your head from earlier blocks. You are starting fresh on this block.
3. **Apply `/skill:scrutinize` Phase 3** to this block's scope. All seven passes --
   see `skills/scrutinize/SKILL.md`. Cross-cutting concerns feed into scrutinize passes:
   - Error handling patterns -> Pass 4
   - Logging consistency -> Pass 4 (observability) + Pass 7 (convention fit)
   - Security boundaries, secrets, config side effects -> Pass 3
   - Dead code, duplication, complexity, naming -> Pass 5
   - Test adequacy -> Pass 6

4. **Research authoritative patterns** via the MCP docs library. Before prose queries,
   check the entity graph for blocks dominated by a named concept:
   - `docs_entity_lookup(name="<concept>")` -- prefer over re-deriving principles
   - `docs_entity_neighbors(name="<concept>")` -- adjacent techniques

   Then the usual two-stage prose retrieval:
   - `docs_semantic_search(query="clean architecture dependency rule boundaries")`
   - `docs_semantic_search(query="error handling exception patterns best practices")`
   - `docs_vault_document_read(file_path, section="...")` for full text
   - `docs_list_code_examples(language="<lang>")` for reference implementations

   Graph lookups are cheap no-ops when extraction hasn't run -- don't gate the pass on them.

5. **Write findings to `.audit/findings/<block-id>.md`** in scrutinize's
   severity-sectioned format. Prepend a header:
   ```
   # Block B03 -- auth-middleware
   Reviewed: <date>
   Coverage class: COVERAGE-GAP (line 71%, branch 44%, 3 tautological tests removed from denominator)
   Dependencies: B01 (token-crypto), B02 (session-store)
   Upstream consumers: (filled in during Phase 6)
   ```

6. **Update `progress.md`** -- set status to `done`, fill in finding counts per
   severity, note any cross-block references surfaced during review.

7. **Stop and context-reset before the next block.** If running in a single long
   session is causing earlier findings to bleed into later reviews, offer the user:
   *"I recommend running the next block in a fresh `/codebase-review resume`
   invocation to avoid context pollution. Proceed anyway, or pause?"*

**Critical discipline:** do **not** read other blocks' findings while reviewing this
block. Cross-block patterns are surfaced deliberately in Phase 6.

---

## Phase 5: Panel Review [3 GEMMA PERSONAS via docs_assist]

pi-mcp-local has no subagent pool. Replace the 3-Sonnet panel with three **independent
calls** to `docs_assist`. Each call carries only the evidence package and a persona
charter.

**Evidence package you prepare (pass as the `code` argument, JSON-encoded):**
- Symbol map with module sizes and complexity flags
- Dependency graph with coupling metrics
- Per-block findings from `.audit/findings/`
- Coverage classification per block
- Relevant patterns from MCP docs research
- Prior review findings from vault (if present)

Gemma (via `docs_assist`) cannot call MCP tools. All evidence must be pre-collected.

### Persona 1: The Architect

```
docs_assist(
    code=<evidence_package_json>,
    focus="architecture",
    question="""You are The Architect -- you evaluate structural integrity.

Given the codebase evidence below, evaluate:
- Does the architecture follow a consistent pattern?
- Are SOLID principles respected across modules?
- Are there abstraction leaks between layers?
- Is the dependency graph healthy or tangled?
- Are modules sized appropriately for their responsibility?
- Is the codebase organized for team scalability?

Focus on SYSTEMIC issues, not individual line-level problems.
Cite Clean Architecture, Clean Code, or Fundamentals of Software Architecture.

For each finding respond EXACTLY:
finding_id: [N]
persona: ARCHITECT
severity: CRITICAL | HIGH | MEDIUM | LOW
scope: module | cross-module | system
files: [affected file paths]
category: SRP | coupling | layers | abstraction | organization
issue: [the structural problem]
evidence: [metrics, symbol counts, dependency data]
source: [authoritative principle/book this violates]
recommendation: [specific refactoring approach]
confidence: HIGH | MEDIUM | LOW
"""
)
```

### Persona 2: The Reliability Engineer

```
docs_assist(
    code=<evidence_package_json>,
    focus="correctness",
    question="""You are The Reliability Engineer -- you evaluate operational resilience.

Given the codebase evidence below, evaluate:
- Will this system fail gracefully under load?
- Are errors handled consistently with sufficient context for debugging?
- Is logging adequate for diagnosing production incidents at 3 AM?
- Are there resource leaks, unbounded queues, or missing timeouts?
- Is configuration robust (validation, defaults, env handling)?
- Are there single points of failure?

Cite Site Reliability Engineering, Why Programs Fail, or DDIA.

For each finding respond EXACTLY:
finding_id: [N]
persona: RELIABILITY_ENGINEER
severity: CRITICAL | HIGH | MEDIUM | LOW
scope: module | cross-module | system
files: [affected file paths]
category: error-handling | logging | resources | config | resilience
issue: [what fails and how to trigger it]
evidence: [code references]
source: [authoritative principle this violates]
recommendation: [specific fix]
confidence: HIGH | MEDIUM | LOW
"""
)
```

### Persona 3: The Security Auditor

```
docs_assist(
    code=<evidence_package_json>,
    focus="security",
    question="""You are The Security Auditor -- you evaluate security posture.

Given the codebase evidence below, evaluate:
- Are all external entry points validated?
- Is authentication and authorization consistent?
- Are secrets managed properly (no hardcoded values)?
- Are there injection risks (SQL, command, path, template)?
- Is data exposure minimized (logs, errors, responses)?
- Are dependencies from trusted, maintained sources?
- Is the principle of least privilege followed?

Apply OWASP Top 10 and Defense in Depth.
Cite Security Engineering or Full Stack Python Security.

For each finding respond EXACTLY:
finding_id: [N]
persona: SECURITY_AUDITOR
severity: CRITICAL | HIGH | MEDIUM | LOW
scope: module | cross-module | system
files: [affected file paths]
category: injection | auth | data-exposure | secrets | access-control | crypto | dependencies
issue: [the vulnerability and attack vector]
evidence: [code references]
source: [authoritative principle this violates]
recommendation: [specific remediation]
confidence: HIGH | MEDIUM | LOW
"""
)
```

---

## Phase 6: Cross-Block Synthesis

This is the highest-value phase. Single-block reviews find local bugs; synthesis finds
systemic ones. Do not skip it.

Read every file in `.audit/findings/`. Identify:

1. **[SYSTEMIC]** -- the same smell in >= 2 blocks. One catch-log-continue is a bug;
   four catch-log-continues is a convention, and the convention is wrong.
2. **[COUPLING]** -- boundary mismatches. Block A returns shape X, block B expects
   shape Y. Hides because each block's own review finds nothing wrong.
3. **[DRIFT]** -- conflicting conventions. Block 3 uses `Result<T, E>`; block 7
   throws; block 9 returns `None`. Inconsistency across a codebase is almost always a
   bug waiting to happen.
4. **[ASSUMPTION]** -- shared false assumptions. Multiple blocks assume the same
   wrong thing about another block (e.g. all consumers of `session-store` assume it is
   in-memory; it is actually async).
5. **[ARCH]** -- architectural incoherence at scale. If many blocks' Pass-2 "describe
   the design philosophy in three sentences" answers contradict each other, the whole
   codebase has no spine.

Write `.audit/synthesis.md`. Cross-reference individual finding files for every pattern:

> *"[SYSTEMIC] Error-swallowing `catch {}` in B02, B04, B07. See findings/B02.md #H3,
> findings/B04.md #H1, findings/B07.md #M2."*

Fill in the `Upstream consumers` header of each `findings/<block-id>.md` now that the
full dependency picture is known.

---

## Phase 7: Adversarial Review [Gemini -- fresh context, independent evidence]

Gemini is the only reviewer in this pipeline with independent evidence gathering. Gemma
(via `docs_assist`) is harness-limited to the pre-collected evidence; Gemini CLI runs
with filesystem access in the repo and gemini-2.5-pro has a ~1M-token context window.
It can and should read actual source files, not just digest what the panel summarized.
Treat missed findings as at least as valuable as severity downgrades.

Write the consolidated findings + synthesis + codebase metrics + block->files map to a
temp JSON file. Pipe to Gemini from the repo root so the CLI can resolve relative paths:

```bash
cat /tmp/codebase_review_context.json | \
  GOOGLE_CLOUD_PROJECT=gen-lang-client-0060471158 \
  GOOGLE_CLOUD_LOCATION=us-central1 \
  gemini -m gemini-2.5-pro -p "<adversarial prompt below>"
```

Adversarial prompt:

```
You are the fourth reviewer on this codebase audit. Unlike the three panel
personas -- which are limited to the evidence package -- you can read files
directly. Use that. Before evaluating panel findings, independently read the
source files for any block with at least one HIGH or CRITICAL finding, plus
any block flagged in synthesis ([SYSTEMIC], [COUPLING], [DRIFT], [ASSUMPTION],
[ARCH]). File paths are in the block->files map below.

Then do five things, in order:

1. INDEPENDENT FINDINGS: What did the panel miss? Bugs, security issues,
   systemic patterns, observability gaps, deployment risks, scalability
   bottlenecks. Cite file:line.

2. VERIFY THE PANEL: Spot-check HIGH/CRITICAL findings against the actual
   code. Mark any that misread the code as FALSE_POSITIVE with a specific
   correction.

3. CHALLENGE SEVERITY: A 2000-line file is not automatically CRITICAL if it
   is well-organized. Downgrade where warranted, with reasoning.

4. PRIORITIZE RUTHLESSLY: If the team can fix only 5 things, which 5 have
   highest impact? Rank by blast_radius * probability * fix_cost.

5. EVALUATE PROPORTIONALITY: Is each proposed fix proportional to the risk?
   Do not refactor a module for a single violation.

Be specific. Every claim cites file:line. No vibes, no hedges.

PANEL FINDINGS AND EVIDENCE:
{all_findings_json}

SYNTHESIS PATTERNS:
{synthesis_md_content}

BLOCK -> FILES MAP (read these independently):
{block_file_map}

CODEBASE METRICS:
{symbol_count, module_sizes, coverage_report, dependency_stats}
```

---

## Phase 8: Consensus & Refactor Readiness

**8a. Aggregate Gemma panel votes.**

For overlapping findings (same file, same issue):
- 3/3 personas flagged -> HIGH_CONFIDENCE
- 2/3 personas flagged -> MEDIUM_CONFIDENCE + severity promoted one level
- 1/3 persona flagged -> LOW_CONFIDENCE

Weighted consensus scoring:
- HIGH confidence vote = 1.0
- MEDIUM confidence vote = 0.7
- LOW confidence vote = 0.4
- Total >= 2.4 -> HIGH_CONFIDENCE
- Total >= 1.5 -> MEDIUM_CONFIDENCE
- Total < 1.5  -> LOW_CONFIDENCE

Merge in synthesis tags from Phase 6: any finding that also appears in a `[SYSTEMIC]`
or `[COUPLING]` pattern gains +0.2 to its score.

**8b. Classify remediation.**

For every finding across all blocks, classify the remediation as one of:

- **INFORMATIONAL** -- observation only; no change required.
- **FIX-IN-PLACE** -- localised change that preserves behaviour; safe without a test
  suite if it is small enough to be obviously correct.
- **REFACTOR** -- restructures code without changing contracts. **Requires tests.**
- **REDESIGN** -- changes a contract or invariant. **Requires tests plus explicit
  design review.**

**8c. Apply the coverage gate.**

- For any **REFACTOR** or **REDESIGN** finding in a block classified **COVERAGE-GAP**
  or **TEST-DESERT**: mark the finding **BLOCKED -- characterization tests required
  first**. Do not output a diff. Do not output a proposed rewrite. Instead, list the
  specific characterization tests that must exist before this refactor can be
  proposed: what inputs, what observable outcomes, what invariants.
- For any finding in a **REFACTOR-READY** block: mark **READY** -- the finding may be
  acted on.

**Never output a refactor diff for a BLOCKED item.** If the user explicitly asks for
one, refuse and explain: *"Refactoring this without tests would be rearranging
behaviour blindly. I will write the characterization tests first -- confirm?"*

---

## Phase 9: Report & User Review

```markdown
## Codebase Review: [project/scope]

### Health Score: [0-100]

Formula: max(0, 100 - (critical * 25) - (high * 10) - (medium * 3))
Weighted by category:
- Security: 20%
- Architecture: 15%
- Error Handling: 15%
- Reliability: 15%
- Test Adequacy: 15%
- Code Quality: 10%
- Readability: 10%

### Health: [HEALTHY (80-100) | NEEDS_ATTENTION (60-79) | CRITICAL (<60)]

### Executive Summary
[3-5 sentences: scope, key findings, assessment, comparison to prior review]

### Block Inventory
| # | ID  | Name | LOC | Coverage | Class       | Status | C | H | M | L |
|---|-----|------|-----|----------|-------------|--------|---|---|---|---|

### Module Health Map
| Module | Lines | Coverage | Ca | Ce | Instability | Findings | Health |

### Synthesis Patterns
- [SYSTEMIC] ...
- [COUPLING] ...
- [DRIFT] ...
- [ASSUMPTION] ...
- [ARCH] ...

### HIGH CONFIDENCE Findings (3/3 personas)
1. **[Severity] [Category]** scope: [module|system]
   - Block: B03 (auth-middleware)
   - Files: `file1:line`, `file2:line`
   - Issue: ...
   - Consensus: [score] ([vote breakdown])
   - Adversarial: [Gemini's take]
   - Source: [authoritative reference]
   - Fix: [specific approach]
   - Refactor Readiness: READY | BLOCKED

### MEDIUM CONFIDENCE Findings (2/3 personas)
[With severity promotion applied]

### LOW CONFIDENCE (Manual Review)
[Single-persona findings for human judgment]

### Test Adequacy
| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Overall coverage | N% | 70% | PASS/FAIL |
| Modules below 50% | N | 0 | PASS/FAIL |
| Untested public APIs | N | 0 | PASS/FAIL |
| TEST-DESERT blocks | N | --- | [details] |

### Refactor Readiness

READY (safe to act on now):
- [B01:H2] ...
- [B05:M1] ...

BLOCKED on characterization tests (write these first):
- [B03:C1] ... -- required tests: (1) ..., (2) ..., (3) ...
- [B07:H3] ...

INFORMATIONAL (no action required):
- [B04:L1] ...

### Adversarial Counterpoints
[Where Gemini disagreed and the reasoning]

### Action Plan

**Immediate** (HIGH_CONFIDENCE + CRITICAL/HIGH, READY):
1. [action] -- effort: S/M/L -- blast radius: [scope]

**Next Sprint** (MEDIUM_CONFIDENCE or MEDIUM, READY):
1. [action]

**Blocked on Tests** (write characterization tests first):
1. [action with list of required tests]

**Backlog** (architectural debt):
1. [action]

### Comparison to Prior Review
[If vault has prior review notes: new findings, recurring, resolved]
```

**Present report to user. Ask:**
- Which findings to prioritize?
- Which to create tickets for?
- Any areas needing deeper investigation?
- Save findings to vault for future comparison?

---

## Tracking File Schema -- `.audit/progress.md`

```markdown
# Codebase Audit

Started: <ISO date>
Scope: <path>
Auditor: Claude /codebase-review
Strategy: <chosen segmentation strategy>
Focus: <area or "general">

## Status
- Total blocks: N
- Done: n
- In progress: n
- Pending: n
- Blocked on coverage: n

## Block Inventory

| # | ID  | Name | Path | Layer | Deps | LOC | Coverage | Class | Status | C | H | M | L |

## Cross-block flags surfaced during review
- [B02] references a convention from [B01] that may not exist -> confirm in synthesis

## Suggested commits (user-initiated)
- After Phase 2: `audit: initial inventory`
- After each block: `audit: B03 reviewed -- 0C / 2H / 5M / 1L`
- After Phase 6: `audit: cross-block synthesis complete`

## Log
- <date> Phase 1 complete -- 9 blocks identified
- <date> B01 reviewed -- 0C / 1H / 3M / 0L
```

Keep this file under 500 lines. Large audits spill detail into `findings/` and
`synthesis.md`.

---

## Key Constraints

- **Grep for declarations/imports BEFORE full-file reads** -- build the map first, then
  slice in targeted reads.
- **Two-stage MCP doc retrieval** -- `docs_semantic_search` then `docs_vault_document_read`.
- **Gemma (`docs_assist`) CANNOT call MCP tools** -- pre-collect evidence in Phases 1-4.
- **Run the three Gemma persona calls independently** -- do NOT feed one persona's
  response into another call.
- **Gemini adversarial review runs in FRESH context** -- no history leaks from earlier
  phases.
- **Block isolation** -- one block, one mind. Do not read other blocks' findings
  during Phase 4.
- **Leaves first, never roots first** -- a bad abstraction in a leaf propagates upward.
- **Coverage gates refactors, not reviews** -- surface findings regardless; block
  REFACTOR/REDESIGN on untested code.
- **No fabricated findings** -- empty severity buckets are valid.
- **Announce what was skipped** -- generated code, vendored deps, lockfiles.
- **Durable over fast** -- every phase writes to `.audit/`. Interruptions are
  expected. `resume` must work.
- **No git unless requested** -- AGENTS.md rule. Suggest commits in `progress.md`; do
  not run them.
- **Present BOTH panel and adversarial perspectives** to the user.
- **Cite authoritative sources** for every architectural finding.
- **User makes final prioritization decisions.**

---

## Principles

1. **`/skill:scrutinize` is the reviewer; this prompt is the lead.** Block
   segmentation, tracking, synthesis, coverage gating, and reporting are the lead's
   job. The 7-pass methodology lives in `/skill:scrutinize`.
2. **Synthesis is not optional.** Single-block reviews find local bugs. Cross-block
   synthesis finds systemic ones. A codebase audit without a synthesis phase has
   missed the most important category of finding.
3. **Refuse to rewrite blocked refactors.** If the user pushes for a refactor on an
   untested block, the correct answer is *"characterization tests first"* -- not
   *"ok, here's the diff, be careful."*
