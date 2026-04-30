---
name: gemini
description: Query Gemini for adversarial review, alternative perspectives, or independent file-reading analysis
---

# Gemini Skill

Consult Gemini (Google's LLM) for peer review, alternative perspectives, or domain
expertise. Gemini runs as an external CLI with filesystem access and a ~1M-token context
window -- it can independently read source files rather than rely on a digest.

Used both standalone and by the adversarial phases of `/pr-review`, `/codebase-review`,
`/research`, and `/prompt-review`.

---

## Workflow

### 1. Build structured JSON context

```json
{
  "system_prompt": "<see template below>",
  "project_context": {
    "name": "<project>",
    "description": "<what it does>",
    "tech_stack": ["..."],
    "current_branch": "<branch>",
    "code_standards": "<key AGENTS.md points>"
  },
  "conversation_history": ["<last 10 turns only>"],
  "current_files": [{"path": "...", "relevant_lines": "...", "content": "..."}],
  "user_query": "{{prompt}}"
}
```

**System prompt template:**

```
You are Gemini, a code review consultant in read-only mode. Tools available:
read_file, search_file_content, web_fetch.

Do NOT use run_shell_command or file modification tools.

Your role:
1. PEER REVIEW: Objectively review Claude's analysis and recommendations
2. ALTERNATIVE APPROACHES: Suggest solutions Claude may not have considered
3. CHALLENGE ASSUMPTIONS: Identify edge cases, issues, or flawed reasoning
4. CONSTRUCTIVE FEEDBACK: Provide specific, actionable improvements
```

### 2. Execute Gemini CLI

Write JSON to a temp file and pipe via stdin (avoids ARG_MAX limits). Invoke from the
repo root so Gemini can resolve relative paths:

```bash
cat /tmp/gemini_context.json | \
  GOOGLE_CLOUD_PROJECT=gen-lang-client-0060471158 \
  GOOGLE_CLOUD_LOCATION=us-central1 \
  gemini -m gemini-2.5-pro -p "{{prompt}}"
```

Do NOT pass JSON as a positional argument.

### 3. Present results

- Show Gemini's complete response
- Provide your evaluation: where you agree, disagree, and additional insights
- Recommend how to proceed based on both perspectives

---

## Gemini vs docs_assist

Both tools are peer reviewers, but they serve different phases:

| Tool | Invoked by | Role | Independence |
|------|------------|------|--------------|
| `docs_assist` (Qwen 3.6 27B, local) | `/skill:assist`, panel phases of `/pr-review` and `/codebase-review` | Three-persona panel validator | Limited to evidence package provided |
| `gemini` CLI (remote) | `/skill:gemini`, adversarial phases of review skills | Fourth reviewer with independent file reads | Full filesystem access, fresh context |

Use Gemini when you need a reviewer that can independently open files and read neighbours
to challenge the panel's digest. Use Qwen (`docs_assist`) when you need three parallel
persona votes on a pre-collected evidence package.

---

## Notes

- Limit conversation history to the last 10 turns (prevents TPM 429 errors)
- Be objective -- if Gemini has valid points, acknowledge them
- If Gemini reveals gaps in your analysis, be transparent
- Gemini runs in a **fresh context** -- the calling session's history does not leak in
  unless you include it in the JSON payload
