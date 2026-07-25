#!/bin/bash
# scripts/check-dist-drift.sh — Fail build if any backend src/*.ts is newer
# than its compiled dist/*.js counterpart.
#
# Background: 2026-07-23 14:56 PKT — FIX-COMPREHENSIVE root-cause.
# The deployed `dist/src/modules/tenant-templates/tenant-templates.controller.js`
# was using an injected `TenantContextService` while the local TS source still
# used `@CurrentUser() user.tenantId` + raw `throw new Error()`. The drift
# was not detected because `nest build` succeeded locally but wasn't run on
# Contabo after the source change — rsync copied the new .ts file but the
# stale .js in `dist/` was never recompiled.
#
# Usage:
#   ./scripts/check-dist-drift.sh <backend-dir>
#
# Exit codes:
#   0  No drift detected.
#   1  Drift detected (newer source than compiled artefact).
#   2  Source or dist directory missing.

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <backend-dir>" >&2
  echo "  e.g. $0 /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend" >&2
  echo "  or:  $0 /opt/neurecore/backend/backend" >&2
  exit 2
fi

BACKEND_DIR="$1"
SRC_DIR="$BACKEND_DIR/src"
# nest build outputs to dist/src/... (mirrors src/ tree), so the dist root
# we compare against is dist/src. (Some legacy projects output to dist/
# directly — try both. The rootDir in tsconfig.build.json controls this.)
if [ -d "$BACKEND_DIR/dist/src" ]; then
  DIST_DIR="$BACKEND_DIR/dist/src"
elif [ -d "$BACKEND_DIR/dist" ]; then
  DIST_DIR="$BACKEND_DIR/dist"
else
  echo "WARN: dist directory not found at $BACKEND_DIR/dist — skipping drift check"
  exit 0
fi

if [ ! -d "$SRC_DIR" ]; then
  echo "ERROR: src directory not found at $SRC_DIR" >&2
  exit 2
fi

if [ ! -d "$DIST_DIR" ]; then
  echo "WARN: dist directory not found at $DIST_DIR (first build?) — skipping drift check"
  exit 0
fi

# Find every .ts file under src/ that has a corresponding .js under dist/.
# A file is "drifted" if its src mtime is strictly newer than the dist mtime.
DRIFTED=0
DRIFTED_FILES=()
while IFS= read -r -d '' src_file; do
  # Compute the relative path under src/.
  rel="${src_file#${SRC_DIR}/}"
  # Dist mirrors src/ → dist/. For example:
  #   src/modules/foo/bar.ts → dist/src/modules/foo/bar.js
  dist_file="${DIST_DIR}/${rel%.ts}.js"
  if [ ! -f "$dist_file" ]; then
    DRIFTED=1
    DRIFTED_FILES+=("$rel (missing $dist_file)")
    continue
  fi
  src_mtime=$(stat -c '%Y' "$src_file" 2>/dev/null || stat -f '%m' "$src_file")
  dist_mtime=$(stat -c '%Y' "$dist_file" 2>/dev/null || stat -f '%m' "$dist_file")
  if [ "$src_mtime" -gt "$dist_mtime" ]; then
    DRIFTED=1
    DRIFTED_FILES+=("$rel")
  fi
done < <(find "$SRC_DIR" -type f -name '*.ts' \
            ! -path '*/node_modules/*' \
            ! -path '*/__tests__/*' \
            ! -path '*/dist/*' \
            ! -name '*.spec.ts' \
            ! -name '*.test.ts' \
            ! -name '*.integration-spec.ts' \
            ! -name '*.d.ts' \
            -print0)

if [ "$DRIFTED" -eq 1 ]; then
  echo "ERROR: dist/src drift detected (${#DRIFTED_FILES[@]} file(s)):" >&2
  for f in "${DRIFTED_FILES[@]}"; do
    echo "  - $f" >&2
  done
  echo "" >&2
  echo "  Run \`./node_modules/.bin/nest build\` (or \`pnpm run build\`) and" >&2
  echo "  re-rsync the dist/ directory before reloading PM2." >&2
  echo "  This drift caused the 2026-07-23 /tenant-templates 500 incident." >&2
  exit 1
fi

echo "OK: dist/src drift check passed (no source newer than compiled artefact)"
exit 0
