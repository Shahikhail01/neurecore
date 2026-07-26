# ADR-002: Transactional Outbox

## Status: Accepted

## Context
We need at-least-once delivery of business events for async automation.

## Decision
Use PostgreSQL-backed transactional outbox:
1. Outbox event is inserted in the same transaction as the business mutation
2. Outbox worker polls and dispatches events
3. Consumer inbox provides fan-out
4. Lease mechanism ensures single-processing
5. Dead-letter after 3 failures

## Consequences
- No Redis/BullMQ dependency for Phase 1-3
- Throughput adequate for autonomous work layer
- Simpler operational model
