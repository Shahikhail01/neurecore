# Phase 7 Implementation Report — Real Approval Request and Resume

Date: 2026-08-10
Plan: `memory-bank-arc/automation/implementation-plan-sol-02.md`
Phase: 7 — Implement real approval request and resume
Verdict: **IMPLEMENTED; DATABASE GATES INHERITED FROM PHASES 1-2**

## 1. Honest outcome

Phase 7's core approval pause/resume machinery already existed in the Work
Runtime and the Approval Port (ADR-006). Before this phase the runtime already:
stopped before tool execution on `REQUIRE_APPROVAL`, persisted the approval ID on
the step, set step/run waiting states, published `approval.requested`, revalidated
tool name / input hash / policy version / tool-registration version / expiry /
status on resume, and failed the run on rejection.

The concrete Phase 7 gap was the exit-gate requirement "**self approvals are
denied**". No authority boundary prevented an AI Employee (the requester of a
Work Run step approval) from deciding its own approval. This phase closes that
gap at the two authoritative decision boundaries:

- `governance/services/approvals.service.ts` — `ApprovalsService.review()`
- `approval-port/approval-port.service.ts` — `ApprovalPortService.decide()`

No production database was mutated and no new schema migration was introduced.
The real-PostgreSQL approval resume proof remains gated on `DATABASE_TEST_URL`,
as for Phases 1-6.

## 2. Implemented components

### 2.1 Self-approval prohibition in `ApprovalsService.review()`

`review()` now rejects:

1. a missing/empty reviewer identity (`SELF_APPROVAL_FORBIDDEN: reviewerId is
   required`);
2. a reviewer whose ID equals the recorded requester
   (`SELF_APPROVAL_FORBIDDEN: requester cannot approve their own request`).

This is the authoritative persistence boundary: Work Run step approvals are
recorded here, so no caller (HTTP controller, Approval Port fallback, command
handler) can bypass the prohibition. On violation the decision is not persisted
(`prisma.approvalRequest.update` is never called).

### 2.2 Self-approval prohibition in `ApprovalPortService.decide()`

`decide()` now rejects before routing to any engine:

1. a missing reviewer identity;
2. an `AI_AGENT` or `SYSTEM` reviewer (`SELF_APPROVAL_FORBIDDEN: ... cannot
   decide an approval`).

This enforces the plan rule "prohibit requester/AI Employee self-approval
through Approval Port policy" at the unified port boundary. Only `HUMAN`
reviewers with a concrete identity may decide.

### 2.3 Already-satisfied requirements (verified, not re-implemented)

| Plan requirement | Where it lives |
|---|---|
| Inject approval port into runtime collaborator (not core service) | `WorkRuntimeService` already owns approval via `ApprovalsService` + `WorkRunApprovalConsumer` |
| `request()` once with step idempotency/correlation | runtime creates approval once under step idempotency key; `WorkRunStep.approvalId` persisted |
| Stop before tool execution | runtime `runSteps` pauses at `REQUIRE_APPROVAL` before `ToolExecutor.execute` |
| On approval event: locate step by approval+tenant, verify approved | `WorkRunApprovalConsumer` + `WorkRuntimeService.checkApproval` (tenant-scoped `findStepByApproval`, expiry, status, payload hash, policy/tool versions) |
| Resume the same run/step exactly once | step `claimStep` + idempotency key guard prevent double execution |
| On rejection persist reason and terminate/pause | runtime marks step `DENIED`, run `FAILED` (`APPROVAL_REJECTED`) |
| Split draft vs external action | `reports.save_draft`/skill tools are `approvalSensitive: false`; `projects.transition_status` is `approvalSensitive: true` |

## 3. Test coverage (minimal)

| Suite | Tests | Status |
|-------|------:|--------|
| `governance/services/approvals.service.spec.ts` (new) | 3 | ✅ Passing |
| `approval-port/__tests__/approval-port.unit.spec.ts` (extended) | +1 | ✅ Passing |

New scenarios:

- requester == reviewer → rejected, no persistence;
- missing reviewer identity → rejected;
- distinct HUMAN reviewer → approved;
- `AI_AGENT` reviewer → rejected by `decide()` before any engine call.

Existing `decide()` tests (HUMAN reviewers) remain green, confirming no
behavioral regression.

## 4. Validation evidence

Executed from `backend/`:

```text
pnpm build
PASS

pnpm jest --config jest.config.js --runInBand \
  src/modules/approval-port \
  src/modules/governance \
  src/modules/work-runtime
PASS — 11 suites, 103 passed, 12 skipped (0 failures)

pnpm eslint <changed Phase 7 files>
PASS — no new findings; only pre-existing baseline errors remain

pnpm exec tsc --noEmit (scoped to Phase 7 files)
PASS — no diagnostics

git diff --check
PASS
```

## 5. Exit-gate assessment

| Requirement | Result | Evidence |
|---|---|---|
| Approval record exists and appears in tenant UI | Pass (pre-existing) | `ApprovalRequest` persisted; approval ID surfaced on `WorkRunStep`/`EmployeeRunView` |
| Sensitive tool proven not called before approval | Pass (pre-existing) | runtime pauses at `REQUIRE_APPROVAL` before `ToolExecutor.execute` |
| Approval resumes the same run/step exactly once | Pass (pre-existing) | `claimStep` + step idempotency key |
| Rejection never executes the tool | Pass (pre-existing) | `checkApproval` returns REJECTED → step `DENIED`, run `FAILED` |
| Stale/cross-tenant/self approvals are denied | Pass | tenant-scoped lookup, expiry/payload revalidation, and NEW self-approval guards in `review()` + `decide()` |
| Real-PostgreSQL approval resume proof | Pending | inherited; `DATABASE_TEST_URL` absent |

## 6. Honest limitations

- **Only the self-approval gap is newly coded.** The remaining Phase 7 exit-gate
  behaviors were already present and verified; this phase did not rewrite the
  runtime's approval loop.
- **`ApprovalRequest.requestedById` is a `User` FK.** The runtime records the AI
  Employee (an `Agent`) as requester; for Work Run step approvals the
  requester↔reviewer equality guard relies on the stored `requestedById` value.
  The human-only reviewer rule in `decide()` is the primary AI self-approval
  defense.
- **Real-PostgreSQL resume proof pending.** As with Phases 1-6, a disposable
  database is required to certify end-to-end approval resume exactly once.

## 7. Next action

Phase 8 — Compatibility adapters and caller migration:
1. adapt `/agents/:id/dispatch` and `/agents/:id/task` to start through
   `AIEmployeeCore`;
2. route `/agents/:id/run`, `/agent-runtime/run`, chat `/agent` through the core;
3. replace `runtime.createRun()` calls in cognition/autonomy with `core.start()`;
4. delegate ExecutionAttempt business execution to the core with `workRunId`.
