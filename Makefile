SHELL := /bin/bash
PI_DIR := $(HOME)/.pi/agent
REPO_DIR := $(shell pwd)

.PHONY: install update uninstall status deps gemma4 qwen-122B

## Install external tool dependencies listed in deps.json
deps:
	@echo "=== Checking dependencies ==="
	@python3 -c "\
	import json, subprocess, sys; \
	deps = json.load(open('$(REPO_DIR)/deps.json')); \
	missing = []; \
	for tool in deps['tools']: \
	    result = subprocess.run(tool['check'], shell=True, capture_output=True); \
	    if result.returncode == 0: \
	        print(f\"  {tool['name']}: OK\"); \
	    else: \
	        print(f\"  {tool['name']}: MISSING\"); \
	        missing.append(tool); \
	if not missing: \
	    print('All dependencies satisfied.'); sys.exit(0); \
	print(f'Installing {len(missing)} missing dependencies...'); \
	for tool in missing: \
	    print(f'  -> {tool[\"install\"]}'); \
	    r = subprocess.run(tool['install'], shell=True); \
	    if r.returncode != 0: \
	        print(f'  FAILED: {tool[\"name\"]}', file=sys.stderr); sys.exit(1); \
	print('Dependencies installed.')"

## Install: pull latest, copy config, register package
install: pull deps
	@echo "=== Installing pi-mcp-local ==="
	@# Copy AGENTS.md (auto-loaded context file)
	@cp -v $(REPO_DIR)/AGENTS.md $(PI_DIR)/AGENTS.md
	@# Copy model config if not already present
	@if [ ! -f $(PI_DIR)/models.json ]; then \
		cp -v $(REPO_DIR)/models.example.json $(PI_DIR)/models.json; \
		echo "  -> Copied models.json (edit MCP_URL and MCP_TOKEN in extensions/mcp-docs/index.ts)"; \
	else \
		echo "  -> models.json already exists, skipping (see models.example.json for reference)"; \
	fi
	@# Set default provider if not already configured
	@if ! grep -q '"defaultProvider"' $(PI_DIR)/settings.json 2>/dev/null; then \
		python3 -c "import json; \
		f='$(PI_DIR)/settings.json'; \
		d=json.load(open(f)) if __import__('os').path.exists(f) else {}; \
		d.update({'provider':'m1s1','model':'Qwen3.5-122B-A10B-UD-Q5_K_XL.gguf','defaultProvider':'m1s1','defaultModel':'Qwen3.5-122B-A10B-UD-Q5_K_XL.gguf'}); \
		json.dump(d,open(f,'w'),indent=2)"; \
		echo "  -> Set default provider to m1s1"; \
	else \
		echo "  -> Default provider already configured, skipping"; \
	fi
	@# Register as pi package (local path)
	@pi install $(REPO_DIR) 2>/dev/null || echo "  -> Run 'pi install $(REPO_DIR)' manually if pi is not in PATH"
	@# Copy .env from example if not present
	@if [ ! -f $(REPO_DIR)/.env ]; then \
		cp -v $(REPO_DIR)/.env.example $(REPO_DIR)/.env; \
		echo "  -> Copied .env from .env.example (edit with your MCP credentials)"; \
	else \
		echo "  -> .env already exists, skipping"; \
	fi
	@echo ""
	@echo "=== Done ==="
	@echo "Set MCP connection details via environment variables or in .env:"
	@echo "  PI_MCP_URL   = your MCP server endpoint"
	@echo "  PI_MCP_TOKEN = your bearer token"
	@echo ""
	@echo "Start pi to verify: pi"

## Update: pull latest changes, sync AGENTS.md
update: pull
	@echo "=== Updating pi-mcp-local ==="
	@cp -v $(REPO_DIR)/AGENTS.md $(PI_DIR)/AGENTS.md
	@echo "  -> AGENTS.md synced"
	@echo "  -> Extensions/skills/prompts update automatically via package link"
	@echo "=== Done. Run /reload in pi to apply ==="

## Pull latest from git
pull:
	@if [ -d .git ]; then \
		echo "=== Pulling latest ===" && \
		git pull --ff-only 2>/dev/null || echo "  -> Not a git repo or no remote configured"; \
	fi

## Uninstall: remove package registration and config files
uninstall:
	@echo "=== Uninstalling pi-mcp-local ==="
	@pi remove $(REPO_DIR) 2>/dev/null || echo "  -> Package not registered"
	@rm -f $(PI_DIR)/AGENTS.md && echo "  -> Removed AGENTS.md"
	@echo "  -> models.json and settings.json left intact (manual cleanup if needed)"
	@echo "=== Done ==="

## Swap model: shared helper (call via model swap targets below)
## Usage: $(MAKE) _swap-model ID=... NAME=... CTX=... REASONING=...
_swap-model:
	@python3 -c "\
	import json; \
	mf='$(PI_DIR)/models.json'; sf='$(PI_DIR)/settings.json'; \
	m=json.load(open(mf)); \
	m['providers']['m1s1']['models']=[{ \
	  'id':'$(ID)','name':'$(NAME)','reasoning':$(REASONING), \
	  'input':['text'],'contextWindow':$(CTX), \
	  'cost':{'input':0,'output':0,'cacheRead':0,'cacheWrite':0}}]; \
	json.dump(m,open(mf,'w'),indent=2); \
	s=json.load(open(sf)); \
	s.update({'model':'$(ID)','defaultModel':'$(ID)'}); \
	json.dump(s,open(sf,'w'),indent=2)"
	@echo "Switched to: $(NAME)"
	@echo "  Model:   $(ID)"
	@echo "  Context: $(CTX)"
	@echo "  Run /reload in pi to apply"

## Swap to Gemma 4 31B
gemma4:
	@$(MAKE) --no-print-directory _swap-model \
		ID="gemma-4-31B-it-UD-Q6_K_XL.gguf" \
		NAME="Gemma 4 31B (M1:S1)" \
		CTX=262144 \
		REASONING=false

## Swap to Qwen3.5 122B A10B
qwen-122B:
	@$(MAKE) --no-print-directory _swap-model \
		ID="Qwen3.5-122B-A10B-UD-Q4_K_XL.gguf" \
		NAME="Qwen3.5 122B A10B (M1:S1)" \
		CTX=262144 \
		REASONING=true

## Status: show what's installed
status:
	@echo "=== pi-mcp-local status ==="
	@echo "Repo: $(REPO_DIR)"
	@echo "Git:  $$(git log --oneline -1 2>/dev/null || echo 'not a git repo')"
	@echo ""
	@echo "Live files:"
	@[ -f $(PI_DIR)/AGENTS.md ] && echo "  AGENTS.md: installed" || echo "  AGENTS.md: MISSING"
	@[ -f $(PI_DIR)/models.json ] && echo "  models.json: installed" || echo "  models.json: MISSING"
	@echo ""
	@echo "Package registration:"
	@pi list 2>/dev/null | grep -i "mcp-local" || echo "  Not registered (run 'make install')"
