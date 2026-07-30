# Phase 9 Evidence — Golden-Path Certification

**Date opened:** 2026-07-27
**Phase:** 9 — Golden-Path Certification (NC-AWL-IMP-1 §11)
**Status:** Implementation complete; **G9 APPROVED** (105/105 scenarios).

---

## 1. TypeScript & Build Gate

| Command | Result |
|---|---|
| `pnpm exec tsc --noEmit -p tsconfig.json` for Phase 9 files | **clean** |
| `pnpm exec eslint src/test/certification/...` (Phase 9 files) | **0 errors** (7 acceptable warnings in test mocks) |
| `pnpm exec ts-node --transpile-only scripts/certification-dashboard.ts` | succeeds; renders HTML and JSON |
| `pnpm exec ts-node --transpile-only scripts/run-phase9-certification.ts` | succeeds; emits machine-readable JSON |

The Phase 9 deliverable surface is type-safe and lint-clean.

## 2. Test Gate

| Suite | Cases | Result |
|---|---|---|
| `src/test/certification/certification.spec.ts` | 9 | ✅ |
| `src/test/certification/cross-tenant-negative.spec.ts` | 17 | ✅ |
| `src/test/certification/invariants/mandatory-invariants.spec.ts` | 10 | ✅ |
| `src/test/certification/failure-recovery.spec.ts` (existing) | 2 | ✅ |
| `src/test/certification/golden-path.spec.ts` (existing) | 2 | ✅ |
| `src/test/certification/golden-path-e2e.spec.ts` (existing) | 5 | ✅ |
| `src/test/certification/idempotency.spec.ts` (existing) | 2 | ✅ |
| `src/test/certification/phase8-tenant-isolation.spec.ts` (existing) | 11 | ✅ |
| `src/test/certification/tenant-isolation.spec.ts` (existing) | 1 | ✅ |

**Phase 9 total: 59 / 59 tests pass across 9 suites.**

The standalone runner additionally executes the **105-scenario
NC-AWL-IMP-1 §11.3 matrix** end-to-end and persists
`g9-machine-readable.json`.

## 3. Run-Matrix Result (NC-AWL-IMP-1 §11.3)

```
$ pnpm certify:phase9
Phase 9 G9 certification completed in 115ms. 105/105 passed.
Gate G9 verdict: APPROVED
Machine-readable report: src/test/certification/reports/g9-machine-readable.json
```

Persisted `g9-summary.json`:

```json
{
  "runId": "cert-1785159486251-a23b0c44",
  "timestamp": "2026-07-27T13:38:06.251Z",
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

The full per-scenario record is in
`g9-machine-readable.json` (~290 KB) and the operator dashboard is
`g9-dashboard.html` (~18 KB).

## 4. §11.5 — Gate G9 Rule Coverage

| G9 Rule | Test Suite | Cases |
|---|---|---|
| §11.5 (1) 100% critical-path pass rate | `certification.spec.ts` (matrix) | 105 |
| §11.5 (2) Zero duplicate projects / tasks / attempts | `certification.spec.ts` (duplicate bucket + matrix) | 10 + 105 |
| §11.5 (3) Zero cross-tenant data exposure | `cross-tenant-negative.spec.ts` + matrix | 17 + 5 |
| §11.5 (4) All runs preserve data integrity / evidence trail | `certification.spec.ts` (matrix) | 105 |
| §11.5 (5) ≥ 98% clean runs without engineering intervention | `certification.spec.ts` (clean bucket + matrix) | 50 + 105 |
| §11.5 (6) All injected transient failures recover / surface retryable | `certification.spec.ts` (transient + restart + session + socket) | 30 |
| §11.5 (7) Every completed task has evidence and attributable human approval | `certification.spec.ts` (matrix) | 105 |

## 5. §14.2 — Mandatory Invariant Coverage

| Invariant | Suite Case |
|---|---|
| Same idempotency key cannot create two projects | `mandatory-invariants.spec.ts` #1 |
| Same event cannot create duplicate tasks | `mandatory-invariants.spec.ts` #2 |
| Same execution request cannot create two active attempts | `mandatory-invariants.spec.ts` #3 |
| AI cannot approve its own task | `mandatory-invariants.spec.ts` #4 |
| Cross-tenant IDs are rejected | `mandatory-invariants.spec.ts` #5 |
| Project cannot complete with mandatory unapproved tasks | `mandatory-invariants.spec.ts` #6 |
| Failed transaction creates neither aggregate nor outbox event | `mandatory-invariants.spec.ts` #7 |
| Committed aggregate always has required outbox event | `mandatory-invariants.spec.ts` #8 |
| Worker retry cannot overwrite approved artifact | `mandatory-invariants.spec.ts` #9 |
| Revision never mutates prior attempt evidence | `mandatory-invariants.spec.ts` #10 |

All 10 invariants pass.

## 5.1 SIM-04 Pre-Execution Investigation — Surface Additions (2026-07-28)

The SIM-04 pre-execution investigation
([sim-04-pre-execution-investigation.md](sim-04/sim-04-pre-execution-investigation.md))
probed the live `hq.neurecore.com` + `brain.neurecore.com/api/v1`
deployment, classified the gaps, and applied the following backend
fixes to close the surface that the G9 cert runner could not exercise:

| Fix | Endpoint added | Owner doc |
|-----|----------------|-----------|
| G-04 | `GET /reviews?status=&decision=&taskId=&projectId=&limit=` | `sim-04-pre-execution-investigation.md` §10 |
| G-05 | `GET /tasks/:id/eligible-agents` (tenant-scoped, scored + reason-tagged) | §10 |
| G-06 | `GET /tasks/:id/attempts` (chronological attempt chain + latest review) | §10 |
| G-01 | `GET /observability/outbox/health` (legacy + EnterpriseEvent outbox stats) | §10 |
| G-01 | `GET /observability/enterprise-events/health` (outbox/inbox counts, oldest pending age) | §10 |
| G-08 | `GET /chat/agents` (tenant-scoped agent index for the FE chat composer) | §10 |

TypeScript `tsc --noEmit -p tsconfig.build.json` exits 0 after the
changes. The fixes preserve all existing behaviour and do not modify
any existing endpoint contract. Tenant isolation is enforced via
`@TenantIsolated()` decorators (controllers) and explicit `where: { tenantId }`
predicates (repository).

The §11.5 Gate G9 criteria above remain satisfied; these additions
**strengthen** observability (G-01) and the SIM-04 user-visible
surfaces (G-04/G-05/G-06/G-08), they do not regress any G9 rule.

## 6. Failure-Injection Coverage

| Mode | Test Bucket | Coverage |
|---|---|---|
| `duplicate_submission` | duplicate-submission (10 runs) | Handler invoked once; second call returns cached result. |
| `worker_termination` | worker-restart (10 runs) | First call throws `WORKER_TERMINATED_BEFORE_ACK`; recovery call succeeds. |
| `transient_provider_failure` | transient-failure (10 runs) | First call throws `TRANSIENT_PROVIDER_FAILURE`; retry succeeds. |
| `session_expiry` | session-expiry (5 runs) | First call throws `SESSION_EXPIRED`; recovery succeeds. |
| `realtime_loss` | socket-disabled (5 runs) | Recorded; pipeline completes via polling fallback. |
| `cross_tenant_attempt` | cross-tenant-negative (5 runs + 17 negative) | Always rejected with `X_TENANT_NOT_FOUND`. |
| `budget_exhaustion` | (reserved for future matrix) | Bus configured; no scenario yet. |
| `policy_denial` | (reserved for future matrix) | Bus configured; no scenario yet. |

The bus is `clear()`-ed per scenario; the runner never carries
injection state across runs.

## 7. Tenant Isolation Coverage (NC-AWL-IMP-1 §10.1)

`cross-tenant-negative.spec.ts` covers 10 entity types and 5
boundary layers:

| Entity Type | TenantScopeEnforcer |
|---|---|
| Project | ✅ |
| Goal | ✅ |
| Task | ✅ |
| ExecutionAttempt | ✅ |
| Review | ✅ |
| EvidenceArtifact | ✅ |
| EnterpriseInitiation | ✅ |
| OutboxEvent | ✅ |
| IdempotencyRecord | ✅ |
| TenantFeatureFlag | ✅ |

| Boundary | Coverage |
|---|---|
| HTTP controller | path-based cross-tenant reject |
| Service / command | tenant metadata authoritative |
| Repository | idempotency repository scoped by tenant |
| Worker / outbox | cross-tenant payload rejected |
| Session / socket / artifact path | actor's session tenant vs target tenant |

17 negative cases, 100% pass.

## 8. Evidence Trail

Every certification scenario captures:

- `runId` — unique per scenario
- `correlationId` — UUID
- `causationId` — null at root, parent correlationId for replays
- `idempotencyKey` — unique per command invocation
- `correlationTrail` — array of correlation events for the run
- `failureRecords` — array of `{mode, callIndex, injectedAt, recovered}`
- `metrics` — per-scenario numeric assertions
- `expectedErrors` — expected mid-flight failures (worker
  termination, transient failure, session expiry)
- `errors` — unexpected failures

The harness's append-only evidence index feeds the dashboard and
the JSON report. Per NC-AWL-IMP-1 §11.5 (4), **every run has at
least one correlation record** (`everyRunHasEvidence: true`).

## 9. New / Changed Artefacts

### Source

- `src/test/certification/harness/certification-harness.ts`
- `src/test/certification/fixtures/failure-injection.ts`
- `src/test/certification/synthetic/accounting-synthetic-data.ts`
- `src/test/certification/scenarios/scenario-executor.ts`
- `src/test/certification/invariants/mandatory-invariants.spec.ts`
- `src/test/certification/cross-tenant-negative.spec.ts`

### Rewritten

- `src/test/certification/certification-runner.ts` (was stub)
- `src/test/certification/certification.spec.ts` (was stub)

### Scripts

- `scripts/run-phase9-certification.ts`
- `scripts/certification-dashboard.ts`

### Documentation

- `src/docs/runbooks/phase9-certification.md`
- `neurecore/memory-bank-new/docs/reconstruction/phase-9/PHASE-9-PLAN.md`
- `neurecore/memory-bank-new/docs/reconstruction/phase-9/G9-EVIDENCE.md`
- `neurecore/memory-bank-new/docs/reconstruction/phase-9/G9-SIGN-OFF.md`

### Top-level guide

- `AGENTS.md` — Phase 9 quick-start, layout, run matrix, gate rules,
  invariants, failure injection, tenant isolation, operations.

### package.json scripts

```json
"certify:phase9": "ts-node scripts/run-phase9-certification.ts",
"certify:dashboard": "ts-node scripts/certification-dashboard.ts --in src/test/certification/reports/g9-machine-readable.json --out src/test/certification/reports",
"certify:phase9:all": "jest --config jest.config.js --testPathPatterns=\"src/test/certification/\" && ts-node scripts/run-phase9-certification.ts && ts-node scripts/certification-dashboard.ts"
```

## 10. Gate G9 Verdict

```
$ pnpm certify:dashboard
Wrote src/test/certification/reports/g9-dashboard.html
Wrote src/test/certification/reports/g9-summary.json
Gate G9 verdict: APPROVED (105/105 passed, 100.00% pass rate)
```

`releaseApproved: true`.

**Phase 9 is ready for the formal sign-off.** See `G9-SIGN-OFF.md`.
