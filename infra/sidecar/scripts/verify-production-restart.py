#!/usr/bin/env python3
"""Prove live systemd restart recovery for the Phase 1 sidecar."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

ENV_FILE = Path("/opt/neurecore/backend/backend/.env")
BASE_URL = "http://127.0.0.1:8080"


def env_value(key: str) -> str:
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError(f"{key} is missing from {ENV_FILE}")


def mint_token(secret: str, execution_id: str) -> str:
    claims = {
        "sub": "production-restart-verifier",
        "tenantId": "phase1-operations",
        "executionId": execution_id,
        "workspacePath": f"/var/lib/neurecore/hermes/state/{execution_id}",
        "allowedTools": ["stub.approval_required"],
        "approvalThreshold": "STANDARD",
        "exp": int(time.time()) + 900,
        "scope": "hermes:execute",
    }
    payload = base64.urlsafe_b64encode(
        json.dumps(claims, separators=(",", ":")).encode()
    ).rstrip(b"=").decode()
    signature = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"{payload}.{signature}"


def request(method: str, path: str, token: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"{method} {path} returned {exc.code}: {exc.read().decode()}") from exc


def wait_until_healthy(timeout: float = 20) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"{BASE_URL}/healthz", timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            pass
        time.sleep(0.5)
    raise RuntimeError("sidecar did not become healthy after SIGKILL")


def main() -> None:
    if os.geteuid() != 0:
        raise RuntimeError("run as root so systemd can SIGKILL the service")

    secret = env_value("HERMES_SIDECAR_SECRET")
    if secret == "dev-secret-do-not-use-in-prod":
        raise RuntimeError("development sidecar secret is forbidden")

    execution_id = f"restart-verify-{int(time.time())}"
    token = mint_token(secret, execution_id)
    request("POST", "/v1/executions", token, {
        "executionId": execution_id,
        "tenantId": "phase1-operations",
        "initialMessage": "approval required for restart verification",
        "allowedTools": ["stub.approval_required"],
    })
    before = request("GET", f"/v1/executions/{execution_id}", token)
    assert before["status"] == "WAITING_APPROVAL"
    approval_id = before["pendingApproval"]["approvalId"]

    subprocess.run(
        ["systemctl", "kill", "--kill-whom=main", "--signal=SIGKILL", "hermes-sidecar.service"],
        check=True,
    )
    wait_until_healthy()

    recovered = request("GET", f"/v1/executions/{execution_id}", token)
    assert recovered["status"] == "WAITING_APPROVAL"
    assert recovered["pendingApproval"]["approvalId"] == approval_id

    completed = request(
        "POST",
        f"/v1/executions/{execution_id}/approvals/{approval_id}",
        token,
        {"decision": "approve", "reason": "production restart gate"},
    )
    assert completed["status"] == "COMPLETED"
    event_types = {event["type"] for event in completed["events"]}
    required = {"approval.requested", "approval.granted", "execution.completed"}
    assert required <= event_types
    print(f"PASS: {execution_id} recovered after SIGKILL and completed with {len(completed['events'])} events")


if __name__ == "__main__":
    main()
