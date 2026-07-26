# ADR-001: Command Boundary

## Status: Accepted

## Context
Business mutations must have a single authoritative entry point to ensure:
- Idempotency is guaranteed
- Tenant isolation is enforced
- Audit trail is complete
- Failure is recoverable

## Decision
All business mutations MUST go through typed Application Commands:
1. UI/Tools/System triggers invoke Command
2. Command validates input and authorization
3. Command calls Domain Service
4. Domain Service performs mutation within transaction
5. Transactional Outbox event is emitted

## Consequences
- Tools must be rewritten to call Commands, not Prisma directly
- Direct Prisma mutations become prohibited (except for seeds/fixtures)
