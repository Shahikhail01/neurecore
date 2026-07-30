# G7 Sign-Off

**Date opened:** 2026-07-27
**Gate:** G7 — Execution UX and Unified Timeline
**Status:** TECHNICAL GREEN — formal reviewer sign-off pending

## Evidence Summary

- TypeScript `tsc --noEmit` (backend): no errors in the new
  `timeline/`, `execution/execution.controller.ts`, or
  `project-automation.service.ts` files
- TypeScript `tsc --noEmit` (frontend): no errors in any of the 14
  new files (`services/*`, `hooks/useTimeline`, the new components,
  and the two new pages)
- Backend unit + integration test gate: **42 / 42 pass** (Phase 6 +
  Phase 7 surface logic; no schema migration introduced in Phase 7)
- Frontend vitest suite: **152 / 152 pass**
- ESLint (backend, Phase 7 files): clean
- ESLint (frontend, Phase 7 files): clean
- `nest build`: succeeds
- New APIs introduced in Phase 7:
  - `GET  /timeline/:entityType/:entityId?since=…&limit=…`
  - `GET  /timeline/project/:projectId?since=…&limit=…`
  - `GET  /execution/attempt/:attemptId`
  - `GET  /execution/evidence/:evidenceId/download`
  - `GET  /execution/evidence/:evidenceId/preview`
  - `POST /execution/retry/:attemptId`
- Socket.IO events added (on the default `/` namespace, identical to
  the existing `EventsGateway`):
  - `timeline:subscribe { entityType, entityId }` →
    `{ joined, room?, reason? }`
  - `timeline:unsubscribe { entityType, entityId }` →
    `{ left, room? }`
  - `timeline:event { tenantId, entityType, entityId, event }` (server
    → client fanout)
- No DB migration was required for Phase 7; the existing
  `timeline_events` table serves as the storage and the
  `ProjectAutomationStatus` response shape was extended non-breakingly
  with a full `tasks[]` list to drive the Kanban board.

## Required Signatures

| Reviewer | Required Decision | Signature | Date | Notes |
|----------|-------------------|-----------|------|-------|
| Architecture Owner | Approve timeline schema + transport strategy + tenant guard | PENDING | | |
| Backend Lead | Approve canonical read paths (timeline, evidence, retry) + cross-tenant rejection | PENDING | | |
| Security | Approve tenant-scoped timeline gateway + evidence endpoint tenant guard + path-traversal protection on storage | PENDING | | |
| QA Lead | Approve Phase 7 surfaces (transport fallback + keyboard navigation) | PENDING | | |
| Product Owner | Approve every P0 surface (initiation, automation, board, picker, execution, evidence, inbox) + at least the recovery guidance text per classification | PENDING | | |

## Codex Attestation

Codex records technical evidence only. Codex cannot sign as a human
reviewer or mark G7 formally closed without the listed reviewer
approvals.

## G7 Closure Decision

**Current decision:** TECHNICAL GREEN; HOLD only for human signatures.

Required before closing G7:

- Collect all five human signatures above.
- Run the existing `awl-g6-review-lifecycle` integration suite against
  the deployed PostgreSQL so the retry/cancel evidence path is
  exercised against a live DB (Phase 7 added retry-on-top of Phase 5's
  `RequestTaskExecutionCommand`; the underlying DB contract is
  unchanged).
- Confirm that the workspace project page (`/projects/[id]`)
  composes the Phase 7 surfaces on the deployment currently shipping
  to reconstruction tenants.
- Confirm that the
  `evidence_artifacts_immutable()` triggers (introduced in Phase 6)
  cover the Phase 7 evidence download / preview paths — they do,
  because the new endpoints are read-only.

## Next Phase

G7 closure unblocks Phase 8 (Security, Observability, and Operations)
and Phase 9 (Certification). The Strangler boundary
(`executionEngineVersion: 'canonical-v1'`) introduced in earlier
phases is unchanged.
