#!/usr/bin/env bash
# scripts/assert-no-bare-skips.sh
#
# Phase 10.6 / D2 follow-up — guard against naked test skips.
#
# A "naked" skip is one with no explanatory comment on the line
# preceding it. Infrastructure-gated skips (e.g. `describeDb = HAS_DB ? describe : describe.skip`)
# are NOT naked — the gated expression carries the reason.
#
# Run from CI / pre-deploy. Exit 0 = pass; 1 = a naked skip found.
#
# Allow-list:
#   - `describe.skip` behind a `HAS_DB` / `REQUIRE_DB` / `DB_AVAILABLE` /
#     `RUN === '1'` ternary is treated as legitimate infra gating.
#   - `itOrSkip = skipReason ? it.skip : it` (with explicit reason) is allowed.
#
# Flags new naked skips NOT in the allow-list.

set -euo pipefail

cd "$(dirname "$0")/.."

# Find naked skips: a line ending with `.skip(` whose 3 preceding lines do NOT
# contain any of: `TODO(`, `FIXME(`, `XXX(`, `infra`, `DB_AVAILABLE`, `REQUIRE_DB`,
# `HAS_DB`, `RUN === '1'`, `RUN = process.env`.
#
# Strategy: extract multi-line context (prev line + skip line + next line) and
# look for "good reason" markers nearby. If none present, flag.

violations=$(grep -rEn --include='*.spec.ts' --include='*.test.ts' \
    -B 3 '(^|[^a-zA-Z_])(it|describe|test)\s*\.[a-z]+\s*\(' \
    src 2>/dev/null \
  | grep -E '\.(skip|todo|fixme)\(' \
  | grep -vE 'TODO\(|FIXME\(|XXX\(|infra|DB_AVAILABLE|REQUIRE_DB|HAS_DB|RUN ===|RUN = process\.env|runOnlyIf|integration-gate|env-gated|skipped-suite|integration-only|db-only|skipReason' \
  || true)

if [ -n "$violations" ]; then
  echo "❌ Found naked test skip(s) — every skip must have a TODO(<reason>) comment:"
  echo "$violations"
  exit 1
fi

echo "✅ no-bare-skips guard passed"
exit 0
