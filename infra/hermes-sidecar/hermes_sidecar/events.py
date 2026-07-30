"""Event emission for the sidecar.

In Phase 1.1, events are kept in memory + persisted to state.json. The webhook
forwarding is wired but optional (so the sidecar can run standalone for tests).

Phase 1.4: webhook emission signs the request with HMAC-SHA256 so the
events-bridge can verify the source. The scheme mirrors the NestJS
events-ingest.service.ts and the Python events-bridge signature.py:

    signature = HMAC-SHA256(secret, f"{timestamp}.{body}".encode()).hexdigest()

If the bridge rejects the signature (or any other error), the sidecar
swallows the failure and logs it. The sidecar is the source of truth;
the webhook is advisory.

Plan ref: NC-AWL-IMP-2 §1.2, §1.4
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from typing import Any

import httpx

from .models import now_ms


WEBHOOK_SIGNATURE_HEADER = "x-hermes-signature"
WEBHOOK_TIMESTAMP_HEADER = "x-hermes-timestamp"


class EventBus:
    """In-memory event store + optional webhook forwarding."""

    def __init__(
        self,
        webhook_url: str = "",
        secret: str = "",
        tolerance_seconds: int = 300,
    ) -> None:
        self.webhook_url = webhook_url
        self._secret = secret
        self._tolerance_seconds = tolerance_seconds
        self._events: list[dict[str, Any]] = []

    def emit(
        self,
        event_type: str,
        execution_id: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        event = {
            "type": event_type,
            "executionId": execution_id,
            "ts": now_ms(),
            "payload": payload or {},
        }
        self._events.append(event)
        self._forward(event)
        return event

    def list(self) -> list[dict[str, Any]]:
        return list(self._events)

    def _forward(self, event: dict[str, Any]) -> None:
        if not self.webhook_url or not self._secret:
            return
        # Best-effort forward; do not block the request thread.
        try:
            body = json.dumps(event, separators=(",", ":"))
            timestamp = str(int(time.time()))
            signature = self._compute_signature(timestamp, body)
            headers = {
                WEBHOOK_SIGNATURE_HEADER: signature,
                WEBHOOK_TIMESTAMP_HEADER: timestamp,
                "Content-Type": "application/json",
            }
            with httpx.Client(timeout=2.0) as client:
                webhook_url = self.webhook_url.replace(
                    "{executionId}", str(event["executionId"])
                )
                client.post(
                    webhook_url,
                    content=body.encode("utf-8"),
                    headers=headers,
                )
        except Exception as exc:
            # Swallow: the sidecar is the source of truth; webhook is advisory.
            # Logging is best-effort so we don't crash if logging isn't set up.
            try:
                import logging
                logging.getLogger(__name__).warning(
                    "webhook forward failed: %s", exc
                )
            except Exception:
                pass

    def _compute_signature(self, timestamp: str, body: str) -> str:
        msg = f"{timestamp}.{body}".encode("utf-8")
        return hmac.new(
            self._secret.encode("utf-8"),
            msg,
            hashlib.sha256,
        ).hexdigest()
