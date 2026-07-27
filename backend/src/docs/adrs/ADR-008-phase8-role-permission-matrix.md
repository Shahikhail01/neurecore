# ADR-008 — Phase 8 Role × Action Permission Matrix

**Status:** Accepted
**Phase:** 8 — Security, Observability, and Operations (NC-AWL-IMP-1 §10.5)

## Context

Phase 8 §10.1 item 5/6 requires:

> Repositories require tenant-scoped keys and include tenant predicates.
> Tool policies validate tenant, actor, task, and allowed action.
> Server-side evaluation for all security or mutation decisions. Client-visible flags are presentation hints only and cannot authorize backend behavior.

§10.5 requires a "Role/permission matrix" doc.

Before Phase 8, authorization decisions were spread across guards, decorators, and ad-hoc `if` checks inside services. There was no single place that answered "is actor X allowed to perform action Y?". Self-approval was enforced downstream by state-machine checks rather than at the authorization boundary.

## Decision

Authorization for **every business mutation** is consolidated behind a
single `Phase8PermissionService` (in
`src/modules/phase8/application/phase8-permission.service.ts`).
The service reads its allow-list from a frozen role × action matrix
(`src/modules/phase8/domain/phase8.constants.ts` → `PHASE8_PERMISSIONS`)
and applies a self-approval invariant
(`SELF_APPROVAL_FORBIDDEN`).

### Matrix

| Action ↓ / Role → | OWNER | ADMIN | USER | AUDITOR | SEC-OFF | PLAT-ADMIN | SUPER | AI-AGENT | SYSTEM |
|-------------------|:-----:|:-----:|:----:|:-------:|:-------:|:----------:|:-----:|:--------:|:------:|
| INITIATE                   | ✓ | ✓ | ✓ |   |   |   | ✓ |   |   |
| APPROVE_INITIATION         | ✓ | ✓ |   |   |   |   | ✓ |   |   |
| CREATE_PROJECT             | ✓ | ✓ |   |   |   |   | ✓ |   |   |
| REQUEST_AUTOMATION         | ✓ | ✓ |   |   |   |   | ✓ |   |   |
| CREATE_GOAL                | ✓ | ✓ |   |   |   |   | ✓ |   |   |
| CREATE_TASK                | ✓ | ✓ |   |   |   |   | ✓ |   |   |
| ASSIGN_TASK                | ✓ | ✓ |   |   |   |   | ✓ |   |   |
| REASSIGN_TASK              | ✓ | ✓ |   |   |   |   | ✓ |   |   |
| EXECUTE_TASK               | ✓ | ✓ |   |   |   |   | ✓ | ✓ | ✓ |
| PRODUCE_EVIDENCE           | ✓ | ✓ |   |   |   |   | ✓ | ✓ | ✓ |
| APPROVE_REVIEW             | ✓ | ✓ | ✓ |   |   |   | ✓ | ✗ | ✗ |
| REVISION_REQUEST           | ✓ | ✓ | ✓ |   |   |   | ✓ | ✓ |   |
| CANCEL_EXECUTION           | ✓ | ✓ |   |   |   |   | ✓ |   |   |
| RETRY_EXECUTION            | ✓ | ✓ |   |   |   |   | ✓ |   |   |
| COMPLETE_PROJECT           | ✓ | ✓ |   |   |   |   | ✓ |   |   |
| ADVANCE_STAGE              | ✓ | ✓ |   |   |   |   | ✓ |   |   |
| TOGGLE_FEATURE_FLAG        | ✓ | ✓ |   |   | ✓ | ✓ | ✓ |   |   |
| REPLAY_DEAD_LETTER         |   |   |   |   | ✓ | ✓ | ✓ |   | ✓ |
| READ_ARTIFACT              | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |   |   |
| CREATE_SIDE_EFFECT         | ✓ | ✓ |   |   |   |   | ✓ |   | ✓ |
| REDACT_SECRET              |   |   |   |   |   |   | ✓ |   | ✓ |
| RECONSTRUCT_TENANT         | ✓ | ✓ |   |   |   | ✓ | ✓ |   |   |

✓ = allowed by role
✗ = role has the matrix entry but is blocked by `SELF_APPROVAL_FORBIDDEN`
(blank) = not present in the role's allow set

### Self-approval invariant

The matrix alone is not sufficient. The `SELF_APPROVAL_FORBIDDEN` table
captures the G5 / G6 invariant that no AI-controlled path may approve
its own work. The Phase 8 service enforces both layers in one call:

```ts
phase8Permission.assertAllowed({
  role: 'AI_AGENT',
  actorType: 'AI_AGENT',
  actorId: 'agent-1',
  action: 'APPROVE_REVIEW',
  subjectActorId: 'agent-1',
});
// throws PHASE8_PERMISSION_DENIED with reason SELF_APPROVAL_FORBIDDEN
```

### Where the service is called

* `ExecutionWorker.handleTaskExecutionRequested` — before invoking a
  side-effecting tool, the worker calls `assertAllowed({ action: 'CREATE_SIDE_EFFECT', ... })`
  and refuses on `PHASE8_PERMISSION_DENIED`.
* `ReviewService.submitReview` — calls `assertAllowed({ action: 'APPROVE_REVIEW', ... })`
  before persisting the decision; AI agents that try to approve their
  own attempt receive a 403 *before* the state machine sees the call.
* `AssignmentsService.assign` — calls `assertAllowed({ action: 'ASSIGN_TASK', ... })`.

## Consequences

* All mutating authorization paths flow through one service.
* AI self-approval is impossible without code changes.
* Client-visible flags cannot authorize any backend behavior; the
  matrix is server-side only.
* The matrix is a frozen object — adding a permission requires a code
  change, a test update, and ADR review. No flag flipping.
* The matrix is authoritative — no `if (role === 'OWNER')` ad-hoc
  checks are allowed in domain services (enforced by ESLint and
  architecture tests in later phases).

## References

* NC-AWL-IMP-1 §10.5 (Role/permission matrix)
* NC-AWL-IMP-1 §10.1 items 1-8 (security enforcement at every boundary)
* G5 §7.7 "No AI-controlled path can approve its own work"
* G6 §8.4 "Reviewer identity and decision are persisted"
