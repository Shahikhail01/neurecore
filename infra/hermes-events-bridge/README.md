# hermes-events-bridge

NeureCore Hermes events webhook receiver — Phase 1.4.

**Plan ref:** NC-AWL-IMP-2 §1.4

Receives signed events from the upstream Hermes execution sidecar and
captures them. This is the integration-tested receive path; the NestJS
`hermes-sidecar-events.controller.ts` is the production counterpart.

## What's in Phase 1.4

- FastAPI app with 4 endpoints:
  - `POST /webhook` — receive signed event from sidecar
  - `GET /events` — list recent events (testing)
  - `GET /events/{executionId}` — list events for one execution
  - `GET /healthz` — liveness
- HMAC-SHA256 signature verification (timestamp + body)
- Sliding SQLite store for events (Phase 1.4 deliverable; production
  writes to NeureCore's `HermesAuditLog` table)
- Python port of the NestJS `events-ingest.service.ts` logic
- Integration tests that drive the sidecar's webhook emission

## What's NOT in Phase 1.4

- Socket.IO broadcast to the React frontend (depends on chat UI work)
- Wired into NeureCore's chat path (Phase 1.4 follow-up)
- Webhook signature differences between FastAPI's body parsing and
  Express's body parser (the NestJS side is reviewed by inspection
  but not execution-tested in this environment)

## Running

```bash
cd neurecore/infra/hermes-events-bridge
python3 -m venv venv && source venv/bin/activate
pip install -e ".[dev]"
python3 -m pytest tests/ -v
```

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `HERMES_SIDECAR_SECRET` | `dev-secret-do-not-use-in-prod` | HMAC signing key (shared with sidecar) |
| `HERMES_EVENTS_BRIDGE_DB` | `./hermes_events.db` | SQLite event store path |
| `HERMES_EVENTS_BRIDGE_PORT` | `8082` | uvicorn port |
| `HERMES_SIDECAR_WEBHOOK_TOLERANCE_SECONDS` | `300` | Replay protection window |
