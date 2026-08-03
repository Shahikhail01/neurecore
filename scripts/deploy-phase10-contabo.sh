#!/usr/bin/env bash
# Phase 10 Contabo deploy — operator-run script.
# Per contabo-ops.md §3.2, §3.3, §3.8c.
# IMPORTANT: review every line before running. DO NOT run unattended.

set -euo pipefail

PHASE="${1:-all}"   # backend | admin | all
SNAP="$(date -u +%Y%m%d-%H%M%S)-pre-phase10"
SNAP_DIR="/opt/neurecore/_archives/$SNAP"
BACKEND_DIR="/opt/neurecore/backend/backend"
ADMIN_DIR="/opt/neurecore/frontend-admin"

say() { printf '\n=== %s ===\n' "$*"; }

say "1/8 Pre-flight: branch + tag"
git rev-parse --abbrev-ref HEAD | grep -q '^0010-harness-base$' \
  || { echo "ERROR: not on 0010-harness-base. Aborting."; exit 1; }
git status --short | grep -v '^??' | head

say "2/8 Snapshot"
mkdir -p "$SNAP_DIR"
cd "$BACKEND_DIR"  && tar -czf "$SNAP_DIR/backend-dist.tar.gz"        dist/   || true
cd "$ADMIN_DIR"    && tar -czf "$SNAP_DIR/frontend-admin-.next.tar.gz" .next/  || true
cp /opt/neurecore/ecosystem.config.js "$SNAP_DIR/" || true

say "3/8 Database backup (REQUIRED)"
test -n "${DATABASE_URL:-}" || { echo "ERROR: DATABASE_URL unset on Contabo"; exit 1; }
pg_dump "$DATABASE_URL" -Fc -f "$SNAP_DIR/pre-phase10.dump"
ls -lh "$SNAP_DIR/pre-phase10.dump"

say "4/8 Pull branch + install"
cd /opt/neurecore
git fetch origin
git checkout 0010-harness-base
git pull --ff-only origin 0010-harness-base || true
cd "$BACKEND_DIR" && pnpm install --no-frozen-lockfile
cd "$ADMIN_DIR"   && pnpm install --no-frozen-lockfile

say "5/8 Apply migration (postgres superuser per §3.8c)"
test -n "${POSTGRES_SUPERUSER_PASSWORD:-}" || {
  echo "ERROR: POSTGRES_SUPERUSER_PASSWORD must be set in backend/.env on Contabo";
  exit 1;
}
PGPASSWORD="$POSTGRES_SUPERUSER_PASSWORD" \
  psql -h 127.0.0.1 -U postgres -d neurecore -v ON_ERROR_STOP=1 \
       -f "$BACKEND_DIR/prisma/migrations/20260803_phase10_harness_control_center/migration.sql"

PGPASSWORD="$POSTGRES_SUPERUSER_PASSWORD" psql -h 127.0.0.1 -U postgres -d neurecore -v ON_ERROR_STOP=1 <<SQL
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count, started_at, logs)
VALUES (gen_random_uuid()::text, '', now(), '20260803_phase10_harness_control_center', 1, now(), 'operator-applied per §3.8c')
ON CONFLICT (migration_name) DO NOTHING;
SQL

cd "$BACKEND_DIR" && ./node_modules/.bin/prisma generate

say "6/8 Build"
cd "$BACKEND_DIR" && ./node_modules/.bin/nest build
cd "$ADMIN_DIR"   && ./node_modules/.bin/next build

say "7/8 Restart"
pm2 startOrReload /opt/neurecore/ecosystem.config.js
pm2 save

say "8/8 Verify"
curl -fsS https://brain.neurecore.com/api/v1/health
cd "$BACKEND_DIR" && ./node_modules/.bin/jest --config jest.config.js --runInBand src/harness/phase10
pnpm certify:phase10

say "Done. If anything failed: pg_restore -d \"\$DATABASE_URL\" --clean --if-exists $SNAP_DIR/pre-phase10.dump"
