"""Pydantic models for the sidecar API.

Plan ref: NC-AWL-IMP-2 §1.2, §1.3
"""

from __future__ import annotations

import time
from typing import Any, Literal

from pydantic import BaseModel, Field

# ─── Status ───────────────────────────────────────────────────

ExecStatus = Literal[
    "PENDING",
    "RUNNING",
    "WAITING_APPROVAL",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
]

# ─── Tool registry ────────────────────────────────────────────

ToolResult = dict[str, Any]


# ─── Scoped token claims (HMAC-signed) ────────────────────────


class ScopedTokenClaims(BaseModel):
    """JWT-ish claims signed by the gateway; verified by the sidecar.

    The sidecar NEVER calls the DB. The token is the only source of truth
    for tenantId, allowedTools, and approval threshold.
    """

    sub: str
    tenantId: str
    executionId: str
    workspacePath: str
    allowedTools: list[str]
    approvalThreshold: Literal["NONE", "STANDARD", "HIGH"] = "STANDARD"
    exp: int
    scope: Literal["hermes:execute"] = "hermes:execute"


# ─── Request / response models ────────────────────────────────


class StartExecutionRequest(BaseModel):
    executionId: str = Field(..., min_length=1, max_length=128)
    tenantId: str = Field(..., min_length=1, max_length=64)
    projectId: str | None = None
    workspaceSpec: dict[str, Any] = Field(default_factory=dict)
    allowedTools: list[str] = Field(default_factory=list)
    initialMessage: str = Field("", max_length=16_000)


class StartExecutionResponse(BaseModel):
    executionId: str
    status: ExecStatus
    startedAt: int


class ApprovalRequest(BaseModel):
    approvalId: str
    toolName: str
    toolInput: dict[str, Any]
    requestedAt: int
    reason: str = ""


class SubmitApprovalRequest(BaseModel):
    decision: Literal["approve", "reject"]
    reason: str = ""


class ExecutionState(BaseModel):
    """Full state of one execution — what gets persisted to state.json."""

    executionId: str
    tenantId: str
    userId: str
    projectId: str | None
    workspacePath: str
    status: ExecStatus
    startedAt: int
    updatedAt: int
    allowedTools: list[str]
    approvalThreshold: Literal["NONE", "STANDARD", "HIGH"]
    messages: list[dict[str, Any]] = Field(default_factory=list)
    events: list[dict[str, Any]] = Field(default_factory=list)
    pendingApproval: ApprovalRequest | None = None
    completedAt: int | None = None
    failureReason: str | None = None


class GetExecutionStatusResponse(BaseModel):
    executionId: str
    status: ExecStatus
    startedAt: int
    updatedAt: int
    events: list[dict[str, Any]]
    pendingApproval: ApprovalRequest | None = None
    completedAt: int | None = None
    failureReason: str | None = None


class ErrorResponse(BaseModel):
    error: str
    code: str
    retriable: bool = False


# ─── Helper ───────────────────────────────────────────────────


def now_ms() -> int:
    return int(time.time() * 1000)
