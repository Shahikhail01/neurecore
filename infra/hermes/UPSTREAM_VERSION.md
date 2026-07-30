# Upstream Hermes Vendored Version

**Pinned commit:** `219c04a34122a0de7101526a7753c63446dec375`
**Pinned date:** 2026-07-28 22:38:51 -0700
**Upstream commit subject:** `docs(integrations): unified Buzz integration overview page`
**Upstream version:** `0.19.0` (from `pyproject.toml`)
**Vendored on:** 2026-07-29
**Vendored by:** NC-AWL-IMP-2 Phase 1.1
**Source URL:** `https://github.com/NousResearch/hermes-agent.git`

## Pinning policy

This snapshot is **frozen**. Upstream commits after this SHA will NOT be merged into the
vendored copy without an explicit upgrade sprint. The weekly CI probe (see §Upgrade detection)
fails fast if upstream HEAD advances, but does not auto-merge.

## Files verified at pin time

| File | SHA-256 (vendored) | Upstream matches |
|---|---|---|
| `pyproject.toml` | `(recorded in UPSTREAM_VERSION.sha256)` | YES |
| `run_agent.py`     | `(recorded in UPSTREAM_VERSION.sha256)` | YES |
| `hermes_bootstrap.py` | `(recorded in UPSTREAM_VERSION.sha256)` | YES |

Full tree comparison: `diff -rq <vendor> <upstream HEAD>` returned 0 differences
(excluding `.git/`).

## Upgrade detection

A weekly CI job:
1. `git fetch upstream`
2. Compares `origin/HEAD` against this pinned SHA
3. **Fails the build** if HEAD has moved (operator is notified, no auto-merge)
4. Record any changes in `UPSTREAM_DIFF_<NEW_SHA>.md` if the operator initiates an upgrade

## How to upgrade (operator procedure)

1. `cd infra/hermes/`
2. `git clone --depth 1 https://github.com/NousResearch/hermes-agent.git upgrade-probe`
3. `cd upgrade-probe && git log -1 --format='%H %ai %s'`
4. Compare to this file's pinned SHA
5. If upgrade is desired:
   - Run integration tests against the new SHA in a staging environment
   - Update this file with the new SHA
   - Run the Phase 1 lifecycle exit gate (see `infra/sidecar/RUNBOOK.md`)
   - Only then advance the pin

## Related

- Plan: `neurecore/memory-bank-arc/plans/NEURECORE-AUTONOMOUS-WORK-LAYER-IMPLEMENTATION-PLAN-v2.md` (NC-AWL-IMP-2)
- Upstream README: `infra/hermes/hermes-agent/README.md`
- Sidecar source: `infra/hermes-sidecar/`
- Adapter gateway: `backend/src/modules/hermes-adapter/`
