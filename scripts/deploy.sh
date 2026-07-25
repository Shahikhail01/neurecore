#!/bin/bash
# NeureCore — push-to-Contabo deploy orchestrator.
# Run FROM LOCAL WORKSPACE. Syncs source, then triggers the on-server rebuild.
#
# Usage:
#   ./scripts/deploy.sh tenant   # sync + rebuild frontend-tenant
#   ./scripts/deploy.sh admin    # sync + rebuild frontend-admin
#   ./scripts/deploy.sh backend  # sync src+prisma + rebuild backend
#   ./scripts/deploy.sh all      # sync + rebuild all three
#
# Requires:
#   - ssh alias `contabo` (root@109.123.248.253)
#   - rsync, ssh on PATH
#   - sshpass or pre-shared key (the contabo alias uses key auth)

set -euo pipefail

# FIX-COMPREHENSIVE-R3 (2026-07-24): make sure pnpm is on PATH.
# After `corepack prepare pnpm@9.15.9 --activate`, pnpm lives at
# /home/najeeb/node/node-v22.12.0-linux-x64/bin/pnpm but deploy.sh
# subshells start with a minimal PATH that doesn't include it. This
# guard makes the lockfile-drift pre-flight (which uses `cd tmp && pnpm ...`)
# reliable across all operator environments.
if [ -d /home/najeeb/node/node-v22.12.0-linux-x64/bin ]; then
  export PATH="/home/najeeb/node/node-v22.12.0-linux-x64/bin:${PATH}"
fi

APP="${1:-}"
LOCAL_ROOT="/home/najeeb/Linux-Dev/neurecore-2026/neurecore"
REMOTE_ROOT="contabo:/opt/neurecore"

# Per-app source → destination mapping
declare -A APP_SRC=(
  [tenant]="$LOCAL_ROOT/frontend-tenant"
  [admin]="$LOCAL_ROOT/frontend-admin"
  [backend]="$LOCAL_ROOT/backend"
)
declare -A APP_DST=(
  [tenant]="$REMOTE_ROOT/frontend-tenant"
  [admin]="$REMOTE_ROOT/frontend-admin"
  [backend]="$REMOTE_ROOT/backend/backend"
)

EXCLUDES=(
  --exclude=node_modules
  --exclude=.next
  --exclude=dist
  --exclude=coverage
  --exclude=test
  --exclude=.env.local
  --exclude=tsconfig.tsbuildinfo
  --exclude=.git
)

sync_app() {
  local app="$1"
  local src="${APP_SRC[$app]}"
  local dst="${APP_DST[$app]}"
  echo ""
  echo "=== Syncing $app: $src → $dst ==="
  # --delete-after: remove files on dst that no longer exist in src, AFTER
  # the transfer so a partial sync doesn't delete files we didn't replace.
  rsync -avz --delete-after -e ssh "${EXCLUDES[@]}" "$src/" "$dst/"
}

check_ports() {
  local app="$1"
  if [ "$app" = "tenant" ] || [ "$app" = "all" ]; then
    local tenant_port
    tenant_port=$(grep -oP '\-\-port \K[0-9]+' "$LOCAL_ROOT/frontend-tenant/start.sh")
    if [ "$tenant_port" != "3001" ]; then
      echo "ERROR: tenant start.sh port is $tenant_port, expected 3001"
      exit 1
    fi
    echo "  tenant start.sh port OK: $tenant_port"
  fi
  if [ "$app" = "admin" ] || [ "$app" = "all" ]; then
    local admin_port
    admin_port=$(grep -oP '\-\-port \K[0-9]+' "$LOCAL_ROOT/frontend-admin/start.sh")
    if [ "$admin_port" != "3020" ]; then
      echo "ERROR: admin start.sh port is $admin_port, expected 3020"
      exit 1
    fi
    echo "  admin start.sh port OK: $admin_port"
  fi
}

if [ -z "$APP" ]; then
  echo "Usage: $0 {tenant|admin|backend|all}" >&2
  exit 2
fi

# FIX-COMPREHENSIVE-R3 (2026-07-24): lockfile-drift pre-flight.
# Detects when package.json has new deps that pnpm-lock.yaml doesn't capture
# (caused the 2026-07-23 + 2026-07-24 lockfile-fail deploy incidents).
# Runs LOCALLY so the operator knows *before* rsync that `pnpm install
# --frozen-lockfile` will fail on Contabo.
check_lockfile() {
  local app="$1"
  local pkg_dir=""
  case "$app" in
    tenant) pkg_dir="$LOCAL_ROOT/frontend-tenant" ;;
    admin)  pkg_dir="$LOCAL_ROOT/frontend-admin" ;;
    backend) pkg_dir="$LOCAL_ROOT/backend" ;;
  esac
  if [ ! -f "$pkg_dir/pnpm-lock.yaml" ]; then
    return 0
  fi
  # pnpm provides a native "is the lockfile up to date" check via
  # `pnpm install --frozen-lockfile` — if it fails with non-zero exit,
  # the lockfile needs regenerating. We attempt that in a tmp copy to
  # avoid mutating the real lockfile when running locally for pre-flight.
  #
  # This is intentionally lighter than `pnpm install --dry-run` (which
  # downloads packages). `--lockfile-only` doesn't reach the registry,
  # it just validates the in-tree lockfile against package.json.
  local drift=""
  if [ -f "$pkg_dir/pnpm-lock.yaml" ]; then
    local lockfile_tmp
    lockfile_tmp=$(mktemp -d)
    cp "$pkg_dir/package.json" "$lockfile_tmp/package.json" 2>/dev/null
    cp "$pkg_dir/pnpm-lock.yaml" "$lockfile_tmp/pnpm-lock.yaml" 2>/dev/null
    # Copy .npmrc / workspace manifests that pnpm reads when validating.
    [ -f "$pkg_dir/.npmrc" ] && cp "$pkg_dir/.npmrc" "$lockfile_tmp/.npmrc" 2>/dev/null
    # Resolve pnpm with PATH inherited from the parent. Subshell
    # bash functions reset PATH to defaults, so we locate pnpm once
    # and reuse the absolute path.
    local pnpm_bin
    pnpm_bin="$(command -v pnpm 2>/dev/null)"
    if [ -z "$pnpm_bin" ]; then
      echo "WARN[$app]: pnpm not on PATH — skipping lockfile drift check" >&2
      rm -rf "$lockfile_tmp"
    else
      if ! (
        cd "$lockfile_tmp" && \
        "$pnpm_bin" install --frozen-lockfile --lockfile-only --ignore-scripts >/dev/null 2>&1
      ); then
        drift="lockfile out of date"
      fi
      rm -rf "$lockfile_tmp"
    fi
  fi
  if [ -n "$drift" ]; then
    echo ""
    echo "WARN[$app]: lockfile drift detected in $pkg_dir/pnpm-lock.yaml" >&2
    echo "  The on-server rebuild.sh has been updated (FIX-COMPREHENSIVE-R3)" >&2
    echo "  to auto-fallback to --no-frozen-lockfile, but you should regenerate" >&2
    echo "  the lockfile locally via: cd $pkg_dir && pnpm install" >&2
    echo "  and commit the resulting pnpm-lock.yaml." >&2
  fi
}

case "$APP" in
  tenant|admin|backend)
    check_ports "$APP"
    check_lockfile "$APP"
    # FIX-COMPREHENSIVE-R3: drift gate runs LOCALLY before rsync —
    # the gate exists to prevent shipping source that the server's
    # dist/ cannot match. rsync excludes dist/, so the server's dist/
    # stays stale until rebuild.sh runs nest build. We must compare
    # the LOCAL dist against LOCAL src (which the rsync will replace
    # src/) so we catch a forgotten local rebuild *before* the deploy.
    if [ "$APP" = "backend" ]; then
      bash "$LOCAL_ROOT/scripts/check-dist-drift.sh" "$LOCAL_ROOT/backend" || {
        echo "ERROR: backend dist is stale. Run \`./node_modules/.bin/nest build\` locally first." >&2
        exit 1
      }
    fi
    sync_app "$APP"
    ssh contabo "bash /opt/neurecore/rebuild.sh $APP"
    ;;
  all)
    for a in tenant admin backend; do
      check_lockfile "$a"
    done
    bash "$LOCAL_ROOT/scripts/check-dist-drift.sh" "$LOCAL_ROOT/backend" || {
      echo "ERROR: backend dist is stale. Run \`./node_modules/.bin/nest build\` locally first." >&2
      exit 1
    }
    for a in tenant admin backend; do
      sync_app "$a"
    done
    ssh contabo "bash /opt/neurecore/rebuild.sh all"
    ;;
  *)
    echo "Unknown app: $APP" >&2
    echo "Usage: $0 {tenant|admin|backend|all}" >&2
    exit 2
    ;;
esac

echo ""
echo "=== Deploy finished: $APP ==="
echo "Smoke tests:"
echo "  curl -sk https://brain.neurecore.com/api/v1/health"
echo "  curl -sk -o /dev/null -w 'hq %{http_code}\n' https://hq.neurecore.com/"
echo "  curl -sk -o /dev/null -w 'cc %{http_code}\n' https://cc.neurecore.com/"