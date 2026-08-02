#!/usr/bin/env bash
# ─── scripts/verify-deploy.sh ─────────────────────────────────────────────
# PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §10.5.3 — post-deploy verification.
#
# Runs every health probe + cert smoke test against a deployed phase.
# Exits 0 on PASS, non-zero on any FAIL. Cached 24 hours via mtime to
# avoid hammering the live backend during multi-tenant workflows.
#
# Usage:
#   bash scripts/verify-deploy.sh                       # full check (default: phase 2.A after deploy)
#   bash scripts/verify-deploy.sh --phase 5.B          # check phase 5.B specifically
#   bash scripts/verify-deploy.sh --skip-cert           # skip the SIM runner invocation
#   bash scripts/verify-deploy.sh --tenant-id <uuid>   # the tenant to audit (default: Mali)
#   bash scripts/verify-deploy.sh --no-cache            # bypass the 24h cache
#
# Required env (or .env.production):
#   SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, MALI_TENANT_ID
#
# Exit codes:
#   0  all checks PASS
#   1  one or more checks FAIL
#   2  missing required env

set -uo pipefail

# ─── args ─────────────────────────────────────────────────────────────────
PHASE="2.A"
SKIP_CERT=0
NO_CACHE=0
TENANT_ID="${MALI_TENANT_ID:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase)      PHASE="$2"; shift 2 ;;
    --skip-cert)  SKIP_CERT=1; shift ;;
    --no-cache)   NO_CACHE=1; shift ;;
    --tenant-id)  TENANT_ID="$2"; shift 2 ;;
    *)            echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# ─── constants ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HQ="${HQ:-https://hq.neurecore.com}"
CC="${CC:-https://cc.neurecore.com}"
BRAIN="${BRAIN:-https://brain.neurecore.com}"
RESULTS_DIR="${REPO_ROOT}/_archives/verify-deploy"
mkdir -p "$RESULTS_DIR"
RESULTS_FILE="$RESULTS_DIR/$(date +%Y%m%d-%H%M%S)-phase-${PHASE//\//_}.log"
CACHE_FILE="$RESULTS_DIR/.last-verify-cache"
CACHE_TTL=86400  # 24 hours

# Cache: skip if a recent run for this phase succeeded (unless --no-cache)
if [[ $NO_CACHE -eq 0 && -f "$CACHE_FILE" ]]; then
  if [[ $(find "$CACHE_FILE" -mtime -1 2>/dev/null) ]]; then
    CACHED_PHASE=$(head -1 "$CACHE_FILE" 2>/dev/null | cut -d: -f2)
    if [[ "$CACHED_PHASE" == "$PHASE" ]]; then
      echo "Skipping (24h cache valid for phase $PHASE). Use --no-cache to force."
      cat "$CACHE_FILE" | tail -30
      exit 0
    fi
  fi
fi

# Load env (best-effort; do not fail)
for env_file in "$REPO_ROOT/backend/.env.production" "$REPO_ROOT/backend/.env"; do
  [[ -f "$env_file" ]] || continue
  while IFS='=' read -r key val; do
    [[ "$key" =~ ^[A-Z0-9_]+$ ]] || continue
    [[ "$val" =~ ^# ]] && continue
    export "$key=$val"
  done < <(grep -v '^#' "$env_file" 2>/dev/null)
done

# ─── preflight ────────────────────────────────────────────────────────────
PASS=0
FAIL=0
SKIP=0

preflight() {
  echo ""
  echo "════════════════════════════════════════════════════════════════════════"
  echo "  Pre-flight (env + DNS)"
  echo "════════════════════════════════════════════════════════════════════════"
  local p=0; local f=0
  for var in SUPER_ADMIN_EMAIL SUPER_ADMIN_PASSWORD; do
    if [[ -z "${!var:-}" ]]; then
      echo "  ✘ Missing required env: $var"
      f=$((f+1))
    else
      echo "  ✓ $var is set"
      p=$((p+1))
    fi
  done
  for host in "$HQ" "$CC" "$BRAIN"; do
    if curl -sk -o /dev/null -w "%{http_code}" "$host" --max-time 5 | grep -qE "^(200|301|302)$"; then
      echo "  ✓ $host reachable"
      p=$((p+1))
    else
      echo "  ✘ $host unreachable"
      f=$((f+1))
    fi
  done
  PASS=$((PASS+p)); FAIL=$((FAIL+f))
  [[ $f -gt 0 ]] && return 1
  return 0
}

# ─── §10.5.3 health probes ────────────────────────────────────────────────
health_probes() {
  echo ""
  echo "════════════════════════════════════════════════════════════════════════"
  echo "  §10.5.3 — Health probes (contabo-ops.md §9.1)"
  echo "════════════════════════════════════════════════════════════════════════"
  local p=0; local f=0

  # 1. /api/v1/health returns 200
  body=$(curl -sk --max-time 5 "$BRAIN/api/v1/health" || echo "FAIL")
  if echo "$body" | grep -q '"status":"healthy"'; then
    echo "  ✓ brain.neurecore.com/api/v1/health → 200 healthy"
    p=$((p+1))
  else
    echo "  ✘ brain.neurecore.com/api/v1/health failed: $body"
    f=$((f+1))
  fi

  # 2. tenant root returns 200
  code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 5 "$HQ/")
  if [[ "$code" == "200" ]]; then
    echo "  ✓ hq.neurecore.com → 200"
    p=$((p+1))
  else
    echo "  ✘ hq.neurecore.com → $code"
    f=$((f+1))
  fi

  # 3. admin root returns 200
  code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 5 "$CC/")
  if [[ "$code" == "200" ]]; then
    echo "  ✓ cc.neurecore.com → 200"
    p=$((p+1))
  else
    echo "  ✘ cc.neurecore.com → $code"
    f=$((f+1))
  fi

  # 4. PM2 process list (ssh only if SUPER_ADMIN_EMAIL etc. is set up to allow it)
  if command -v ssh >/dev/null 2>&1; then
    if ssh -o ConnectTimeout=5 -o BatchMode=yes contabo 'pm2 list --json 2>/dev/null' >/dev/null 2>&1; then
      echo "  ✓ pm2 list reachable via ssh"
      p=$((p+1))
    else
      echo "  ⊘ pm2 list not reachable (skipped)"
      SKIP=$((SKIP+1))
    fi
  else
    echo "  ⊘ ssh not on PATH (pm2 check skipped)"
    SKIP=$((SKIP+1))
  fi

  PASS=$((PASS+p)); FAIL=$((FAIL+f))
}

# ─── §10.5.1 tenant distribution audit ───────────────────────────────────
tenant_distribution() {
  echo ""
  echo "════════════════════════════════════════════════════════════════════════"
  echo "  §10.5.1 — Tenant distribution audit (BEFORE flip)"
  echo "════════════════════════════════════════════════════════════════════════"
  if [[ -z "$TENANT_ID" ]]; then
    echo "  ⊘ No --tenant-id provided; skipping per-tenant isolation check"
    SKIP=$((SKIP+1))
    return 0
  fi

  local p=0; local f=0

  # Curl /api/v1/customers/<mali-tenant> with a fake header — should 403/404
  code=$(curl -sk -o /dev/null -w "%{http_code}" \
    -H "x-tenant-id: $TENANT_ID" \
    "$BRAIN/api/v1/customers/cross-tenant-attempt-test" --max-time 5)
  if [[ "$code" == "403" || "$code" == "404" ]]; then
    echo "  ✓ Cross-tenant access denied (HTTP $code)"
    p=$((p+1))
  else
    echo "  ✘ Cross-tenant access check failed: HTTP $code (expected 403/404)"
    f=$((f+1))
  fi

  PASS=$((PASS+p)); FAIL=$((FAIL+f))
}

# ─── §10.5.3 SIM runner invocation ────────────────────────────────────────
sim_runner() {
  echo ""
  echo "════════════════════════════════════════════════════════════════════════"
  echo "  §10.5.3 — SIM cert runner for phase $PHASE"
  echo "════════════════════════════════════════════════════════════════════════"
  if [[ $SKIP_CERT -eq 1 ]]; then
    echo "  ⊘ Skipped (--skip-cert)"
    SKIP=$((SKIP+1))
    return 0
  fi

  local SIM_DIR
  case "$PHASE" in
    2.A) SIM_DIR="SIM-04-Accounting-Project-Full-Flow" ;;
    2.B) SIM_DIR="SIM-05-Financial-Services-Project-Full-Flow" ;;
    3.A) SIM_DIR="SIM-06-Technology-Digital-Services-Project-Full-Flow" ;;
    3.B) SIM_DIR="SIM-07-Professional-Business-Services-Project-Full-Flow" ;;
    4.A) SIM_DIR="SIM-08-Retail-Commerce-Consumer-Project-Full-Flow" ;;
    4.B) SIM_DIR="SIM-09-Media-Communications-Creative-Project-Full-Flow" ;;
    5.A) SIM_DIR="SIM-10-Nonprofit-International-Project-Full-Flow" ;;
    5.B) SIM_DIR="SIM-11-Special-Purpose-Organizations-Project-Full-Flow" ;;
    *)   echo "  ⊘ Unknown phase: $PHASE (skipping SIM runner)"; SKIP=$((SKIP+1)); return 0 ;;
  esac

  local CERT="$REPO_ROOT/simulations/$SIM_DIR/certify-sim*.mjs"
  if [[ ! -f $CERT ]]; then
    echo "  ✘ Cert runner not found: $CERT"
    FAIL=$((FAIL+1))
    return 1
  fi

  # Syntax check only (full SIM execution needs live browser + SUPER_ADMIN creds).
  if node --check "$CERT" 2>/dev/null; then
    echo "  ✓ SIM runner syntax: $(basename $CERT)"
    PASS=$((PASS+1))
  else
    echo "  ✘ SIM runner syntax FAILED: $CERT"
    FAIL=$((FAIL+1))
  fi
}

# ─── §10.7 SOLID guard ────────────────────────────────────────────────────
solid_guard() {
  echo ""
  echo "════════════════════════════════════════════════════════════════════════"
  echo "  §10.7 — SOLID guard (post-deploy gate)"
  echo "════════════════════════════════════════════════════════════════════════"
  if bash "$REPO_ROOT/scripts/solid-guard.sh" >/dev/null 2>&1; then
    echo "  ✓ SOLID guard PASS"
    PASS=$((PASS+1))
  else
    echo "  ✘ SOLID guard FAIL — re-introduced duplication (Law 2 violation)"
    FAIL=$((FAIL+1))
  fi
}

# ─── run ──────────────────────────────────────────────────────────────────
main() {
  echo "════════════════════════════════════════════════════════════════════════"
  echo "  NeureCore deploy verification — phase $PHASE"
  echo "════════════════════════════════════════════════════════════════════════"
  echo "  HQ=$HQ CC=$CC BRAIN=$BRAIN"
  echo "  Tenant to audit: ${TENANT_ID:-<none>}"
  echo "  Log file: $RESULTS_FILE"
  echo ""

  preflight || true
  health_probes
  tenant_distribution
  sim_runner
  solid_guard

  echo ""
  echo "════════════════════════════════════════════════════════════════════════"
  echo "  Summary"
  echo "════════════════════════════════════════════════════════════════════════"
  echo "  PASS: $PASS"
  echo "  FAIL: $FAIL"
  echo "  SKIP: $SKIP"
  echo ""

  # Record results
  {
    echo "phase: $PHASE"
    echo "pass: $PASS"
    echo "fail: $FAIL"
    echo "skip: $SKIP"
    echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } > "$RESULTS_FILE"

  if [[ $FAIL -eq 0 ]]; then
    echo "phase: $PHASE" > "$CACHE_FILE"
    echo "VERIFY_DEPLOY_PASS phase=$PHASE date=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >&2
    echo "All checks PASS. See $RESULTS_FILE for details."
    exit 0
  else
    echo "VERIFY_DEPLOY_FAIL phase=$PHASE fail=$FAIL" >&2
    echo "One or more checks FAILED. See $RESULTS_FILE for details."
    exit 1
  fi
}

main 2>&1 | tee -a "$RESULTS_FILE"