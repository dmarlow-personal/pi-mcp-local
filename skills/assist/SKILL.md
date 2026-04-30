---
name: assist
description: Second-opinion code review and peer feedback from a local Qwen 3.6 27B LLM
---

# Assist Skill

Get code review, peer feedback, or alternative perspectives from a local Qwen 3.6 27B
model running as a standalone service via llama-server.

This is the pi-mcp-local equivalent of a subagent reviewer: when `/pr-review` or
`/codebase-review` need independent "panel" voices (Architect, Reliability, Security),
they call `docs_assist` with distinct persona prompts rather than spawning subagents.

---

## Usage

```
/skill:assist [code or file reference]
```

When invoked standalone, Claude will use the `docs_assist` tool to send code to Qwen 3.6 27B
for review. When invoked by `/pr-review` or `/codebase-review`, it runs as part of the
panel-review phase with persona-specific prompts.

---

## Available Tool

### docs_assist

Get code assistance from the local Qwen 3.6 27B LLM.

```
docs_assist(
    code: str,                    # Source code to review (required)
    question: str | None = None,  # Specific question about the code
    language: str | None = None,  # Programming language hint
    focus: str | None = None      # Review focus area
)
```

**Focus areas:**
- `security` -- Security vulnerabilities and secure coding practices
- `performance` -- Performance issues and optimization opportunities
- `readability` -- Code readability, maintainability, and clarity
- `correctness` -- Logic errors and edge cases
- `architecture` -- Architecture, design patterns, and SOLID principles

---

## Examples

### Basic code review

```
/skill:assist
```

Then provide the code to review.

### Review with specific focus

```
docs_assist(
    code="""
def process_user_input(user_data):
    query = f"SELECT * FROM users WHERE id = {user_data['id']}"
    return db.execute(query)
""",
    focus="security"
)
```

### Ask a specific question

```
docs_assist(
    code="def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)",
    question="How can I optimize this for large values of n?"
)
```

---

## Use as a Panel Reviewer

`/pr-review` and `/codebase-review` replace the 3-Sonnet subagent panel with three
sequential calls to `docs_assist`, each carrying a distinct persona prompt. The calls
are independent: Qwen 3.6 27B receives only the evidence package and a persona charter,
with no memory of the other personas' responses.

Example persona wrapper (issued by the review skills, not by the user directly):

```
docs_assist(
    code=<evidence_package_json>,
    focus="architecture",
    question="You are The Architect. Evaluate structural integrity: ..."
)
```

The three personas are:
- **The Architect** (focus=architecture) -- SOLID, boundaries, coupling, cohesion
- **The Reliability Engineer** (focus=correctness or performance) -- error paths,
  resource handling, operational resilience
- **The Security Auditor** (focus=security) -- OWASP-informed analysis of trust boundaries

Aggregate votes across the three calls exactly as a 3-Sonnet panel would (see
`/codebase-review` Phase 8 and `/pr-review` Phase 8 for consensus scoring).

---

## Configuration

The assist tool requires a Qwen 3.6 27B llama-server instance running on the assist port
with a code-specialized model.

**Environment variables:**
- `SECOND_OPINION_ENABLED` -- enable/disable the tool (default: true)
- `SECOND_OPINION_HOST` -- server URL
- `SECOND_OPINION_TIMEOUT` -- request timeout in seconds (default: 120)

**Start the server:** `make toolbox-start` (or the Qwen 3.6 27B target configured in the Makefile).

---

## Output Format

The tool returns structured feedback:

1. **Summary** -- 1-2 sentence overview
2. **Issues Found** -- with severity (Critical/Major/Minor)
3. **Suggestions** -- specific improvements
4. **Positive observations** -- what's done well

When used as a panel reviewer, the calling skill parses these sections into the standard
finding schema (finding_id, persona, severity, file:line, category, issue, evidence,
recommendation, confidence).
