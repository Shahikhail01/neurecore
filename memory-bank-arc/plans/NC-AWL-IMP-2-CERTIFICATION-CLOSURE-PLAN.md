# NC-AWL-IMP-2 Certification Closure Plan

**Date:** 2026-07-30
**Status:** ACTIVE — executing
**Supersedes:** FINAL-CERTIFICATION-STATUS-2026-07-30.md
**Target:** Close all 8 open gates, certify NC-AWL-IMP-2 as complete

---

## Gate Map

| # | Gate | Current Status | Target |
|---|---|---|---|
| 1 | DB-backed template inventory | ❌ No inventory exists | ✅ Script + report |
| 2 | Baseline archive | ❌ Missing | ✅ Replace with labeled current snapshot |
| 3 | 20 isolated clean-tenant SIM-04 runs | ❌ Reused one account | ✅ Provision + run + evidence |
| 4 | General autonomy traces (no locked prompt) | ❌ Acme Q3 locked | ✅ General prompt + learning enabled |
| 5 | Subagent delegation, skills, learning, reviewer, self-correction cert | ❌ Not evidenced | ✅ Focused test suites |
| 6 | Ten-tool contract matrix | ❌ Partial | ✅ Complete RBAC/approval/idempotency/schema/audit |
| 7 | Audit surviving legacy callers | ❌ Not documented | ✅ Full audit + ADR-0001 update |
| 8 | Zero-rollback observation report | ⏳ Set at 2026-08-28 | ✅ Reset to 30 days after Gate 3 completion |

**Post-deletion observation adjustment (per user instruction 2026-07-30):**
The 30-day observation window now starts from the date the 20 clean-tenant
runs complete and the gate passes. The previous fixed date of 2026-08-28 is
void. The new earliest completion date will be set when Gate 3 closes.

---

## Gate 1 — Template Inventory

### Objective
Produce a DB-backed report reconciling the historical 707 figure with every
current `AgentTemplate` row, grouped by source/domain/status with stable IDs.

### Tasks

| # | Task | Deliverable |
|---|---|---|
| 1.1 | Create `backend/scripts/inventory-templates.ts` — connects to Prisma, queries all `AgentTemplate` rows, groups by `config.autonomousWorkLayer.domain`, `isPublic`, `tenantId IS NULL`, `deprecatedAt IS NULL`, `enabled`, certification status | Executable script |
| 1.2 | Add `pnpm inventory:templates` script to root `package.json` | npm script |
| 1.3 | Run against production DB, write `simulations/SIM-04-Accounting-Project-Full-Flow/certification/2026-07-30-template-inventory.json` | Evidence JSON |
| 1.4 | Reconcile: explain every row that does not fit the 20 certified + 792 shadow split; flag duplicates by natural identity (same name + type + model) | Report section |

### Verification
- `pnpm inventory:templates` produces a valid JSON report
- Report includes `totalRows`, `certifiedCount`, `shadowCount`, `deprecatedCount`, `perDomain` breakdown, `duplicateNaturalIdentities`

---

## Gate 2 — Baseline Archive

### Objective
The original `sim-04-baseline-2026-07-28` is absent. Create a clearly labeled
replacement that snapshots the current state.

### Tasks

| # | Task |
|---|---|
| 2.1 | Snapshot current SIM-04 artifacts: `runs/2026-07-29T14-27-07-839Z/`, `certification/*.json`, `provision-sim04-tenants.cjs`, `certify-sim04.mjs`, `capture-sim04-duplicate-evidence.cjs`, `README.md` |
| 2.2 | Write `BASELINE-REPLACEMENT.md` explaining what this is, why the original is missing, and what state it captures |
| 2.3 | Store at `simulations/SIM-04-Accounting-Project-Full-Flow/baselines/2026-07-30-replacement/` |

### Verification
- `baselines/2026-07-30-replacement/` exists with all artifacts + `BASELINE-REPLACEMENT.md`

---

## Gate 3 — 20 Clean-Tenant SIM-04 Runs

### Objective
Provision 20 fresh tenants, run the browser certification against each,
capture per-tenant duplicate evidence, and produce a passing gate.

### Prerequisites
- Production database accessible from the workstation running the scripts
- `hq.neurecore.com` accessible in a browser
- `provision-sim04-tenants.cjs` and `certify-sim04.mjs` functional

### Tasks

| # | Task | Command |
|---|---|---|
| 3.1 | Provision 20 clean tenants | `node simulations/SIM-04-Accounting-Project-Full-Flow/provision-sim04-tenants.cjs --count=20 --prefix=sim04-clean-20260730` |
| 3.2 | Run browser certification against all 20 | `PLAYWRIGHT_BASE_URL=https://hq.neurecore.com SIM04_TENANT_MANIFEST=<manifest.json> node simulations/SIM-04-Accounting-Project-Full-Flow/certify-sim04.mjs --runs=20` |
| 3.3 | Capture per-tenant duplicate evidence | `node simulations/SIM-04-Accounting-Project-Full-Flow/capture-sim04-duplicate-evidence.cjs --manifest=<manifest.json>` |
| 3.4 | Finalize gate with evidence file | Re-run certify with `SIM04_DUPLICATE_RECORDS_EVIDENCE=<evidence.json>` |
| 3.5 | Write `2026-07-30-phase3-certification.json` with verdict | Composite gate record |

### Verification
- `summary.json`: `verdict = "PASS"`, `completionRate >= 0.9`, all sub-gates green
- `duplicate-record-evidence.json`: `perTenant` array with 20 entries, aggregate counts all zero
- Unique `tenantId` × 20 and unique `email` × 20

---

## Gate 4 — General Autonomy Traces

### Objective
Remove the locked Acme Q3 workflow from the system prompt. Enable general
planning autonomy and the learning path.

### Tasks

| # | Task | File(s) |
|---|---|---|
| 4.1 | Rewrite `ephemeral_system_prompt` in `aiagent.py` to be domain-neutral: "You are NeureCore's autonomous execution worker. Fulfil the user's requested business workflow by planning and using only the enabled nc.* tools. Resolve real IDs with read tools; never invent IDs." Remove "For the locked Acme Q3 workflow..." paragraph | `infra/hermes-sidecar/hermes_sidecar/aiagent.py` |
| 4.2 | Change `skip_memory=True` → `skip_memory=False` and `save_trajectories=False` → `save_trajectories=True` in `create_aiagent()` | `infra/hermes-sidecar/hermes_sidecar/aiagent.py` |
| 4.3 | Add a `reasoning_effort` parameter configurable per execution, defaulting to medium | `infra/hermes-sidecar/hermes_sidecar/models.py` + `aiagent.py` |
| 4.4 | Add `nc.plan_workflow` tool that lets the model emit its plan before executing (traceable, auditable) | `backend/src/modules/hermes-adapter/tools/` + `infra/hermes-sidecar/hermes_sidecar/neurecore_tools.py` |
| 4.5 | Deploy sidecar update to Contabo, verify with a general-purpose chat turn (not Acme) | Production verification |

### Verification
- System prompt no longer contains "Acme", "Q3", or "locked"
- `skip_memory=False`, `save_trajectories=True` in production runtime
- A non-accounting chat turn (e.g. "What tools can you use?") returns a plan via `nc.plan_workflow` then executes

---

## Gate 5 — Subagent, Skills, Learning, Reviewer, Self-Correction

### Objective
Certify that the autonomous work layer can delegate work to subagents, create
and reuse skills, learn from prior executions, invoke reviewers, and
self-correct.

### Tasks

| # | Task | Deliverable |
|---|---|---|
| 5.1 | **Subagent delegation cert** — Build a focused test suite that validates the upstream `delegate_task` tool works through the NeureCore sidecar. Test: parent creates a subagent, subagent completes a task, parent receives result, audit trail captured | `infra/hermes-sidecar/tests/test_subagent_delegation.py` |
| 5.2 | **Skill creation/reuse cert** — Build a test that creates a skill (via template), stores it in HERMES_HOME persistent layer, then a second execution reuses it. Test: skill directory exists, LLM references it in planning | `infra/hermes-sidecar/tests/test_skill_lifecycle.py` |
| 5.3 | **Learning cert** — With `skip_memory=False`, run 3 consecutive executions of the same workflow. Assert: execution 3 is faster/uses fewer tool calls than execution 1 (demonstrates trajectory reuse) | `infra/hermes-sidecar/tests/test_learning_curve.py` |
| 5.4 | **Reviewer cert** — Add a `nc.request_review` tool that pauses execution for human review of output evidence. Test: reviewer rejects, agent self-corrects using feedback, resubmits successfully | `infra/hermes-sidecar/tests/test_reviewer_loop.py` |
| 5.5 | **Self-correction cert** — Inject a deliberate error (invalid tool arg), verify agent detects the error response, replans, and retries correctly without human intervention | `infra/hermes-sidecar/tests/test_self_correction.py` |
| 5.6 | Run all 5 new test suites + existing sidecar tests, verify 0 failures | CI gate |

### Verification
- 5 new test suites created, all passing
- Evidence traces showing delegation, skill reuse, learning improvement, reviewer feedback loop, self-correction

---

## Gate 6 — Ten-Tool Contract Matrix

### Objective
Complete the RBAC, approval, idempotency, invalid-schema, and audit matrix for
all 10 scoped `nc.*` tools.

### Tasks

| # | Task | Deliverable |
|---|---|---|
| 6.1 | Expand `hermes-scoped-tool-gateway.spec.ts` to cover every tool × every contract dimension: (a) valid call succeeds, (b) invalid schema returns 400, (c) RBAC mismatch returns 403, (d) approval-required tool defers correctly, (e) idempotent retry reuses result, (f) audit log row written | `backend/test/unit/hermes-scoped-tool-gateway.spec.ts` |
| 6.2 | Add tenant-isolation tests: Tool call with wrong tenant ID in token → 403 | `backend/test/unit/hermes-scoped-tool-gateway.spec.ts` |
| 6.3 | Add truncation test: > 50KB response → truncation marker | `backend/test/unit/hermes-scoped-tool-gateway.spec.ts` |
| 6.4 | Add error normalization test: Every error path → `{success: false, error: {code, message, retriable}}` | `backend/test/unit/hermes-scoped-tool-gateway.spec.ts` |
| 6.5 | Produce a machine-readable matrix: `simulations/SIM-04-Accounting-Project-Full-Flow/certification/2026-07-30-tool-contract-matrix.json` with pass/fail per cell | Evidence JSON |

### Verification
- 10 tools × 7 contract dimensions = 70 test cases minimum, all passing
- Machine-readable matrix file valid and complete

---

## Gate 7 — Legacy Caller Audit + ADR-0001 Update

### Objective
Document every surviving Hermes reference, confirm the governance exception
scope, and update ADR-0001 with the complete audit.

### Tasks

| # | Task |
|---|---|
| 7.1 | Produce `simulations/SIM-04-Accounting-Project-Full-Flow/certification/2026-07-30-legacy-hermes-audit.md`: list every file importing from `modules/hermes/`, every `Hermes*` type reference, every `HERMES_*` env var, and classify each as "runtime (deleted)", "non-runtime (preserved)", or "adapter (active)" |
| 7.2 | Update `docs/adr/0001-legacy-hermes-runtime-deletion.md` with the full audit reference and the new observation period definition |
| 7.3 | Add a CI lint rule that blocks new imports of `HermesRuntimeService`, `HermesNode`, `HermesRouter`, `HermesCheckpointer`, `HermesApprovalResumeConsumer` |

### Verification
- Audit document complete and attached to ADR-0001
- `grep -rn "HermesRuntimeService\|HermesNode\|HermesRouter\|HermesCheckpointer\|HermesApprovalResumeConsumer" backend/src/` → 0
- CI rule present in `eslint` config

---

## Gate 8 — Post-Deletion Observation

### Objective
Adjust the observation window to start from Gate 3 completion, not a fixed
date.

### Tasks

| # | Task |
|---|---|
| 8.1 | Update ADR-0001 §"Consequences" to reflect: "The 30-day observation window begins on the date Gate 3 (20 clean-tenant SIM-04 runs) passes. The earliest completion date is 30 days after that, with an exact date set at the time of Gate 3 closure." |
| 8.2 | Add a placeholder observation report at `simulations/SIM-04-Accounting-Project-Full-Flow/certification/2026-08-XX-observation-report.md` with the required structure: weekly audit checks, rollback events (must be zero), service health checks |
| 8.3 | Remove the hardcoded `2026-08-28` date from all plan documents and replace with "T + 30 days from Gate 3 PASS date" |

### Verification
- No document references the fixed `2026-08-28` date as the required completion date
- Observation start date recorded at Gate 3 closure time

---

## Execution Order

```
Gate 7 (audit) ────┐
Gate 1 (inventory) ─┤─── Phase 0 cleanup (parallel, no dependencies)
Gate 2 (baseline) ──┘
                    │
                    ▼
Gate 4 (general prompt) ──── sidecar redeploy
                    │
                    ▼
Gate 5 (subagent/skills/learning) ──── test suites + sidecar update
                    │
                    ▼
Gate 6 (contract matrix) ──── expand test suite
                    │
                    ▼
Gate 3 (20 clean tenants) ──── provision + runs + evidence ──── sets Gate 8 start date
                    │
                    ▼
Gate 8 (observation) ──── 30-day window ──── final sign-off
```

Gates 1, 2, 7 can run in parallel immediately.
Gates 4, 5, 6 are code changes that prepare for Gate 3.
Gate 3 requires production access and is the critical path.
Gate 8 is temporal and cannot be accelerated.

---

## Files Created/Modified by This Plan

| Action | File |
|---|---|
| CREATE | `backend/scripts/inventory-templates.ts` |
| CREATE | `simulations/SIM-04-Accounting-Project-Full-Flow/baselines/2026-07-30-replacement/` |
| CREATE | `simulations/SIM-04-Accounting-Project-Full-Flow/certification/2026-07-30-template-inventory.json` |
| CREATE | `simulations/SIM-04-Accounting-Project-Full-Flow/certification/2026-07-30-legacy-hermes-audit.md` |
| CREATE | `simulations/SIM-04-Accounting-Project-Full-Flow/certification/2026-07-30-tool-contract-matrix.json` |
| CREATE | `infra/hermes-sidecar/tests/test_subagent_delegation.py` |
| CREATE | `infra/hermes-sidecar/tests/test_skill_lifecycle.py` |
| CREATE | `infra/hermes-sidecar/tests/test_learning_curve.py` |
| CREATE | `infra/hermes-sidecar/tests/test_reviewer_loop.py` |
| CREATE | `infra/hermes-sidecar/tests/test_self_correction.py` |
| MODIFY | `infra/hermes-sidecar/hermes_sidecar/aiagent.py` — generalize system prompt, enable learning |
| MODIFY | `infra/hermes-sidecar/hermes_sidecar/models.py` — add reasoning_effort |
| MODIFY | `backend/src/modules/hermes-adapter/tools/scoped-tool-gateway.service.ts` — add nc.plan_workflow |
| MODIFY | `backend/test/unit/hermes-scoped-tool-gateway.spec.ts` — expand to full matrix |
| MODIFY | `docs/adr/0001-legacy-hermes-runtime-deletion.md` — update observation period + audit ref |
| MODIFY | `memory-bank-arc/plans/NEURECORE-AUTONOMOUS-WORK-LAYER-IMPLEMENTATION-PLAN-v2.md` — update Gate 8 date |
| MODIFY | Root `package.json` — add `inventory:templates` script |

---

## Stop Criteria

This plan is complete when:
1. All 8 gates show ✅ in the gate map above
2. `FINAL-CERTIFICATION-STATUS-2026-07-30.md` is superseded by a new document with verdict: **CERTIFIED**
3. ADR-0001 is updated with the observation start date
4. The 30-day observation window is documented and a calendar event is set
