#!/usr/bin/env bash
# scripts/solid-guard.sh
#
# PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §2.7 (R4) — SOLID enforcement CI gate.
#
# This script greps the repo for known SOLID violations and exits non-zero
# if any are found. Use as a pre-merge check on every PR touching
# backend/src, frontend-tenant/src, frontend-admin/src.
#
# Excluded paths (legitimate sources / test fixtures):
#   - backend/src/modules/industry/tier-industry-matrix.ts (CANONICAL backend source)
#   - frontend-tenant/src/lib/industryGroups.ts (CANONICAL tenant source)
#   - frontend-tenant/src/lib/industryNavigation.ts (canonical nav config; its own map IS the registry)
#   - frontend-admin/src/lib/industries.ts (canonical admin registry)
#   - frontend-admin/src/lib/industryGroups.ts (canonical admin source)
#   - backend/src/modules/industry/customer-fields/industry-customer-field-definitions.ts (canonical customer-fields registry)
#   - *.spec.ts / *.test.ts / __tests__/ (tests assert literal values)
#   - docs/* (markdown)
#
# Exit codes:
#   0 = clean
#   1 = at least one SOLID violation found
#   2 = script error (missing tool)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck disable=SC2317  # function called via trap
fail() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo "  SOLID GUARD FAILED — ${1:-violation}"
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo "  ${2:-see above}"
  echo "  PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §2 — one source of truth per concept."
  echo ""
  exit 1
}

GROUP_SLUGS=(
  'financial-compliance'
  'healthcare'
  'business-technology'
  'consumer-commerce'
  'public-social'
  'industrial-infrastructure'
  'agriculture-food'
  'other'
)

EXCLUDE_PATHS=(
  ':!backend/src/modules/industry/tier-industry-matrix.ts'
  ':!frontend-tenant/src/lib/industryGroups.ts'
  ':!frontend-tenant/src/lib/industryNavigation.ts'
  ':!frontend-tenant/src/lib/dashboards/industry-dashboard.registry.ts'
  ':!frontend-admin/src/lib/industries.ts'
  ':!frontend-admin/src/lib/industryGroups.ts'
  ':!backend/src/modules/industry/customer-fields/industry-customer-field-definitions.ts'
  ':!backend/src/modules/widgets/widget-definition.ts'
  ':!backend/src/modules/financial-compliance/fc-widgets.ts'
  ':!backend/src/modules/industry/industry-groups.service.ts'
  ':!**/*.spec.ts'
  ':!**/*.test.ts'
  ':!**/__tests__/**'
  ':!docs/**'
  ':!scripts/**'
  ':!**/seed-*'
  ':!**/seeds/**'
  ':!**/migrations/**'
)

# Build the grep exclude-args
EXCLUDES=""
for p in "${EXCLUDE_PATHS[@]}"; do
  EXCLUDES+=" --exclude-dir=$(echo "$p" | sed 's/:!//;s|^\*\*/||;s|/\*$||') "
  # Note: rg uses --glob '!pattern' for ignore; fallback to grep --exclude-dir
done

# We use ripgrep if available (fast), else grep (universal).
if command -v rg >/dev/null 2>&1; then
  USE_RG=1
else
  USE_RG=0
fi

echo "=== SOLID guard (R4) — checking repo for industry-group slug literals ==="
echo ""

violations=0

# ── Check 1 (S — Single Responsibility / One source of truth) ───────────────
# Every industry-group slug literal should appear ONLY in the canonical source
# files (excluded above). Any other occurrence is a SOLID violation.

for slug in "${GROUP_SLUGS[@]}"; do
  if [ "$USE_RG" = "1" ]; then
    hits=$(rg -n --type-add 'industry:*.{ts,tsx}' \
                -g '!backend/src/modules/industry/tier-industry-matrix.ts' \
                -g '!frontend-tenant/src/lib/industryGroups.ts' \
                -g '!frontend-tenant/src/lib/industryNavigation.ts' \
                -g '!frontend-admin/src/lib/industries.ts' \
                -g '!frontend-admin/src/lib/industryGroups.ts' \
                -g '!backend/src/modules/industry/customer-fields/industry-customer-field-definitions.ts' \
                -g '!backend/src/modules/widgets/widget-definition.ts' \
                -g '!backend/src/modules/financial-compliance/fc-widgets.ts' \
                -g '!backend/src/modules/industry/industry-groups.service.ts' \
                -g '!**/*.spec.ts' \
                -g '!**/*.test.ts' \
                -g '!**/__tests__/**' \
                -g '!docs/**' \
                -g '!**/migrations/**' \
                -g '!**/seed-*' \
                -g '!**/seeds/**' \
                "$slug" \
                neurecore/backend/src neurecore/frontend-tenant/src neurecore/frontend-admin/src \
                2>/dev/null || true)
  else
    hits=$(grep -rnE --include='*.ts' --include='*.tsx' \
                --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
                --exclude='*.spec.ts' --exclude='*.test.ts' \
                "$slug" \
                neurecore/backend/src neurecore/frontend-tenant/src neurecore/frontend-admin/src 2>/dev/null \
              | grep -vE "tier-industry-matrix.ts|frontend-tenant/src/lib/industryGroups.ts|frontend-tenant/src/lib/industryNavigation.ts|frontend-admin/src/lib/industries.ts|frontend-admin/src/lib/industryGroups.ts|industry-customer-field-definitions.ts|widget-definition.ts|fc-widgets.ts|industry-groups.service.ts|migrations|seed-|seeds/|__tests__|/docs/" \
              || true)
  fi

  # Filter out comment-only lines (// or *).
  if [ -n "$hits" ]; then
    code_hits=$(echo "$hits" | grep -vE '^[^:]*:[0-9]+:\s*(//|\*|/\*)' || true)
    if [ -n "$code_hits" ]; then
      echo ""
      echo "✘ S-VIOLATION: industry-group slug '$slug' used outside canonical sources:"
      echo "$code_hits"
      violations=$((violations + 1))
    fi
  fi
done

# ── Check 2 (D — Dependency Inversion) ───────────────────────────────────────
# Tier slugs 'basic' | 'business' should not appear in package seeders (T1 fix)
# outside the financial-services-packages legacy seeder (which is being migrated).

echo ""
echo "=== Check 2: tier-slug 'basic' / 'business' literals in package seeders ==="
for slug in 'basic' 'business'; do
  if [ "$USE_RG" = "1" ]; then
    hits=$(rg -n --type ts \
                -g '!backend/src/modules/industry/tier-industry-matrix.ts' \
                -g '!**/*.spec.ts' \
                -g '!**/*.test.ts' \
                "$slug" \
                neurecore/backend/prisma/seed-*packages.cjs \
                2>/dev/null || true)
  else
    hits=$(grep -nE --include='*.cjs' \
                --exclude='*.spec.cjs' --exclude='*.test.cjs' \
                "$slug" \
                neurecore/backend/prisma/seed-*packages.cjs 2>/dev/null \
              | grep -vE "tier-industry-matrix\.ts|migrations|seed-tier-slugs\.cjs" \
              || true)
  fi
  if [ -n "$hits" ]; then
    echo ""
    echo "✘ D-VIOLATION: legacy tier-slug '$slug' found in package seeder (T1 fix pending):"
    echo "$hits"
    violations=$((violations + 1))
  fi
done

# ── Check 3 (O — Open/Closed) ────────────────────────────────────────────────
# No `switch (tenant.industry)` or `if (tenant.industry === ...)` chains
# outside IndustryAware services (which should use the registry instead).

echo ""
echo "=== Check 3: 'switch (tenant.industry)' / 'if (industry === ...)' branches ==="
if [ "$USE_RG" = "1" ]; then
  hits=$(rg -n --type ts \
              -g '!backend/src/modules/industry/**' \
              -g '!**/*.spec.ts' \
              -g '!**/*.test.ts' \
              -e 'switch *\(.*industry' \
              -e 'if *\(.*\.industry *===' \
              neurecore/backend/src neurecore/frontend-tenant/src neurecore/frontend-admin/src \
              2>/dev/null || true)
else
  hits=$(grep -rnE --include='*.ts' --include='*.tsx' \
              --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
              --exclude-dir=industry \
              --exclude='*.spec.ts' --exclude='*.test.ts' \
              '(switch *\(.*industry|if *\(.*\.industry *===)' \
              neurecore/backend/src neurecore/frontend-tenant/src neurecore/frontend-admin/src 2>/dev/null \
            | grep -vE '/(spec|test)\.' \
            || true)
fi
if [ -n "$hits" ]; then
  echo ""
  echo "✘ O-VIOLATION: switch/if-else on industry slug outside industry module:"
  echo "$hits"
  violations=$((violations + 1))
fi

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
if [ "$violations" -eq 0 ]; then
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo "  SOLID GUARD PASSED — 0 violations"
  echo "═══════════════════════════════════════════════════════════════════════════════"
  exit 0
else
  echo "═══════════════════════════════════════════════════════════════════════════════"
  echo "  SOLID GUARD FAILED — $violations violation(s)"
  echo "═══════════════════════════════════════════════════════════════════════════════"
  exit 1
fi