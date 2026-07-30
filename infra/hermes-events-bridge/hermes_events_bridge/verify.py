"""Phase 1.4 deployment verification — Python equivalent of the bash script.

Runs the same checks as `phase1-4-deployment-verify.sh` but via Python
so it can be invoked from pytest, from CI, or from the bash script.

Plan ref: NC-AWL-IMP-2 §1.4
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import socket
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class CheckResult:
    name: str
    passed: bool
    skipped: bool = False
    message: str = ""

    def __str__(self) -> str:
        if self.skipped:
            return f"  - {self.name} (skipped: {self.message})"
        mark = "✓" if self.passed else "✗"
        return f"  {mark} {self.name}" + (f" — {self.message}" if self.message else "")


@dataclass
class VerificationReport:
    results: list[CheckResult] = field(default_factory=list)

    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.passed)

    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if not r.passed and not r.skipped)

    @property
    def skipped(self) -> int:
        return sum(1 for r in self.results if r.skipped)

    def verify_pass(self) -> bool:
        return self.failed == 0


def _http(method: str, url: str, *, headers: dict | None = None,
          body: str | None = None, timeout: float = 5.0) -> tuple[int, str]:
    """Tiny HTTP client. Returns (status, body)."""
    req = urllib.request.Request(url, method=method, headers=headers or {})
    data = body.encode("utf-8") if body is not None else None
    req.data = data
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, ConnectionError, OSError) as e:
        return 0, str(e)


def run_deployment_verification(
    *,
    sidecar_port: int = 8080,
    bridge_port: int = 8082,
    gateway_port: int = 3000,
    secret: str = "dev-secret-do-not-use-in-prod",
) -> VerificationReport:
    """Run all 6 verification checks. Returns a report."""
    report = VerificationReport()

    # 1. Events bridge health
    status, _ = _http("GET", f"http://127.0.0.1:{bridge_port}/healthz")
    if status == 200:
        report.results.append(CheckResult(
            "events-bridge /healthz returns 200", True,
        ))
    elif status == 0:
        report.results.append(CheckResult(
            "events-bridge /healthz is not reachable", False,
            message="connection refused",
        ))
    else:
        report.results.append(CheckResult(
            "events-bridge /healthz returns 200", False,
            message=f"HTTP {status}",
        ))

    # 2. Sidecar health
    status, _ = _http("GET", f"http://127.0.0.1:{sidecar_port}/healthz")
    if status == 200:
        report.results.append(CheckResult(
            "sidecar /healthz returns 200", True,
        ))
    else:
        report.results.append(CheckResult(
            "sidecar /healthz is not reachable", False,
            message=f"HTTP {status}",
        ))

    # 3. NestJS gateway health
    status, _ = _http("GET", f"http://127.0.0.1:{gateway_port}/api/v1/health")
    if status == 200:
        report.results.append(CheckResult(
            "gateway /api/v1/health returns 200", True,
        ))
    else:
        # Try /health
        status2, _ = _http("GET", f"http://127.0.0.1:{gateway_port}/health")
        if status2 == 200:
            report.results.append(CheckResult(
                "gateway /health returns 200", True,
            ))
        else:
            report.results.append(CheckResult(
                "gateway is not reachable", False,
                message=f"HTTP {status}",
            ))

    # 4. NestJS hermes-adapter routes
    routes = [
        ("POST", "/api/v1/hermes-adapter/executions"),
        ("GET", "/api/v1/hermes-adapter/executions/test-id"),
        ("POST", "/api/v1/hermes-adapter/executions/test-id/cancel"),
        ("POST", "/api/v1/hermes-adapter/executions/test-id/resume"),
        ("POST", "/api/v1/hermes-adapter/executions/test-id/approvals/test-appr"),
    ]
    for method, path in routes:
        status, _ = _http(
            method, f"http://127.0.0.1:{gateway_port}{path}",
            headers={"Content-Type": "application/json"},
            body="{}",
        )
        if status in (401, 403):
            report.results.append(CheckResult(
                f"route {method} {path} mounted", True,
                message=f"auth guard rejected (HTTP {status})",
            ))
        elif status == 404:
            report.results.append(CheckResult(
                f"route {method} {path} NOT MOUNTED", False,
                message="HTTP 404",
            ))
        elif status == 200:
            report.results.append(CheckResult(
                f"route {method} {path} mounted and accessible", True,
            ))
        else:
            report.results.append(CheckResult(
                f"route {method} {path} returned HTTP {status}", False,
                message="unexpected status",
            ))

    # 5. Webhook endpoint accepts signed events
    timestamp = str(int(time.time()))
    test_body = json.dumps({
        "type": "deployment.verify", "executionId": "deploy-verify",
        "ts": 1, "payload": {},
    })
    sig = hmac.new(
        secret.encode("utf-8"),
        f"{timestamp}.{test_body}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    status, response_body = _http(
        "POST", f"http://127.0.0.1:{bridge_port}/webhook",
        headers={
            "Content-Type": "application/json",
            "x-hermes-signature": sig,
            "x-hermes-timestamp": timestamp,
        },
        body=test_body,
    )
    if status == 200:
        report.results.append(CheckResult(
            "webhook accepts signed event", True,
        ))
    else:
        report.results.append(CheckResult(
            "webhook rejected signed event", False,
            message=f"HTTP {status}: {response_body[:200]}",
        ))

    # Verify the event was stored
    status, body = _http("GET", f"http://127.0.0.1:{bridge_port}/events/deploy-verify")
    if status == 200 and "deployment.verify" in body:
        report.results.append(CheckResult(
            "webhook event was persisted to the bridge store", True,
        ))
    else:
        report.results.append(CheckResult(
            "webhook event was NOT persisted", False,
            message=f"HTTP {status}, body={body[:200]}",
        ))

    # 6. End-to-end: sidecar → bridge
    eid = f"deploy-verify-{int(time.time())}"
    token = _mint_token(secret, eid, ["stub.echo"])
    status, response_body = _http(
        "POST", f"http://127.0.0.1:{sidecar_port}/v1/executions",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        body=json.dumps({
            "executionId": eid, "tenantId": "t1",
            "allowedTools": ["stub.echo"], "initialMessage": "deploy verify",
        }),
    )
    if status == 201:
        report.results.append(CheckResult(
            f"sidecar started execution ({eid})", True,
        ))
    else:
        report.results.append(CheckResult(
            "sidecar refused to start execution", False,
            message=f"HTTP {status}: {response_body[:200]}",
        ))
        return report

    # Wait for the bridge to capture events
    deadline = time.time() + 5
    events = []
    while time.time() < deadline:
        _, body = _http("GET", f"http://127.0.0.1:{bridge_port}/events/{eid}")
        try:
            data = json.loads(body)
            events = data.get("events", [])
        except json.JSONDecodeError:
            events = []
        if len(events) >= 4:
            break
        time.sleep(0.2)

    if len(events) >= 4:
        report.results.append(CheckResult(
            f"bridge captured {len(events)} events from sidecar", True,
            message="audit trail preserved",
        ))
    else:
        report.results.append(CheckResult(
            "bridge captured fewer than 4 events", False,
            message=f"got {len(events)}",
        ))

    return report


def _mint_token(secret: str, execution_id: str, allowed_tools: list[str]) -> str:
    """Identical to the gateway's mint."""
    import base64
    claims = {
        "sub": "deploy", "tenantId": "t1",
        "executionId": execution_id, "workspacePath": "/x",
        "allowedTools": allowed_tools, "approvalThreshold": "STANDARD",
        "exp": int(time.time()) + 900, "scope": "hermes:execute",
    }
    payload = json.dumps(claims, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload).rstrip(b"=").decode("ascii")
    sig = hmac.new(secret.encode(), payload_b64.encode(), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode("ascii")
    return f"{payload_b64}.{sig_b64}"


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description="Phase 1.4 deployment verification")
    parser.add_argument("--sidecar-port", type=int, default=8080)
    parser.add_argument("--bridge-port", type=int, default=8082)
    parser.add_argument("--gateway-port", type=int, default=3000)
    parser.add_argument("--secret", default="dev-secret-do-not-use-in-prod")
    args = parser.parse_args()

    report = run_deployment_verification(
        sidecar_port=args.sidecar_port,
        bridge_port=args.bridge_port,
        gateway_port=args.gateway_port,
        secret=args.secret,
    )

    print("=" * 64)
    print("Phase 1.4 deployment verification")
    print("=" * 64)
    for r in report.results:
        print(r)
    print("=" * 64)
    print(f"Summary: {report.passed} pass, {report.failed} fail, {report.skipped} skip")
    print("=" * 64)

    if not report.verify_pass():
        print("\nPHASE 1.4 DEPLOYMENT VERIFICATION: FAIL")
        print("Phase 2 (SIM-04 vertical slice) is BLOCKED.")
        return 1
    print("\nPHASE 1.4 DEPLOYMENT VERIFICATION: PASS")
    print("Phase 2 (SIM-04 vertical slice) is GO.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
