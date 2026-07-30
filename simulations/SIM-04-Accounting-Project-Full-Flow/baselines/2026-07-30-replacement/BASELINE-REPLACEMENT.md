# Baseline Replacement — 2026-07-30

## Why a replacement

The original `sim-04-baseline-2026-07-28` archive claimed in
NC-AWL-IMP-2 Phase 0.1 does not exist in the repository. A 2026-07-29
audit confirmed the directory is absent. Browser artifacts from the
original run may exist outside the repository under `.playwright-mcp/`,
but that is not a frozen 37-file archive.

This replacement captures the current state as of 2026-07-30 — the
post-Phase B codebase with the legacy runtime deleted, the upstream
sidecar active, and one accounting domain certified.

## What is captured

| Artifact | Source |
|---|---|
| `certify-sim04.mjs` | Current runner (supports 20-tenant manifest) |
| `provision-sim04-tenants.cjs` | Current provisioning script |
| `capture-sim04-duplicate-evidence.cjs` | Current evidence capture |
| `README.md` | Current SIM-04 workflow doc |
| `certification/2026-07-29-phase3-certification.json` | Original aggregate gate (NOT_CERTIFIED — reused one account) |
| `certification/2026-07-29-duplicate-record-evidence.json` | Original aggregate evidence |
| `certification/FINAL-CERTIFICATION-STATUS-2026-07-30.md` | Certification correction (honest FAIL) |
| `certification/2026-07-30-legacy-hermes-audit.md` | Surviving Hermes references |
| `runs/2026-07-29T14-27-07-839Z/` (8 of 20) | Original browser runs |

## What this baseline proves

- The simulator, provisioner, and evidence capture scripts are functional
- The 2026-07-29 certification ran against ONE production account (NOT 20)
- The infrastructure is ready for a clean 20-tenant Gate 3 run
- All 8 certification gates have a defined closure path

## Usage

This baseline is the starting point for the certification closure plan
at `memory-bank-arc/plans/NC-AWL-IMP-2-CERTIFICATION-CLOSURE-PLAN.md`.
Compare post-Gate-3 artifacts against this snapshot to measure the delta.
