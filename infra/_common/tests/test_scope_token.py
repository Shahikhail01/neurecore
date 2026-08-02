"""Protocol-lock tests for infra/_common/scope_token.{py,ts}.

These tests verify that the Python implementation can produce tokens that
its own verify function accepts, AND that the token format is exactly the
base64url-claims.base64url-hmac pattern that the NestJS side must produce.

For the cross-language lock test, see test_scope_token.spec.ts (in the
backend repo) which calls this module via a Python subprocess and asserts
byte-for-byte equality of the produced signature.
"""
from __future__ import annotations

import json
import time

import pytest

from infra._common.scope_token import (
    ScopeTokenError, sign, verify, mint_for_test,
)


SECRET = "test-secret-do-not-use-in-prod"


def test_sign_then_verify_roundtrip():
    claims = {
        "sub": "user-123",
        "tenantId": "tenant-abc",
        "executionId": "exec-xyz",
        "workspacePath": "/var/lib/neurecore/hermes/tenants/tenant-abc/",
        "allowedTools": ["search", "fetch"],
        "approvalThreshold": "STANDARD",
        "exp": int(time.time()) + 900,
        "scope": "hermes:execute",
    }
    token = sign(claims, SECRET)
    decoded = verify(token, SECRET, expected_scope="hermes:execute")
    assert decoded["sub"] == "user-123"
    assert decoded["tenantId"] == "tenant-abc"
    assert decoded["allowedTools"] == ["search", "fetch"]


def test_missing_scope_rejected_at_sign():
    with pytest.raises(ScopeTokenError) as exc:
        sign({"sub": "u", "tenantId": "t", "exp": int(time.time()) + 60}, SECRET)
    assert exc.value.code == "missing_scope"


def test_wrong_scope_rejected_at_verify():
    token = sign({
        "sub": "u", "tenantId": "t", "exp": int(time.time()) + 60,
        "scope": "hermes:execute",
    }, SECRET)
    with pytest.raises(ScopeTokenError) as exc:
        verify(token, SECRET, expected_scope="accounting:execute")
    assert exc.value.code == "wrong_scope"


def test_expired_rejected():
    token = sign({
        "sub": "u", "tenantId": "t", "exp": int(time.time()) - 60,
        "scope": "hermes:execute",
    }, SECRET)
    with pytest.raises(ScopeTokenError) as exc:
        verify(token, SECRET)
    assert exc.value.code == "expired_token"


def test_missing_exp_rejected():
    """A token with no exp claim must be rejected (defence against replay forever)."""
    payload = {"sub": "u", "tenantId": "t", "scope": "hermes:execute"}
    import infra._common.scope_token as st
    # Bypass sign()'s scope check by signing directly with manual HMAC:
    import base64, hmac, hashlib
    payload_b64 = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).rstrip(b"=").decode()
    sig = hmac.new(SECRET.encode(), payload_b64.encode(), hashlib.sha256).digest()
    token = f"{payload_b64}.{base64.urlsafe_b64encode(sig).rstrip(b'=').decode()}"
    with pytest.raises(ScopeTokenError) as exc:
        verify(token, SECRET)
    assert exc.value.code == "missing_exp"


def test_bad_signature_rejected():
    token = sign({
        "sub": "u", "tenantId": "t", "exp": int(time.time()) + 60,
        "scope": "hermes:execute",
    }, SECRET)
    # Tamper with the signature
    tampered = token[:-4] + "AAAA"
    with pytest.raises(ScopeTokenError) as exc:
        verify(tampered, SECRET)
    assert exc.value.code == "bad_signature"


def test_wrong_secret_rejected():
    token = sign({
        "sub": "u", "tenantId": "t", "exp": int(time.time()) + 60,
        "scope": "hermes:execute",
    }, SECRET)
    with pytest.raises(ScopeTokenError):
        verify(token, "different-secret")


def test_malformed_token_rejected():
    for bad in ["", "no-dot", ".only-sig", "only-payload."]:
        with pytest.raises(ScopeTokenError) as exc:
            verify(bad, SECRET)
        assert exc.value.code in ("malformed_token", "malformed_signature",
                                  "bad_signature", "malformed_payload")


def test_mint_for_test_adds_scope_and_exp():
    token = mint_for_test(SECRET, {
        "sub": "u", "tenantId": "t",
    }, scope="accounting:execute", ttl_seconds=60)
    claims = verify(token, SECRET, expected_scope="accounting:execute")
    assert claims["scope"] == "accounting:execute"
    assert claims["exp"] > int(time.time())


def test_deterministic_format_for_cross_lang():
    """The exact wire format must not depend on dict ordering.

    NestJS uses JSON.stringify which is insertion-ordered for objects with
    string keys (V8). We pin sort_keys=True on the Python side to match.
    This test asserts that two semantically identical claim dicts produce
    byte-identical tokens regardless of dict insertion order.
    """
    a = {"b": 2, "a": 1, "exp": int(time.time()) + 60, "scope": "x"}
    b = {"a": 1, "b": 2, "scope": "x", "exp": a["exp"]}
    assert sign(a, SECRET) == sign(b, SECRET)


def test_payload_is_base64url_json_dot_hmac():
    """Wire format: <base64url-json>.<base64url-hmac>. Both halves unpadded."""
    token = sign({
        "sub": "u", "tenantId": "t", "exp": int(time.time()) + 60,
        "scope": "hermes:execute",
    }, SECRET)
    payload_b64, sig_b64 = token.split(".")
    assert "=" not in payload_b64
    assert "=" not in sig_b64
    assert "+" not in payload_b64 and "/" not in payload_b64
    # Decoded payload is the original JSON
    import base64
    pad = "=" * (-len(payload_b64) % 4)
    decoded = json.loads(base64.urlsafe_b64decode(payload_b64 + pad))
    assert decoded["scope"] == "hermes:execute"