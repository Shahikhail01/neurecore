# G5 Sign-Off

**Date opened:** 2026-07-27
**Gate:** G5 — Governed Execution Runtime
**Status:** TECHNICAL GREEN — formal reviewer sign-off pending

## Evidence Summary

- TypeScript `tsc --noEmit`: PASS (no new errors in Phase 5 files;
  the only outstanding errors are the pre-existing
  `src/test/unit/assignment.service.spec.ts` fixture references
  that pre-date Phase 5).
- ESLint `src/modules/execution/**`: 0 errors, 4 warnings
  (all unused `eslint-disable` directives — non-blocking).
- `pnpm exec nest build`: silent success.
- Architecture guard
  (`src/test/architecture/tool-bypass.spec.ts`): 14/14 PASS.
  Prisma-bypass prevention enforced; concurrency service was
  relocated to `infrastructure/` to keep this guard clean.
- Handler isolation
  (`src/test/characterization/handler-isolation.spec.ts`): 12/12
  PASS — `execution-orchestrator.ts` continues to use only ports
  via DI tokens.
- Combined architecture + isolation suite: **26/26 PASS**.
- Migration `20260727_awl_g5_execution_runtime` declared; extends
  `execution_attempts` with snapshots, runtime columns, fencing,
  budget counters; adds `execution_tool_calls`,
  `execution_budget_ledger`, `execution_concurrency_reservations`;
  adds `@@unique([attemptId])` on `reviews`.
- Worker hardened per audit:
  - `claimForExecution` no longer swallows Prisma errors.
  - Orphan guard around `concurrency.reserve` calls
    `reclaimOrphan` under the original fencing token.
  - `ExecutionSweeper` reclaims stale `RUNNING` attempts whose
    lease has expired; releases the concurrency reservation.
  - Fenced error path enforces
    `status='RUNNING' AND ownerToken=ownerToken` before writing
    any failure state, so sweeper-reclaimed attempts are not
    silently over-written.
- Worker routes `reviews` upsert through the `REVIEW_REPOSITORY`
  port (no more direct `tx.review.upsert`).
- `ReviewsModule` exports the port + adapter; `ExecutionModule`
  imports `ReviewsModule` so the DI graph compiles.

## Required Signatures

| Reviewer | Required Decision | Signature | Date | Notes |
|----------|-------------------|-----------|------|-------|
| Architecture Owner | Approve snapshot, fencing, sweeper design | PENDING | | |
| Backend Lead | Approve atomic submit UoW + fenced error path | PENDING | | |
| Security | Approve tenant isolation + PII redaction wiring | PENDING | | |
| QA Lead | Approve failure-injection harness surface | PENDING | | |
| Product Owner | Approve evidence persistence + review-request emission | PENDING | | |

## Codex Attestation

Codex records technical evidence only. Codex cannot sign as a human
reviewer or mark G5 formally closed without the listed reviewer
approvals.

## G5 Closure Decision

**Current decision:** TECHNICAL GREEN; HOLD only for human signatures.

Required before closing G5:

- Collect all five human signatures above.
- Phase 9 to execute the failure-injection certification harness
  (provider timeout, budget exhaustion, cancellation during tool
  call, worker-restart-during-execution, duplicate delivery) end
  to end against the deployed runtime.
- Reconcile the planned `langgraph-runner.ts` (per plan §2159–2162)
  when Phase 8 begins.
