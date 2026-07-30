# ADR-0001: Delete Legacy In-Process Hermes Runtime

Date: 2026-07-29  
Updated: 2026-07-30 (Gate 3 PASS — certification closure)

Status: **Accepted — certification complete. Operational closure pending (30-day observation).**

Decision: A2-TODAY - delete/tombstone the legacy in-process Hermes execution
runtime now, after the Phase 3 production workflow run. The original 14-day
soak requirement in NC-AWL-IMP-2 is explicitly waived by the product owner for
this cleanup pass.

Certification evidence (updated 2026-07-30):

- **Gate 3: 20 Clean-Tenant SIM-04 Runs**: 20/20 PASS against fresh provisioned
  tenants. Zero duplicate customers, projects, and goals across all 20 tenants.
  Zero fabricated IDs, zero mandatory approval bypasses, 100% approval resume
  success, complete audit trails. Unique tenant IDs and emails for every run.
- Backend health: `https://brain.neurecore.com/api/v1/health` returns 200.
- All 8 gates of NC-AWL-IMP-2-CERTIFICATION-CLOSURE-PLAN are closed.
- Final gate report:
  `simulations/SIM-04-Accounting-Project-Full-Flow/runs/2026-07-30T09-30-00-000Z/summary.json`.
- Updated certification status:
  `simulations/SIM-04-Accounting-Project-Full-Flow/certification/FINAL-CERTIFICATION-STATUS-2026-07-30.md`.
- Duplicate record evidence:
  `simulations/SIM-04-Accounting-Project-Full-Flow/certification/2026-07-30-duplicate-record-evidence.json`.

Scope:

- Remove the legacy in-process `HermesRuntimeService` execution path.
- Remove its LangGraph wrapper providers and approval-resume consumer.
- Remove legacy runtime unit tests that import the deleted runtime.
- Keep the upstream Hermes sidecar and `HermesAdapterModule`.
- Keep non-runtime services currently housed in `modules/hermes/` that still
  provide live platform capabilities: activity feed, threads, approval workflow
  engine, presence, conversation intelligence, digest, escalation, follow-up,
  and related communication services.

Legacy caller audit (2026-07-30):

A full audit of every surviving `Hermes*` reference is published at:
`simulations/SIM-04-Accounting-Project-Full-Flow/certification/2026-07-30-legacy-hermes-audit.md`.

Rationale:

NeureCore remains the enterprise control plane. Upstream Hermes is the isolated
execution plane. The legacy in-process runtime is no longer the supported
execution path and should not receive further feature work.

Consequences:

- Agent task execution falls back to the local governed task executor instead
  of the removed in-process runtime.
- Direct imports of `HermesRuntimeService` are forbidden outside archived
  history.
- Physical table drops for legacy `Hermes*` persistence models are deferred
  until the remaining non-runtime services are extracted or proven unused.
- **Observation window begins 2026-07-30** (Gate 3 PASS date). The 30-day
  post-deletion observation period ends **2026-08-29**. Zero rollback events
  must be confirmed before operational closure.
- All plan documents reference T+30 from Gate 3 PASS, not the deprecated
  fixed date of 2026-08-28.
