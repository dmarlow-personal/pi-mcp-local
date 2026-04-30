---
description: Systematic debugging using Agans' 9 Rules and Zeller's scientific method
---

Guide systematic debugging of: $@

## Sources

Search MCP docs for methodology details:
- `docs_semantic_search(query="debugging rules divide conquer make it fail")` -- Agans
- `docs_semantic_search(query="delta debugging scientific method hypothesis")` -- Zeller

Use `docs_vault_document_read(file_path, section)` for full text after search.

---

## Phase 1: Understand the Problem

### Gather information
- What exactly is failing? (error, wrong output, crash)
- When did it start? Has it ever worked? What changed?
- Expected vs actual behavior
- Can you reproduce consistently?
- Environment: runtime version, OS, dependencies, recent changes
- Logs, error messages, stack traces

### Define success criteria
How will we know the bug is fixed? What edge cases to consider?

---

## Phase 2: Apply the 9 Rules

**Rule 1 -- Understand the System**
Locate the failing code. Pick the cheapest navigator:

```
docs_cg_search(query="<error class or function>")
  -> "code-graph not reachable" / empty for known symbol
       -> bridge unavailable. Use LSP (TypeScript) or Grep. Don't retry.
  -> hits returned -> /skill:code-graph to unlock cg_get_symbol,
                      cg_reachability, etc.
```

Then `Read(file, offset=line-5, limit=30)` for the slice. Trace imports/callers
via `docs_cg_reachability(direction="backward")` when the bridge is up,
`lsp_references` for TypeScript, or another `Grep` pass otherwise. Never open
whole files to "orient".

**Rule 2 -- Make It Fail**
Create minimal reproduction case. Document exact steps. Identify trigger conditions.

**Rule 3 -- Quit Thinking and Look**
Observe actual behavior. Add logging at critical points. Use debugger. Check actual
variable values -- don't assume.
For exact errors: `docs_search_all_docs(query="exact error message", rewrite=false)`.
The default `rewrite=true` rewrites the query into prose -- pass `rewrite=false`
for true exact-text matching of error strings, identifiers, and library symbols.

**Rule 4 -- Divide and Conquer**
Binary search through code/data. Isolate components. Test at boundaries.
`git bisect` to find breaking commit. Narrow the call chain with the
cheapest navigator available: `docs_cg_reachability(direction="backward")`
when the bridge is up, `lsp_references` for TypeScript, or `Grep` for
callers and call sites otherwise.

**Rule 5 -- Change One Thing at a Time**
One change, test, observe. Revert if it doesn't help. Commit each attempt.

**Rule 6 -- Keep an Audit Trail**
Document hypotheses, changes, results. Keep error messages and logs.

**Rule 7 -- Check the Plug**
Question assumptions: service running? path correct? permissions set? env var set?
Restarted after change? Editing the right file? Virtual env activated? Right runtime version?

**Rule 8 -- Get a Fresh View**
Rubber duck debugging. Take a break. Read code bottom to top.
Optional: invoke `/skill:gemini` for an alternative perspective, or `/skill:assist`
for a Qwen peer review of the suspected root-cause hypothesis.

**Rule 9 -- If You Didn't Fix It, It Ain't Fixed**
Test original reproduction case + edge cases. Run full test suite.
Understand WHY the fix works. Check for similar bugs elsewhere.

---

## Phase 3: Scientific Method (if 9 Rules didn't resolve)

1. **Observe** -- collect data about the failure
2. **Hypothesize** -- form testable hypotheses
3. **Predict** -- what should happen if the hypothesis is correct?
4. **Experiment** -- test the hypothesis
5. **Conclude** -- confirmed or rejected?

For complex cases: `git bisect`, minimize test case, isolate exact breaking change.

---

## Phase 4: Resolution

### Document root cause
What was the problem? Why did it happen? What fixed it? How to prevent it?

### Apply and verify
- Implement fix
- Add regression tests
- Run linting and test suite
- Test original case + edge cases

---

## Output Format

Structure debugging sessions as:
1. **Problem Statement** -- description, repro steps, expected vs actual
2. **Methodology** -- which rules applied, searches executed, citations
3. **Hypotheses Tested** -- what you tested, results
4. **Root Cause** -- source of problem, why it occurred
5. **Solution** -- fix, why it works, tests added
6. **Prevention** -- how to avoid in future
