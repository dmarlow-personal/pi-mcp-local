---
description: Analyze prompts for redundancy, weak enforcement, and verbosity
---

Review and optimize the prompt file: $ARGUMENTS

## Step 1: Read the Prompt

Read the file specified by the argument.

## Step 2: Analysis

Analyze against this checklist:

| Issue | Detection | Fix |
|-------|-----------|-----|
| Redundancy | Same concept 2+ times | Consolidate to single location |
| Verbosity | Can be shorter | Apply density of expression |
| Weak enforcement | "should" / "try to" / "consider" | Use stronger directives |
| Overtriggering | 3+ CRITICAL/MUST in proximity | Reduce, use structure instead |
| Missing structure | No headings | Add hierarchical organization |
| No checkpoints | Requirements without verification | Add checkpoint format |
| Buried intent | Key instructions in paragraphs | Pull to top, use tables |

For each issue: note type, location, specific text, proposed fix.

## Step 3: Propose Changes

Combine findings into a refined version.

## Output Format

```markdown
## Prompt Review: [filename]

### Summary
- Lines: X -> Y (Z% reduction)
- Issues found: N by type

### Issues Found
#### 1. [Issue Type]: [description]
**Location**: Lines X-Y
**Original**: > [quoted text]
**Fix**: [what to change]

### Proposed Changes
[Before/after comparison]

### Verification
1. All identified issues addressed
2. No new redundancies introduced
3. Structure validates
```
