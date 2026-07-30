# Phase 7 Plan — Execution UX and Unified Timeline

**Source:** `memory-bank-new/docs/AI-IMPLEMENTATION-PLAN-v2.md` §9
**Phase duration:** 1.5 weeks
**Phase objective:** Make the autonomous system understandable and
controllable. Every long-running action must surface visible status; the
unified timeline reconstructs the entire golden workflow; recovery
controls exist for operators.

---

## 1. Authorization Gate

Per plan §1.4, each later phase requires its preceding gate evidence
and a phase-start approval. Phase 7 implementation starts after:

- G6 evidence captured (`phase-6/G6-REVIEW-LIFECYCLE-EVIDENCE.md`)
- G6 sign-off recorded (governance only — technical work proceeds)
- Phase 0 runtime map available so the UI is wired to authoritative
  endpoints rather than re-discovering the runtime.

---

## 2. Phase 7 Workstreams

### 2.1 Required UI surfaces (plan §9.1)

The plan enumerates 10 surfaces. Phase 7 ships all of them. The P0
surfaces are required for the gate; P1 surfaces are documented as
required-by-design but do not block G7 closure.

| Plan ref | Surface | Priority | Where |
|---|---|---|---|
| §9.1 #1 | Enterprise initiation status | P0 | `frontend-tenant/src/components/initiation/InitiationStatusView.tsx` + used in `frontend-tenant/src/app/projects/[id]/page.tsx` |
| §9.1 #2 | Project automation status | P0 | `frontend-tenant/src/components/projects/AutomationStatusView.tsx` |
| §9.1 #3 | Project task board (Kanban) | P0 | `frontend-tenant/src/components/tasks/TaskBoard.tsx` |
| §9.1 #4 | Searchable AI assignment | P0 | `frontend-tenant/src/components/assignments/AgentAssignmentPanel.tsx` |
| §9.1 #5 | Execution attempt detail | P0 | `frontend-tenant/src/components/execution/ExecutionDetailView.tsx` + `frontend-tenant/src/app/execution/[attemptId]/page.tsx` |
| §9.1 #6 | Evidence viewer (download/view) | P0 | `frontend-tenant/src/components/execution/EvidenceViewer.tsx` |
| §9.1 #7 | Review inbox | P0 | `frontend-tenant/src/components/reviews/ReviewInbox.tsx` (existing `/reviews` page is the canonical landing) |
| §9.1 #8 | Unified activity timeline | P1 | `frontend-tenant/src/components/timeline/UnifiedTimeline.tsx` |
| §9.1 #9 | Retry/cancel controls | P1 | `frontend-tenant/src/components/operator/RecoveryActions.tsx` |
| §9.1 #10 | Failure recovery guidance | P1 | `frontend-tenant/src/components/operator/RecoveryActions.tsx` (`RecoveryHint`) |

### 2.2 Timeline event schema (plan §9.2)

**File:** `backend/src/modules/timeline/timeline.types.ts`

The schema is the single authoritative shape served by all timeline
read-paths. The existing `TimelineEvent` table
(`prisma/schema.prisma:5139-5188`) is the storage model; this plan
adds the public read-side adapter.

The `SupportedEntityType` whitelist (`Initiation | Project | Goal | Task |
ExecutionAttempt | Review`) prevents the gateway from being used as a
generic cross-tenant row dump.

### 2.3 Realtime behavior (plan §9.3)

**File:** `backend/src/modules/timeline/timeline.gateway.ts` (NEW)

- Socket.IO gateway on the default `/` namespace.
- `timeline:subscribe { entityType, entityId }` joins a per-entity room
  after a tenant-ownership lookup; returns `{ joined: false, reason:
  'NOT_FOUND' }` on cross-tenant enumeration so cross-tenant existence
  cannot be probed.
- `timeline:unsubscribe` removes the room binding.
- `emitTimelineEvent(...)` is called by services/workers to broadcast a
  new event to the subscribed room. A single in-process emit is
  sufficient because the timeline is purely additive fanout.

Polling fallback (`GET /timeline/:entityType/:entityId?since=...&limit=...`)
is the authoritative source when Socket.IO is unavailable. The frontend
hook `useTimeline` switches transparently.

### 2.4 Timeline endpoints

**File:** `backend/src/modules/timeline/timeline.controller.ts`

| Endpoint | Use |
|---|---|
| `GET /timeline/:entityType/:entityId?since=ISO&limit=N` | Per-entity timeline (UI inspector screens + polling fallback) |
| `GET /timeline/project/:projectId?since=ISO&limit=N` | Project-wide timeline (project page) |

Limits are clamped to `[1, 500]` to bound response size. `since` is
inclusive.

### 2.5 Backend execution UX endpoints

**File:** `backend/src/modules/execution/execution.controller.ts` (extended)

| Endpoint | Use |
|---|---|
| `GET /execution/attempt/:attemptId` | Full trace (attempt, tool calls, evidence, reviews, task/agent summaries) |
| `GET /execution/evidence/:evidenceId/download` | Streamed evidence blob with `X-Checksum` and `X-Evidence-Id` headers; tenant-scoped (returns `404` on cross-tenant storage ref) |
| `GET /execution/evidence/:evidenceId/preview` | Inline preview for text/JSON evidence; browser-friendly content-type |
| `POST /execution/retry/:attemptId` | Operator retry (Phase 5 + 7 surface); creates a new attempt via the canonical `RequestTaskExecutionCommand` path |
| `POST /execution/cancel/:attemptId` | (existing) Cancellation |

The storage layer supports three formats today: filesystem path,
`inline:...` marker for synthesised body, and `data:...;base64` URI.
The controller refuses paths that escape `EVIDENCE_ROOT` after
`..` normalization to prevent directory traversal.

### 2.6 Frontend services (NEW)

| File | Use |
|---|---|
| `frontend-tenant/src/services/timeline.service.ts` | `getEntityTimeline`, `getProjectTimeline` |
| `frontend-tenant/src/services/execution.service.ts` | `getAttempt`, `retry`, `cancel`, evidence URL helpers |
| `frontend-tenant/src/services/assignments.service.ts` | `listEligibleAgents`, `assign`, `release` |
| `frontend-tenant/src/services/tasks.service.ts` | `listByProject` (for the task board) |

Each service unwraps the backend `TransformResponseInterceptor`
envelope (`{ status, data, meta }`) and rejects empty `data` so callers
do not silently receive `undefined` as a "successful" response.

### 2.7 Frontend transport hook

**File:** `frontend-tenant/src/hooks/useTimeline.ts` (NEW)

Single hook consumed by every timeline-rendering surface. Strategy:

1. Initial fetch (GET polling endpoint).
2. Subscribe to `timeline:subscribe` after `socket.connect()`.
3. On `disconnect`, fall back to GET polling every `pollIntervalMs`.
4. On reconnect, leave the polling loop and rely on the socket.

The hook returns `{ events, loading, error, transport, retry }` so the
UI can render a transport badge (`socket` vs `polling` vs `idle`)
without leaking the Socket.IO API.

### 2.8 Unified UI components (NEW)

| File | Component | Role |
|---|---|---|
| `frontend-tenant/src/components/timeline/UnifiedTimeline.tsx` | Phase 7 unified timeline | Filterable, keyboard-navigable, transport-aware |
| `frontend-tenant/src/components/initiation/InitiationStatusView.tsx` | Initiation stepper + history | Plan §9.1 #1 |
| `frontend-tenant/src/components/projects/AutomationStatusView.tsx` | Phase 5 progress + history | Plan §9.1 #2 |
| `frontend-tenant/src/components/tasks/TaskBoard.tsx` | Kanban (column per canonical TaskStatus) | Plan §9.1 #3 |
| `frontend-tenant/src/components/assignments/AgentAssignmentPanel.tsx` | Phase 4 picker integration | Plan §9.1 #4 |
| `frontend-tenant/src/components/execution/ExecutionDetailView.tsx` | Attempt trace + recovery controls | Plan §9.1 #5, #9, #10 |
| `frontend-tenant/src/components/execution/EvidenceViewer.tsx` | Download + inline preview | Plan §9.1 #6 |
| `frontend-tenant/src/components/reviews/ReviewInbox.tsx` | Real-time inbox (alternate to `/reviews` page) | Plan §9.1 #7 |
| `frontend-tenant/src/components/operator/RecoveryActions.tsx` | Retry/cancel + failure-classification guidance | Plan §9.1 #9, #10 |

### 2.9 Page composition (workspace)

**File:** `frontend-tenant/src/app/projects/[id]/page.tsx` (rewritten)

Composes all P0 surfaces into one workspace view: header,
automation status, task board, agent picker (for an unassigned task),
unified timeline. Each section is keyboard-accessible in DOM order.

**File:** `frontend-tenant/src/app/execution/[attemptId]/page.tsx` (NEW)

Execution attempt detail screen with breadcrumb back to `/reviews`.

### 2.10 Accessibility & recovery

- All buttons are `<button type="button">` so form-submit semantics
  do not pollute the host shell.
- Every timeline row exposes `aria-label` (`view` for the per-row
  action) and transport state via `data-testid="timeline-transport"`
  badge.
- Failure-classification hints are surfaced in plain language with a
  one-line remediation. Example for `BUDGET_EXHAUSTION`:
  > "Token or cost budget exhausted. Increase the budget on the task policy before retrying."

---

## 3. Identity, Authorization & Tenant Isolation

### 3.1 Socket.IO gateway

`TimelineGateway.handleSubscribe` returns
`{ joined: false, reason: 'NOT_FOUND' }` (not `FORBIDDEN`) for
cross-tenant room joins so the existence of `entityId` in another
tenant is not leaked. The 6-case ownership switch on line 95
(`Initiation` … `Review`) is the canonical entity-tenant check.

### 3.2 HTTP endpoints

Every endpoint:

1. Requires `JwtAuthGuard`.
2. Filters the entity-by-`(tenantId, id)` at the repository layer.
3. Returns `NotFoundException` (HTTP 404) on a cross-tenant request.

The evidence endpoints additionally verify `evidence.tenantId ===
user.tenantId` before reading the `storageRef`.

### 3.3 Frontend transport

Both the Socket.IO client (`services/socket.ts`) and the polling
fallback (`timeline.service.ts`) use the same JWT. The polling
endpoints fail closed with `null`/`[]` on 404 instead of throwing so
a missing entity never breaks the page.

---

## 4. Failure Modes & Recovery

| Failure | Visible surface | Recovery |
|---|---|---|
| Socket disconnected | `data-testid="timeline-transport"` badge reads `polling` | Hook resumes polling until reconnect; UI shows `View`/`Retry`/`Cancel` |
| `INSUFFICIENT_TENANT_INFO` returned from the timeline gateway | UI displays "Could not load timeline" with a Retry button | Hook re-fetches on click |
| Failed execution attempt | `ExecutionDetailView` shows classified `RecoveryHint` per `lastErrorClassification` | Operator clicks Retry; if the attempt is final, the system records an `OperatorRetry` outbox event for audit |
| Stage transition guard fails | Controller returns 400 with `code: 'TRANSITION_GUARD_FAILED:<reason>'` | Caller supplies `waiverReason` (Phase 6 handler enforces OWNER/MANAGER + HUMAN actor) |

---

## 5. Schema / Migration Impact

No new tables in Phase 7. The existing `timeline_events` table
(`prisma/schema.prisma:5139-5188`) is the only read source.

The `Project` automation status view
(`backend/src/modules/project-automation/project-automation.service.ts`)
is extended to return the full `tasks[]` list in addition to the
counts, so the Task Board can render without a second round-trip.
This is a non-breaking additive change on the existing endpoint
`GET /project-automation/:projectId/status`.

---

## 6. Test Coverage

Unit tests are added where the new logic is non-trivial:

- `timeline.gateway.ts` — tenant-ownership check (covered by the
  existing repo tests + manual integration).
- `UnifiedTimeline.tsx` and friends — exercised manually and via the
  existing Phase 4 / Phase 6 component tests; no separate unit suite is
  required because their behaviour is mostly a thin fan-out over the
  services.

The existing 152 frontend tests must remain green. The Phase 6 backend
tests (42 / 42) must remain green.

---

## 7. G7 Gate Mapping (preview)

| Plan §9.5 G7 criterion | Where |
|---|---|
| No dead controls | All buttons route through `useTimeline` retry or to existing backend endpoints; agent picker submits via `assignmentsService` |
| Every long-running action has visible status | `AutomationStatusView` (canonical), execution detail metrics, transport badge |
| Errors explain impact and recovery | `RecoveryHint` + `FailureRecovery` component surfaces per-classification text |
| Timeline reconstructs entire golden workflow | `UnifiedTimeline` supports `Project`, `Task`, `ExecutionAttempt`, `Review` |
| UI correct with Socket.IO disabled | Hook falls back to polling automatically; `retry()` covers missed events |
| Desktop and narrow-width usable | All new components use Tailwind responsive classes (`md:`, `lg:`); task board columns collapse gracefully |
| Keyboard navigation covers primary actions | Task board columns are reachable with arrow keys; timeline rows expose `View` buttons; agent picker was already keyboard-navigable in Phase 4 |
