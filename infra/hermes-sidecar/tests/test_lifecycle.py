"""Phase 1 exit gate tests.

These 5 tests drive the binary pass/fail at:
    infra/sidecar/PHASE1-EXIT-GATE.md

Plan ref: NC-AWL-IMP-2 §1.4
"""

from __future__ import annotations

import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import json
from pathlib import Path

import pytest

from hermes_sidecar.auth import mint_test_token, sign_token
from hermes_sidecar.models import ScopedTokenClaims


SECRET = "test-secret-phase1"


@pytest.fixture
def state_dir():
    d = tempfile.mkdtemp(prefix="hermes-state-")
    yield d
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture
def client(state_dir):
    root = Path(__file__).resolve().parent.parent
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "hermes_sidecar.main:app",
         "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"],
        cwd=root,
        env={**os.environ, "HERMES_SIDECAR_SECRET": SECRET,
             "HERMES_SIDECAR_STATE_DIR": state_dir,
             "HERMES_SIDECAR_EVENT_WEBHOOK": "", "PYTHONPATH": str(root)},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz", timeout=1):
                break
        except OSError:
            time.sleep(0.1)
    else:
        proc.kill()
        raise RuntimeError("sidecar did not become healthy")
    try:
        yield HttpClient(f"http://127.0.0.1:{port}")
    finally:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)


class HttpResponse:
    def __init__(self, status_code: int, body: bytes):
        self.status_code = status_code
        self.text = body.decode("utf-8", errors="replace")

    def json(self):
        return json.loads(self.text)


class HttpClient:
    def __init__(self, base_url: str):
        self.base_url = base_url

    def request(self, method: str, path: str, *, headers=None, json=None):
        data = None if json is None else __import__("json").dumps(json).encode()
        request = urllib.request.Request(
            self.base_url + path, data=data, method=method,
            headers={"Content-Type": "application/json", **(headers or {})},
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return HttpResponse(response.status, response.read())
        except urllib.error.HTTPError as error:
            return HttpResponse(error.code, error.read())

    def get(self, path: str, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs):
        return self.request("POST", path, **kwargs)


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ─── Step 1: startExecution ─────────────────────────────────


def test_step_1_start_execution_simple(client):
    """startExecution returns 201 with executionId + status."""
    token = mint_test_token(
        SECRET,
        tenantId="t1",
        executionId="phase1-step1",
        allowedTools=["stub.echo"],
    )
    r = client.post(
        "/v1/executions",
        headers=_bearer(token),
        json={
            "executionId": "phase1-step1",
            "tenantId": "t1",
            "initialMessage": "hello",
            "allowedTools": ["stub.echo"],
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["executionId"] == "phase1-step1"
    assert body["status"] in ("RUNNING", "COMPLETED", "WAITING_APPROVAL", "FAILED")


# ─── Step 2: stub tool call (no approval) ───────────────────


def test_step_2_stub_echo_no_approval(client):
    """An echo tool call completes the execution with status=COMPLETED."""
    token = mint_test_token(
        SECRET,
        tenantId="t1",
        executionId="phase1-step2",
        allowedTools=["stub.echo"],
    )
    r = client.post(
        "/v1/executions",
        headers=_bearer(token),
        json={
            "executionId": "phase1-step2",
            "tenantId": "t1",
            "initialMessage": "echo this",
            "allowedTools": ["stub.echo"],
        },
    )
    assert r.status_code == 201

    r2 = client.get(
        "/v1/executions/phase1-step2",
        headers=_bearer(token),
    )
    assert r2.status_code == 200
    state = r2.json()
    assert state["status"] == "COMPLETED"
    # The lifecycle emits events: execution.started, tool.call, tool.completed, execution.completed
    event_types = [e["type"] for e in state["events"]]
    assert "execution.started" in event_types
    assert "tool.call" in event_types
    assert "tool.completed" in event_types
    assert "execution.completed" in event_types


# ─── Step 3: approval-required tool parks execution ─────────


def test_step_3_approval_required_parks_execution(client):
    """When a tool requires approval, the execution enters WAITING_APPROVAL."""
    token = mint_test_token(
        SECRET,
        tenantId="t1",
        executionId="phase1-step3",
        allowedTools=["stub.approval_required"],
    )
    r = client.post(
        "/v1/executions",
        headers=_bearer(token),
        json={
            "executionId": "phase1-step3",
            "tenantId": "t1",
            "initialMessage": "please run an approval-required action",
            "allowedTools": ["stub.approval_required"],
        },
    )
    assert r.status_code == 201

    r2 = client.get(
        "/v1/executions/phase1-step3",
        headers=_bearer(token),
    )
    state = r2.json()
    assert state["status"] == "WAITING_APPROVAL"
    assert state["pendingApproval"] is not None
    assert state["pendingApproval"]["toolName"] == "stub.approval_required"


# ─── Step 4: SIGKILL recovery via state.json ────────────────


def test_step_4_sigkill_recovery(state_dir, monkeypatch):
    """After SIGKILL, a new ExecutionManager reloading from disk must
    recover the WAITING_APPROVAL state."""
    import os
    os.environ["HERMES_SIDECAR_SECRET"] = SECRET
    os.environ["HERMES_SIDECAR_STATE_DIR"] = state_dir

    from hermes_sidecar.events import EventBus
    from hermes_sidecar.lifecycle import ExecutionManager

    bus = EventBus()
    mgr1 = ExecutionManager(state_dir=state_dir, event_bus=bus)

    token = mint_test_token(
        SECRET,
        tenantId="t1",
        executionId="phase1-step4",
        allowedTools=["stub.approval_required"],
    )
    claims = ScopedTokenClaims(
        sub="tester",
        tenantId="t1",
        executionId="phase1-step4",
        workspacePath="/dev/null",
        allowedTools=["stub.approval_required"],
        approvalThreshold="STANDARD",
        exp=token_metadata_exp(token),
    )
    state = mgr1.start(claims, "needs approval")
    assert state.status == "WAITING_APPROVAL"

    # Simulate SIGKILL: drop the in-memory process, keep state.json
    del mgr1
    del bus

    # Cold start: a new manager loads from disk
    bus2 = EventBus()
    mgr2 = ExecutionManager(state_dir=state_dir, event_bus=bus2)
    recovered = mgr2.get_status(claims)
    assert recovered.status == "WAITING_APPROVAL"
    assert recovered.pendingApproval is not None
    assert recovered.pendingApproval.toolName == "stub.approval_required"


def token_metadata_exp(token: str) -> int:
    """Helper: parse the exp claim off a token for fixture setup."""
    import base64
    import json

    payload_b64 = token.split(".", 1)[0]
    pad = "=" * (-len(payload_b64) % 4)
    payload = json.loads(base64.urlsafe_b64decode(payload_b64 + pad).decode("utf-8"))
    return int(payload["exp"])


# ─── Step 5: approval resume completes execution ───────────


def test_step_5_approval_resume_completes(client):
    """Approve the parked execution; it should resume and complete."""
    token = mint_test_token(
        SECRET,
        tenantId="t1",
        executionId="phase1-step5",
        allowedTools=["stub.approval_required"],
    )
    r = client.post(
        "/v1/executions",
        headers=_bearer(token),
        json={
            "executionId": "phase1-step5",
            "tenantId": "t1",
            "initialMessage": "approval please",
            "allowedTools": ["stub.approval_required"],
        },
    )
    assert r.status_code == 201

    # Must be parked
    r2 = client.get("/v1/executions/phase1-step5", headers=_bearer(token))
    state = r2.json()
    assert state["status"] == "WAITING_APPROVAL"
    approval_id = state["pendingApproval"]["approvalId"]

    # Submit approval
    r3 = client.post(
        f"/v1/executions/phase1-step5/approvals/{approval_id}",
        headers=_bearer(token),
        json={"decision": "approve", "reason": "phase1-gate"},
    )
    assert r3.status_code == 200, r3.text
    state_after = r3.json()
    assert state_after["status"] == "COMPLETED"
    assert state_after["completedAt"] is not None

    # Audit trail: approval.requested + approval.granted + execution.completed
    types = [e["type"] for e in state_after["events"]]
    assert "approval.requested" in types
    assert "approval.granted" in types
    assert "execution.completed" in types


# ─── Auth: bad token rejected ───────────────────────────────


def test_auth_missing_token_rejected(client):
    r = client.post(
        "/v1/executions",
        json={
            "executionId": "phase1-noauth",
            "tenantId": "t1",
            "initialMessage": "x",
            "allowedTools": [],
        },
    )
    assert r.status_code == 401


def test_auth_bad_signature_rejected(client):
    # Token signed with a different secret
    bad_token = mint_test_token(
        "wrong-secret",
        tenantId="t1",
        executionId="phase1-badsig",
        allowedTools=[],
    )
    r = client.post(
        "/v1/executions",
        headers=_bearer(bad_token),
        json={
            "executionId": "phase1-badsig",
            "tenantId": "t1",
            "initialMessage": "x",
            "allowedTools": [],
        },
    )
    assert r.status_code == 401


def test_auth_execution_id_mismatch_rejected(client):
    token = mint_test_token(
        SECRET,
        tenantId="t1",
        executionId="phase1-token-a",
        allowedTools=["stub.echo"],
    )
    # Try to use a different executionId in the body
    r = client.post(
        "/v1/executions",
        headers=_bearer(token),
        json={
            "executionId": "phase1-token-b",
            "tenantId": "t1",
            "initialMessage": "x",
            "allowedTools": ["stub.echo"],
        },
    )
    assert r.status_code == 403


def test_auth_tenant_id_mismatch_rejected(client):
    token = mint_test_token(
        SECRET,
        tenantId="t1",
        executionId="phase1-tenant",
        allowedTools=["stub.echo"],
    )
    r = client.post(
        "/v1/executions",
        headers=_bearer(token),
        json={
            "executionId": "phase1-tenant",
            "tenantId": "t2",
            "initialMessage": "x",
            "allowedTools": ["stub.echo"],
        },
    )
    assert r.status_code == 403


def test_persisted_execution_is_not_visible_to_another_tenant(client):
    owner = mint_test_token(
        SECRET, tenantId="tenant-a", executionId="tenant-owned",
        allowedTools=["stub.echo"],
    )
    created = client.post(
        "/v1/executions", headers=_bearer(owner),
        json={"executionId": "tenant-owned", "tenantId": "tenant-a",
              "projectId": "project-a", "initialMessage": "hello",
              "allowedTools": ["stub.echo"]},
    )
    assert created.status_code == 201

    attacker = mint_test_token(
        SECRET, tenantId="tenant-b", executionId="tenant-owned",
        allowedTools=["stub.echo"],
    )
    denied = client.get(
        "/v1/executions/tenant-owned", headers=_bearer(attacker),
    )
    assert denied.status_code == 404


def test_project_id_survives_restart(state_dir):
    from hermes_sidecar.events import EventBus
    from hermes_sidecar.lifecycle import ExecutionManager

    token = mint_test_token(
        SECRET, tenantId="t1", executionId="project-recovery",
        allowedTools=["stub.echo"],
    )
    claims = ScopedTokenClaims.model_validate(
        __import__("json").loads(
            __import__("base64").urlsafe_b64decode(
                token.split(".", 1)[0] + "=" * (-len(token.split(".", 1)[0]) % 4)
            )
        )
    )
    ExecutionManager(state_dir, EventBus()).start(claims, "hello", "project-a")
    recovered = ExecutionManager(state_dir, EventBus()).get_status(claims)
    assert recovered.projectId == "project-a"


def test_deferred_tool_result_interrupts_upstream_loop(state_dir):
    from hermes_sidecar.events import EventBus
    from hermes_sidecar.lifecycle import ExecutionManager

    claims = ScopedTokenClaims(
        sub="user-1",
        tenantId="t1",
        executionId="approval-interrupt",
        workspacePath="/workspace",
        allowedTools=["stub.echo"],
        approvalThreshold="STANDARD",
        exp=2_000_000_000,
        scope="hermes:execute",
    )
    manager = ExecutionManager(state_dir, EventBus())
    state = manager.start(claims, "hello", None)

    class Agent:
        interrupted = 0

        def interrupt(self):
            self.interrupted += 1

    agent = Agent()
    manager._on_tool_complete(
        state,
        (
            "call-1",
            "nc.create_customer",
            {"name": "Acme"},
            json.dumps({"success": True, "deferred": True, "approvalId": "approval-1"}),
        ),
        agent,
    )

    assert state.status == "WAITING_APPROVAL"
    assert state.pendingApproval.approvalId == "approval-1"
    assert agent.interrupted == 1
