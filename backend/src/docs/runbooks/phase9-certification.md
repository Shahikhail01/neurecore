# Phase 9 G9 — Golden-Path Certification Runbook

**Document ID:** NC-AWL-CERT-RUN-1
**Owner:** QA Lead
**Version:** 1.0 — Phase 9 Operational Closure
**Date:** 2026-07-27

This runbook explains how to execute, observe, and gate the Phase 9
Golden-Path Certification. It references NC-AWL-IMP-1 §11 (Phase 9)
and is the authoritative entry point for the certification suite.

---

## 1. Scope

Phase 9 certifies the NeureCore autonomous work layer against the
NC-AWL-IMP-1 §11.3 run matrix:

| Test Type                                | Minimum Runs |
|------------------------------------------|-------------:|
| Clean golden-path executions             | 50           |
| Duplicate-submission executions          | 10           |
| Worker-restart executions                | 10           |
| Transient-provider-failure executions   | 10           |
| Revision cycles                          | 10           |
| Session-expiry / relogin executions      | 5            |
| Socket-disabled executions               | 5            |
| Cross-tenant negative tests              | per boundary |

---

## 2. Commands

```bash
# Run all certification unit tests (does not require a database)
pnpm jest --config jest.config.js --testPathPatterns="src/test/certification/"

# Run the full 105-scenario matrix as a standalone program
pnpm certify:phase9

# Render the HTML dashboard from the latest machine-readable report
pnpm certify:dashboard

# One-shot: run the suite, persist JSON, render dashboard
pnpm certify:phase9:all
```

Artifacts are written to `src/test/certification/reports/`:

| File                                | Purpose |
|-------------------------------------|---------|
| `g9-machine-readable.json`          | Raw `CertificationRun` JSON |
| `g9-summary.json`                   | Flattened G9 gate summary   |
| `g9-dashboard.html`                 | Operator-friendly dashboard |

---

## 3. Gate G9 Criteria

The release is approved only when **every** rule passes:

| Rule | Required value |
|------|---------------|
| Critical-path pass rate | 100% |
| Zero duplicate effects | true |
| Zero cross-tenant exposure | true |
| Evidence trail preserved per run | true |
| Clean run completion without engineering intervention | ≥ 98% |
| Duplicate suppression | ≥ 99% |
| Worker recovery | ≥ 99% |
| Transient failure recovery | ≥ 90% |
| Revision cycle reliability | ≥ 99% |
| Session expiry resilience | ≥ 99% |
| Socket-disabled recovery | ≥ 99% |
| Cross-tenant denial | = 100% |

The dashboard renders an `APPROVED` / `BLOCKED` verdict and lists
the failing rules. The release is blocked until the verdict is
`APPROVED`.

---

## 4. Failure-Injection Seams

| Mode                       | Configured in `FailureInjectionBus` |
|----------------------------|-------------------------------------|
| `duplicate_submission`     | Two same-key submissions, only the first persists. |
| `worker_termination`       | First call throws `WORKER_TERMINATED_BEFORE_ACK`; second call succeeds. |
| `transient_provider_failure` | First call throws `TRANSIENT_PROVIDER_FAILURE`; second succeeds. |
| `session_expiry`           | First call throws `SESSION_EXPIRED`; second succeeds. |
| `realtime_loss`            | Recorded for socket-disabled scenarios; command path completes. |
| `cross_tenant_attempt`     | Throws `X_TENANT_NOT_FOUND` end-to-end. |
| `budget_exhaustion`        | Records budget metric; future use. |
| `policy_denial`            | Records denial; future use. |

The injection bus is reset per scenario. The runner's harness
guarantees no leakage between scenarios.

---

## 5. Tenant Isolation

The cross-tenant negative suite (`cross-tenant-negative.spec.ts`)
covers 10 entity types (Project, Goal, Task, ExecutionAttempt,
Review, EvidenceArtifact, EnterpriseInitiation, OutboxEvent,
IdempotencyRecord, TenantFeatureFlag) and the full boundary matrix
(controller, service, command, repository, worker, session, socket,
artifact path). Every test asserts rejection with no information
leakage.

---

## 6. Failure Procedure

When a scenario fails:

1. The dashboard's per-scenario table highlights the failure with
   the `errors` column.
2. The `expectedErrors` column lists expected mid-flight errors
   (worker termination, transient failure, session expiry). These
   are NOT failures — the run is still passing if the failure was
   recovered and the expected outcome was reached.
3. Open the machine-readable JSON (`g9-machine-readable.json`) to
   inspect the full `failureRecords`, `correlationTrail`, and
   `metrics` for the failed scenario.
4. Re-run the affected suite with `pnpm jest --testPathPatterns=...`
   and verify the failure is reproducible.
5. Open a fix in the relevant module; do NOT modify the
   certification runner to mask the failure.

---

## 7. P95 Targets

| Measure | Target |
|---------|--------|
| Synchronous command acknowledgement | < 2 s |
| UI sees committed state | < 5 s |
| Outbox event begins processing | < 10 s |
| Duplicate-effect rate | 0 |
| Lost committed events | 0 |
| Stuck executions without alert | 0 |
| Cross-tenant authorization failures incorrectly allowed | 0 |

---

## 8. Document End

**NC-AWL-CERT-RUN-1 v1.0**
