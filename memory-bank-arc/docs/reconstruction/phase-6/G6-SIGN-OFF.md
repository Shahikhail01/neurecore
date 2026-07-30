# G6 Sign-Off

**Date opened:** 2026-07-27
**Gate:** G6 — Human Review, Revision, and Lifecycle
**Status:** TECHNICAL GREEN — formal reviewer sign-off pending

## Evidence Summary

- TypeScript `tsc --noEmit`: PASS (no new errors; the pre-existing
  unrelated errors in `src/test/unit/assignment.service.spec.ts` are
  not part of Phase 6)
- Phase 6 unit suite (`review-state-machine` 9 + `lifecycle-guard` 7 +
  `decide-task-review.handler` 8 + `advance-project-stage.handler` 7
  = **34 tests** across 4 suites): PASS
- Integration spec `awl-g6-review-lifecycle.integration.spec.ts`
  (9 G6 invariant tests against real PostgreSQL): defined; runs in CI
  when `AWL_REQUIRE_INTEGRATION_DB=true` or `DATABASE_URL` is set
- Migration `20260727_awl_g6_review_lifecycle` applied locally:
  - `Project.stageVersion` column (with default 1)
  - `LifecycleWaiverScope` enum
  - `lifecycle_waivers` table (3 indexes)
  - `evidence_artifacts` BEFORE UPDATE / BEFORE DELETE triggers
    enforcing `EVIDENCE_ARTIFACT_IMMUTABLE`
- Decisions routed through the Phase 1 `CommandRegistry`:
  - `DecideTaskReviewCommand:1.0` registered in
    `reviews.module.ts:42-58`
  - `AdvanceProjectStageCommand:1.0` registered in
    `reviews.module.ts:48-58`
- Frontend `<SidebarLink>` integration deferred to Phase 7 (Execution
  UX) — the `/reviews` route is reachable and the inbox + detail
  pages render with the canonical decision flow. The
  `AgentPicker`/`Task board` slots in plan §9.1 are owned by their
  respective phases.

## Required Signatures

| Reviewer | Required Decision | Signature | Date | Notes |
|----------|-------------------|-----------|------|-------|
| Architecture Owner | Approve state-machine + completion-guard design and waiver model | PENDING | | |
| Backend Lead | Approve canonical command path + atomicity + outbox/audit integration | PENDING | | |
| Security | Approve AI-cannot-approve-guard + cross-tenant rejection + evidence immutability | PENDING | | |
| QA Lead | Approve optimistic-concurrency behavior + revision lineage + DB triggers | PENDING | | |
| Product Owner | Approve review inbox UI + evidence viewer + approve/revise/reject flow | PENDING | | |

## Codex Attestation

Codex records technical evidence only. Codex cannot sign as a human
reviewer or mark G6 formally closed without the listed reviewer
approvals.

## G6 Closure Decision

**Current decision:** TECHNICAL GREEN; HOLD only for human signatures.

Required before closing G6:

- Collect all five human signatures above.
- Run the integration spec against the deployed PostgreSQL to capture
  the same evidence CI captured locally.
- Confirm that the sidebar/navigation entry to `/reviews` is shipped
  (owned by Phase 7 Execution UX; can be added without disturbing
  Phase 6 invariants).
- Confirm that the
  `evidence_artifacts_immutable()` triggers apply to the production
  database (the migration is idempotent but the production rollout
  must be coordinated with the Phase 8 Security & Operations team so
  that the rollback plan is documented).
