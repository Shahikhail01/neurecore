# NeureCore Autonomous Work Layer (AWL) — Phase 1-10

This directory contains the implementation of the **Autonomous Work Layer Reconstruction** following the [NC-AWL-IMP-1 plan](../../memory-bank-new/plans/AI-IMPLEMENTATION-PLAN-v2.md).

## Architecture

```
src/
├── common/                              # Shared infrastructure
│   ├── commands/                       # Command pattern + idempotency wrapper
│   │   ├── command.interface.ts        # ICommand, CommandDefinition, CommandResult
│   │   ├── command.registry.ts         # CommandRegistry - handler registration
│   │   └── command.module.ts           # @Global - injectable in all modules
│   │
│   ├── correlation/                    # AsyncLocalStorage + CommandMetadata
│   │   ├── correlation.interface.ts    # CommandMetadata contract
│   │   ├── correlation.service.ts      # AsyncLocalStorage provider
│   │   └── correlation.module.ts       # @Global
│   │
│   ├── idempotency/                    # Command idempotency layer
│   │   ├── command-idempotency.service.ts  # Uses Prisma IdempotencyRecord
│   │   ├── command-idempotency.module.ts
│   │   └── idempotency-matrix.ts       # Spec for 7 operations
│   │
│   ├── outbox/                         # Transactional outbox + circuit breaker
│   │   ├── outbox.interface.ts
│   │   ├── outbox.service.ts           # OutboxService with claim/dispatch/settle
│   │   ├── outbox.worker.ts            # 1s poll, 30s lease, exponential backoff
│   │   ├── circuit-breaker.ts          # 5-failure threshold, 30s reset
│   │   └── outbox.module.ts            # @Global
│   │
│   ├── enterprise/                     # Architecture rules
│   │   ├── architecture-rules.ts       # Layer dependency rules
│   │   └── strangler-strategy.ts       # Legacy isolation pattern
│   │
│   └── logging/                        # CorrelationLogger
│       ├── correlation-logger.service.ts
│       └── logging.module.ts           # @Global
│
├── modules/                            # Business modules
│   ├── enterprise-initiation/          # Phase 2
│   │   ├── commands/                   # ApproveInitiation, CreateProject
│   │   ├── domain/                     # InitiationStateMachine
│   │   ├── application/                # ApproveInitiationHandler, CreateProjectHandler
│   │   ├── enterprise-initiation.controller.ts
│   │   ├── enterprise-initiation.service.ts
│   │   └── enterprise-initiation.module.ts
│   │
│   ├── project-automation/             # Phase 3
│   │   ├── domain/                     # AutomationStateMachine
│   │   ├── application/                # ProjectAutomationHandler (event consumer)
│   │   ├── project-automation.service.ts
│   │   └── project-automation.module.ts
│   │
│   ├── execution/                      # Phase 5
│   │   ├── domain/                     # ExecutionPolicy, FailureClassification, EvidenceArtifact
│   │   ├── application/                # ExecutionOrchestrator
│   │   ├── execution.worker.ts         # TaskExecutionRequested handler
│   │   └── execution.module.ts
│   │
│   ├── reviews/                        # Phase 6
│   │   ├── domain/                     # ReviewDecision, ReviewStatus
│   │   ├── application/                # ReviewService
│   │   └── review.controller.ts
│   │
│   ├── assignments/                    # Phase 4
│   │   └── application/                # AssignmentService
│   │
│   ├── tenant-flags/                   # Phase 1
│   │   ├── tenant-flags.service.ts     # Per-tenant feature flags with audit
│   │   └── tenant-flags.controller.ts
│   │
│   ├── timeline/                       # Phase 7
│   │   ├── timeline.types.ts
│   │   ├── timeline.service.ts
│   │   └── timeline.controller.ts
│   │
│   └── observability/                  # Phase 8
│       ├── metrics.service.ts
│       └── awl-health.controller.ts    # /awl-health endpoint
│
└── test/
    ├── architecture/                   # Architecture tests
    │   ├── tool-bypass.spec.ts         # Detects tool bypasses
    │   └── circuit-breaker.spec.ts     # Circuit breaker behavior
    └── certification/                  # Phase 9 certification
        ├── golden-path.spec.ts
        ├── idempotency.spec.ts
        ├── failure-recovery.spec.ts
        ├── tenant-isolation.spec.ts
        ├── certification.spec.ts
        └── golden-path-e2e.spec.ts     # Full command flow E2E
```

## Quick Start

### 1. Apply Database Migration

```bash
cd backend
npx prisma migrate dev --name autonomous-work-layer
```

This adds the following models:
- `EnterpriseInitiation`
- `ExecutionAttempt`
- `Review`
- `EvidenceArtifact`
- `TaskAssignment`
- `TenantFeatureFlagOverride`
- `FeatureFlagAuditLog`

And fields:
- `Agent.role`, `capabilities`, `maxConcurrency`, `availability`, `archived`
- `Goal.automationVersion`, `templateKey`
- `Task.automationVersion`, `templateKey`, `requiredRole`, `requiredCapabilities`
- `Project.executionEngineVersion`, `initiationId`

### 2. Verify Compilation

```bash
npx tsc --noEmit
```

### 3. Run Tests

```bash
# Architecture tests
npx jest --testPathPatterns="src/test/architecture"

# Certification tests
npx jest --testPathPatterns="src/test/certification"
```

### 4. Enable Feature Flags

Set per-tenant flags in the database:
```sql
INSERT INTO tenant_feature_flag_overrides (id, "tenantId", "flagKey", enabled, "setByActorId", version, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'tenant-id', 'CANONICAL_INITIATION', true, 'admin-user-id', 1, NOW(), NOW());
```

Available flags:
- `CANONICAL_INITIATION` — Enable canonical initiation flow
- `DURABLE_AUTOMATION` — Use outbox-based automation
- `AUTO_ASSIGNMENT` — Auto-assign tasks to AI
- `AUTONOMOUS_EXECUTION` — Allow autonomous task execution
- `HUMAN_REVIEW_WORKFLOW` — Require human review for AI work
- `NEW_LIFECYCLE_GUARDS` — Apply new lifecycle guards
- `NEW_TIMELINE` — Use new timeline UI

### 5. Health Check

```bash
curl http://localhost:3000/awl-health
```

Response:
```json
{
  "status": "healthy",
  "components": {
    "outbox": { "backlog": 0, "status": "healthy" },
    "circuit": { "open": false, "status": "closed" },
    "commands": { "registered": 2 }
  }
}
```

## Key Design Decisions

### Command Pattern (Phase 1)
- All business mutations go through `CommandRegistry.execute()`
- Each command has `commandType`, `version`, idempotency key, request hash
- Idempotency via `tenantId + scope + idempotencyKey` unique constraint
- `RETURN_CACHE` on duplicate, no business re-execution

### Transactional Outbox (Phase 3)
- Events written in same transaction as business mutation
- Worker polls every 1s, claims with 30s lease
- Exponential backoff: 1s, 4s, 16s
- Dead letter after 3 attempts
- Circuit breaker: opens after 5 failures, auto-resets after 30s

### Tenant Context (Phase 1)
- `AsyncLocalStorage` for ambient context (logging, observability)
- Explicit `tenantId` in commands and repositories (no implicit context)
- `tenantFlags.isEnabled(flag, tenantId)` for feature flag checks
- 30s in-memory cache with manual invalidation on override

### State Machines (Phase 1)
- Each aggregate has a typed state machine
- `assertTransition(from, to)` throws on invalid transition
- Audit log + outbox event emitted on every transition
- Optimistic concurrency via `version` field

## Performance Targets

| Metric | Target |
|--------|--------|
| Synchronous command acknowledgement | P95 < 2s |
| UI sees committed state | P95 < 5s |
| Outbox event begins processing | P95 < 10s |
| Duplicate-effect rate | 0 |
| Cross-tenant failures | 0 |

## Failure Modes

| Failure | Detection | Recovery |
|---------|-----------|----------|
| Worker crash | Stale lease > 60s | Auto-recovery on next poll |
| Provider timeout | `classifyFailure()` | Backoff + retry up to 3x |
| Duplicate event | `IdempotencyRecord` lookup | Return cached result |
| Outbox backlog | `/awl-health` | Manual replay or scale workers |
| Circuit open | `/awl-health` circuit.open=true | Auto-recovery after 30s |
| Cross-tenant access | `tenantId !== context.tenantId` | Reject with 403 |

## Next Steps

- [ ] Apply migration to staging
- [ ] Run integration tests
- [ ] Submit for G1 gate review
- [ ] Begin Phase 2 wire-up
