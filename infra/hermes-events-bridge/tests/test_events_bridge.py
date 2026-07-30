"""Phase 1.4 events-bridge integration tests.

This is the load-bearing test for Phase 1.4: it spawns the REAL sidecar
subprocess, configures it to send events to the events-bridge, runs
executions, and verifies the events arrive intact.

Plan ref: NC-AWL-IMP-2 §1.4

What this test proves:
- The sidecar's webhook emission format matches the events-bridge's
  receiver format (HMAC signature, headers, body)
- The events-bridge's signature verification accepts the sidecar's
  signatures
- Events are captured to the SQL store with correct fields
- The full audit trail is preserved (execution.started, tool.start,
  tool.complete, execution.completed — all in correct order)

What this test does NOT prove:
- The NestJS webhook controller (no node_modules in this env)
- The Socket.IO broadcast to the React frontend
- The actual write to NeureCore's Postgres HermesAuditLog table
"""

from __future__ import annotations

import hashlib
import hmac
import json
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
from pathlib import Path

import pytest


SECRET = "phase1-4-integration-test-secret"


# ─── Shared helpers ────────────────────────────────────


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_for_health(port: int, timeout_s: float = 15.0) -> None:
    deadline = time.time() + timeout_s
    last_err = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz", timeout=1) as r:
                if r.status == 200:
                    return
        except (urllib.error.URLError, ConnectionError, OSError) as e:
            last_err = e
            time.sleep(0.2)
    raise RuntimeError(f"Service did not become healthy on port {port}: {last_err}")


# ─── Signature tests (port-locked with NestJS) ─────────


def test_signature_matches_nestjs_format():
    """Verify the bridge's signature uses the same format as the NestJS
    events-ingest.service.ts. Both must produce identical hex digests."""
    from hermes_events_bridge.signature import compute_signature

    body = '{"type":"tool.start","executionId":"e1","ts":1234567890,"payload":{}}'
    ts = 1234567890
    secret = SECRET

    # Python
    py_sig = compute_signature(secret, ts, body)

    # Recompute using Node's algorithm directly (for the assertion)
    # Node: crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
    # Which is byte-for-byte hmac.new(secret.encode(), f"{ts}.{body}".encode(), sha256).hexdigest()
    node_sig = hmac.new(
        secret.encode("utf-8"),
        f"{ts}.{body}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    assert py_sig == node_sig


def test_verify_signature_rejects_missing_header():
    from hermes_events_bridge.signature import verify_signature
    ok, reason = verify_signature(SECRET, "1234567890", "{}", None)
    assert ok is False
    assert reason == "missing_signature"


def test_verify_signature_rejects_missing_timestamp():
    from hermes_events_bridge.signature import verify_signature
    ok, reason = verify_signature(SECRET, None, "{}", "abc")
    assert ok is False
    assert reason == "missing_timestamp"


def test_verify_signature_rejects_stale_timestamp():
    from hermes_events_bridge.signature import verify_signature, compute_signature
    now = int(time.time())
    ok, reason = verify_signature(
        SECRET, "1000", "{}", compute_signature(SECRET, "1000", "{}"),
        tolerance_seconds=300, now_epoch=now,
    )
    assert ok is False
    assert reason == "timestamp_out_of_tolerance"


def test_verify_signature_rejects_bad_signature():
    from hermes_events_bridge.signature import verify_signature, compute_signature
    now = int(time.time())
    ok, reason = verify_signature(
        SECRET, str(now), "{}", "deadbeef" * 8,
        tolerance_seconds=300, now_epoch=now,
    )
    assert ok is False
    assert reason == "bad_signature"


def test_verify_signature_accepts_valid_signature():
    from hermes_events_bridge.signature import verify_signature, compute_signature
    body = '{"type":"x","executionId":"y","ts":1,"payload":{}}'
    ts = str(int(time.time()))
    sig = compute_signature(SECRET, ts, body)
    ok, reason = verify_signature(
        SECRET, ts, body, sig, tolerance_seconds=300,
    )
    assert ok is True, reason


# ─── Event store tests ──────────────────────────────────


def test_event_store_records_and_lists(tmp_path):
    from hermes_events_bridge.store import EventStore

    store = EventStore(tmp_path / "events.db")
    try:
        id1 = store.record(
            "execution.started", "exec-1", int(time.time() * 1000),
            {"foo": "bar"}, '{"type":"execution.started"}',
        )
        id2 = store.record(
            "tool.complete", "exec-1", int(time.time() * 1000),
            {"toolName": "stub.echo"}, '{"type":"tool.complete"}',
        )
        events = store.list_by_execution("exec-1")
        assert len(events) == 2
        assert events[0]["type"] == "execution.started"
        assert events[1]["type"] == "tool.complete"
        assert id1 < id2
    finally:
        store.close()


def test_event_store_filter_by_execution(tmp_path):
    from hermes_events_bridge.store import EventStore

    store = EventStore(tmp_path / "events.db")
    try:
        store.record("x", "exec-1", 1, {}, "{}")
        store.record("x", "exec-2", 1, {}, "{}")
        store.record("x", "exec-1", 2, {}, "{}")

        exec1 = store.list_by_execution("exec-1")
        exec2 = store.list_by_execution("exec-2")
        assert len(exec1) == 2
        assert len(exec2) == 1
    finally:
        store.close()


# ─── Cross-stack integration: sidecar → bridge ─────────


@pytest.fixture(scope="module")
def sidecar_process():
    """Spawn the real sidecar with WEBHOOK env pointing at the bridge."""
    sidecar_dir = Path(__file__).resolve().parents[2] / "hermes-sidecar"
    port = _free_port()
    state_dir = tempfile.mkdtemp(prefix="sidecar-p14-")
    bridge_port = _free_port()

    env = {
        **os.environ,
        "HERMES_SIDECAR_SECRET": SECRET,
        "HERMES_SIDECAR_STATE_DIR": state_dir,
        "HERMES_SIDECAR_PORT": str(port),
        "HERMES_SIDECAR_EVENT_WEBHOOK": f"http://127.0.0.1:{bridge_port}/webhook",
        "PYTHONPATH": str(sidecar_dir),
    }

    proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn",
            "hermes_sidecar.main:app",
            "--host", "127.0.0.1", "--port", str(port),
            "--log-level", "warning",
        ],
        cwd=str(sidecar_dir),
        env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )

    try:
        _wait_for_health(port)
        yield {"port": port, "proc": proc, "state_dir": state_dir, "bridge_port": bridge_port}
    finally:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
        shutil.rmtree(state_dir, ignore_errors=True)


@pytest.fixture
def bridge_app(tmp_path):
    """Bridge process with a fresh SQLite store and the right secret."""
    root = Path(__file__).resolve().parent.parent
    port = _free_port()
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "hermes_events_bridge.main:app",
         "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"],
        cwd=root,
        env={**os.environ, "HERMES_SIDECAR_SECRET": SECRET,
             "HERMES_EVENTS_BRIDGE_DB": str(tmp_path / "events.db"),
             "HERMES_SIDECAR_WEBHOOK_TOLERANCE_SECONDS": "300",
             "PYTHONPATH": str(root)},
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        _wait_for_health(port)
        yield RemoteClient(f"http://127.0.0.1:{port}")
    finally:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)


class RemoteResponse:
    def __init__(self, status_code: int, body: bytes):
        self.status_code = status_code
        self.text = body.decode("utf-8", errors="replace")

    def json(self):
        return json.loads(self.text)


class RemoteClient:
    def __init__(self, base_url: str):
        self.base_url = base_url

    def request(self, method: str, path: str, *, json=None, content=None, headers=None):
        data = content.encode() if isinstance(content, str) else content
        if data is None and json is not None:
            data = __import__("json").dumps(json).encode()
        request = urllib.request.Request(
            self.base_url + path, data=data, method=method,
            headers={"Content-Type": "application/json", **(headers or {})},
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return RemoteResponse(response.status, response.read())
        except urllib.error.HTTPError as error:
            return RemoteResponse(error.code, error.read())

    def get(self, path: str, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs):
        return self.request("POST", path, **kwargs)


def _mint_token(secret: str, execution_id: str, allowed_tools: list[str]) -> str:
    """Identical to the gateway's mint."""
    import base64
    claims = {
        "sub": "test", "tenantId": "t1",
        "executionId": execution_id, "workspacePath": "/x",
        "allowedTools": allowed_tools, "approvalThreshold": "STANDARD",
        "exp": int(time.time()) + 900, "scope": "hermes:execute",
    }
    payload = json.dumps(claims, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload).rstrip(b"=").decode("ascii")
    sig = hmac.new(secret.encode(), payload_b64.encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode("ascii")
    return f"{payload_b64}.{sig_b64}"


def _post_sidecar(port: int, token: str, body: dict) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/v1/executions",
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        data=json.dumps(body).encode(),
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def _get_sidecar(port: int, token: str, execution_id: str) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/v1/executions/{execution_id}",
        method="GET",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status, json.loads(r.read())


def test_bridge_rejects_missing_signature(bridge_app):
    """The bridge must reject webhook calls with no signature."""
    r = bridge_app.post("/webhook", json={"type": "x", "executionId": "e1", "ts": 1})
    assert r.status_code == 401


def test_bridge_rejects_bad_signature(bridge_app):
    """The bridge must reject webhook calls with a wrong signature."""
    r = bridge_app.post(
        "/webhook",
        json={"type": "x", "executionId": "e1", "ts": 1},
        headers={
            "x-hermes-signature": "deadbeef" * 8,
            "x-hermes-timestamp": str(int(time.time())),
        },
    )
    assert r.status_code == 401


def test_bridge_accepts_valid_signature(bridge_app):
    """The bridge accepts a properly-signed event."""
    from hermes_events_bridge.signature import compute_signature
    body = json.dumps({"type": "x", "executionId": "e1", "ts": 1, "payload": {}})
    ts = str(int(time.time()))
    sig = compute_signature(SECRET, ts, body)
    r = bridge_app.post(
        "/webhook",
        content=body,
        headers={
            "x-hermes-signature": sig,
            "x-hermes-timestamp": ts,
            "Content-Type": "application/json",
        },
    )
    assert r.status_code == 200, r.text
    body_resp = r.json()
    assert body_resp["accepted"] is True
    assert body_resp["type"] == "x"


def test_bridge_list_events_after_valid_post(bridge_app):
    """Events are persisted and retrievable via GET /events."""
    from hermes_events_bridge.signature import compute_signature
    body = json.dumps({"type": "tool.start", "executionId": "exec-1", "ts": 1, "payload": {"toolName": "stub.echo"}})
    ts = str(int(time.time()))
    sig = compute_signature(SECRET, ts, body)
    r1 = bridge_app.post(
        "/webhook", content=body,
        headers={"x-hermes-signature": sig, "x-hermes-timestamp": ts, "Content-Type": "application/json"},
    )
    assert r1.status_code == 200

    r2 = bridge_app.get("/events/exec-1")
    assert r2.status_code == 200
    events = r2.json()["events"]
    assert len(events) == 1
    assert events[0]["type"] == "tool.start"
    assert events[0]["executionId"] == "exec-1"


def test_bridge_list_all_events_orders_newest_first(bridge_app):
    """GET /events returns events in DESC id order."""
    from hermes_events_bridge.signature import compute_signature
    now = int(time.time())
    for i in range(3):
        body = json.dumps({"type": f"e{i}", "executionId": f"exec-{i}", "ts": now, "payload": {}})
        ts = str(now)
        sig = compute_signature(SECRET, ts, body)
        bridge_app.post(
            "/webhook", content=body,
            headers={"x-hermes-signature": sig, "x-hermes-timestamp": ts, "Content-Type": "application/json"},
        )
    r = bridge_app.get("/events")
    types = [e["type"] for e in r.json()["events"]]
    assert types == ["e2", "e1", "e0"]


def test_full_audit_trail_sidecar_to_bridge(sidecar_process, bridge_app):
    """End-to-end: start execution, the sidecar emits events to the bridge,
    and the bridge captures them in the correct order.

    This is the Phase 1.4 exit gate test. It spawns the REAL sidecar
    subprocess (the sidecar_process fixture) and the bridge in-process.

    Flow:
      1. Start execution
      2. Sidecar emits execution.started → bridge captures
      3. Sidecar emits tool.call → bridge captures
      4. Sidecar emits tool.completed → bridge captures
      5. Sidecar emits execution.completed → bridge captures

    NOTE: the sidecar's EventBus._forward() uses a 2.0s timeout httpx
    client. The bridge's /webhook endpoint must respond within that
    window. FastAPI's TestClient is in-process so response is sub-ms.
    """
    port = sidecar_process["port"]
    bridge_port = sidecar_process["bridge_port"]

    # The sidecar's webhook URL was set to bridge_port, but the bridge
    # is running in-process (TestClient) on the bridge_app fixture. The
    # bridge_port env var pointed at a port that has no listener.
    # We need to point the sidecar at the TestClient's localhost.
    # Workaround: run the bridge on the bridge_port; bring up a second
    # bridge for the TestClient that scans the same DB.
    # Simpler: run the bridge on the bridge_port via uvicorn, then
    # make HTTP calls to it.

    # Actually, the cleanest fix: start the bridge as a real subprocess
    # at bridge_port, since the sidecar emits HTTP to that port. The
    # TestClient fixture is for unit testing only; for the integration
    # test we need a real socket.
    pytest.skip(
        "Cross-stack webhook test requires a real bridge subprocess; "
        "checked in the dedicated cross-stack test below"
    )


def test_cross_stack_sidecar_emits_to_real_bridge(tmp_path):
    """The real Phase 1.4 exit gate: sidecar subprocess → bridge subprocess
    on the wire. Run both, drive an execution, verify events arrive."""
    from hermes_events_bridge.main import app as bridge_app
    from hermes_events_bridge.store import EventStore

    # Allocate ports
    sidecar_port = _free_port()
    bridge_port = _free_port()

    # Start bridge first
    db_path = tmp_path / "bridge.db"
    os.environ["HERMES_SIDECAR_SECRET"] = SECRET
    os.environ["HERMES_EVENTS_BRIDGE_DB"] = str(db_path)
    os.environ["HERMES_EVENTS_BRIDGE_PORT"] = str(bridge_port)

    bridge_root = Path(__file__).resolve().parent.parent
    bridge_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "hermes_events_bridge.main:app",
         "--host", "127.0.0.1", "--port", str(bridge_port), "--log-level", "warning"],
        cwd=str(bridge_root),
        env={**os.environ, "PYTHONPATH": str(bridge_root)},
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )

    try:
        _wait_for_health(bridge_port)

        # Start sidecar with webhook pointing at the bridge
        sidecar_dir = Path(__file__).resolve().parents[2] / "hermes-sidecar"
        sidecar_state = tempfile.mkdtemp(prefix="sidecar-p14-cs-")
        sidecar_proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "hermes_sidecar.main:app",
             "--host", "127.0.0.1", "--port", str(sidecar_port), "--log-level", "warning"],
            cwd=str(sidecar_dir),
            env={
                **os.environ,
                "HERMES_SIDECAR_SECRET": SECRET,
                "HERMES_SIDECAR_STATE_DIR": sidecar_state,
                "HERMES_SIDECAR_PORT": str(sidecar_port),
                "HERMES_SIDECAR_EVENT_WEBHOOK": f"http://127.0.0.1:{bridge_port}/webhook",
                "PYTHONPATH": str(sidecar_dir),
            },
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        try:
            _wait_for_health(sidecar_port)

            # Run an execution
            token = _mint_token(SECRET, "cs-exec-1", ["stub.echo"])
            status, body = _post_sidecar(sidecar_port, token, {
                "executionId": "cs-exec-1",
                "tenantId": "t1",
                "allowedTools": ["stub.echo"],
                "initialMessage": "hello",
            })
            assert status == 201, body

            # Wait for the bridge to receive events (the sidecar emits
            # events synchronously after the response, then httpx forwards
            # them in a separate call; give it a moment to land)
            deadline = time.time() + 5
            events = []
            while time.time() < deadline:
                with urllib.request.urlopen(
                    f"http://127.0.0.1:{bridge_port}/events/cs-exec-1", timeout=2
                ) as r:
                    events = json.loads(r.read())["events"]
                if len(events) >= 4:
                    break
                time.sleep(0.2)

            # Verify the audit trail
            assert len(events) >= 4, (
                f"Expected at least 4 events (execution.started, tool.call, "
                f"tool.completed, execution.completed), got {len(events)}: "
                f"{[e['type'] for e in events]}"
            )

            types = [e["type"] for e in events]
            # The first event must be execution.started
            assert types[0] == "execution.started"
            # The last event must be execution.completed
            assert types[-1] == "execution.completed"
            # The full audit trail is present
            assert "tool.call" in types
            assert "tool.completed" in types

        finally:
            sidecar_proc.send_signal(signal.SIGTERM)
            try:
                sidecar_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                sidecar_proc.kill()
                sidecar_proc.wait(timeout=5)
            shutil.rmtree(sidecar_state, ignore_errors=True)

    finally:
        bridge_proc.send_signal(signal.SIGTERM)
        try:
            bridge_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            bridge_proc.kill()
            bridge_proc.wait(timeout=5)
