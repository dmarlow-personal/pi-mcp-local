SHELL := /bin/bash
PI_DIR := $(HOME)/.pi/agent
REPO_DIR := $(shell pwd)

.PHONY: install update uninstall status

## Install: pull latest, copy config, register package
install: pull
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
		d.update({'provider':'m1s1','model':'gemma-4-31B-it-UD-Q6_K_XL.gguf','defaultProvider':'m1s1','defaultModel':'gemma-4-31B-it-UD-Q6_K_XL.gguf'}); \
		json.dump(d,open(f,'w'),indent=2)"; \
		echo "  -> Set default provider to m1s1"; \
	else \
		echo "  -> Default provider already configured, skipping"; \
	fi
	@# Register as pi package (local path)
	@pi install $(REPO_DIR) 2>/dev/null || echo "  -> Run 'pi install $(REPO_DIR)' manually if pi is not in PATH"
	@echo ""
	@echo "=== Done ==="
	@echo "Edit MCP connection details in: $(REPO_DIR)/extensions/mcp-docs/index.ts"
	@echo "  MCP_URL  = your MCP server endpoint"
	@echo "  MCP_TOKEN = your bearer token"
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
