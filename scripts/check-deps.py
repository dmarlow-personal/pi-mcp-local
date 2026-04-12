#!/usr/bin/env python3
"""Check and install dependencies from deps.json."""
import json
import subprocess
import sys

if len(sys.argv) < 2:
    print("Usage: check-deps.py <deps.json>", file=sys.stderr)
    sys.exit(1)

with open(sys.argv[1]) as f:
    deps = json.load(f)

missing = []
for tool in deps["tools"]:
    result = subprocess.run(tool["check"], shell=True, capture_output=True)
    if result.returncode == 0:
        print(f"  {tool['name']}: OK")
    else:
        print(f"  {tool['name']}: MISSING")
        missing.append(tool)

if not missing:
    print("All dependencies satisfied.")
    sys.exit(0)

print(f"Installing {len(missing)} missing dependencies...")
for tool in missing:
    print(f"  -> {tool['install']}")
    r = subprocess.run(tool["install"], shell=True)
    if r.returncode != 0:
        print(f"  FAILED: {tool['name']}", file=sys.stderr)
        sys.exit(1)

print("Dependencies installed.")
