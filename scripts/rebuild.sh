#!/bin/bash
# NeureCore on-Contabo rebuild script.
# Run ON CONTABO (via `ssh contabo 'bash /opt/neurecore/rebuild.sh <app>'`),
# OR copy /opt/neurecore/ecosystem.config.js + this script together.
#
# Usage:
#   ./rebuild.sh tenant   # rebuild only frontend-tenant
#   ./rebuild.sh admin    # rebuild only frontend-admin
#   ./rebuild.sh backend  # rebuild only backend (NestJS + prisma)
#   ./rebuild.sh all      # rebuild all three + reload PM2
#
# Replaces the old /var/www/... rebuild.sh that targeted a now-defunct layout.
#
# FIX-COMPREHENSIVE-R3 (2026-07-24):
#   - The dist/src drift gate (`scripts/check-dist-drift.sh`) runs in
#     `scripts/deploy.sh` BEFORE rsync (locally), so a forgotten local
#     `nest build` is caught before the source ships. This script does
#     NOT re-run the drift check because rsync excludes `dist/`, so the
#     server's dist/ is always stale until `nest build` runs (which
#     this script then does on the server). The drift gate in deploy.sh
#     is the single source of truth.
#   - Lockfile drift detection: when pnpm install --frozen-lockfile fails
#     with `ERR_PNPM_OUTDATED_LOCKFILE` (caused by `compression` + `lru-cache`
#     added 2026-07-21 but not regenerated into pnpm-lock.yaml), fall back
#     to `pnpm install --no-frozen-lockfile` automatically.

set -euo pipefail

LOG=/tmp/rebuild.log
APP="${1:-all}"
NEURECORE_ROOT="/opt/neurecore"

echo "=== Rebuild started ($(date)) app=$APP ===" | tee -a "$LOG"

BACKEND_DIR="$NEURECORE_ROOT/backend/backend"
TENANT_DIR="$NEURECORE_ROOT/frontend-tenant"
ADMIN_DIR="$NEURECORE_ROOT/frontend-admin"
ECOSYSTEM="$NEURECORE_ROOT/ecosystem.config.js"

# --- pnpm install helper (FIX-COMPREHENSIVE-R3) ----------------------------
# Tries `pnpm install --frozen-lockfile` first (deterministic). If the
# lockfile is stale relative to package.json (rare — happens when
# package.json gets new deps without regenerating the lockfile), falls
# back to `--no-frozen-lockfile` with a loud WARN to the operator.
pnpm_install() {
  local dir="$1"
  local app_name="$2"
  cd "$dir"
  if command -v pnpm &> /dev/null && [ -f pnpm-lock.yaml ]; then
    if ! pnpm install --frozen-lockfile 2>&1 | tail -10; then
      echo "WARN[$app_name]: --frozen-lockfile failed; retrying with --no-frozen-lockfile" | tee -a "$LOG"
      echo "WARN[$app_name]: this indicates lockfile drift (see memory-bank-new/pending-tasks.md §B.2)" | tee -a "$LOG"
      pnpm install --no-frozen-lockfile 2>&1 | tail -10
    fi
  else
    echo "WARN[$app_name]: pnpm not installed; falling back to npm install --legacy-peer-deps" | tee -a "$LOG"
    npm install --legacy-peer-deps 2>&1 | tail -10
  fi
}

rebuild_backend() {
  echo "" | tee -a "$LOG"
  echo "=== Rebuilding backend ($(date)) ===" | tee -a "$LOG"
  cd "$BACKEND_DIR"

  # 1. Snapshot current dist (defensive)
  tar -czf "/tmp/dist-backup-$(date +%Y%m%d-%H%M%S).tar.gz" dist/ 2>/dev/null || true

  # 2. Pull deps + regen Prisma client
  pnpm_install "$BACKEND_DIR" "backend"
  if [ -f .env ]; then
    set +u
    export $(grep -v '^#' .env | grep -E 'DATABASE_URL|DIRECT_URL' | xargs)
    set -u
  fi
  ./node_modules/.bin/prisma generate 2>&1 | tail -3
  ./node_modules/.bin/prisma migrate deploy 2>&1 | tail -5

  # 3. Compile
  ./node_modules/.bin/nest build 2>&1 | tail -5

  # 4. Reload via ecosystem
  pm2 startOrReload "$ECOSYSTEM" --only neurecore-backend
  echo "=== BACKEND_DONE $(date) ===" | tee -a "$LOG"
}

rebuild_tenant() {
  echo "" | tee -a "$LOG"
  echo "=== Rebuilding tenant ($(date)) ===" | tee -a "$LOG"
  cd "$TENANT_DIR"

  pnpm_install "$TENANT_DIR" "tenant"
  ./node_modules/.bin/next build 2>&1 | tail -10

  pm2 startOrReload "$ECOSYSTEM" --only neurecore-tenant
  echo "=== TENANT_DONE $(date) ===" | tee -a "$LOG"
}

rebuild_admin() {
  echo "" | tee -a "$LOG"
  echo "=== Rebuilding admin ($(date)) ===" | tee -a "$LOG"
  cd "$ADMIN_DIR"

  pnpm_install "$ADMIN_DIR" "admin"
  ./node_modules/.bin/next build 2>&1 | tail -10

  pm2 startOrReload "$ECOSYSTEM" --only neurecore-admin
  echo "=== ADMIN_DONE $(date) ===" | tee -a "$LOG"
}

case "$APP" in
  tenant)  rebuild_tenant ;;
  admin)   rebuild_admin ;;
  backend) rebuild_backend ;;
  all)
    rebuild_tenant
    rebuild_admin
    rebuild_backend
    pm2 save
    ;;
  *)
    echo "Usage: $0 {tenant|admin|backend|all}" >&2
    exit 2
    ;;
esac

echo "" | tee -a "$LOG"
echo "=== ALL_DONE $(date) ===" | tee -a "$LOG"
