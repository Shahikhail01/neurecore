"""Minimal deploy-side token signer for the bridge (NC-ACCT-IMP-1 Phase 0).

Different from scope_token.py: the bridge deployment helper mints long-lived
bootstrap tokens for the first-boot deploy of an event bridge. This is a
distinct protocol (no `scope`, no `allowedTools`, simpler claims). Kept
separate from scope_token to avoid conflating two use cases.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any


class DeployTokenError(Exception):
    pass


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def sign(claims: dict[str, Any], secret: str) -> str:
    payload_b64 = _b64url_encode(
        json.dumps(claims, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    sig = hmac.new(
        secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256
    ).digest()
    return f"{payload_b64}.{_b64url_encode(sig)}"


def verify(token: str, secret: str) -> dict[str, Any]:
    if not token or "." not in token:
        raise DeployTokenError("malformed_token")
    payload_b64, sig_b64 = token.rsplit(".", 1)
    expected = hmac.new(
        secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256
    ).digest()
    actual = _b64url_decode(sig_b64)
    if not hmac.compare_digest(expected, actual):
        raise DeployTokenError("bad_signature")
    claims = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    exp = claims.get("exp")
    if exp is not None and int(exp) < int(time.time()):
        raise DeployTokenError("expired")
    return claims