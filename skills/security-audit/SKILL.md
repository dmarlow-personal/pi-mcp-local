---
name: security-audit
description: Full dependency security audit via docs_audit_repo_security with per-dependency evidence review
---

# Security Audit Skill

Runs a full dependency security audit on a project using the `docs_audit_repo_security`
MCP tool, then performs a Claude-powered review of the per-dependency evidence files.

---

## Usage

```
/skill:security-audit [project_path]
```

If no path is given, ask the user which project to audit.

---

## Prerequisites

The security audit runs on the **MCP server**, not in the audited project's environment.
Tree-sitter grammars, pattern definitions, and all scanning logic live server-side. No
dependencies need to be installed in the audited project.

**Do NOT run tree-sitter import checks in the current project.** The MCP server handles
all scanning internally. If the server is missing dependencies, the tool will return an
error -- that is an MCP server admin issue, not a project issue.

---

## Workflow

### Phase 1: Data Collection

1. **Resolve the project path** -- use the argument or ask the user.
2. **Invoke the MCP tool**:
   ```
   docs_audit_repo_security(project_path="<path>")
   ```
   Returns a **compact summary report** and writes **per-dependency evidence files** to
   `<project_path>/.security-audit/`. Each evidence file contains:
   - Pattern findings with source lines
   - Known CVEs from OSV
   - Metadata flags
   - Full tree-sitter symbol map (function signatures, imports, classes)

### Phase 2: Claude Review

1. **Read the summary report** -- identify all Critical and High rated deps.

2. **Read evidence files for each Critical/High dep** using the Read tool:
   ```
   Read: <project_path>/.security-audit/<dep_name>.md
   ```
   Read the files directly (not via subagents, since evidence lives in the target project
   directory which may be outside the CWD). Review the symbol map and pattern findings
   together. For each dep, determine:

   - **True positive or expected behavior?** Many patterns are normal for their ecosystem:
     - Neovim plugins: `vim.fn.system()` for git/shell, `loadstring()` in test harnesses
     - Rust crates: `unsafe {}` blocks, `Command::new()` for tooling
     - npm packages: `spawn()` in build tools
   - **Genuine supply chain risk indicators?**
     - Network calls to hardcoded IPs or unusual domains
     - Dynamic code loading from external sources (not local files)
     - Obfuscation patterns (base64 decode + eval)
     - Unusual file system writes outside expected paths
     - Credential or env-var access in unexpected contexts
   - **Suspicious structure in the symbol map?**
     - Functions combining network access + code execution
     - Imports of crypto/encoding libraries alongside shell execution
     - Test files executing real commands (not mocked)

### Phase 3: Final Assessment

1. **Present the final assessment** with:
   - A summary table with revised risk ratings (overriding heuristic where appropriate,
     with reasoning)
   - For each Critical/High finding: whether it's a true positive or expected ecosystem
     behavior, citing specific functions from the symbol map
   - Dependencies that warrant manual inspection (specific files to check)
   - Actionable recommendations (pin versions, replace deps, report upstream)

2. **Offer next steps** -- if genuine findings exist, suggest reviewing the flagged files
   or pinning to a safer version.

---

## Supported Lock File Formats

| Format              | Ecosystems detected    |
|---------------------|------------------------|
| `lazy-lock.json`    | Neovim lazy.nvim       |
| `pyproject.toml`    | Python (uv/poetry/pip) |
| `requirements.txt`  | Python (pip)           |
| `Cargo.lock`        | Rust (cargo)           |
| `package-lock.json` | Node.js (npm)          |

The tool auto-detects the format from the project directory.

---

## Baseline Persistence

Each audit saves a `baseline.json` alongside the evidence files. On subsequent runs,
findings that match the baseline keep their calibrated severity. NEW findings (not in
the baseline) bypass calibration and appear at full severity with `[NEW]` in the note.
This prevents ecosystem overrides from hiding newly introduced dangerous patterns.
