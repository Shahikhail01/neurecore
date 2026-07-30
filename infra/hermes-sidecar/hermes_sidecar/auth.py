"""HMAC scoped token verification.

Plan ref: NC-AWL-IMP-2 §1.2

The sidecar NEVER has DB access. The gateway mints a short-lived (≤15min)
HMAC-SHA256 token with the tenant's claims; the sidecar verifies it locally
and uses the claims as the source of truth for the execution.

Token format:
    <base64url-claims-json>.<base64url-hmac-sha256>

NOT a JWT — we don't need a JWT library. The sidecar is a single-tenant
internal service, so HMAC is sufficient.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from pydantic import ValidationError

from .models import ScopedTokenClaims


class TokenError(Exception):
    """Raised when a token is malformed, expired, or has a bad signature."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def sign_token(claims: ScopedTokenClaims, secret: str) -> str:
    """Sign a claims object. Used by tests + the gateway equivalent."""
    payload = claims.model_dump()
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)
    return f"{payload_b64}.{sig_b64}"


def verify_token(token: str, secret: str) -> ScopedTokenClaims:
    """Verify a token and return its claims.

    Raises:
        TokenError: malformed, bad signature, expired, or wrong scope.
    """
    if not token or "." not in token:
        raise TokenError("malformed_token", "Token must be in 'payload.signature' format")

    payload_b64, sig_b64 = token.rsplit(".", 1)

    try:
        expected_sig = hmac.new(
            secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256
        ).digest()
        actual_sig = _b64url_decode(sig_b64)
    except Exception as exc:
        raise TokenError("malformed_signature", f"Signature decode failed: {exc}") from exc

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise TokenError("bad_signature", "Signature does not match")

    try:
        payload_json = _b64url_decode(payload_b64).decode("utf-8")
        payload = json.loads(payload_json)
    except Exception as exc:
        raise TokenError("malformed_payload", f"Payload decode failed: {exc}") from exc

    try:
        claims = ScopedTokenClaims.model_validate(payload)
    except ValidationError as exc:
        raise TokenError("invalid_claims", f"Claims validation failed: {exc}") from exc

    if claims.exp < int(time.time()):
        raise TokenError("expired_token", f"Token expired at {claims.exp}")

    if claims.scope != "hermes:execute":
        raise TokenError("wrong_scope", f"Token scope is {claims.scope!r}, expected 'hermes:execute'")

    return claims


def mint_test_token(
    secret: str,
    tenantId: str = "test-tenant",
    executionId: str = "test-exec",
    allowedTools: list[str] | None = None,
    approvalThreshold: str = "STANDARD",
    ttl_seconds: int = 900,
) -> str:
    """Mint a token for tests. Production minting happens in the gateway."""
    claims = ScopedTokenClaims(
        sub="test-user",
        tenantId=tenantId,
        executionId=executionId,
        workspacePath=f"/var/lib/neurecore/hermes/tenants/{tenantId}/",
        allowedTools=allowedTools or [],
        approvalThreshold=approvalThreshold,  # type: ignore[arg-type]
        exp=int(time.time()) + ttl_seconds,
    )
    return sign_token(claims, secret)
