"""Shared timestamped webhook signature library.

Plan ref: NC-ACCT-IMP-1 Phase 0; replaces duplicate HMAC code in:
  - infra/hermes-sidecar/hermes_sidecar/events.py
  - infra/hermes-events-bridge/.../signature.py

Format:
    X-Signature: t=<unix-seconds>,v1=<base64url-hmac-sha256>

The signed payload is `<timestamp>.<body>`. Replay protection: the verifier
checks `abs(now - timestamp) <= max_skew_seconds`.

Different from scope_token: webhook signatures are signed by the sidecar
when emitting events; the bridge verifies them when receiving events.
"""
from __future__ import annotations

import hashlib
import hmac
import time
from typing import Any


class WebhookSigError(Exception):
    """Raised when a webhook signature is malformed, expired, or invalid."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def sign(body: bytes, secret: str, timestamp: int | None = None) -> dict[str, str]:
    """Sign a webhook body. Returns headers dict {t, v1}."""
    if timestamp is None:
        timestamp = int(time.time())
    signed_payload = f"{timestamp}.".encode("ascii") + body
    sig = hmac.new(
        secret.encode("utf-8"), signed_payload, hashlib.sha256
    ).digest()
    import base64
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=").decode("ascii")
    return {"t": str(timestamp), "v1": sig_b64}


def verify(
    body: bytes,
    headers: dict[str, str],
    secret: str,
    max_skew_seconds: int = 300,
) -> int:
    """Verify a webhook signature. Returns the timestamp on success.

    Args:
        body: raw request body bytes.
        headers: must contain 't' (unix seconds) and 'v1' (signature).
        secret: shared HMAC secret.
        max_skew_seconds: replay window. 5min default.

    Raises:
        WebhookSigError: with codes missing_header, expired, bad_signature.
    """
    t_str = headers.get("t")
    sig = headers.get("v1")
    if not t_str or not sig:
        raise WebhookSigError("missing_header",
                              "Webhook requires t and v1 headers")
    try:
        timestamp = int(t_str)
    except ValueError as exc:
        raise WebhookSigError("missing_header",
                              f"t header must be integer: {exc}") from exc

    skew = abs(int(time.time()) - timestamp)
    if skew > max_skew_seconds:
        raise WebhookSigError("expired",
                              f"Timestamp skew {skew}s exceeds max {max_skew_seconds}s")

    signed_payload = f"{timestamp}.".encode("ascii") + body
    expected_sig = hmac.new(
        secret.encode("utf-8"), signed_payload, hashlib.sha256
    ).digest()

    import base64
    try:
        actual_sig = base64.urlsafe_b64decode(sig + "=" * (-len(sig) % 4))
    except Exception as exc:
        raise WebhookSigError("bad_signature",
                              f"v1 decode failed: {exc}") from exc

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise WebhookSigError("bad_signature",
                              "Webhook signature does not match")

    return timestamp