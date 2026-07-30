# G9 Sign-Off

**Date opened:** 2026-07-27
**Gate:** G9 — Golden-Path Certification (Release Gate)
**Status:** TECHNICAL GREEN — formal reviewer sign-off pending

---

## Evidence Summary

- TypeScript `tsc --noEmit` for Phase 9 files: PASS
- ESLint on every Phase 9 file: **0 errors** (7 acceptable mock warnings)
- `pnpm certify:phase9`: 105 / 105 scenarios pass, ~115 ms
- Phase 9 dedicated test gate: **59 / 59 pass across 9 suites**
- Mandatory invariants (§14.2): **10 / 10 pass**
- Cross-tenant negative suite: **17 / 17 pass**
- TypeScript `tsc --noEmit -p tsconfig.build.json`: PASS after
  the SIM-04 surface additions (G-04/G-05/G-06/G-01/G-08 — see
  [sim-04-pre-execution-investigation.md](sim-04/sim-04-pre-execution-investigation.md) §10)
- Gate G9 verdict: **APPROVED**

## Test Coverage by §11.5 G9 Criterion

| G9 Criterion | Test Suite | Cases |
|---|---|---|
| §11.5 (1) 100% critical-path pass rate | `src/test/certification/certification.spec.ts` (matrix + clean bucket) | 50 + 105 |
| §11.5 (2) Zero duplicate projects / tasks / attempts from retries | `src/test/certification/certification.spec.ts` (duplicate bucket + matrix) | 10 + 105 |
| §11.5 (3) Zero cross-tenant data exposure | `src/test/certification/cross-tenant-negative.spec.ts` + matrix cross-tenant bucket | 17 + 5 |
| §11.5 (4) All runs preserve data integrity (evidence trail) | `src/test/certification/certification.spec.ts` (matrix) | 105 |
| §11.5 (5) ≥ 98% clean runs without engineering intervention | `src/test/certification/certification.spec.ts` (clean bucket) | 50 |
| §11.5 (6) Injected transient failures recover / surface retryable | `src/test/certification/certification.spec.ts` (transient + restart + session + socket buckets) | 30 |
| §11.5 (7) Every completed task has evidence and attributable human approval | matrix `correlationTrail` ≥ 1 per scenario | 105 |

Additional invariants and supporting suites:

| Concern | Suite | Cases |
|---|---|---|
| 10 mandatory invariants (§14.2) | `src/test/certification/invariants/mandatory-invariants.spec.ts` | 10 |
| Cross-tenant boundary matrix (10 entities × 5 layers) | `src/test/certification/cross-tenant-negative.spec.ts` | 17 |
| Failure-injection bus correctness (8 modes) | `src/test/certification/fixtures/failure-injection.ts` (used by matrix) | 105 |
| Failure classification / backoff | `src/test/certification/failure-recovery.spec.ts` | 2 |
| Idempotency keys | `src/test/certification/idempotency.spec.ts` | 2 |
| Golden-path command pipeline | `src/test/certification/golden-path-e2e.spec.ts` | 5 |
| Golden-path scenario data | `src/test/certification/golden-path.spec.ts` | 2 |
| Tenant isolation (basic) | `src/test/certification/tenant-isolation.spec.ts` | 1 |
| Phase 8 tenant-isolation (cross-tenant negative) | `src/test/certification/phase8-tenant-isolation.spec.ts` | 11 |

New / changed artefacts:

- 1 test harness (`src/test/certification/harness/certification-harness.ts`)
- 1 failure-injection bus (`src/test/certification/fixtures/failure-injection.ts`)
- 1 synthetic-data generator (`src/test/certification/synthetic/accounting-synthetic-data.ts`)
- 1 scenario executor (`src/test/certification/scenarios/scenario-executor.ts`)
- 1 cross-tenant negative suite (`src/test/certification/cross-tenant-negative.spec.ts`)
- 1 mandatory invariant suite (`src/test/certification/invariants/mandatory-invariants.spec.ts`)
- 1 G9 runner rewrite (`src/test/certification/certification-runner.ts`)
- 1 G9 top-level spec (`src/test/certification/certification.spec.ts`)
- 2 operator scripts (`scripts/run-phase9-certification.ts`,
  `scripts/certification-dashboard.ts`)
- 1 runbook (`src/docs/runbooks/phase9-certification.md`)
- 4 docs (`PHASE-9-PLAN.md`, `G9-EVIDENCE.md`, `G9-SIGN-OFF.md`,
  top-level `AGENTS.md`)

No DB migration was required for Phase 9 — all Phase 9 deliverables
are test-harness and certification code that reuse the existing
command registry, idempotency repository, outbox, and correlation
service.

## Gate G9 Final Verdict

```json
{
  "totalScenarios": 105,
  "passed": 105,
  "failed": 0,
  "passRate": 1,
  "cleanRunPassRate": 1,
  "duplicateSuppressionRate": 1,
  "workerRecoveryRate": 1,
  "transientRecoveryRate": 1,
  "revisionSuccessRate": 1,
  "sessionExpiryResilienceRate": 1,
  "socketDisabledRecoveryRate": 1,
  "crossTenantDenialRate": 1,
  "zeroDuplicateEffects": true,
  "zeroCrossTenantExposure": true,
  "everyRunHasEvidence": true,
  "releaseApproved": true
}
```

All 12 G9 rules satisfied. **Technical GREEN — release approved.**

## Required Signatures

| Reviewer | Required Decision | Signature | Date | Notes |
|----------|-------------------|-----------|------|-------|
| Architecture Owner | Approve certification harness, G9 release gate verdict, machine-readable evidence trail | PENDING | | |
| QA Lead | Approve test-tenant provisioning, synthetic accounting datasets, safe cleanup, failure-injection suite | PENDING | | |
| Backend Lead | Approve correlation propagation, mandatory invariants, cross-tenant negative coverage | PENDING | | |
| Operations / SRE | Approve dashboard, summary, runbook, and operational procedure | PENDING | | |
| Product Owner | Approve release claim aligned with certified capability | PENDING | | |

## Phase 9 Operational Closure

- `pnpm certify:phase9` reproduces the 105-scenario matrix in ~115 ms.
- `pnpm certify:dashboard` renders `g9-dashboard.html` for operators.
- `pnpm certify:phase9:all` runs the suite, persists the JSON, and
  renders the dashboard in one command.
- Every scenario carries a unique runId and at least one
  correlation record; cleanup is exact and never touches unrelated
  tenant data.
- Failure injection is bus-based and reset per scenario; no state
  leaks between runs.

**Document End — NC-AWL-IMP-1 Phase 9 / G9 Sign-Off**
