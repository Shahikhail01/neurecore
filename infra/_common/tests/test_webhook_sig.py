"""Protocol-lock tests for infra/_common/webhook_sig.py."""
from __future__ import annotations

import time

import pytest

from infra._common.webhook_sig import (
    WebhookSigError, sign, verify,
)


SECRET = "webhook-test-secret"


def test_sign_then_verify_roundtrip():
    body = b'{"event":"posting.recorded","id":"abc-123"}'
    headers = sign(body, SECRET)
    ts = verify(body, headers, SECRET)
    assert abs(ts - int(time.time())) < 5


def test_tampered_body_rejected():
    body = b'{"event":"posting.recorded"}'
    headers = sign(body, SECRET)
    tampered = b'{"event":"posting.recorded","extra":"evil"}'
    with pytest.raises(WebhookSigError) as exc:
        verify(tampered, headers, SECRET)
    assert exc.value.code == "bad_signature"


def test_expired_timestamp_rejected():
    body = b'{"x":1}'
    # 10 minutes in the past
    headers = sign(body, SECRET, timestamp=int(time.time()) - 600)
    with pytest.raises(WebhookSigError) as exc:
        verify(body, headers, SECRET, max_skew_seconds=300)
    assert exc.value.code == "expired"


def test_missing_headers_rejected():
    with pytest.raises(WebhookSigError) as exc:
        verify(b'{}', {}, SECRET)
    assert exc.value.code == "missing_header"


def test_wrong_secret_rejected():
    body = b'{"x":1}'
    headers = sign(body, SECRET)
    with pytest.raises(WebhookSigError):
        verify(body, headers, "different")