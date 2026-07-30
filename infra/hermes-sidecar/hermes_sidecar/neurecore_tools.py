"""Register the quarantined NeureCore toolset against the control-plane gateway."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from .auth import sign_token
from .models import ScopedTokenClaims

_ID = {
    "type": "string",
    "description": "A real NeureCore UUID or CUID returned by an nc.* read/create tool; never invent an ID.",
    "anyOf": [
        {"format": "uuid"},
        {"pattern": "^c[a-z0-9]{8,63}$"},
    ],
}

TOOL_SCHEMAS: dict[str, dict[str, Any]] = {
    "nc.plan_workflow": {"steps": {"type": "array", "minItems": 1, "items": {"type": "object", "properties": {"order": {"type": "integer", "minimum": 1}, "action": {"type": "string"}, "tool": {"type": "string"}, "rationale": {"type": "string"}}, "required": ["order", "action"], "additionalProperties": False}}},
    "nc.list_customers": {"query": {"type": "string"}, "limit": {"type": "integer", "default": 10}},
    "nc.create_customer": {"name": {"type": "string"}, "financialSubType": {"type": "string", "enum": ["BANKING", "INSURANCE", "WEALTH_MANAGEMENT", "INVESTMENT", "FINTECH", "ACCOUNTING_AUDIT"]}, "lifecycleStage": {"type": "string", "enum": ["PROSPECT", "KYC_VERIFIED", "ACTIVE", "DORMANT", "CLOSED"]}},
    "nc.create_project": {"name": {"type": "string"}, "customerId": _ID, "projectTypeId": _ID, "stageTemplate": {"type": "array", "minItems": 1, "items": {"type": "object", "properties": {"name": {"type": "string"}, "description": {"type": "string"}}, "required": ["name"], "additionalProperties": False}}},
    "nc.create_goal": {"projectId": _ID, "name": {"type": "string"}, "description": {"type": "string"}},
    "nc.create_task": {"projectId": _ID, "goalId": _ID, "title": {"type": "string"}, "dueDate": {"type": "string", "format": "date-time"}},
    "nc.assign_task": {"taskId": _ID, "agentProfileId": _ID},
    "nc.update_task_status": {"taskId": _ID, "status": {"type": "string", "enum": ["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]}, "evidence": {"type": "object"}},
    "nc.submit_for_approval": {"entityType": {"type": "string"}, "entityId": _ID, "payload": {"type": "object"}},
    "nc.send_notification": {"userId": _ID, "title": {"type": "string"}, "body": {"type": "string"}, "link": {"type": "string", "format": "uri-reference"}},
    "nc.search_memory": {"query": {"type": "string"}, "limit": {"type": "integer", "default": 10}},
}

_registered = False
_execution_tokens: dict[str, str] = {}


def _schema(name: str, properties: dict[str, Any]) -> dict[str, Any]:
    required = [key for key, value in properties.items() if "default" not in value and key != "evidence"]
    return {"name": name, "description": f"NeureCore scoped control-plane tool {name}", "parameters": {"type": "object", "properties": properties, "required": required, "additionalProperties": False}}


def _handler(name: str):
    def call(args: dict, **kwargs: Any) -> str:
        execution_id = str(kwargs.get("session_id") or "")
        token = _execution_tokens.get(execution_id)
        if not token:
            return json.dumps({"success": False, "error": {"code": "EXECUTION_SCOPE_MISSING", "message": "No scoped execution token", "retriable": False}})
        base = os.environ.get("HERMES_GATEWAY_URL", "http://127.0.0.1:3003").rstrip("/")
        tool = urllib.parse.quote(name, safe=".")
        request = urllib.request.Request(
            f"{base}/api/v1/hermes-adapter/executions/{urllib.parse.quote(execution_id)}/tools/{tool}",
            data=json.dumps({"arguments": args}).encode(),
            method="POST",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode())
                return json.dumps(payload.get("data", payload))
        except urllib.error.HTTPError as exc:
            return json.dumps({"success": False, "error": {"code": f"HTTP_{exc.code}", "message": exc.read().decode(errors="replace")[:2000], "retriable": exc.code >= 500}})
        except OSError as exc:
            return json.dumps({"success": False, "error": {"code": "GATEWAY_UNAVAILABLE", "message": str(exc), "retriable": True}})
    return call


def register_for_execution(claims: ScopedTokenClaims) -> None:
    global _registered
    secret = os.environ.get("HERMES_SIDECAR_SECRET", "")
    if not secret:
        raise RuntimeError("HERMES_SIDECAR_SECRET is required for gateway tools")
    _execution_tokens[claims.executionId] = sign_token(claims, secret)
    if _registered:
        return
    from tools.registry import registry
    for name, properties in TOOL_SCHEMAS.items():
        registry.register(name=name, toolset="neurecore", schema=_schema(name, properties), handler=_handler(name), description=f"Call {name} through the NeureCore scoped gateway", max_result_size_chars=50_000)
    _registered = True


def execute_approved_tool(
    claims: ScopedTokenClaims,
    tool_name: str,
    arguments: dict[str, Any],
    approval_id: str,
) -> dict[str, Any]:
    register_for_execution(claims)
    token = _execution_tokens[claims.executionId]
    base = os.environ.get("HERMES_GATEWAY_URL", "http://127.0.0.1:3003").rstrip("/")
    request = urllib.request.Request(
        f"{base}/api/v1/hermes-adapter/executions/{urllib.parse.quote(claims.executionId)}/tools/{urllib.parse.quote(tool_name, safe='.')}",
        data=json.dumps({"arguments": arguments, "approvedApprovalId": approval_id}).encode(),
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode())
        return payload.get("data", payload)


def resolve_model_lease(claims: ScopedTokenClaims) -> dict[str, Any]:
    register_for_execution(claims)
    token = _execution_tokens[claims.executionId]
    base = os.environ.get("HERMES_GATEWAY_URL", "http://127.0.0.1:3003").rstrip("/")
    request = urllib.request.Request(
        f"{base}/api/v1/hermes-adapter/executions/{urllib.parse.quote(claims.executionId, safe='')}/model-lease",
        method="GET",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return payload.get("data", payload)
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"model lease rejected ({error.code}): {detail}") from error
