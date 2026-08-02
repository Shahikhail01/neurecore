# Backend

> NeureCore NestJS 11 API. Last refreshed: 2026-07-31.

---

## 1. Stack at a glance

| Concern | Choice |
|---|---|
| Framework | NestJS 11 (`@nestjs/common`, `@nestjs/core`) |
| Runtime | Node.js 22 (matches `node-v22.12.0-linux-x64` on Contabo) |
| ORM | Prisma 5.22 with `@prisma/client` |
| Auth | JWT via `passport-jwt` + `passport-local`; **cookies are the only auth path in production** (Phase 9) |
| Realtime | Socket.IO 4.8 via `@nestjs/platform-socket.io` + `@nestjs/websockets` |
| AI | LangChain 0.3 + LangGraph 1.2 + OpenAI 4.77 |
| Cache | ioredis 5.9 + `@upstash/redis` 1.37 |
| Validation | `class-validator` + `class-transformer` (global `ValidationPipe`) |
| Logging | `pino` + `pino-http` (correlation-id aware) |
| Docs | `@nestjs/swagger` → `backend/openapi/openapi.json` |
| Tracing | OpenTelemetry Node SDK (`@opentelemetry/sdk-node`) |
| Tests | Jest 30 (`*.spec.ts` unit, `*.integration-spec.ts` e2e) |
| Rate limit | `@nestjs/throttler` 100 req / 60s per IP |
| Process mgr | PM2 (`ecosystem.config.js` — see `contabo-ops.md`) |

`backend/package.json:69-118` lists the full dep tree.

---

## 2. Bootstrap

Entry: `backend/src/main.ts`. Order of operations matters:

1. `initTracing()` — OpenTelemetry SDK initialised **before** Nest boots
   (`backend/src/main.ts:19`).
2. `NestFactory.create(AppModule, { bodyParser: false })` — auto body-parser
   disabled (FIX D12.2) so the explicit `json()` + `urlencoded()` middleware
   mount first. Without this, `req.body` is `undefined` in `forwardRef`'d
   modules (PackagesModule, DepartmentsModule) — see `fixes.md`.
3. `helmet()`, `compression()`, `pinoHttp()` — security + perf + access log.
4. `cookieParser()` — required by `CookieAuthService`.
5. `json({ limit: '2mb', verify })` and `urlencoded()` — also store
   `req.rawBody` for webhook HMAC verification.
6. Global prefix `/api` + URI versioning `/v1`.
7. CORS with **credentialed origin-echo** (`origin: true`-like callback that
   mirrors `Origin` only if in allow-list).
8. Global `ValidationPipe` (whitelist true, forbid false, transform true).
9. Static asset mount at `/cdn/` → `apps/cdn/uploads/`.
10. Swagger doc built + persisted to `backend/openapi/openapi.json`.
11. `app.getHttpAdapter()` adds `/api`, `/api/metrics` (Prometheus),
    `/api/health`, `/api/health/ready`, `/api/health/live`.
12. `app.listen(PORT, 3000)` — port overridable via `PORT` env.

---

## 3. AppModule wiring

`backend/src/app.module.ts:160-347` registers **~100 feature modules**. Notable ones:

### 3.1 Cross-cutting @Global modules
- `ConfigurationModule` — env validation at boot.
- `DatabaseModule` — PrismaClient singleton.
- `CacheModule` — ioredis + Upstash.
- `IdempotencyModule` — `idempotency_records` table wrapper.
- `CommandIdempotencyModule` — command-pattern idempotency wrapper.
- `PersistenceModule` — Prisma adapters bound to port interfaces (DDD).
- `CorrelationModule` — `AsyncLocalStorage` tenant + correlation context.
- `CommandModule` — `@Global` command bus + idempotency.
- `OutboxModule` — transactional outbox + `OutboxWorker` (boots from
  `AppModule.onApplicationBootstrap`, see `app.module.ts:404-412`).
- `LoggingModule` — correlation logger.
- `TenantContextModule` — `@Global` for `TenantContextService.tenantId`.
- `CookieAuthModule` — `@Global` cookie auth (Phase 9).
- `TenantFlagsModule` — `@Global` tenant-scoped feature flags.
- `AuditModule` — `@Global` `AuditService` for every mutating request.
- `SimulationVisibilityModule` — `@Global` default exclusion of simulation artifacts.

### 3.2 Global guards / interceptors / filter
`app.module.ts:348-373`:

| Type | Class |
|---|---|
| `APP_GUARD` | `ThrottlerGuard` (rate limit) |
| `APP_GUARD` | `JwtAuthGuard` (routes opt-out with `@Public()`) |
| `APP_GUARD` | `RolesGuard` |
| `APP_GUARD` | `TenantContextGuard` (sets ALS context after JWT) |
| `APP_FILTER` | `GlobalExceptionFilter` |
| `APP_INTERCEPTOR` | `TransformResponseInterceptor` (envelopes responses in `ApiResponse`) |
| `APP_INTERCEPTOR` | `AuditInterceptor` |
| `APP_INTERCEPTOR` | `IdempotencyInterceptor` |

CSRF is **not** a guard — it's a middleware (`CsrfProtectionMiddleware`)
mounted in `AppModule.configure()` at `*path` (`app.module.ts:387-388`).

### 3.3 Feature modules by area

- **Auth/identity:** `AuthModule`, `UsersModule`, `TenantsModule`, `ServiceIdentitiesModule`.
- **Work/runtime:** `ProjectsModule`, `TasksModule`, `GoalsModule`, `WorkflowsModule`,
  `RoutinesModule`, `ApprovalsModule`, `ReviewsModule`, `ExecutionModule`,
  `AssignmentsModule`, `ExecutionLogModule`, `ApprovalChainsModule`.
- **EAOS layers:** `EnterpriseInitiationModule`, `ContextPlaneModule`,
  `WorkRuntimeModule`, `EnterpriseCognitionModule`, `EnterpriseAutonomyModule`,
  `EnterpriseOperatingSystemModule`, `PlatformOperationsModule`,
  `EnterpriseIntelligenceNetworkModule`, `PlatformSDKModule`,
  `CloudPlatformModule`, `ApplicationFrameworkModule`,
  `EnterpriseAIGovernanceModule`, `PlatformEvolutionModule`,
  `EnterpriseEventsModule`, `ChiefOfStaffModule`, `DigitalTwinModule`.
- **Agents:** `AgentsModule`, `AgentsPoolModule`, `AgentTemplatesModule`,
  `MemoryModule`, `ToolsModule`, `OrchestrationModule`, `ModelsModule`,
  `AIGatewayModule`, `HermesModule`, `HermesAdapterModule`.
- **Domain packs:** `AccountingModule`, `FinanceModule`,
  `FinancialComplianceModule`, `ConnectorsModule`, `IntegrationsModule`,
  `RetailModule`, `HealthModule`, `ComplianceModule`.
- **Pools (admin composition):** `IndustriesModule`, `DepartmentsModule`,
  `DepartmentsPoolModule`, `DepartmentTemplatesModule`, `TiersModule`,
  `TenantTemplatesModule`, `PackagesModule`, `FeaturesModule`.
- **Onboarding:** `OnboardingModule`.
- **UX:** `ChatModule`, `MissionFeedModule`, `ActivityModule`, `ThreadsModule`,
  `AIActionsModule`, `InboxModule`, `WidgetsModule`, `SettingsModule`,
  `NotificationsModule`, `UploadsModule`, `KnowledgeModule`, `MarketplaceModule`,
  `SolutionPacksModule`, `CommandCenterModule`, `ContextModule`,
  `ProjectHealthModule`, `PortalModule`.
- **Cross-cutting:** `AnalyticsModule`, `AuditModule`, `ReliabilityModule`,
  `SecurityModule`, `ObservabilityModule`, `MetricsModule`,
  `FeatureFlagModule`, `CostsModule`, `ProjectDecisionsModule`,
  `ProjectMemoryModule`, `ProjectEventsModule`, `ProjectAutomationModule`,
  `ProjectStagesModule`, `ProjectMembersModule`, `ProjectTypesModule`,
  `CustomersModule`, `DeliverablesModule`, `TimelineEventsModule`,
  `DecisionEvaluationsModule`, `SimulationsModule`, `AdminModule`, `Phase8Module`.

---

## 4. Command + Outbox pattern (AWL)

This is the heart of Phase 1–10.

### 4.1 What it solves
- No aggregate mutation may run without producing its required outbox event.
- A failed transaction must create **neither** the aggregate **nor** the event.
- Idempotency: same `(idempotencyKey, tenantId)` may not run twice.

### 4.2 Where it lives
- `backend/src/common/commands/command.module.ts` — `CommandModule` (@Global).
- `backend/src/common/commands/command.ts` — base class with `execute()` and
  `dispatch()`.
- `backend/src/common/idempotency/command-idempotency.module.ts` — wrapper.
- `backend/src/common/outbox/outbox.module.ts` — outbox table + repository.
- `backend/src/common/outbox/outbox.worker.ts` — background worker.
- `backend/src/common/persistence/persistence.module.ts` — Prisma adapters bound
  to ports (hexagonal ports & adapters).

### 4.3 Boot sequence
`AppModule.onApplicationBootstrap()` (`app.module.ts:404-412`) calls
`outboxWorker.bootstrap()`. This was moved **out** of `onModuleInit` because
of a race: handlers register in `onModuleInit`, but the worker started in
`onModuleInit` could miss handlers that hadn't registered yet (FIX-OUTBOX-RACE).

### 4.4 Mandatory invariants (NC-AWL-IMP-1 §14.2)
Enforced by `src/test/certification/invariants/mandatory-invariants.spec.ts`
(10 invariants) and persistence-layer integration spec at
`src/test/integration/golden-path-invariants.integration.spec.ts`. See
`pending-tasks.md` for current status.

---

## 5. Tenancy model

- Every domain row carries `tenantId`.
- Tenant context flows via `TenantContextService` backed by
  `AsyncLocalStorage` (`CorrelationModule`).
- Set by `TenantContextGuard` (APP_GUARD, runs after `JwtAuthGuard`).
- Cross-tenant queries are rejected at the repository layer.

---

## 6. API surface

- Global prefix `/api`, default version `/v1`.
- OpenAPI 3.1 generated at boot and persisted to
  `backend/openapi/openapi.json` (`main.ts:207-223`).
- Swagger UI served at `/api/docs`.
- Servers declared: `http://localhost:3000/api/v1` and
  `https://brain.neurecore.com/api/v1`.
- Bearer auth (`JWT`), `X-Tenant-ID` (apiKey), `Idempotency-Key` (apiKey) are
  the three declared security schemes (`main.ts:186-204`).

Response envelope: every response goes through `TransformResponseInterceptor`
to `{ data, error, meta }` shape (`@/types/api.types` on FE).

---

## 7. Health, metrics, observability

- `/api/health` — liveness.
- `/api/health/ready`, `/api/health/live` — split for k8s-style probes.
- `/api/metrics` — Prometheus exposition via `MetricsService`.
- `/api/docs`, `/api/docs-json` — Swagger.
- `pino-http` access log with `X-Correlation-ID` (generated if absent).
- OpenTelemetry trace exporter (OTLP HTTP).
- Per-request `slow-request alarm` at >1500ms (`main.ts:65-72`).

---

## 8. Scripts (root `package.json`)

```bash
pnpm start:dev              # nest start --watch
pnpm start:prod             # node dist/src/main.js (NODE_ENV=production)
pnpm verify                 # tsc + eslint + jest --coverage + nest build
pnpm test                   # jest
pnpm test:unit              # *.spec.ts only
pnpm test:integration       # *.integration-spec.ts only
pnpm certify:phase9         # 105-scenario matrix
pnpm certify:phase9:all     # jest suite + runner + dashboard
pnpm certify:dashboard      # render HTML from JSON report
pnpm certify:sim04          # SIM-04 accounting walkthrough
pnpm inventory:templates    # template library inventory
pnpm phase4:activate-accounting-domain
pnpm seed:industry-templates:all
pnpm seed:accounting-agent-slugs
```

See `backend/scripts/` and `scripts/contabo/` for one-off operations.

---

## 9. Notable files

- `backend/src/main.ts` — bootstrap (see §2).
- `backend/src/app.module.ts` — module wiring (§3).
- `backend/src/common/auth/cookie-auth.service.ts` — cookie auth (§cookie
  auth in `auth.md`).
- `backend/src/common/auth/csrf.middleware.ts` — CSRF double-submit.
- `backend/src/modules/accounting/accounting.module.ts` — accounting
  capability gateway (`accounting-sidecar.md`).
- `backend/src/modules/hermes-adapter/hermes-adapter.module.ts` — Hermes
  scoped-token gateway (`hermes-tools.md`).
- `backend/src/common/outbox/outbox.worker.ts` — transactional outbox worker.
- `backend/src/infrastructure/database/prisma.service.ts` — PrismaClient
  lifecycle.
- `backend/src/common/guards/tenant-context.guard.ts` — ALS tenant context.
- `backend/prisma/schema.prisma` — 174 Prisma models (`databases.md`).

---

## 10. Common gotchas

- **`req.body` undefined in `forwardRef`'d modules** — keep `bodyParser: false`
  + explicit `json()` mount (FIX D12.2).
- **CSRF middleware** must run **before** JWT guard so unauthenticated mutating
  requests fail closed. Achieved by registering as middleware in
  `AppModule.configure()`, not as a guard.
- **OutboxWorker race** — never start it in `onModuleInit`; do it in
  `onApplicationBootstrap` after all handlers have registered.
- **Tenant context requires the guard, not middleware** — middleware runs
  before `req.user` is populated. The original `TenantContextMiddleware` was
  removed and replaced by `TenantContextGuard` (`app.module.ts:399-401`).
- **`/api` literal GET handler** — added via `app.getHttpAdapter().get()`
  since Nest controllers can't own `/api` itself (`main.ts:229-256`).

---

## 11. Source-of-truth pointers

- Architectural Constitution: `neurecore/memory-bank-arc/NeuroCore Architectural Constitution/`
- API contract: `EAOS-api-contract.md` (referenced by code; lives in
  `docs/` of memory-bank-arc).
- Roadmap / phased plans: `EAOS-implementation-roadmap.md` and the many
  `NC-*-IMP-*.md` plan files in memory-bank-arc.
- AGENTS.md at repo root has the Phase 9 certification guide.