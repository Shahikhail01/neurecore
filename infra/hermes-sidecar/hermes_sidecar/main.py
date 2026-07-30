"""FastAPI app for the Hermes execution sidecar.

Phase 1.1 endpoints (5):
    POST /v1/executions              → startExecution
    POST /v1/executions/{id}/resume  → resumeExecution (after approval)
    POST /v1/executions/{id}/cancel  → cancelExecution
    GET  /v1/executions/{id}         → getExecutionStatus
    POST /v1/executions/{id}/approvals/{approvalId} → submitApprovalDecision

Plus:
    GET /healthz                     → liveness
    GET /readyz                      → readiness

All endpoints require Authorization: Bearer <scoped token>.

Plan ref: NC-AWL-IMP-2 §1.2, §1.3
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .auth import TokenError, verify_token
from .events import EventBus
from .lifecycle import (
    ExecutionManager,
    ExecutionNotFound,
    InvalidStateTransition,
)
from .models import (
    ErrorResponse,
    GetExecutionStatusResponse,
    ScopedTokenClaims,
    StartExecutionRequest,
    StartExecutionResponse,
    SubmitApprovalRequest,
)


SECRET = os.environ.get("HERMES_SIDECAR_SECRET", "dev-secret-do-not-use-in-prod")
STATE_DIR = os.environ.get("HERMES_SIDECAR_STATE_DIR", "./.state")
WEBHOOK_URL = os.environ.get("HERMES_SIDECAR_EVENT_WEBHOOK", "")
USE_REAL_AIAGENT = os.environ.get("HERMES_USE_REAL_AIAGENT", "false").lower() == "true"
WEBHOOK_TOLERANCE_SECONDS = int(
    os.environ.get("HERMES_SIDECAR_WEBHOOK_TOLERANCE_SECONDS", "300")
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    event_bus = EventBus(
        webhook_url=WEBHOOK_URL,
        secret=SECRET,
        tolerance_seconds=WEBHOOK_TOLERANCE_SECONDS,
    )
    manager = ExecutionManager(
        state_dir=STATE_DIR,
        event_bus=event_bus,
        use_real_aiagent=USE_REAL_AIAGENT,
    )
    app.state.event_bus = event_bus
    app.state.manager = manager
    yield


app = FastAPI(
    title="NeureCore Hermes Sidecar",
    version="0.1.0",
    lifespan=lifespan,
)


_security = HTTPBearer(auto_error=False)


def get_claims(
    creds: HTTPAuthorizationCredentials | None = Depends(_security),
) -> ScopedTokenClaims:
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=401,
            detail=ErrorResponse(
                error="missing_bearer_token", code="unauthorized", retriable=False
            ).model_dump(),
        )
    try:
        return verify_token(creds.credentials, SECRET)
    except TokenError as exc:
        raise HTTPException(
            status_code=401,
            detail=ErrorResponse(
                error=exc.message, code=exc.code, retriable=False
            ).model_dump(),
        )


def _execution_id_matches(claims: ScopedTokenClaims, execution_id: str) -> None:
    if claims.executionId != execution_id:
        raise HTTPException(
            status_code=403,
            detail=ErrorResponse(
                error="execution_id_mismatch",
                code="forbidden",
                retriable=False,
            ).model_dump(),
        )


# ─── Endpoints ────────────────────────────────────────────────


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {"status": "ok"}


@app.get("/readyz")
async def readyz() -> dict[str, Any]:
    return {"status": "ready"}


@app.post(
    "/v1/executions",
    response_model=StartExecutionResponse,
    status_code=201,
)
async def start_execution(
    body: StartExecutionRequest,
    claims: ScopedTokenClaims = Depends(get_claims),
) -> StartExecutionResponse:
    manager: ExecutionManager = app.state.manager
    _execution_id_matches(claims, body.executionId)
    if body.tenantId != claims.tenantId:
        raise HTTPException(
            status_code=403,
            detail=ErrorResponse(
                error="tenant_id_mismatch",
                code="forbidden",
                retriable=False,
            ).model_dump(),
        )
    try:
        state = manager.start(claims, body.initialMessage, body.projectId)
    except InvalidStateTransition as exc:
        raise HTTPException(
            status_code=409,
            detail=ErrorResponse(
                error=str(exc), code="invalid_state", retriable=False
            ).model_dump(),
        )
    return StartExecutionResponse(
        executionId=state.executionId,
        status=state.status,
        startedAt=state.startedAt,
    )


@app.get(
    "/v1/executions/{execution_id}",
    response_model=GetExecutionStatusResponse,
)
async def get_status(
    execution_id: str,
    claims: ScopedTokenClaims = Depends(get_claims),
) -> GetExecutionStatusResponse:
    manager: ExecutionManager = app.state.manager
    _execution_id_matches(claims, execution_id)
    try:
        state = manager.get_status(claims)
    except ExecutionNotFound as exc:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error=str(exc), code="not_found", retriable=False
            ).model_dump(),
        )
    return GetExecutionStatusResponse(
        executionId=state.executionId,
        status=state.status,
        startedAt=state.startedAt,
        updatedAt=state.updatedAt,
        events=state.events,
        pendingApproval=state.pendingApproval,
        completedAt=state.completedAt,
        failureReason=state.failureReason,
    )


@app.post("/v1/executions/{execution_id}/approvals/{approval_id}")
async def submit_approval(
    execution_id: str,
    approval_id: str,
    body: SubmitApprovalRequest,
    claims: ScopedTokenClaims = Depends(get_claims),
) -> GetExecutionStatusResponse:
    manager: ExecutionManager = app.state.manager
    _execution_id_matches(claims, execution_id)
    try:
        state = manager.resume(
            claims, approval_id, body.decision, body.reason
        )
    except ExecutionNotFound as exc:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error=str(exc), code="not_found", retriable=False
            ).model_dump(),
        )
    except InvalidStateTransition as exc:
        raise HTTPException(
            status_code=409,
            detail=ErrorResponse(
                error=str(exc), code="invalid_state", retriable=False
            ).model_dump(),
        )
    return GetExecutionStatusResponse(
        executionId=state.executionId,
        status=state.status,
        startedAt=state.startedAt,
        updatedAt=state.updatedAt,
        events=state.events,
        pendingApproval=state.pendingApproval,
        completedAt=state.completedAt,
        failureReason=state.failureReason,
    )


@app.post("/v1/executions/{execution_id}/cancel")
async def cancel(
    execution_id: str,
    claims: ScopedTokenClaims = Depends(get_claims),
) -> GetExecutionStatusResponse:
    manager: ExecutionManager = app.state.manager
    _execution_id_matches(claims, execution_id)
    try:
        state = manager.cancel(claims)
    except ExecutionNotFound as exc:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error=str(exc), code="not_found", retriable=False
            ).model_dump(),
        )
    return GetExecutionStatusResponse(
        executionId=state.executionId,
        status=state.status,
        startedAt=state.startedAt,
        updatedAt=state.updatedAt,
        events=state.events,
        pendingApproval=state.pendingApproval,
        completedAt=state.completedAt,
        failureReason=state.failureReason,
    )


@app.post("/v1/executions/{execution_id}/resume")
async def resume(
    execution_id: str,
    claims: ScopedTokenClaims = Depends(get_claims),
) -> GetExecutionStatusResponse:
    """Resume a paused execution. For Phase 1.1, this is a no-op wrapper
    that returns the current status (resume after approval uses the
    /approvals/{approvalId} endpoint above)."""
    manager: ExecutionManager = app.state.manager
    _execution_id_matches(claims, execution_id)
    try:
        state = manager.get_status(claims)
    except ExecutionNotFound as exc:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error=str(exc), code="not_found", retriable=False
            ).model_dump(),
        )
    return GetExecutionStatusResponse(
        executionId=state.executionId,
        status=state.status,
        startedAt=state.startedAt,
        updatedAt=state.updatedAt,
        events=state.events,
        pendingApproval=state.pendingApproval,
        completedAt=state.completedAt,
        failureReason=state.failureReason,
    )


def run() -> None:
    """Entry point for `hermes-sidecar` script."""
    import uvicorn

    port = int(os.environ.get("HERMES_SIDECAR_PORT", "8080"))
    uvicorn.run(
        "hermes_sidecar.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
        workers=1,
    )


if __name__ == "__main__":
    run()
