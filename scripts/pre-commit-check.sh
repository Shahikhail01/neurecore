#!/usr/bin/env bash
# ─── scripts/pre-commit-check.sh ─────────────────────────────────────────────
# PD-51: Pre-commit hook — runs lint, type-check, prisma checks, and auth-lint.
#
# To install as a git hook:
#   cp scripts/pre-commit-check.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#
# Or use Husky (recommended):
#   npx husky add .husky/pre-commit "bash scripts/pre-commit-check.sh"

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
TENANT="$ROOT/frontend-tenant"
ADMIN="$ROOT/frontend-admin"

FAIL=0

echo "========================================"
echo "Pre-commit checks"
echo "========================================"

# ─── 1. Backend checks ───────────────────────────────────────────────────────
echo ""
echo "[pre-commit] Running backend checks..."

cd "$BACKEND"

echo "[pre-commit]   TypeScript..."
if ! pnpm tsc --noEmit > /tmp/precommit-tsc.log 2>&1; then
  echo "  FAIL: TypeScript errors:"
  cat /tmp/precommit-tsc.log
  FAIL=1
else
  echo "  OK: TypeScript"
fi

echo "[pre-commit]   ESLint..."
if ! pnpm lint > /tmp/precommit-lint.log 2>&1; then
  echo "  WARN: ESLint issues found (see logs)"
  cat /tmp/precommit-lint.log | head -50
fi

echo "[pre-commit]   Prisma schema..."
if ! pnpm prisma validate > /tmp/precommit-prisma.log 2>&1; then
  echo "  FAIL: Prisma validation errors:"
  cat /tmp/precommit-prisma.log
  FAIL=1
else
  echo "  OK: Prisma schema valid"
fi

# PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §4.4 (R4) — SOLID guard.
# Catches re-introduction of string-literal slugs, tier-slug legacy values,
# and switch(tenant.industry) branches that violate Law 2 (Open/Closed).
echo "[pre-commit]   SOLID guard..."
if ! bash "$ROOT/scripts/solid-guard.sh" > /tmp/precommit-solid.log 2>&1; then
  echo "  FAIL: SOLID guard violations:"
  cat /tmp/precommit-solid.log
  FAIL=1
else
  echo "  OK: SOLID guard green"
fi

echo "[pre-commit]   @@map() enforcement..."
if ! bash scripts/enforce-prisma-map.sh > /tmp/precommit-map.log 2>&1; then
  echo "  FAIL: @@map() enforcement failed:"
  cat /tmp/precommit-map.log
  FAIL=1
else
  echo "  OK: All models have @@map()"
fi

echo "[pre-commit]   Enum case consistency..."
if ! bash scripts/enforce-enum-case.sh > /tmp/precommit-enum.log 2>&1; then
  echo "  FAIL: Enum case consistency failed:"
  cat /tmp/precommit-enum.log
  FAIL=1
else
  echo "  OK: Enum naming conventions OK"
fi

echo "[pre-commit]   @IsUUID() usage check..."
if ! bash scripts/lint-no-isuuid.sh > /tmp/precommit-isuuid.log 2>&1; then
  echo "  FAIL: @IsUUID() found in DTOs:"
  cat /tmp/precommit-isuuid.log
  FAIL=1
else
  echo "  OK: No @IsUUID() usage"
fi

# ─── 2. Frontend checks ───────────────────────────────────────────────────────
echo ""
echo "[pre-commit] Running frontend checks..."

echo "[pre-commit]   Backend build..."
if ! pnpm build > /tmp/precommit-build.log 2>&1; then
  echo "  FAIL: Build errors:"
  cat /tmp/precommit-build.log | tail -30
  FAIL=1
else
  echo "  OK: Build successful"
fi

# ─── 3. Auth pattern checks ──────────────────────────────────────────────────
echo ""
echo "[pre-commit]   Auth patterns (auth-lint)..."
if ! bash "$ROOT/scripts/auth-lint.sh" > /tmp/precommit-authlint.log 2>&1; then
  echo "  FAIL: Auth lint found banned patterns:"
  cat /tmp/precommit-authlint.log
  FAIL=1
else
  echo "  OK: No banned auth patterns"
fi

echo ""
echo "========================================"
if [ "$FAIL" -eq 1 ]; then
  echo "PRE-COMMIT CHECKS FAILED"
  echo "Fix the issues above before committing."
  exit 1
fi

echo "All pre-commit checks passed!"
exit 0
