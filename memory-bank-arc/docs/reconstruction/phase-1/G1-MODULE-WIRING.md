# G1 Module Wiring Diagram

**Date:** 2026-07-26

## Application Module Graph

```
AppModule (src/app.module.ts)
│
├── ConfigurationModule (@Global) ─ env validation
│
├── CookieAuthModule ─ httpOnly JWT
├── TenantContextModule (@Global) ─ request context
│
├── ThrottlerModule ─ rate limiting
│
├── DatabaseModule (@Global) ─ Prisma
├── CacheModule (@Global) ─ Redis
├── SecurityModule (@Global) ─ secret management
│
├── IdempotencyModule (@Global) ─ event idempotency
├── CommandIdempotencyModule (@Global) ─ command idempotency  ← NEW
├── CommandModule (@Global) ─ command pattern  ← NEW
├── OutboxModule (@Global) ─ transactional outbox  ← NEW
├── LoggingModule (@Global) ─ correlation logger  ← NEW
├── CorrelationModule (@Global) ─ AsyncLocalStorage  ← NEW
├── TenantFlagsModule (@Global) ─ feature flags  ← NEW
│
├── AuthModule, TenantsModule, UsersModule
├── EventsModule
├── EnterpriseEventsModule (@Global) ─ event fabric
│
├── AgentsModule ─ AI agents
├── MemoryModule ─ agent memory
├── ToolsModule ─ built-in tools
├── OrchestrationModule ─ workflows/tasks
│
├── GovernanceModule, ApprovalPortModule
├── HermesModule ─ AI runtime
├── ContextPlaneModule (@Global)
├── WorkRuntimeModule ─ governed work
│
├── EnterpriseInitiationModule ─ canonical initiation  ← NEW
├── ProjectAutomationModule ─ durable automation
├── ExecutionModule ─ governed execution runtime  ← NEW
├── ReviewsModule ─ human review  ← NEW
├── AssignmentsModule ─ task-to-AI  ← NEW
├── TimelineModule ─ unified timeline  ← NEW
├── ObservabilityModule ─ metrics + AWL health  ← NEW
│
└── ... (other modules: Notifications, Departments, etc.)
```

## New Module Lifecycles

### EnterpriseInitiationModule

```typescript
@Module({ ... })
export class EnterpriseInitiationModule implements OnApplicationBootstrap {
  onApplicationBootstrap() {
    commandRegistry.register(
      createApproveInitiationDefinition(approveHandler.handle),
    );
    commandRegistry.register(
      createCreateProjectFromInitiationDefinition(createProjectHandler.handle),
    );
  }
}
```

### ProjectAutomationModule

```typescript
@Module({ ... })
export class ProjectAutomationModule implements OnApplicationBootstrap {
  onApplicationBootstrap() {
    outboxWorker.registerHandler(
      'ProjectAutomationRequested',
      (event) => handler.handleProjectAutomationRequested(event),
    );
  }
}
```

### ExecutionModule

```typescript
@Module({ ... })
export class ExecutionModule implements OnApplicationBootstrap {
  onApplicationBootstrap() {
    outboxWorker.registerHandler(
      'TaskExecutionRequested',
      (event) => executionWorker.handleTaskExecutionRequested(event),
    );
  }
}
```

## Service Dependencies

```
EnterpriseInitiationService
  ├─ CommandRegistry
  └─ TenantFlagsService

EnterpriseInitiationController
  ├─ EnterpriseInitiationService
  └─ CorrelationService

ApproveInitiationHandler
  ├─ PrismaService
  └─ OutboxService

ProjectAutomationHandler
  ├─ PrismaService
  ├─ OutboxService
  └─ TimelineService

ExecutionOrchestrator
  ├─ PrismaService
  └─ OutboxService

ExecutionWorker
  ├─ PrismaService
  └─ ExecutionOrchestrator

ReviewService
  ├─ PrismaService
  └─ OutboxService

AssignmentService
  ├─ PrismaService
  └─ OutboxService

TenantFlagsService
  └─ PrismaService

TimelineService
  └─ PrismaService

AwlHealthController
  ├─ OutboxService
  ├─ OutboxWorker
  └─ CommandRegistry
```

## Module Loading Order

NestJS resolves module dependencies in the following order:
1. Global modules (Database, Cache, Correlation, Command, Outbox, etc.)
2. Feature modules (EnterpriseInitiation, ProjectAutomation, etc.)
3. Controllers initialized after all providers
4. `OnApplicationBootstrap` hooks called

## Cross-Module Communication

| From | To | Mechanism |
|------|-----|-----------|
| Controller → Service | Service | Direct injection |
| Service → Command | `CommandRegistry.execute()` | Idempotent |
| Service → Outbox | `OutboxService.publish()` | Transactional |
| Worker → Service | `OutboxWorker.registerHandler()` | Event-driven |
| Worker → Outbox | `OutboxService.claimAvailable()` | Lease-based |

## Module Statistics

| Module | Providers | Controllers | Exports | Imports |
|--------|-----------|-------------|---------|---------|
| CorrelationModule | 1 | 0 | 1 | 0 |
| CommandModule | 1 | 0 | 1 | 1 |
| OutboxModule | 2 | 0 | 1 | 0 |
| LoggingModule | 1 | 0 | 1 | 0 |
| CommandIdempotencyModule | 1 | 0 | 1 | 0 |
| EnterpriseInitiationModule | 3 | 1 | 1 | 0 |
| ProjectAutomationModule | 2 | 1 | 1 | 0 |
| ExecutionModule | 2 | 1 | 1 | 0 |
| ReviewsModule | 1 | 1 | 1 | 0 |
| AssignmentsModule | 1 | 1 | 1 | 0 |
| TenantFlagsModule | 1 | 1 | 1 | 0 |
| TimelineModule | 1 | 1 | 1 | 0 |
| ObservabilityModule | 4 | 1 | 1 | 0 |
| **Total new** | **21** | **9** | **13** | **2** |
