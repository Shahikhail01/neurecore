"""Signature verification — must match NestJS events-ingest.service.ts.

Both implementations use:
    HMAC-SHA256(secret, f"{timestamp}.{body}".encode("utf-8"))
    .hexdigest()

The receiving party verifies that the X-Hermes-Signature header equals
the expected hex digest, using `hmac.compare_digest` (Python) or
`crypto.timingSafeEqual` (Node) for constant-time comparison.
"""

from __future__ import annotations

import hashlib
import hmac


SIGNATURE_HEADER = "x-hermes-signature"
TIMESTAMP_HEADER = "x-hermes-timestamp"


def compute_signature(secret: str, timestamp: int | str, body: str) -> str:
    """Return the hex HMAC-SHA256 of `f"{timestamp}.{body}"` keyed by `secret`.

    This is the EXACT function the NestJS events-ingest.service.ts uses
    (see hashedSecret over `${timestamp}.${body}`). Both implementations
    must produce identical output for any (secret, ts, body) tuple.
    """
    msg = f"{timestamp}.{body}".encode("utf-8")
    return hmac.new(
        secret.encode("utf-8"), msg, hashlib.sha256
    ).hexdigest()


def verify_signature(
    secret: str,
    timestamp: str | None,
    body: str,
    provided_signature: str | None,
    tolerance_seconds: int = 300,
    now_epoch: int | None = None,
) -> tuple[bool, str]:
    """Verify a webhook signature. Returns (ok, reason).

    Returns `(True, "ok")` if the signature is valid.
    Returns `(False, reason)` with one of:
      - "missing_signature"
      - "missing_timestamp"
      - "invalid_timestamp"
      - "timestamp_out_of_tolerance"
      - "bad_signature"
    """
    if not provided_signature:
        return False, "missing_signature"
    if not timestamp:
        return False, "missing_timestamp"
    try:
        ts_num = int(timestamp)
    except (ValueError, TypeError):
        return False, "invalid_timestamp"

    if now_epoch is None:
        import time
        now_epoch = int(time.time())
    if abs(now_epoch - ts_num) > tolerance_seconds:
        return False, "timestamp_out_of_tolerance"

    expected = compute_signature(secret, ts_num, body)
    provided = provided_signature.lower()
    if len(expected) != len(provided):
        return False, "bad_signature"
    if not hmac.compare_digest(expected, provided):
        return False, "bad_signature"
    return True, "ok"
