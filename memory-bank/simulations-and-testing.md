# Simulations & Testing

> How the Phase 9 certification harness, SIM-04 runner, mandatory invariants, and unit/integration test layers compose. Last refreshed: 2026-07-31.

The platform has four distinct test layers. Each is necessary; they are
not interchangeable.

| Layer | Tool | Path | Scope | DB? |
|---|---|---|---|---|
| **Unit** | Jest | `backend/src/**/*.spec.ts` | Single class / function | No |
| **Integration** | Jest | `backend/src/**/*.integration-spec.ts` | Modules + Prisma | Yes (`DATABASE_URL`) |
| **AWL certification** | Jest + custom runner | `backend/src/test/certification/` | 105-scenario matrix + invariants | Optional |
| **End-to-end FE** | Playwright (Node) | `simulations/SIM-04-...` + tenant portal | Browser-driven flows | Yes |

Plus tooling around them:
- **Fixture harness** (`harness/certification-harness.ts`).
- **Failure injection** (`fixtures/failure-injection.ts`).
- **Synthetic data** (`synthetic/accounting-synthetic-data.ts`).

---

## 1. Unit tests

### 1.1 Backend
- **Command:** `pnpm test` (or `pnpm test:unit`).
- **Pattern:** `*.spec.ts`, run by `jest --config jest.config.js` (rootDir
  `src`).
- **Coverage:** `pnpm test:cov`.
- **Staged on commit:** `pnpm test:staged`.
- **CI:** `pnpm test:ci` with JUnit report.

Specialties:
- `auth-hardening.spec.ts` — verifies cookie + CSRF + lockout behaviour.
- `auth.service.ts:59-98` constant-time `validateUser` covered.
- `chat-history.service.spec.ts` — DB-free where possible.

### 1.2 Frontend — Vitest
- `frontend-admin/`, `frontend-tenant/`: `pnpm test` (vitest).
- Coverage: `pnpm test:coverage`.

### 1.3 Backend sidecars
- `infra/accounting-sidecar/tests/` — pytest.
- `infra/hermes-sidecar/tests/` — pytest.
- `infra/hermes-events-bridge/tests/` — pytest.
- `infra/_common/tests/` — shared helpers (HMAC + scope token).

---

## 2. Integration tests

### 2.1 Backend
- `*.integration-spec.ts`.
- Require a Postgres with the latest schema applied
  (`pnpm prisma migrate deploy`).
- `pnpm test:integration` runs them only.

Examples:
- `backend/src/test/integration/golden-path-invariants.integration-spec.ts` —
  persistence-layer invariants.
- `backend/src/modules/chat/chat.integration-spec.ts` — chat flow.
- Many module-level integration specs.

### 2.2 DB-free when possible
The certification runner is intentionally DB-typed-agnostic so unit
tests can run without a DB. The DB path is opt-in via `DB_AVAILABLE`.

---

## 3. Phase 9 certification (AWL)

> **Gate G9** is the platform's release gate for the Autonomous Work
> Layer reconstruction. **APPROVED** is required for production deploys.
> See `memory-bank/runbook.md §5` for thresholds + emergency procedure.

### 3.1 Layout
```
backend/src/test/certification/
├── certification-runner.ts       ← The runner (run matrix + G9 gate)
├── certification.spec.ts         ← Top-level G9 suite
├── cross-tenant-negative.spec.ts ← Cross-tenant denial coverage
├── failure-recovery.spec.ts      ← Failure classification
├── golden-path.spec.ts           ← Basic happy path
├── golden-path-e2e.spec.ts       ← Command pipeline
├── idempotency.spec.ts           ← Idempotency keys
├── phase8-tenant-isolation.spec.ts ← Phase-8 isolation
├── tenant-isolation.spec.ts      ← Basic isolation
├── fixtures/
│   └── failure-injection.ts      ← FailureInjectionBus
├── harness/
│   └── certification-harness.ts  ← Run IDs + dataset provisioning
├── invariants/
│   └── mandatory-invariants.spec.ts ← 10 invariants
├── scenarios/
│   └── scenario-executor.ts      ← Simulated command pipeline executor
├── synthetic/
│   └── accounting-synthetic-data.ts ← Synthetic datasets
└── reports/                      ← Generated artifacts (gitignored)
```

### 3.2 Run matrix (NC-AWL-IMP-1 §11.3)

| Scenario | Count |
|---|---:|
| Clean golden-path | 50 |
| Duplicate submission | 10 |
| Worker restart | 10 |
| Transient failure | 10 |
| Revision cycle | 10 |
| Session expiry / relogin | 5 |
| Socket disabled | 5 |
| Cross-tenant negative | 5 |
| **Total** | **105** |

### 3.3 Gate G9 (NC-AWL-IMP-1 §11.5)
| Rule | Required |
|---|---|
| 100% critical-path pass rate | yes |
| Zero duplicate effects | yes |
| Zero cross-tenant exposure | yes |
| All runs preserve evidence trail | yes |
| ≥ 98% clean runs without engineering intervention | yes |
| Duplicate suppression ≥ 99% | yes |
| Worker recovery ≥ 99% | yes |
| Transient recovery ≥ 90% | yes |
| Revision cycle reliability ≥ 99% | yes |
| Session expiry resilience ≥ 99% | yes |
| Socket-disabled recovery ≥ 99% | yes |
| Cross-tenant denial = 100% | yes |

Verdict: **`APPROVED` / `BLOCKED`** — single boolean in `g9-summary.json`.

### 3.4 Commands
```bash
pnpm certify:phase9        # full matrix standalone
pnpm certify:dashboard     # render dashboard from JSON
pnpm certify:phase9:all    # suite + runner + dashboard (one shot)

pnpm jest --config jest.config.js \
    --testPathPatterns="src/test/certification/"   # jest side only
```

Outputs (`src/test/certification/reports/`):
- `g9-machine-readable.json` — raw `CertificationRun`.
- `g9-summary.json` — flattened gate summary.
- `g9-dashboard.html` — operator-friendly dashboard.

### 3.5 The runner
`backend/src/test/certification/certification-runner.ts:1-60` declares:
- `ScenarioType`: `'clean_run' | 'duplicate_submission' |
  'worker_restart' | 'transient_failure' | 'revision_cycle' |
  'session_expiry' | 'socket_disabled' | 'cross_tenant_negative'`.
- `CertificationScenario` — id, type, tenantId, runId, inputs,
  `failureConfig?`, expected outcomes.
- `ExpectedOutcome` — entity type, expected count, idempotency key.

The runner:
1. Generates a unique `runId` per scenario.
2. Optionally provisions an isolated dataset
   (`harness/certification-harness.ts`).
3. Wires `FailureInjectionBus` per scenario.
4. Executes and compares against expected outcomes.
5. Writes the evidence index to the JSON report.

### 3.6 FailureInjectionBus
`backend/src/test/certification/fixtures/failure-injection.ts`:
8 modes:
- `duplicate_submission`
- `worker_termination`
- `transient_provider_failure`
- `session_expiry`
- `realtime_loss`
- `cross_tenant_attempt`
- `budget_exhaustion`
- `policy_denial`

Per-scenario only. The runner never carries injection state across
runs (reset per scenario).

### 3.7 10 Mandatory Invariants (NC-AWL-IMP-1 §14.2)
`backend/src/test/certification/invariants/mandatory-invariants.spec.ts`:
1. Same idempotency key cannot create two projects.
2. Same event cannot create duplicate tasks.
3. Same execution request cannot create two active attempts.
4. AI cannot approve its own task.
5. Cross-tenant IDs are rejected.
6. Project cannot complete with mandatory unapproved tasks.
7. Failed transaction creates neither aggregate nor outbox event.
8. Committed aggregate always has required outbox event.
9. Worker retry cannot overwrite approved artifact.
10. Revision never mutates prior attempt evidence.

Persistence-layer invariant tests live at
`backend/src/test/integration/golden-path-invariants.integration-spec.ts`.

### 3.8 Tenant isolation coverage (Phase 8)
10 entity types × 5 boundary layers = 50 cross-tenant probes:
- **Entity types:** `Project`, `Goal`, `Task`, `ExecutionAttempt`,
  `Review`, `EvidenceArtifact`, `EnterpriseInitiation`, `OutboxEvent`,
  `IdempotencyRecord`, `TenantFeatureFlag`.
- **Boundary layers:** controller, service, command, repository,
  worker, session, socket, artifact path.

---

## 4. SIM-04 (Accounting Customer HITL Walkthrough)

> **FE-first.** Always runs the browser, **never falls back to API**
> for a failed step. Plain-language chat does not name tools.

### 4.1 Path
```
simulations/SIM-04-Accounting-Project-Full-Flow/
├── README.md
├── POSTMORTEM.md
├── certify-sim04.mjs                  ← Entrypoint
├── capture-sim04-duplicate-evidence.cjs
├── provision-sim04-tenants.cjs
├── baselines/                         ← Reference outputs
├── certification/                     ← Cert-level artefacts
├── runs/                              ← Per-run artefacts
```

### 4.2 Status (2026-07-28, per AGENTS.md)
- **Verdict:** ❌ **FAIL** (S1 + S2 failed; S3–S12 skipped).
- **Open defects:** NC-SIM04-002 (modal z-index), NC-SIM04-005
  (chat NL → createProject binding).
- See `memory-bank/pending-tasks.md §A` for closure plan.

### 4.3 Commands
```bash
pnpm certify:sim04                                  # from backend
node ../simulations/SIM-04-Accounting-Project-Full-Flow/certify-sim04.mjs   # direct
node ../simulations/SIM-04-Accounting-Project-Full-Flow/provision-sim04-tenants.cjs   # seed
node ../simulations/SIM-04-Accounting-Project-Full-Flow/capture-sim04-duplicate-evidence.cjs
```

### 4.4 FE-first rule (do not violate)
If a step fails in the browser, **stop and fix the FE**; do not
work around via API. The whole point of SIM-04 is to surface real user
friction, not paper over it.

---

## 5. Per-app test commands

| App | Unit | Typecheck | Lint | Build |
|---|---|---|---|---|
| backend | `pnpm test`, `pnpm test:unit` | `pnpm exec tsc --noEmit` | `pnpm lint` | `pnpm build` |
| backend (all) | `pnpm verify` = tsc + eslint + jest coverage + build | | | |
| frontend-admin | `pnpm test` (vitest) | `pnpm type-check` | `pnpm lint` | `pnpm build` |
| frontend-admin (all) | `pnpm verify` = tsc + lint + vitest cover + build | | | |
| frontend-tenant | same as admin | | | |
| sidecars | `pytest tests/ -v` (each) | — | `ruff` if present | — |

---

## 6. CI / pre-commit

- `scripts/pre-commit-check.sh` — wrapper for staged checks.
- `scripts/auth-lint.sh` — auth-shaping linter.
- `scripts/check-dist-drift.sh` — backend dist drift.
- `scripts/admin-scan.mjs` — admin-only lint/audit pass.
- `neurecore-ci-check/` — generic CI helpers.

---

## 7. Adding a new scenario to the AWL matrix

1. Decide the scenario type (use existing; if a new family is needed,
   add a new `ScenarioType` member at
   `certification-runner.ts:36-43`).
2. Define the expected outcomes + idempotency key.
3. Add to the runner's scenario factory in
   `certification-runner.ts`.
4. Add a unit spec at `*.spec.ts` in the certification folder.
5. Re-run: `pnpm certify:phase9`.
6. If you lowered a threshold, justify in `pending-tasks.md`.

---

## 8. Adding a new test isolation tenant

`RECONSTRUCTION_TEST_TENANT_ID` and `ATTACKER_TENANT_ID` are exported from
`harness/certification-harness.ts`. Use them when you need a second
tenant for cross-tenant denial probes.

---

## 9. Source pointers

- `backend/src/test/certification/` (everything in §3).
- `backend/src/test/integration/` (DB-backed invariants).
- `simulations/SIM-04-Accounting-Project-Full-Flow/`.
- `backend/package.json` scripts (`certify:*`, `test*`).
- `AGENTS.md` (Phase 9 + SIM-04 official guide).
- `memory-bank/runbook.md §5` (operator view of gate G9).