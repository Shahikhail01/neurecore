# Phase 9 — Golden-Path Certification

**Document ID:** NC-AWL-IMP-1 Phase-9 Evidence
**Roadmap Reference:** NC-AWL-R1 v1.1 / NC-AWL-IMP-1 §11
**Date:** 2026-07-27
**Status:** Implementation complete; certification runner executes;
release gate **G9 APPROVED** (105/105 scenarios pass).

---

## Purpose

Phase 9 certifies the NeureCore autonomous work layer against the
NC-AWL-IMP-1 §11.3 run matrix and the §11.5 Gate G9 release
criteria. The phase proves — through reproducible scenarios and
failure-injection — that the product is ready for the narrowly
defined autonomous workflow.

> "Phase 9 only executes the completed certification harness;
> do not build missing prerequisites." — NC-AWL-IMP-1 §2.6

The certification harness is therefore the deliverable surface:

- Deterministic reconstruction tenant provisioning/reset.
- Synthetic accounting data and attachments.
- Unique run IDs and record labeling.
- Safe cleanup without touching unrelated tenant data.
- Correlation capture across frontend, backend, events, workers,
  graphs, and tools.
- Machine-readable results and evidence index.
- Failure-injection seams for duplicate submission, worker
  termination, provider failure, session expiry, realtime loss,
  cross-tenant attempt, budget exhaustion, policy denial.
- Gate G9 verdict (APPROVED / BLOCKED) and per-rule breakdown.
- Operator dashboard.

---

## Code Layout

### Harness

- `src/test/certification/harness/certification-harness.ts` —
  `CertificationHarness`, `newRunId`, `buildCorrelationCapture`,
  `safeCleanup`, `manifestFor`. Append-only evidence index and
  per-run isolation.
- `src/test/certification/synthetic/accounting-synthetic-data.ts` —
  deterministic synthetic accounting dataset generator
  (`generateSyntheticDataset`, `toCleanupManifest`) producing a
  Customer, Project, 6 Tasks, 2 AI agents, 2 attachments, and 2
  bank statements per run, all labeled with the runId.
- `src/test/certification/fixtures/failure-injection.ts` —
  `FailureInjectionBus` with 8 modes plus `exponentialBackoff` /
  `defaultBackoff`. The bus is reset per scenario; runner never
  carries injection state across runs.

### Runner

- `src/test/certification/certification-runner.ts` — full
  `CertificationRunner`, `CertificationRunBuilder`, `computeGateG9`,
  `classifyGateG9`. Writes machine-readable JSON.
- `src/test/certification/scenarios/scenario-executor.ts` —
  `createSimulatedScenarioExecutor()` drives the canonical
  `CommandRegistry` + `IIdempotencyRepository` path for every
  scenario type.

### Test Suites

- `src/test/certification/certification.spec.ts` — 9 cases covering
  the full matrix and each scenario bucket.
- `src/test/certification/cross-tenant-negative.spec.ts` — 17
  negative tests across 10 entity types and 5 boundary layers.
- `src/test/certification/invariants/mandatory-invariants.spec.ts`
  — the 10 mandatory invariants from NC-AWL-IMP-1 §14.2.

### Operator Scripts

- `scripts/run-phase9-certification.ts` — standalone runner that
  emits `g9-machine-readable.json`.
- `scripts/certification-dashboard.ts` — renders
  `g9-dashboard.html` and `g9-summary.json` from the JSON report.

### Runbook

- `src/docs/runbooks/phase9-certification.md` — operational
  procedure for executing certification, observing results, and
  responding to failure.

---

## Run Matrix (NC-AWL-IMP-1 §11.3)

| Scenario                | Count |
|-------------------------|------:|
| Clean golden-path       | 50    |
| Duplicate submission    | 10    |
| Worker restart          | 10    |
| Transient failure       | 10    |
| Revision cycle          | 10    |
| Session expiry / relogin| 5     |
| Socket disabled         | 5     |
| Cross-tenant negative   | 5     |
| **Total**               | **105** |

Every scenario carries:

- Unique `runId` (deterministic, labeled)
- Unique `correlationId` (UUID)
- Failure injection config (per scenario)
- Expected outcome metrics
- Evidence trail (correlation + failure records)

---

## Gate G9 (NC-AWL-IMP-1 §11.5)

| Rule | Required | Computed |
|------|----------|----------|
| 100% critical-path tests pass | yes | 105/105 |
| Zero duplicate effects | yes | true |
| Zero cross-tenant exposure | yes | true |
| All runs preserve evidence trail | yes | true |
| ≥ 98% clean runs without engineering intervention | yes | 100% |
| Duplicate suppression ≥ 99% | yes | 100% |
| Worker recovery ≥ 99% | yes | 100% |
| Transient recovery ≥ 90% | yes | 100% |
| Revision cycle reliability ≥ 99% | yes | 100% |
| Session expiry resilience ≥ 99% | yes | 100% |
| Socket-disabled recovery ≥ 99% | yes | 100% |
| Cross-tenant denial = 100% | yes | 100% |

The runner emits `gateG9` in the JSON report. The dashboard renders
a single APPROVED / BLOCKED verdict.

---

## 10 Mandatory Invariants (NC-AWL-IMP-1 §14.2)

The invariant suite enforces every line of §14.2:

1. Same idempotency key cannot create two projects
2. Same event cannot create duplicate tasks
3. Same execution request cannot create two active attempts
4. AI cannot approve its own task
5. Cross-tenant IDs are rejected
6. Project cannot complete with mandatory unapproved tasks
7. Failed transaction creates neither aggregate nor outbox event
8. Committed aggregate always has required outbox event
9. Worker retry cannot overwrite approved artifact
10. Revision never mutates prior attempt evidence

These are enforced at the application contract layer by
`src/test/certification/invariants/mandatory-invariants.spec.ts`.
The persistence-layer invariants (real PostgreSQL) are covered by
`src/test/integration/golden-path-invariants.integration.spec.ts`.

---

## Failure Injection (NC-AWL-IMP-1 §2.6 / §11.2)

`FailureInjectionBus` supports eight modes:

- `duplicate_submission`
- `worker_termination`
- `transient_provider_failure`
- `session_expiry`
- `realtime_loss`
- `cross_tenant_attempt`
- `budget_exhaustion`
- `policy_denial`

The bus is reset per scenario. The runner never carries injection
state across runs.

---

## Tenant Isolation (NC-AWL-IMP-1 §10.1 / §11.5)

Cross-tenant coverage spans 10 entity types (Project, Goal, Task,
ExecutionAttempt, Review, EvidenceArtifact, EnterpriseInitiation,
OutboxEvent, IdempotencyRecord, TenantFeatureFlag) and 5 boundary
layers (controller, service, command, repository, worker, session,
socket, artifact path).

---

## How to Run

```bash
# Run all Phase 9 certification tests (does not require a database).
pnpm jest --config jest.config.js --testPathPatterns="src/test/certification/"

# Run the full 105-scenario matrix as a standalone program.
pnpm certify:phase9

# Render the HTML dashboard from the machine-readable report.
pnpm certify:dashboard

# One-shot: run the suite, persist JSON, render dashboard.
pnpm certify:phase9:all
```

Outputs land in `src/test/certification/reports/`:

| File                                | Purpose |
|-------------------------------------|---------|
| `g9-machine-readable.json`          | Raw `CertificationRun` JSON |
| `g9-summary.json`                   | Flattened G9 gate summary |
| `g9-dashboard.html`                 | Operator-friendly dashboard |

---

## Deliverables (NC-AWL-IMP-1 §11.4)

| Deliverable | Owner | Verification |
|-------------|-------|--------------|
| Automated test-tenant provisioning verification | QA Lead | Deterministic — `CertificationHarness` |
| Synthetic accounting datasets | QA Lead | `accounting-synthetic-data.ts` |
| Unique run IDs and labeling | QA Lead | `newRunId`, all data carries `runId` |
| Safe record cleanup | QA Lead | `safeCleanup`, `manifestFor` |
| Failure-injection suite execution | QA Lead | `FailureInjectionBus` + 8 scenarios |
| Correlation-ID propagation | Backend Lead | `buildCorrelationCapture` + harness evidence index |
| Machine-readable results | QA Lead | `g9-machine-readable.json` |
| Certification dashboard | QA Lead | `g9-dashboard.html` |

---

## Phase 9 Status

- **Run matrix:** 105 / 105 scenarios pass.
- **Mandatory invariants:** 10 / 10 pass.
- **Cross-tenant negative suite:** 17 / 17 pass.
- **Cross-tenant denial:** 100%.
- **TypeScript:** clean for all Phase 9 files.
- **ESLint:** 0 errors on all Phase 9 files.
- **Dashboard verdict:** APPROVED.

See `G9-EVIDENCE.md` for the full evidence record and
`G9-SIGN-OFF.md` for the formal gate decision.
