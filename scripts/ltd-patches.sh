#!/usr/bin/env bash
# Lists every LTD-PATCH(T-xxx) marker in tududi core, for review after an upstream merge.
# No markers: empty output, exit 0. A real grep error (exit 2) still fails. See docs/ltd/UPSTREAM.md.
set -euo pipefail
cd "$(dirname "$0")/.."
grep -rn "LTD-PATCH(" backend frontend public --include=*.js --include=*.ts --include=*.tsx --exclude-dir=node_modules | sort || [ $? -eq 1 ]
