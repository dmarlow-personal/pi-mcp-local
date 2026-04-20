---
name: agent-check
description: Structural checklist for validating Google ADK agent repos against production patterns
---

Validate an agent repo against production patterns from dynamic-journey-agent and
nutrition-activity-agent.

**Input**: `$ARGUMENTS` -- path to target repo (defaults to current directory).

---

## Phase 1: Discovery

Read or attempt all files below using Glob and Read in parallel. Missing files are data,
not errors.

**Target files:**
- `pyproject.toml` -- project metadata, dependencies
- `.pre-commit-config.yaml` -- pre-commit hooks
- `Makefile` -- developer targets
- `.env.example` / `.env.sample` -- env var documentation
- `.gitignore`, `README.md`, `AGENTS.md`, `CLAUDE.md` / `.claude/CLAUDE.md`
- `app/agent.py` / `src/*/agent.py` -- agent definition
- `app/config.py` / `src/*/config.py` -- configuration
- `app/agents/*.py` / `src/*/agents/*.py` -- sub-agent factories
- `app/tools/**/*.py` / `src/*/tools/**/*.py` -- tool definitions
- `app/a2a/*.py` / `src/*/a2a/*.py` -- A2A integration
- `app/domain/`, `app/infrastructure/`, `app/services/`, `app/shared/`, `app/callbacks/`, `app/prompts/`
- `a2a_server.py`, `Dockerfile`, `docker-compose.yml`, `deploy.py`
- `tests/` directory, `terraform/`, `.github/workflows/`, `scripts/`, `schemas/`, `docs/`
- `.editorconfig`, `.python-version`

---

## Phase 2: Analysis (13 Categories)

Status per item: PASS / FAIL / MISSING / N/A

### Category 1: Project Structure
- [ ] `app/` or `src/` main package exists
- [ ] Separated concerns: at least 3 of agents/, tools/, prompts/, domain/, services/
- [ ] `infrastructure/repositories/` for data access (repository pattern)
- [ ] `callbacks/` for agent lifecycle hooks
- [ ] `shared/` or `utils/` for cross-cutting code
- [ ] `a2a/` for A2A integration (N/A for standalone agents)
- [ ] `tests/` exists with `unit/` and `integration/` separated
- [ ] `scripts/` and `schemas/` directories
- [ ] No source files in root

### Category 2: Configuration and Environment
- [ ] `pyproject.toml` with `[project]` metadata
- [ ] Settings via BaseSettings or @dataclass centralizes config
- [ ] No hardcoded API keys, model names, or URLs in source
- [ ] `.env.example` documents all required variables
- [ ] `.env` in `.gitignore`
- [ ] `.python-version` exists
- [ ] Agent models configurable via env vars
- [ ] Context cache config via env vars

### Category 3: Pre-commit and Code Quality
- [ ] `.pre-commit-config.yaml` exists with `fail_fast: true`
- [ ] Standard hooks: trailing-whitespace, end-of-file-fixer, check-yaml, check-merge-conflict
- [ ] `check-added-large-files` with maxkb limit
- [ ] `debug-statements` hook
- [ ] Ruff format + lint (with `--fix`) hooks
- [ ] Mypy with strict settings
- [ ] Codespell hook
- [ ] Secret detection: `detect-private-key` or `detect-secrets`
- [ ] Pre-commit installed: `.git/hooks/pre-commit` exists

### Category 4: Agent Architecture (Google ADK)
- [ ] Root agent defined with `Agent()` class
- [ ] `App()` wrapper with `context_cache_config` and `ContextCacheConfig`
- [ ] `StreamingMode.SSE` in RunConfig
- [ ] Prompts in `prompts/` with builder functions, not inline strings
- [ ] Prompt `__init__.py` exports via `__all__`
- [ ] `before_agent_callback` for user context loading
- [ ] `after_agent_callback` for post-processing (N/A if not needed)
- [ ] Sub-agent pattern: `AgentTool(agent=...)` (N/A for single-agent)
- [ ] Sub-agent factories in `agents/`, tools in `tools/` (not inline)
- [ ] Tool modules use lazy-init singletons for dependencies
- [ ] Tool `__init__.py` re-exports via `__all__`
- [ ] Session context keys centralized in `shared/context_keys.py`
- [ ] Agent model from config, not hardcoded
- [ ] `__all__` in agent.py
- [ ] Sub-agent `description=` fields serve as LLM routing contracts
- [ ] `output_key` for inter-agent state passing (N/A if not needed)
- [ ] `include_contents` handoff control (N/A for single-agent)
- [ ] Plugins for cross-cutting concerns (N/A for single-agent)
- [ ] Artifact service for large data externalization (N/A if text-only)

### Category 5: A2A Integration
Mark entire category N/A if no `a2a_server.py` and no `a2a-sdk` dependency.
- [ ] `a2a_server.py` at repo root with `AgentCardBuilder`
- [ ] `StreamingRemoteA2aAgent` subclass in `a2a/` (orchestrator only)
- [ ] All sub-agents use `StreamingRemoteA2aAgent` (orchestrator only)
- [ ] `genai_part_converter` filters unsupported MIME types (orchestrator only)
- [ ] Starlette/ASGI app with startup handler
- [ ] `a2a-sdk` in dependencies, `make a2a-server` target
- [ ] Dual connection modes: local (HTTP) and cloud (Vertex AI)
- [ ] Per-agent timeout and port via env vars

### Category 6: Guardrails and Safety
- [ ] `before_model_callback` for input validation
- [ ] `after_model_callback` for output sanitization (N/A if not needed)
- [ ] `before_tool_callback` for argument validation
- [ ] Guardrail state tracking in session state
- [ ] Tool Context defensive design (validate model params against policies)
- [ ] Model output escaped in UI rendering (N/A for API-only)
- [ ] Security callbacks as plugins (N/A for single-agent)
- [ ] Code execution sandboxed (N/A if no code execution)

### Category 7: Testing
- [ ] `tests/unit/` and `tests/integration/` with test files
- [ ] `tests/conftest.py` with integration skip fixtures
- [ ] pytest markers for integration, `asyncio_mode = "auto"`, `pythonpath = "."`
- [ ] Helper functions for test assertions
- [ ] Multi-turn conversation tests
- [ ] Tool invocation validation tests
- [ ] ADK evaluation files (`.evalset.json` / `.test.json`)
- [ ] `test_config.json` with score thresholds
- [ ] `AgentEvaluator.evaluate()` in pytest

### Category 8: Integration Testing Framework
- [ ] `pytest-recording` (VCR.py) in dev deps with cassettes directory
- [ ] VCR config: `filter_headers` for auth tokens
- [ ] Integration tests excluded from CI
- [ ] Separate targets: `make test-unit`, `make test-integration`
- [ ] Fake/stub repositories for external data

### Category 9: Makefile and Developer Experience
- [ ] `make install`, `make test`, `make lint`, `make lint-fix`
- [ ] `make pre-commit`, `make pre-commit-install`
- [ ] `make playground`, `make playground-debug`
- [ ] `make setup-local-env`

### Category 10: Documentation
- [ ] `README.md` with setup instructions
- [ ] `AGENTS.md` or `CLAUDE.md` with coding standards (linting, type hints, git policy)
- [ ] `.env.example` documents all env vars
- [ ] `docs/` directory with architecture diagrams

### Category 11: Performance Optimization
- [ ] Context caching enabled by default with `min_tokens` and TTL configured
- [ ] Streaming SSE configured
- [ ] Model selection optimized (flash for simple, pro for complex)
- [ ] Thinking/extended thinking enabled where applicable
- [ ] `cachetools` in dependencies
- [ ] Context compaction strategy for long conversations (N/A for single-turn)

### Category 12: Observability and Telemetry
- [ ] OpenTelemetry integration
- [ ] Structured event logging (typed records, not opaque strings)
- [ ] Agent tracing: tool calls, model invocations, handoffs as spans
- [ ] Token usage tracking per interaction
- [ ] DEBUG logging target for local dev

### Category 13: Deployment and Infrastructure
- [ ] `deploy.py` or deployment script
- [ ] `terraform/` for infrastructure
- [ ] `.github/workflows/` for CI/CD
- [ ] Container config (Dockerfile or cloudbuild.yaml)
- [ ] `make deploy-*` targets
- [ ] Environment-specific config (dev/staging/production)
- [ ] `.editorconfig`

---

## Phase 3: Report

```markdown
## Agent Check Report: <repo-name>

### Summary
- Total: N | Passed: N (N%) | Failed: N | Missing: N | N/A: N

### Category Scores
(list each category with X/Y score and status)

Status thresholds: 90%+ Excellent, 75-89% Good, 50-74% Needs Work, <50% Missing

### Detailed Findings
(every FAIL and MISSING with: what expected, what found, why it matters)

### Priority Actions
- HIGH: security issues, missing tests, missing pre-commit
- MEDIUM: missing docs, incomplete Makefile, missing config externalization
- LOW: missing .editorconfig, schemas dir, cosmetic issues
```

---

## Execution Rules

1. Direct structural analysis only -- Read, Glob, Grep. No MCP tools or agents.
2. Report findings. Do not generate code or modify files.
3. Run all independent reads in parallel.
4. A2A category is conditional -- N/A if no a2a_server.py and no a2a-sdk.
5. FAIL = exists but wrong. MISSING = does not exist. N/A items excluded from score.
