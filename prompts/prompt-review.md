---
description: Analyze prompts for redundancy, weak enforcement, and verbosity; refine using proven optimization techniques
---

Review and optimize the prompt file: $ARGUMENTS

Apply the same optimization techniques used on AGENTS.md:
- XML tags for structural enforcement
- Consolidation of redundant content
- 10:1 read/write ratio (scannable)
- Hard stops for critical requirements
- Sparse use of "CRITICAL/MUST" to avoid overtriggering

---

## Step 1: Read the Prompt

Read the file specified by `$ARGUMENTS`. If no argument provided, ask the user which
file to analyze.

```
Read(file_path="$ARGUMENTS")
```

---

## Step 2: Claude Analysis

Analyze the prompt against this criteria checklist:

| Issue | Detection | Fix |
|-------|-----------|-----|
| Redundancy | Same concept appears 2+ times | Consolidate to single location with reference |
| Verbosity | Explanation can be shorter | Apply density of expression |
| Weak enforcement | "should" / "try to" / "consider" | Use XML enforcement blocks with hard stops |
| Overtriggering | 3+ CRITICAL/MUST in close proximity | Reduce to 1, use structure instead |
| Missing structure | No headings, no XML tags | Add hierarchical organization |
| No checkpoints | Requirements without verification | Add checkpoint format with checkboxes |
| Buried intent | Key instructions in paragraphs | Pull to top, use tables |

For each issue found, note:
- Issue type
- Location (line numbers or section)
- Specific text
- Proposed fix

---

## Step 3: Gemini Review (ALWAYS RUNS)

Build JSON payload for Gemini:

```json
{
  "system_prompt": "You are a prompt engineering consultant reviewing prompts for Claude. Analyze the provided prompt content and Claude's initial findings. Your role:\n\n1. FIND ISSUES CLAUDE MISSED: Identify redundancies, weak enforcement, or structural problems not in Claude's analysis\n2. SUGGEST ALTERNATIVES: Propose different structural approaches (XML tags, tables, checkpoints)\n3. PHRASING IMPROVEMENTS: Suggest wording that triggers better LLM compliance\n4. CHALLENGE FIXES: If you disagree with Claude's proposed fixes, explain why\n5. PRIORITIZE: Which issues matter most for this specific prompt?\n\nBe specific. Reference line numbers or quote text. Focus on actionable improvements.",
  "prompt_content": "<full prompt file content>",
  "claude_findings": [
    {"issue": "<type>", "location": "<where>", "text": "<what>", "fix": "<how>"}
  ],
  "analysis_criteria": "Redundancy, Verbosity, Weak enforcement, Overtriggering, Missing structure, No checkpoints, Buried intent",
  "user_query": "Review this prompt. Find issues Claude missed. Suggest alternative structural approaches. Challenge fixes where appropriate."
}
```

Write JSON to temp file, pipe via stdin:

```bash
cat /tmp/prompt_review_context.json | \
  GOOGLE_CLOUD_PROJECT=gen-lang-client-0060471158 \
  GOOGLE_CLOUD_LOCATION=us-central1 \
  gemini -m gemini-2.5-pro -p "Review this prompt per the system_prompt and claude_findings in the JSON payload."
```

See `/skill:gemini` for the full invocation pattern.

---

## Step 4: Synthesize and Propose

Combine Claude + Gemini findings into final recommendation.

### Resolve Disagreements

| Situation | Resolution |
|-----------|------------|
| Both agree on issue | Include in final |
| Gemini found issue Claude missed | Add to findings |
| Gemini disagrees with Claude fix | Present both options, recommend one |
| Conflicting approaches | Evaluate against criteria, pick best |

### Build Consolidated Fix

Apply all agreed fixes to produce a refined version.

---

## Output Format

```markdown
## Prompt Review: [filename]

### Summary
- Lines: X -> Y (Z% reduction)
- Redundancies found: N
- Enforcement issues: N
- Structural issues: N

### Issues Found

#### 1. [Issue Type]: [description]
**Location**: Lines X-Y / Section name
**Original**:
> [quoted text]

**Fix**: [what to change]

### Proposed Changes

<details>
<summary>Before (lines X-Y)</summary>

[original text]

</details>

<details>
<summary>After</summary>

[refined text]

</details>

### Gemini Perspective

[Summary of Gemini's unique findings and alternative suggestions]

### Synthesis

[Combined recommendation addressing all findings from both analyses]

### Verification

To verify the refined prompt:
1. Check that all identified issues are addressed
2. Ensure no new redundancies were introduced
3. Confirm CRITICAL/MUST count is appropriate
4. Validate XML tags are properly closed
```

---

## Quick Reference

```
1. Read prompt file ($ARGUMENTS)
2. Claude analysis (apply criteria checklist)
3. Gemini review (always runs)
4. Synthesize findings
5. Produce refined version with comparison
```

---

## Principles Applied

From **Anthropic Claude 4.x Best Practices**:
- XML tags for structural enforcement (`<enforcement>`, `<do_not_act_before_instructions>`)
- Be explicit -- Claude 4.x takes instructions literally
- Avoid overtriggering -- Opus 4.x is sensitive to "CRITICAL/MUST"

From **Clean Code**:
- Readability through clarity, simplicity, density of expression
- 10:1 read/write ratio -- make instructions scannable

From **Why Programs Fail**:
- Assertions/checkpoints catch violations early
- Preconditions document requirements
