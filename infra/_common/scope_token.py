"""Shared HMAC-scoped token library.

Plan ref: NC-ACCT-IMP-1 Phase 0; replaces duplicate HMAC code in:
  - infra/hermes-sidecar/hermes_sidecar/auth.py
  - infra/hermes-events-bridge/.../verify.py
  - backend/src/modules/hermes-adapter/services/token.service.ts

Token format (unchanged from the original Hermes implementation):
    <base64url-claims-json>.<base64url-hmac-sha256>

Claims (parametric):
    sub               — user id
    tenantId          — tenant scope (enforced by caller)
    executionId       — caller-side correlation id
    workspacePath     — tenant workspace dir (e.g. /var/lib/neurecore/...)
    allowedTools      — list of tool names the caller is allowed to invoke
    approvalThreshold — 'NONE' | 'STANDARD' | 'HIGH'
    exp               — unix timestamp of expiry
    scope             — 'hermes:execute' | 'accounting:execute' | ...

The library is scope-parameterized; the caller chooses the scope value. This
allows multiple sidecars to share one HMAC primitive without code duplication.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any


class ScopeTokenError(Exception):
    """Raised when a scoped token is malformed, expired, or has a bad signature."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def sign(claims: dict[str, Any], secret: str) -> str:
    """Sign a claims dict. Returns `payload.signature` (base64url)."""
    if "scope" not in claims:
        raise ScopeTokenError("missing_scope",
                              "claims dict must include 'scope' field")
    payload_b64 = _b64url_encode(
        json.dumps(claims, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    sig = hmac.new(
        secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256
    ).digest()
    sig_b64 = _b64url_encode(sig)
    return f"{payload_b64}.{sig_b64}"


def verify(token: str, secret: str, expected_scope: str | None = None) -> dict[str, Any]:
    """Verify a scoped token. Returns the claims dict if valid.

    Args:
        token: `payload.signature` string from the Authorization header.
        secret: shared HMAC secret.
        expected_scope: if given, claims['scope'] MUST match. If None,
            scope is not validated (caller's responsibility).

    Raises:
        ScopeTokenError: with codes malformed_token, malformed_signature,
            bad_signature, malformed_payload, expired_token, wrong_scope.
    """
    if not token or "." not in token:
        raise ScopeTokenError("malformed_token",
                              "Token must be in 'payload.signature' format")

    payload_b64, sig_b64 = token.rsplit(".", 1)

    try:
        expected_sig = hmac.new(
            secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256
        ).digest()
        actual_sig = _b64url_decode(sig_b64)
    except Exception as exc:
        raise ScopeTokenError("malformed_signature",
                              f"Signature decode failed: {exc}") from exc

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ScopeTokenError("bad_signature", "Signature does not match")

    try:
        payload_json = _b64url_decode(payload_b64).decode("utf-8")
        claims = json.loads(payload_json)
    except Exception as exc:
        raise ScopeTokenError("malformed_payload",
                              f"Payload decode failed: {exc}") from exc

    if not isinstance(claims, dict):
        raise ScopeTokenError("malformed_payload",
                              "Claims must decode to a JSON object")

    exp = claims.get("exp")
    if exp is None:
        raise ScopeTokenError("missing_exp", "Token has no exp claim")
    if int(exp) < int(time.time()):
        raise ScopeTokenError("expired_token",
                              f"Token expired at {exp}")

    if expected_scope is not None:
        actual = claims.get("scope")
        if actual != expected_scope:
            raise ScopeTokenError("wrong_scope",
                                  f"Token scope is {actual!r}, "
                                  f"expected {expected_scope!r}")

    return claims


def mint_for_test(
    secret: str,
    claims: dict[str, Any],
    scope: str,
    ttl_seconds: int = 900,
) -> str:
    """Convenience: add scope + exp and sign. For tests + dev."""
    full = dict(claims)
    full["scope"] = scope
    full["exp"] = int(time.time()) + ttl_seconds
    return sign(full, secret)