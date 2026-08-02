#!/usr/bin/env bash
# Pre-commit hook: fail if vendored copies of infra/_common/ are out of sync.
# Install via: git config core.hooksPath scripts/contabo/hooks
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
python3 "$REPO_ROOT/scripts/contabo/sync-vendored-libs.py" --check
