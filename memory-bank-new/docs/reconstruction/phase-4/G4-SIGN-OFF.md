# G4 Sign-Off

**Date opened:** 2026-07-27
**Gate:** G4 — Task-to-AI Assignment
**Status:** TECHNICAL GREEN — formal reviewer sign-off pending

## Evidence Summary

- TypeScript `tsc --noEmit`: PASS
- Phase 4 unit suite (`assignment-scoring` 14 + `assignment.service` 9
  = 23 tests): PASS
- All 72 tests across 10 suites (including the Phase 2 + Phase 3
  baseline): PASS
- Migration `20260726_awl_g4_assignment_foundation`,
  `20260726_awl_g4_assignment_lifecycle`, `20260726_awl_g4_task_version`
  applied live on Contabo PostgreSQL via `postgres` role
- Deployed backend health: `GET https://brain.neurecore.com/api/v1/health`
  returns 200 with the worker registered and AssignTaskCommand +
  ReleaseAssignmentCommand registered in CommandRegistry
- Live verification `scripts/g4-live.sh` (`AWL_G4_RUN_ID=G4-live-FINAL`):
  - 1 auto-assignment (generation=1, ACTIVE, STAFF agent, task QUEUED)
  - 1 manual-override audit + generation=2 (SENIOR agent) + generation=1 RELEASED
  - 1 reassignment (generation=3, THIRD agent)
  - Cross-tenant insertion rejected (FK constraint holds)
  - Expired sweep flips ACTIVE → EXPIRED
  - All assertions: PASS

## Required Signatures

| Reviewer | Required Decision | Signature | Date | Notes |
|----------|-------------------|-----------|------|-------|
| Architecture Owner | Approve scoring policy version + tie-break order | PENDING | | |
| Backend Lead | Approve transactional command + override audit | PENDING | | |
| Security | Approve tenant isolation across override + reassign paths | PENDING | | |
| QA Lead | Approve optimistic concurrency + sweep behavior | PENDING | | |
| Product Owner | Approve rationale visibility + AgentPicker UX | PENDING | | |

## Codex Attestation

Codex records technical evidence only. Codex cannot sign as a human
reviewer or mark G4 formally closed without the listed reviewer
approvals.

## G4 Closure Decision

**Current decision:** TECHNICAL GREEN; HOLD only for human signatures.

Required before closing G4:

- Collect all five human signatures above.
- Confirm the `dataClassificationAtOverride` hot-fix is reconciled
  via the migration update for future greenfield installs (already
  captured in `20260726_awl_g4_task_version`).
- Acknowledge that the deployed `TaskStatus` enum still uses the legacy
  shape (`PENDING` / `QUEUED`); the new schema values (`READY` /
  `ASSIGNED`) come online with the next greenfield deploy.