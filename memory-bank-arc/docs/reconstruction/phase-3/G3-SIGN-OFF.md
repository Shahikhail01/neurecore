# G3 Sign-Off

**Date opened:** 2026-07-26
**Gate:** G3 — Transactional Outbox and Durable Automation
**Status:** TECHNICAL GREEN — formal reviewer sign-off pending

## Evidence Summary

- TypeScript `tsc --noEmit`: PASS
- Focused unit suite (OutboxWorker + ProjectAutomationHandler + Phase 2): 49 / 49 passed
- Phase 3 unit suite alone (`src/test/unit/outbox-worker.spec.ts`,
  `src/test/unit/project-automation.handler.spec.ts`): 9 / 9 passed
- Migration `20260726_awl_g3_durable_outbox_{enum,schema}` applied live on
  Contabo PostgreSQL via `postgres` role
- Deployed backend health: PASS, `GET https://brain.neurecore.com/api/v1/health`
  returned 200 with the worker registered
- Live verification `scripts/g3-live.sh` (`AWL_G3_RUN_ID=G3-live-FINAL`):
  - 20 / 20 materializations
  - Driver row PENDING → PROCESSING → PROCESSED with COMPLETED automation log
  - Poison row exhausted retries → DEAD_LETTER with dead-letter upsert
  - Stale PROCESSING row with expired lease → PENDING via recoverStale
  - Goal idempotency: 1 row after two upserts under composite key
- `/api/v1/awl-health` exposes backlog, processing, processed, deadLetter,
  workerId and the latest 10 dead-letter rows

## Required Signatures

| Reviewer | Required Decision | Signature | Date | Notes |
|----------|-------------------|-----------|------|-------|
| Architecture Owner | Approve durable outbox + worker topology | PENDING | | |
| Backend Lead | Approve schema migration + idempotency matrix | PENDING | | |
| Security | Approve tenant isolation across (PROJECT, CRON, LEASE) | PENDING | | |
| QA Lead | Approve dead-letter + restart + idempotency proof | PENDING | | |
| Product Owner | Approve automation status visibility + UX | PENDING | | |

## Codex Attestation

Codex records technical evidence only. Codex cannot sign as a human reviewer
or mark G3 formally closed without the listed reviewer approvals.

## G3 Closure Decision

**Current decision:** TECHNICAL GREEN; HOLD only for human signatures.

Required before closing G3:

- Collect all five human signatures above.
- Document the resolution path for the `EnterpriseEventTransport` overlap
  (Phase 4 cleanup) so the dead-letter rows pre-Phase 3 do not mask G3 failure
  counts in production dashboards.
