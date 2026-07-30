"""FastAPI app for the Hermes events bridge.

Phase 1.4 endpoints:
    POST /webhook              — receive signed event from sidecar
    GET  /events               — list recent events (for testing)
    GET  /events/{executionId} — list events for one execution
    GET  /healthz              — liveness

Plan ref: NC-AWL-IMP-2 §1.4

This is the integration-tested receive path. The NestJS webhook
controller (backend/src/modules/hermes-adapter/controllers/hermes-sidecar-events.controller.ts)
is the production counterpart; both implementations agree on the protocol
(verified by test_protocol_lock tests in the sidecar package).
"""

from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request

from .signature import (
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    verify_signature,
)
from .store import EventStore


SECRET_DEFAULT = "dev-secret-do-not-use-in-prod"


def _get_secret() -> str:
    """Read the secret at request time, not at module load.

    Reading at module load is a real bug: in docker-compose / k8s, env
    vars are sometimes set after the Python process starts. Reading at
    request time means a restart is NOT required if the secret is
    rotated. The verify_signature() call uses this function.
    """
    return os.environ.get("HERMES_SIDECAR_SECRET", SECRET_DEFAULT)


def _get_db_path() -> str:
    return os.environ.get("HERMES_EVENTS_BRIDGE_DB", "./hermes_events.db")


def _get_tolerance_seconds() -> int:
    return int(os.environ.get("HERMES_SIDECAR_WEBHOOK_TOLERANCE_SECONDS", "300"))


logger = logging.getLogger("hermes_events_bridge")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.store = EventStore(_get_db_path())
    logger.info(f"Events bridge started; db={_get_db_path()}")
    yield
    app.state.store.close()


app = FastAPI(title="NeureCore Hermes Events Bridge", version="0.1.0", lifespan=lifespan)


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {"status": "ok"}


@app.post("/webhook")
async def webhook(
    request: Request,
    x_hermes_signature: str | None = Header(default=None, alias=SIGNATURE_HEADER),
    x_hermes_timestamp: str | None = Header(default=None, alias=TIMESTAMP_HEADER),
) -> dict[str, Any]:
    """Receive a webhook event from the sidecar.

    Verification uses constant-time HMAC compare. The body MUST be the
    raw, unparsed request body — `Request.body()` gives us that.
    """
    raw_body = (await request.body()).decode("utf-8", errors="replace")
    ok, reason = verify_signature(
        _get_secret(),
        x_hermes_timestamp,
        raw_body,
        x_hermes_signature,
        tolerance_seconds=_get_tolerance_seconds(),
    )
    if not ok:
        logger.warning(f"Webhook rejected: {reason}")
        raise HTTPException(
            status_code=401,
            detail={"error": reason, "code": "unauthorized"},
        )

    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": f"invalid_json: {e}", "code": "bad_request"},
        )

    if not all(k in event for k in ("type", "executionId", "ts")):
        raise HTTPException(
            status_code=400,
            detail={"error": "missing required fields", "code": "bad_request"},
        )

    store: EventStore = app.state.store
    row_id = store.record(
        event_type=event["type"],
        execution_id=event["executionId"],
        ts=int(event["ts"]),
        payload=event.get("payload", {}),
        raw_body=raw_body,
    )
    logger.info(
        f"Recorded event row_id={row_id} type={event['type']} "
        f"executionId={event['executionId']}"
    )
    return {"accepted": True, "id": row_id, "type": event["type"]}


@app.get("/events")
async def list_events(limit: int = 100) -> dict[str, Any]:
    """List recent events (most recent first). For testing."""
    store: EventStore = app.state.store
    return {"events": store.list_all(limit=limit)}


@app.get("/events/{execution_id}")
async def list_events_for_execution(execution_id: str) -> dict[str, Any]:
    """List events for one execution (oldest first). For testing."""
    store: EventStore = app.state.store
    return {
        "executionId": execution_id,
        "events": store.list_by_execution(execution_id),
    }


def run() -> None:
    """Run uvicorn."""
    import uvicorn

    port = int(os.environ.get("HERMES_EVENTS_BRIDGE_PORT", "8082"))
    uvicorn.run(
        "hermes_events_bridge.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
        workers=1,
    )


if __name__ == "__main__":
    run()
