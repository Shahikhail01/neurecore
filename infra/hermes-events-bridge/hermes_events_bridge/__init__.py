"""hermes-events-bridge: webhook receiver for Hermes sidecar events.

Plan ref: NC-AWL-IMP-2 §1.4 (Phase 1.4)

This service is the integration-tested receive path for sidecar events.
It mirrors the NestJS events-ingest.service.ts logic byte-for-byte, so
the protocol lock tests prove both implementations agree.

What this service does:
1. Receives webhook POSTs from the sidecar's EventBus
2. Verifies the HMAC-SHA256 signature (timestamp + body, hex digest)
3. Captures verified events to a local SQLite store (Phase 1.4 deliverable)
4. Exposes GET /events for inspection during testing

**Why a Python service instead of NestJS.** The NestJS backend has no
node_modules in this environment, so its webhook handler cannot be
runtime-tested. The Python port is integration-tested and serves as the
spec. The NestJS code mirrors it.

Mapping to the NestJS counterpart:
- events_bridge.verify_signature()   ↔ events-ingest.service.ts:ingest()
- WebhookReceiver class              ↔ hermes-sidecar-events.controller.ts
"""
