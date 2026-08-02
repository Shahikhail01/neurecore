# Backend (NeureCore NestJS API)

**Last verified:** 2026-07-31 — FULL AUDIT COMPLETED

**⚠️ DEPLOYMENT DISCREPANCY:**
- **Local git HEAD:** `fe335abb` (Phase 9 G9 APPROVED, NC-AWL-IMP-2 closed)
- **Contabo deployed:** `ad73f3e6` (MISSING: Phase 9 G9, NC-AWL-IMP-2, SIM-04 fixes)
- **Production DB:** `neurecore_prod` on Contabo PostgreSQL (54 tenants, 63 users, 181 projects, 694 tasks, 175 tables)
- **AI Providers:** 2 active (Deepseek primary, MiniMax inactive)

**Live URL:** `https://brain.neurecore.com/api/v1/`
**Internal port:** 3003
**Repo:** `git@github.com:Shahikhail01/neurecore.git`
**Contabo deployed commit:** `ad73f3e6` (NOT fe335abb — deployment required)

---

## TL;DR

A NestJS 11 / Prisma 5 / PostgreSQL (Contabo) / Redis / Socket.IO monolith that serves the public API for both frontends and an internal AI agent runtime.
- **Local count:** 106 modules, 119 controllers, 250 services, 174 Prisma models, 69 interfaces, 2 gateways, 132 enums
- **Deployed count:** 175 DB tables (matches 174 Prisma models + _prisma_migrations)
- **Listens on:** `:3003` reverse-proxied by OLS at `brain.neurecore.com`
- **PM2 process:** `neurecore-backend` (pid 614404, uptime shows running)

> **Architecture:** 14-layer governed enterprise platform:
> P1 (EIE) → P2 (Event Fabric) → P3 (Context Plane) → P4 (Runtime) → P5 (Cognition) → P6 (Autonomy) → P7 (Enterprise OS) → P8 (Platform Operations) → P9 (Enterprise Intelligence) → P10 (Platform SDK) → P11 (Cloud Platform) → P12 (Application Framework) → P13 (AI Governance) → P14 (Platform Evolution)

> **2026-07-17 — All 14 Enterprise Integration Phases COMPLETE:**
> - **Phase 1 (EIE Runtime):** 66-statement SQL migration — 5 tables, 7 enums, 17 columns, 14 indexes, 2 triggers
> - **Phase 2 (Event Fabric):** `IdempotencyModule` (@Global), `SimulationVisibilityModule` (@Global), `TimelineEventsModule`, `DecisionEvaluationsModule`, `SimulationsModule`, `ServiceIdentitiesModule`, scoring v1, AgentInvocationsService
> - **Phase 3 (Org Context Plane):** AssembledContext from Context Plane; all capability queries tenant-scoped
> - **Phase 4 (Governed Work Runtime):** WorkRuntime + Workload + Task lifecycle; approval gating
> - **Phase 5 (Enterprise Cognition):** Cognize() with evidence/assumptions/confidence/trade-offs; Cortex integration
> - **Phase 6 (Enterprise Autonomy):** Mission orchestration; Health computation; Auto-correction
> - **Phase 7 (Enterprise OS):** Digital Twin (mirrors Context Plane + Autonomy state); Deterministic simulation; Forecasting; Optimization; Executive Advisor
> - **Phase 8 (Platform Operations):** Health Center (cross-layer assessment); Audit Center (tamper-evident SHA-256 export); Security Center; Diagnostics; Operational Readiness (105 modules)
> - **Phase 9 (Enterprise Intelligence):** Knowledge Graph (Entity Resolution, Relationship Engine, Semantic Search); Knowledge Reasoner via Cognition; Ontology (8 entity kinds, 4 relationship kinds)
> - **Phase 10 (Platform SDK):** Six Pools (Agents/Departments/Industries/Tiers/Features/Packages); Plugin registry lifecycle; Permission manager; WorkRuntimeEventsConsumer
> - **Phase 11 (Cloud Platform):** Multi-cloud abstraction (CloudCluster, CloudProvider, CloudRegion, FailoverPolicy, CostAllocation); CloudHealthMonitor
> - **Phase 12 (Application Framework):** App registry (Draft→Active→Deprecated→Retired); `IEnterpriseEventTransport` event emissions on all write operations
> - **Phase 13 (AI Governance):** Evaluate outputs; Flag hallucinations; Record biases; Create policies; Decide reviews; `IEnterpriseEventTransport` event emissions
> - **Phase 14 (Platform Evolution):** Technology Radar; Benchmark; Experiment lifecycle; Feature lifecycle; Capability versioning (11 domains); Migration planning; `IEnterpriseEventTransport` event emissions
> - **Simulation-5 AEIC:** 83/100 (B+, Production Ready) — 85 decisions, 20 AI debates, 9 board meetings, 28 reality events, 60 Devil's Advocate challenges
> - Full details: [backend.md §18](backend.md#18-enterprise-integration-phases-714)

> **2026-07-11 22:55 PKT — Comms pre-rollout engineering (Kilo):** 6 Prisma migrations created + marked as applied (47 total, DB up to date). WS security hardened in EventsGateway (thread:join/thread:leave now verify tenant + participant membership). A2A flag ambiguity resolved (guard checks AGENT_MESSAGING_ENABLED || COMM_AGENT_MESSAGING_ENABLED). tsc --noEmit → 0 errors, nest build → clean. See comms/comms-rollout.md §14.
>
> **2026-07-08 13:35 PKT — Enterprise Communication Platform Phases 1-9 IMPLEMENTED + AUDIT-PASSED (rev 2 + rev 3) locally (NOT YET DEPLOYED, see [`enterprise-comms-chat.md`](enterprise-comms-chat.md)):** local Prisma models **+8** (CommunicationThread, ThreadParticipant, ThreadReadState, ActivityEvent, AdapterCursor, WorkflowTemplate, NotificationPreference, RetentionPolicy → 83 total local models). Local `HermesModule` providers **+20** (ThreadService, ActivityService, EnterpriseEventBusService, ParticipantResolver, AgentMessagingService, AgentMessagingGuard, PresenceService, ConversationIntelligenceService, EntityGraphService, DependencyGraphService, ThreadSummarizationService, DigestService, EntityHealthRollupService, CostCenterService, RiskDetectionService, EscalationService, FollowUpService, WorkflowTemplateService, NotificationPreferenceService, RetentionJobService → 139 total local services). Local controllers **+4** (ActivityController, ExplainabilityController, ComplianceController, ThreadsController → 61 total local controllers). Local modules **+2** (ActivityModule, ThreadsModule → 57 total local modules). **Legacy `HermesEventBusService` deleted**; `HermesRuntimeService` now injects `IHermesEventBus` interface via `@Inject(HERMES_EVENT_BUS)` (rev-3 fix). **Rev-3 also added:** 6 `useExisting` symbol aliases for interface-based DI (THREAD_SERVICE, HERMES_EVENT_BUS, ACTIVITY_SERVICE, HERMES_RUNTIME, AGENT_MESSAGING_GUARD, PARTICIPANT_RESOLVER); `EventsModule` imported by `HermesModule`; new `thread:join`/`thread:leave` WS handlers in `EventsGateway`; `ActivityService.list()` supports `since` query param; `useActivityFeed` backfill uses `since:lastId` instead of broken `before:undefined`. 3 orphan test specs deleted. All additive; zero prod impact until `COMM_*` / `AGENT_MESSAGING_ENABLED` flags flipped.

(Verified at end of work: `find modules -mindepth 1 -maxdepth 1 -type d | wc -l` → **57** modules, `find . -name '*.controller.ts' | wc -l` → **61** controllers, `find . -name '*.service.ts' | wc -l` → **139** services, `grep -c '^model ' schema.prisma` → **83** Prisma models, `find . -name '*.interface.ts' | wc -l` → **32** interfaces.)

---

## 1. Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | NestJS | 11 | Express adapter (default) |
| Language | TypeScript | 5.x | `strict: true` |
| Runtime | Node.js | 20.20.2 | installed at `/root/.nvm/versions/node/v20.20.2/` |
| ORM | Prisma | 5.22.0 | PostgreSQL provider |
| Database | PostgreSQL (Contabo) | 16 | local |
| Cache | Redis (host) | 7.x | `127.0.0.1:6379` (no auth) |
| WebSocket | Socket.IO | 4.x | via `events.gateway` |
| LLM | OpenAI / DeepSeek / Anthropic | — | selected via `LLM_PROVIDER` env |
| Auth | JWT (HS256 or RS256) | — | access + refresh tokens |
| Validation | class-validator / class-transformer | — | DTO-based |
| Logger | Pino | — | structured JSON to stdout |
| Metrics | prom-client | — | `/health/metrics` |
| Tests | Jest + Supertest | — | 0 unit specs (technical debt — see [future-plans.md §3.4](future-plans.md)) |

---

## 2. Process / deploy

| Item | Value |
|---|---|
| PM2 process | `neurecore-backend` (id 37) |
| Startup | `node ./dist/src/main.js` |
| Source | `/opt/neurecore/backend/backend/` |
| Build output | `/opt/neurecore/backend/backend/dist/` |
| Env file | `/opt/neurecore/backend/backend/.env` (112 keys — never rsync from local) |
| Build command | `./node_modules/.bin/nest build` |
| Migration | `./node_modules/.bin/prisma migrate deploy` |
| Prisma client | `./node_modules/.bin/prisma generate` (before build!) |

Rebuild: `bash /opt/neurecore/rebuild.sh backend` — see [deployment.md §1](deployment.md).

---

## 3. Module map (104 modules total — see §13 for prod drift)

```
src/modules/
├── agents/                  # AI agent runtime + streaming + deployment
│   ├── agents.controller.ts
│   ├── agent-streaming.controller.ts
│   ├── deployment.controller.ts
│   └── services/            # 9 services (LLM, prompts, scheduling, etc.)
├── agents-pool/             # Phase 10 Pool #1 — new clean surface for AgentTemplate
│   ├── agents-pool.controller.ts   # + PATCH /:id/enabled, POST /:id/duplicate
│   ├── agents-pool.service.ts      # extends abstract PoolService + toggleEnabled + duplicate
│   └── dto/{create,update}-agents-pool.dto.ts
├── agent-templates/         # Reusable agent blueprints (legacy service — still available)
├── ai-gateway/              # AI Gateway v2 — sole LLM entry point (AiGatewayService), DB-backed catalog, circuit-breaker failover, cost attribution, admin CRUD controllers, transport, SSE parser
├── analytics/               # Usage metrics + reporting
├── application-framework/    # Phase 12 — App registry: register, activate, deprecate, retire + event emissions
├── audit/                   # Append-only audit log (global @Audit interceptor)
├── auth/                    # JWT login/refresh, Google OAuth, password reset
├── chat/                    # AI chat sessions
├── cloud-platform/          # Phase 11 — Multi-cloud abstraction: CloudCluster, CloudProvider, CloudRegion, FailoverPolicy, CostAllocation
├── command-center/          # Aggregated dashboard data
├── connectors/              # External integrations (HubSpot, Brevo, Mailgun)
│   └── sync-scheduler.service.ts   # cron-style background sync
├── costs/                   # Per-agent cost tracking + budgets
├── department-templates/    # Reusable department blueprints (legacy service — still available)
├── departments/             # Tenant org chart
├── departments-pool/        # Phase 10 Pool #2 — clean surface; hides category='legacy-tier' rows
│   ├── departments-pool.controller.ts
│   ├── departments-pool.service.ts  # extends abstract PoolService
│   └── dto/{create,update}-department-pool.dto.ts
├── enterprise-intelligence/  # Phase 9 — Knowledge Graph, RelationshipEngine, SemanticSearch, Ontology
├── enterprise-operating-system/ # Phase 7 — Digital Twin, Simulation, Forecasting, Optimization, Executive Advisor
├── events/                  # Event bus (also exposes Socket.IO gateway)
├── features/                # Phase 10 Pool #5 — atomic platform capabilities
│   ├── features.controller.ts       # unique key (slug-style: "ms365_integration")
│   ├── features.service.ts          # extends abstract PoolService
│   └── dto/{create,update}-feature.dto.ts
├── finance/                 # Invoices, expenses, billing events
├── goals/                   # OKR tracking
├── governance/              # Approval rules + policies
├── health/                  # /health/* (liveness, readiness, metrics, circuit-breakers)
├── hermes/                  # Hermes Layer — unified AI agent runtime orchestrator
│   ├── services/            # registry, runtime, tool-gateway, session, memory, context, event-bus
│   ├── langgraph/           # hermes-node, hermes-router, hermes-checkpointer
│   ├── interfaces/          # 6 ISP interfaces (runtime, registry, session, context, tool-gateway, event-bus)
│   └── guards/              # HermesTenantGuard
├── inbox/                   # Unified inbox
├── industry/                # Phase 10 Pool #3 — top-level business categorisation
│   ├── industries.controller.ts         # unique slug
│   ├── industries.service.ts            # extends abstract PoolService
│   └── dto/{create,update}-industry.dto.ts
├── memory/                  # Agent memory (vector + structured)
├── mission-feed/            # Dashboard-prioritized items (MissionFeedItem + AIActionInvocation)
├── models/                  # LLM model registry
├── notifications/           # Multi-channel notifications
├── observability/           # Internal traces + spans
├── onboarding/              # WS-2 wizard + WS-2.1 progressive checklist sub-module
│   └── checklist/           # OnboardingChecklistModule (11 wizards, MissionFeed sync, audit)
├── orchestration/           # Multi-agent workflows
├── packages/                # Phase 10 Pool #6 — composite root
│   ├── packages.controller.ts            # + PATCH /:id/composition + POST /preview
│   ├── packages.service.ts               # extends base pattern + atomic M2M replace + dry-run preview
│   └── dto/{create,update}-package.dto.ts + package-composition.dto.ts
├── platform-evolution/      # Phase 14 — Technology Radar, Benchmark, Experiment, Feature Lifecycle, Migration Planning
├── platform-operations/     # Phase 8 — Health Center, Audit Center, Security Center, Diagnostics, Readiness
├── projects/                # Cross-functional initiatives
├── reliability/             # Quota guard, rate limiting, circuit breakers
├── retail/                  # (placeholder for future)
├── routines/                # Scheduled automations (triggers, runs)
├── security/                # Roles + permissions + throttler guards
├── settings/                # Per-tenant settings
├── solution-packs/          # Vertical solution packs
├── tenants/                 # Multi-tenancy root (+ PATCH /tenants/me)
├── tier-templates/          # Phase 10 Pool #4 — commercial offering tier (distinct from billing Tier)
│   ├── tier-templates.controller.ts
│   ├── tier-templates.service.ts        # extends abstract PoolService
│   └── dto/{create,update}-tier-template.dto.ts
├── tiers/                   # Subscription tier + tier-agent-pool (billing Tier — kept)
├── tools/                   # 50+ structured tools (registered via setTools() at boot)
├── uploads/                 # WS-2.1 — Tenant logos (IUploadStorage DIP, LocalDiskStorage, /cdn static)
└── users/                   # User CRUD + sessions

# Simulation-5 modules (Phase 1–2)
src/simulations/             # Simulation lifecycle + day-runner (SimulationsService, SimulationsDayRunner, SimulationsController)
src/modules/timeline-events/  # First-class event log (TimelineEventsService) — status transition matrix
src/modules/decision-evaluations/  # Immutable scores snapshot (DecisionEvaluationsService)
src/modules/service-identities/  # Workload identity + scoped tokens (ServiceIdentitiesService)
src/modules/agents/         # AgentInvocationsController — structured output + bounded repair pass
src/scoring/v1/             # Deterministic scoring: pure-function computeOrganizationalIntelligence(), no Math.random
src/common/idempotency/     # @Global reusable idempotency: hash, IN_FLIGHT/COMPLETED/FAILED state machine
src/common/simulation/      # @Global SimulationVisibilityService — default exclusion filters
```

Cross-cutting:
```
src/common/
├── decorators/   # @Roles, @CurrentUser, @Audit
├── filters/      # GlobalExceptionFilter
├── interceptors/ # TransformResponseInterceptor, AuditInterceptor (global)
├── guards/       # (most guards live in module folders)
└── pool/         # Phase 10 — abstract PoolService + PoolController (DIP primitives)
    ├── pool.types.ts
    ├── pool.service.ts
    └── pool.controller.ts
```

---

## 4. REST surface

32 controllers under `/api/v1/` (prod count). Major routes:

| Module | Path | Auth |
|---|---|---|
| Health | `GET /health`, `/health/detailed`, `/health/ready`, `/health/live`, `/health/system`, `/health/circuit-breakers`, `/health/metrics` (Prometheus) | Public |
| Hermes | `POST /hermes/execute`, `GET /hermes/sessions`, `GET /hermes/sessions/:id`, `GET /hermes/agents/:type/tools` | JWT |
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/register`, `POST /auth/google`, `/auth/forgot-password`, `/auth/reset-password` | Mixed |
| Agents | `GET /agents`, `POST /agents`, `GET /agents/:id`, `POST /agents/:id/execute`, `POST /agents/:id/stream` (SSE), `/agents/orchestration` | JWT + Roles |
| Agent Templates (legacy) | `GET/POST/PATCH/DELETE /agent-templates/platform` | JWT + Roles |
| **Phase 10 — AI Employees Pool (#1)** | `GET/POST/PATCH/DELETE /agents-pool`, `PATCH /agents-pool/:id/enabled`, `POST /agents-pool/:id/duplicate` | Admin |

> **Pool data:** `seed-agency-agents.cjs` seeds **706 public AgentTemplates** (isPublic=true, tenantId=null) from `agency-agents-main/` pool + **57 public DepartmentTemplates**. Re-run idempotently to sync updates.
| Department Templates (legacy) | `GET/POST/PATCH/DELETE /department-templates` | JWT + Roles |
| **Phase 10 — Departments Pool (#2)** | `GET/POST/PATCH/DELETE /departments-pool` (hides `legacy-tier` rows) | Admin |
| **Phase 10 — Industries Pool (#3)** | `GET/POST/PATCH/DELETE /industries`, `GET /industries/by-slug/:slug` | Admin |

> **Industry taxonomy:** `prisma/seed-industries-majors.cjs` populates the canonical 16-major pool (sub-industries packed into `Industry.description`). History: 8 (Phase 10) → 30 (compact interim, superseded) → **15 (canonical)** → **16 (after `add-industry-accounting.cjs` added Accounting & Audit Services, 2026-07-05)**. See [`pools-taxonomy.md` §3](pools-taxonomy.md) for the full taxonomy + migration history. Idempotent; supports `--check` for diff-only preview; refuses to run if any `Package.industryId` row exists. The accounting-major add is additive-only (no `deleteMany`).
| **Phase 10 — Tier Templates Pool (#4)** | `GET/POST/PATCH/DELETE /tier-templates`, `GET /tier-templates/by-slug/:slug` | Admin |
| **Phase 10 — Features Pool (#5)** | `GET/POST/PATCH/DELETE /features`, `GET /features/by-slug/:key` | Admin |
| **Phase 10 — Packages Pool (#6)** | `GET /packages`, `GET /packages/:id`, `GET /packages/by-slug/:slug`, `POST /packages`, `PATCH /packages/:id`, `PATCH /packages/:id/composition` (atomic M2M replace), `POST /packages/preview` (dry-run), `DELETE /packages/:id` | Admin |

> **Master Package Pool:** `prisma/seed-package-catalogue.cjs` ships **68 empty `Package` rows** (DRAFT, version=1, no composition) anchored across 16 industries × 4 tiers. **15 packages with full composition** (Departments + AI Agents + Features) are seeded by `seed-accounting-packages.cjs` for Major #16 (`accounting-audit-services`). The remaining 53 empty packages follow the same per-Major seeder pattern. See [`pools-taxonomy.md` §6](pools-taxonomy.md) + §6.5 for the Accounting composition reference. Schema: enum `PackageScope { FUNCTIONAL | VERTICAL | HYBRID }`, columns `Package.scope` + `Package.version` (migration `20260705_package_catalogue`).
| Tenants | `/tenants`, `/tenants/:id`, `/tenants/:id/metrics`, `/tenants/:id/limits`, `GET /tenants/me/current`, `PATCH /tenants/me` (WS-2.1 owner-scoped) | JWT + Roles |
| Users | `/users`, `/users/:id`, `/users/me` | JWT |
| Departments (tenant org chart) | `/departments`, `/departments/:id/context`, `/departments/:id/roster` | JWT |
| Approvals (governance) | `/governance/approvals`, `POST /governance/approvals/:id/{approve,reject}` | JWT |
| Audit | `/audit-logs`, `/audit-logs/tenant`, `/audit-logs/agent/:agentId` | JWT + Roles |
| Command Center | `/command-center/timeline`, `/command-center/dashboard` | JWT |
| Connectors | `/connectors`, `/connectors/:id/sync` | JWT |
| Finance | `/finance/invoices`, `/finance/expenses`, `/finance/billing-events` | JWT |
| Routines | `/routines`, `/routines/:id/triggers`, `/routines/:id/runs` | JWT |
| Memory | `/memory/entries`, `/memory/search` | JWT |
| Mission Feed | `/mission-feed`, `POST /mission-feed/:itemId/dismiss` | JWT |
| Notifications | `/notifications`, `POST /notifications/mark-read` | JWT |
| Models | `/models` (LLM registry) | JWT |
| Tools | `/tools`, `/tools/:id/execute` | JWT |
| Orchestration | `/orchestration/workflows`, `/orchestration/execute` | JWT |
| Onboarding (WS-2) | `/onboarding/state`, `/onboarding/select-tier`, `/onboarding/select-template`, `/onboarding/invite`, `/onboarding/complete`, `/onboarding/accept-invite/:token` | JWT (own tenant) |
| Onboarding Checklist (WS-2.1) | `GET /onboarding/checklist`, `POST /onboarding/checklist/:slug/{save,complete,skip,dismiss}`, `POST /onboarding/checklist/dismiss-all` | JWT + OWNER/ADMIN |
| Goals | `/goals`, `/goals/:id/checkins` | JWT |
| Projects | `/projects`, `/projects/:id` | JWT |
| Settings | `/settings` | JWT |
| Tiers | `/tiers`, `/tiers/agent-pool` | Admin |
| Inbox | `/inbox` | JWT |
| Costs | `/costs`, `/costs/budgets` | JWT |
| Analytics | `/analytics/usage`, `/analytics/reports` | JWT |
| Observability | `/observability/traces` | Admin |
| Reliability | `/reliability/quotas`, `/reliability/circuit-breakers` | Admin |
| Security | `/security/audit`, `/security/keys` | Admin |
| Streaming | SSE endpoint per agent | JWT |
| Uploads (WS-2.1) | `POST /uploads/logo` (multipart), `DELETE /uploads/logo/:key`; **static `GET /cdn/*` (public)** | JWT + OWNER/ADMIN (uploads); public (cdn read) |
| **Simulation-5** | `POST/GET /simulations`, `GET /simulations/:id`, `POST /simulations/:id/days/:day/run` | JWT + Roles/SvcIdentity |
| **ServiceIdentities** | `POST/GET /service-identities`, `POST /service-identities/:id/tokens`, `POST /service-identities/:id/revoke` | JWT + Roles |
| **AgentInvocations** | `POST /agents/:id/invocations` (structured output + repair pass) | JWT |
| **Phase 7 — Enterprise OS** | `/enterprise-os/cockpit`, `/enterprise-os/twin`, `/enterprise-os/simulate`, `/enterprise-os/forecast`, `/enterprise-os/optimize`, `/enterprise-os/performance`, `/enterprise-os/resilience`, `/enterprise-os/analytics`, `/enterprise-os/resource`, `/enterprise-os/strategy` | JWT |
| **Phase 8 — Platform Operations** | `/platform-ops/health`, `/platform-ops/audit`, `/platform-ops/security`, `/platform-ops/diagnostics`, `/platform-ops/readiness`, `/platform-ops/deployment`, `/platform-ops/backup` | JWT |
| **Phase 9 — Enterprise Intelligence** | `/intelligence/graph`, `/intelligence/entities`, `/intelligence/relationships`, `/intelligence/search`, `/intelligence/reason`, `/intelligence/governance`, `/intelligence/ontology` | JWT |
| **Phase 11 — Cloud Platform** | `/cloud/clusters`, `/cloud/providers`, `/cloud/regions`, `/cloud/failover-policies`, `/cloud/cost-allocation`, `/cloud/health` | JWT |
| **Phase 12 — Application Framework** | `/applications`, `POST /applications`, `PATCH /applications/:id/activate`, `PATCH /applications/:id/deprecate`, `PATCH /applications/:id/retire` | JWT |
| **Phase 13 — AI Governance** | `/governance/evaluate`, `/governance/hallucination`, `/governance/bias`, `/governance/policies`, `/governance/reviews` | JWT |
| **Phase 14 — Platform Evolution** | `/evolution/radar`, `/evolution/benchmarks`, `/evolution/experiments`, `/evolution/features`, `/evolution/capabilities`, `/evolution/migrations`, `/evolution/dashboard` | JWT |

Global response shape (via `TransformResponseInterceptor`):
```json
{ "status": "success", "data": { ... }, "meta": { "timestamp": "...", "correlationId": "..." } }
```

Errors (via `GlobalExceptionFilter`):
```json
{ "status": "error", "error": { "code": "...", "message": "...", "details": {...} }, "meta": {...} }
```

---

## 5. Auth & RBAC

- **JWT** access (15 min default) + refresh (7 days default). Tokens signed by `JWT_SECRET` (HS256 by default; can be RS256 via `JWT_ALGORITHM`).
- **Roles** (Prisma enum `UserRole`): `SUPER_ADMIN`, `PLATFORM_ADMIN`, `SECURITY_OFFICER`, `AUDITOR`, `TENANT_ADMIN`, `DEPT_ADMIN`, `AGENT_MANAGER`, `MEMBER`, `GUEST`.
- **Guards** (in `src/modules/auth/guards/` and `src/modules/security/guards/`):
  - `JwtAuthGuard` — global via `APP_GUARD`; routes marked `@Public()` opt out.
  - `RolesGuard` — enforces `@Roles(...)` decorator.
  - `PermissionsGuard` — fine-grained `@Permissions('agent:execute')` etc.
  - `ThrottlerGuard` — global rate limit (configurable via `THROTTLE_*` env).
  - `QuotaGuard` (Reliability module) — per-tenant quota enforcement.
- **Multi-tenancy**: every request resolves `tenantId` from JWT; controllers use `@CurrentUser()` to scope queries.

---

## 6. Database

| Item | Value |
|---|---|
| Provider | Contabo Local PostgreSQL 16 (VM-hosted) |
| Host | `127.0.0.1` |
| Port | `5433` |
| Database | `neurecore`, schema `public` |
| User | `neurecore_app` (password: `NeureCoreDB123`) |
| SSL | Disabled (local connection) |
| Extensions | `plpgsql`, `vector` (pgvector) |
| Schema sync | `prisma db push --accept-data-loss` (2026-07-20) |
| Migrations location | `/opt/neurecore/backend/backend/prisma/migrations/` |
| **Migration note** | Migration files have ordering bugs (duplicate CREATE TABLE). Use `prisma db push` instead of `prisma migrate deploy` for schema sync. |

**~174 Prisma models** (groups):
- Identity: `User`, `Session`, `RefreshToken`, `OAuthToken`, `ApiKey`, `AuditLog`
- Tenancy: `Tenant`, `Tier` (billing), **`TierTemplate`** (Phase 10 Pool #4), `TierAgentPool`, `TenantLimit`, `TenantMetric`, `QuotaUsage`, `BillingEvent`, `Invoice`, `Expense`, `BudgetPolicy`, `BudgetIncident`, **`OnboardingChecklistEntry`** (WS-2.1)
- Org: `Department`, `DepartmentTemplate`, `Agent`, `AgentTemplate` (+`enabled`), `Task`, `Workflow`, `GovernanceRule`, `ApprovalRequest`
- Runtime: `MemoryEntry`, `ToolIntegration`, `ExecutionLog`, `Routine`, `RoutineTrigger`, `RoutineRun`, `CostRecord`, `Goal`, `Project`, `Notification`, `MissionFeedItem`, `AIActionInvocation`
- Analytics: `AnalyticsModel`, `AnalyticsFeature`, `CrmConnector`
- **Phase 10 — Business Composition (six pools):**
  - `Industry` — top-level business categorisation (Pool #3)
  - `Feature` — atomic platform capabilities (Pool #5)
  - `Package` — composite root (Pool #6: industry + tier + M2M departments/agents/features)
- **Phase 11 — Cloud Platform:**
  - `CloudProvider`, `CloudRegion`, `CloudCluster`, `FailoverPolicy`, `CostAllocation`, `CloudHealthEvent`
- **Phase 12 — Application Framework:**
  - `Application` — tenant-deployable software units (Draft→Active→Deprecated→Retired)
- **Phase 14 — Platform Evolution:**
  - `TechnologyRadarEntry`, `BenchmarkRecord`, `Experiment`, `FeatureLifecycle`, `CapabilityVersion`, `MigrationPlan`
- **Simulation-5 (Phase 1):**
  - **`TimelineEvent`** — first-class event log
  - **`IdempotencyRecord`** — replay protection (IN_FLIGHT/COMPLETED/FAILED state machine)
  - **`DecisionEvaluation`** — immutable scores snapshot (BEFORE UPDATE trigger)
  - **`ServiceIdentity`** — workload identity; bearer tokens hashed SHA-256
  - **`ServiceToken`** — short-lived tokens with expiry

**WS-2.1 additive columns on Tenant:** `locale`, `timezone`, `currency`, `dateFormat`, `timeFormat`, `fiscalYearStart`, `sizeBucket` (TenantSizeBucket enum), `foundedYear`, `businessType`, `phone`, `supportEmail`, `addressJson`, `billingProfileJson`, `defaultsJson`, `checklistDismissedAt`.
**WS-2.1 additive columns on User:** `phone`, `jobTitle`, `timezone`, `locale`, `language`, `theme`, `defaultLanding`, `railCollapsedDefault`, `notificationPrefsJson`.

See `prisma/schema.prisma` for full definitions.

---

## 7. Env vars (112 keys, grouped)

| Group | Example keys |
|---|---|
| **Database** | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_POOL_SIZE`, `DATABASE_STATEMENT_TIMEOUT`, `DATABASE_CONNECTION_TIMEOUT` |
| **Redis** | `REDIS_URL`, `CACHE_TTL_DEFAULT`, `CACHE_TTL_SHORT`, `CACHE_TTL_LONG` |
| **Server** | `BACKEND_PORT`, `API_PREFIX`, `LOG_LEVEL`, `LOG_FORMAT`, `LOG_PRETTY_PRINT`, `HELMET_ENABLED`, `CSRF_ENABLED` |
| **CORS** | `CORS_ENABLED`, `CORS_ORIGINS`, `CORS_CREDENTIALS`, `CORS_METHODS`, `CORS_HEADERS`, `ADDITIONAL_CORS_ORIGINS` |
| **JWT** | `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`, `JWT_AUDIENCE`, `JWT_ISSUER` |
| **LLM** | `LLM_PROVIDER`, `DEFAULT_MODEL`, `DEFAULT_MAX_TOKENS`, `DEFAULT_TEMPERATURE`, `AI_FUNCTION_CALLING_ENABLED`, `AI_STREAMING_ENABLED`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY` |
| **Google OAuth** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| **Email** | `EMAIL_PROVIDER`, `EMAIL_FROM_NAME`, `BREVO_API_KEY`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` |
| **AWS** | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` |
| **Connectors** | `HUBSPOT_ACCESS_TOKEN`, `STRIPE_SECRET_KEY`, `SLACK_BOT_TOKEN` |
| **Frontends** | `FRONTEND_BASE_URL`, `ADMIN_FRONTEND_URL` |
| **API** | `API_KEY_HEADER`, `RATE_LIMIT_DEFAULT`, `THROTTLE_TTL`, `THROTTLE_LIMIT` |
| **Uploads** | `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES`, `UPLOAD_DESTINATION` |
| **Observability** | `ANALYTICS_WRITE_KEY`, `SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT` |
| **Feature flags** | `HERMES_ENABLED`, `HERMES_AUTO_LINK`, `HERMES_APPROVAL_REQUIRED`, `HERMES_SESSION_LOGGING`, `DISABLE_AI_ACTIONS`

Full list: `cat /opt/neurecore/backend/backend/.env | grep -oE "^[A-Z_]+=" | sort -u`.

**Secrets that must NEVER be in source:** `JWT_SECRET` (32+ chars), `OPENAI_API_KEY`, `DATABASE_URL`, `GOOGLE_CLIENT_SECRET`, `AWS_*`, `BREVO_API_KEY`, `MAILGUN_API_KEY`, `HUBSPOT_ACCESS_TOKEN`, `STRIPE_SECRET_KEY`, `SLACK_BOT_TOKEN`.

---

## 8. Background work & queues

- **Connectors sync scheduler** (`src/modules/connectors/services/sync-scheduler.service.ts`) — cron-style sync for HubSpot etc. Logs "0 succeeded, 0 failed" every 15 min when nothing to sync.
- **Routine triggers** — DB-backed cron; `RoutineTrigger` model defines schedules; `RoutineRun` records executions.
- **Goals checkins** — periodic reminder worker.
- **Quotas** — `QuotaGuard` runs synchronously in request path; no background reconciliation yet.

No external queue (Redis BullMQ etc.) is used — all background work is in-process `setInterval` or DB-polling.

---

## 9. Real-time (WebSocket)

- **Gateway**: `src/modules/events/events.gateway.ts` (Socket.IO 4)
- **Namespace**: `/events`
- **Auth**: JWT in `auth` payload at handshake
- **Events emitted**: `agent.execution.started`, `agent.execution.progress`, `agent.execution.completed`, `routine.triggered`, `notification.created`, `inbox.message`
- **Tenant scoping**: every emitted event includes `tenantId`; client filters locally.

Frontend connection URL: `wss://brain.neurecore.com` (configured via `NEXT_PUBLIC_WS_URL`).

---

## 10. Observability

- **Prometheus metrics**: `GET /health/metrics` — `prom-client` default registry + custom counters for HTTP requests, agent executions, LLM tokens, costs.
- **Scraped** by `neurecore-prometheus` (container) every 15s.
- **Health**: `/health` (shallow), `/health/ready` (DB+Redis), `/health/live` (uptime), `/health/detailed`, `/health/system` (CPU/RAM/disk).
- **Circuit breakers**: `/health/circuit-breakers` (state), `POST /health/circuit-breakers/reset`.
- **Structured logs**: JSON via Pino. Log level controlled by `LOG_LEVEL`. `LOG_PRETTY_PRINT=true` for dev.
- **Correlation ID**: every request gets `x-correlation-id` (request header or generated); logged with each line; returned in response `meta.correlationId`.

---

## 11. Tests

| Item | Status |
|---|---|
| Unit tests (`.spec.ts` in `src/`) | **Phase 10:** 6 files (36 tests). **Phase 11:** cloud-platform in-memory + db specs. **Phase 12:** application-framework in-memory + db specs. **Phase 13:** ai-governance in-memory + db specs. **Phase 14:** platform-evolution in-memory + db specs. **Phase 9:** relationship-engine + knowledge-graph specs. **Pre-existing fixes:** analytics, hermes-router-node, cookie-auth, connectors, hermes-context, hermes-runtime, token service specs rewritten to match actual service surfaces. Total: ~1300+ tests passing. |
| E2E tests (`test/e2e/`) | 17 files; runner: `jest --config test/jest-e2e.json` |
| Jest config | `jest.config.js`, `test/jest-e2e.json` |
| Coverage | `jest --coverage` (no coverage threshold enforced) |
| Mocks | `test/mocks/` |

Commands:
```bash
npm run test            # unit
npm run test:e2e        # e2e
npm run test:cov        # with coverage
```

---

## 12. Local dev

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend
nvm use 20
npm install
cp .env.example .env  # edit values
npm run prisma:generate
npm run start:dev     # ts-node + watch mode on port 3000 by default
```

Note: local dev uses `:3000`, not `:3003`. CORS proxy on Contabo (`127.0.0.1:3004`) accepts `http://localhost:3000` via the updated `ALLOWED_ORIGINS`.

---

## 13. Known issues & gaps

1. **Phase 14 deployment** — source code complete and valid. Deployment blocked by Contabo pnpm/Prisma environment corruption (resolved during Phase 14 session). Requires clean deploy following Phase 13 recovery pattern: schema sync → `pnpm install` → `prisma generate` → `nest build` → `pm2 reload`.
2. **No Sentry or APM** — only Prometheus metrics. Production errors rely on `pm2 logs`. See [future-plans.md §3.1](future-plans.md).
3. **Local dev uses port 3000** but production uses 3003 — easy confusion. Be explicit when talking about either.
4. **Static asset root `apps/cdn/uploads/` must exist on Contabo and be readable by PM2's user.** First logo upload after deploy will create the directory; if permissions block it, deployments need `chown neurecore:neurecore apps/cdn -R` once.
5. **Hermes module exists but is gated behind `HERMES_ENABLED=false`** by default. When enabled, all agent execution routes through `HermesRuntimeService` instead of `OfficialAgentGraph` directly.

### Fixed issues (no longer applicable)
- ❌ `@CurrentUser('property')` decorator ignored its parameter — **FIXED in FIX-046**
- ❌ Routines endpoint 500 — **FIXED in FIX-047**
- ❌ Admin auth full-page navigation logout — **FIXED in FIX-045**
- ❌ Department CRUD restricted to SUPER_ADMIN — **FIXED in FIX-044**
- ❌ 22 migration dirs with 15 applied — **FIXED** — all ~48 migrations applied

---

## 14. Quick health checks

```bash
# From Contabo
ssh contabo 'pm2 show neurecore-backend | grep -E "status|uptime|restarts|memory"'
ssh contabo 'curl -s http://127.0.0.1:3003/health | head -1'
ssh contabo 'curl -s http://127.0.0.1:3003/health/ready | head -1'

# From outside
curl -sk https://brain.neurecore.com/api/v1/health | python3 -m json.tool
curl -sk -o /dev/null -w "%{http_code}\n" https://brain.neurecore.com/api/v1/agents   # 401 expected (auth required)

# Phase 10 — six pool endpoints (all require SUPER_ADMIN/PLATFORM_ADMIN)
for path in agents-pool departments-pool industries tier-templates features packages; do
  echo "GET /api/v1/$path …"
  curl -sk -o /dev/null -w "  %{http_code}\n" https://brain.neurecore.com/api/v1/$path   # 401 expected
done
```

---

## 15. 2026-07-10 — Tenant Portal validation fixes (Kilo)

Four backend bugs were found and fixed during the end-to-end tenant portal test session. All fixes are rsynced to Contabo and live in production, but the **git working tree has not been committed yet** (see [pending-tasks.md D23](pending-tasks.md)).

### FIX-028 — `@IsUUID()` on CUID fields (15 DTOs)

**Symptom:** `POST /api/v1/goals` returned 400 with `projectId must be a UUID`. Goals/Deliverables/Users/etc. all blocked at the `class-validator` layer.

**Root cause:** NeureCore uses Prisma's `@default(cuid())` for all primary keys (e.g. `cmreogz8r000811yugjh7zjv8`). Several DTOs decorated ID fields with `@IsUUID()` instead of `@IsString()`, rejecting the CUIDs.

**Fix:** Replaced `@IsUUID()` with `@IsString()` in **15 DTO files**:
- `modules/goals/dto/goal.dto.ts` (3 DTOs, 13 decorators)
- `modules/departments/dto/department.dto.ts`
- `modules/finance/dto/invoice.dto.ts`, `expense.dto.ts`, `billing-filter.dto.ts`
- `modules/orchestration/dto/task.dto.ts`
- `modules/users/dto/user.dto.ts`
- `modules/packages/dto/create-package.dto.ts`, `package-composition.dto.ts`, `package-deployment.dto.ts`
- `modules/connectors/dto/connector.dto.ts`
- `modules/entities/dto/entity.dto.ts`
- `modules/agents/dto/create-agent.dto.ts`, `deployment.dto.ts`
- `modules/costs/dto/cost.dto.ts`
- `modules/routines/dto/routine.dto.ts`
- `modules/tenants/dto/tenant.dto.ts`
- `modules/tier-templates/dto/create-tier-template.dto.ts`, `update-tier-template.dto.ts`

Use `sed` for bulk replacement + manual cleanup of broken imports in `package-composition.dto.ts`. Then `npm run build` + `pm2 restart neurecore-backend`.

**See:** [fixes.md FIX-028](fixes.md#fix-028--goals-creation-400-bad-request-isuuid-on-cuid-fields).

### FIX-029 — Missing `@@map()` on `ApprovalWorkflow` / `ApprovalWorkflowStep`

**Symptom:** `GET /api/v1/approval-chains/pending` returned 500 `The column ApprovalWorkflow.riskTier does not exist in the current database`.

**Root cause:** The models lacked `@@map()` directives. Prisma mapped `model ApprovalWorkflow` to PascalCase `ApprovalWorkflow` table, but the actual DB table is snake_case `approval_workflows` (created by migration `20260709_aaa_prereq_create_approval_workflow_tables`). Compare with `model Project` which correctly has `@@map("projects")`.

**Fix:** Added `@@map("approval_workflows")` and `@@map("approval_workflow_steps")` to the two models in `backend/prisma/schema.prisma`. Regenerated Prisma client (`npx prisma generate`), rebuilt, restarted.

**See:** [fixes.md FIX-029](fixes.md#fix-029--approval-workflow-column-does-not-exist-missing-map-on-prisma-models).

### FIX-030 — `IN_PROGRESS` not in `ApprovalStatus` enum

**Symptom:** After FIX-029, `GET /api/v1/approval-chains/pending` failed with `PrismaClientValidationError: Invalid value for argument 'in'. Expected ApprovalStatus.` The query was passing `status: { in: ["PENDING", "IN_PROGRESS"] }`.

**Root cause:** `ApprovalStatus` enum in the database only has `PENDING | APPROVED | REJECTED | CANCELLED | EXPIRED`. There is no `IN_PROGRESS`. The author confused `ApprovalStatus` (workflow) with `ProjectStatus` (project stage) which does have `IN_PROGRESS`.

**Fix:** Changed `modules/approval-chains/approval-chains.service.ts:142` from `['PENDING', 'IN_PROGRESS']` to just `['PENDING']`. The DTO's `@IsIn([...])` validator was left as-is (it's a filter; an invalid value would just return no results).

**See:** [fixes.md FIX-030](fixes.md#fix-030--approval-workflow-invalid-value-for-argument-in-in_progress-not-in-approvalstatus-enum).

### FIX-031 — Lowercase enum types renamed to PascalCase (6 enums)

**Symptom:** `POST /deliverables` → `type "public.DeliverableStatus" does not exist`; `POST /project-memory` → `type "public.MemoryCategory" does not exist`; `POST /project-decisions` → similar for `DecisionStatus`. Plus 3 more (`risk_tier`, `approval_type`, `thread_status`) found via audit.

**Root cause:** Earlier migrations created some enum types in lowercase snake_case (e.g. `memory_category`) instead of the PascalCase names Prisma expects (e.g. `MemoryCategory`). PostgreSQL enum type names are case-sensitive when quoted, so Prisma queries using PascalCase fail against the lowercase actual names.

**Fix:** Direct SQL via `psql` (no Prisma migration needed — schema is already correct, only DB-side names were wrong):

```sql
ALTER TYPE deliverable_status RENAME TO "DeliverableStatus";
ALTER TYPE memory_category    RENAME TO "MemoryCategory";
ALTER TYPE decision_status    RENAME TO "DecisionStatus";
ALTER TYPE risk_tier          RENAME TO "RiskTier";
ALTER TYPE approval_type      RENAME TO "ApprovalType";
ALTER TYPE thread_status      RENAME TO "ThreadStatus";
```

Idempotent (rename only, preserves values + dependencies). No application code changes required.

**See:** [fixes.md FIX-031](fixes.md#fix-031--lowercase-postgres-enum-types-drift-from-prisma-pascalcase-names) and [deployment.md §12](deployment.md#12-database-schema-drift-enum-case--missing-map).

### Verification (2026-07-10 15:33 PKT)

| Endpoint | Before | After |
|---|---|---|
| `POST /api/v1/goals` | 400 INVALID_REQUEST | 201 Created |
| `GET /api/v1/approval-chains/pending` | 500 (column does not exist → enum) | 200 `{"data":[]}` |
| `POST /api/v1/deliverables` | 500 (enum not found) | 201 Created |
| `POST /api/v1/project-memory` | 500 (enum not found) | 201 Created |
| `POST /api/v1/project-decisions` | 500 (enum not found) | 201 Created |

### What to commit next session

```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
git status                                       # confirm 15 DTO files + 1 service + 1 schema + 1 inspector
git add backend/src/modules/{goals,departments,users,agents,finance,orchestration,packages,connectors,entities,costs,routines,tenants,tier-templates}/dto/ \
        backend/src/modules/approval-chains/approval-chains.service.ts \
        backend/prisma/schema.prisma \
        frontend-tenant/src/components/inspector/ProjectInspector.tsx
git commit -m "fix(FIX-028..031): UUID→String validation, Prisma @@map, enum case fixes

- FIX-028: replace @IsUUID() with @IsString() in 15 DTOs (CUID PKs)
- FIX-029: add @@map() to ApprovalWorkflow + ApprovalWorkflowStep
- FIX-030: remove IN_PROGRESS from ApprovalStatus query (doesn't exist)
- FIX-031: renamed 6 lowercase enum types to PascalCase in prod DB
- also: Array.isArray guard in ProjectInspector health.signals"
git push origin 004-ent-comm
```

---

---

## 16. AI Gateway module (deployed 2026-07-11, Phase 2.8 2026-07-28)

**Status:** ✅ DEPLOYED with `AI_GATEWAY_V2=true` in production (BOTH `.env` and `.env.production` — see [contabo-ops.md §3.8b](../contabo-ops.md)).

The AI Gateway is a new `@Global()` NestJS module at `src/modules/ai-gateway/` that consolidates all LLM invocation into a single entry point (`AiGatewayService`). It replaces the legacy `LLMFactory` + per-provider clients (`MiniMaxClient`, `DeepSeekClientService`, `MiMoClientService`) with a DB-backed model catalog, automatic failover, circuit breaking, and per-invoke cost attribution.

**Phase 2.8 (2026-07-28):** added `model_providers.encryptedKey` column for DB-persisted encrypted API keys. `CapabilityResolver` + `AiGatewayService.resolveApiKey` resolve keys with precedence **DB-prefer-encrypted > env-fallback**. SUPER_ADMIN now adds/edits AI providers + rotates keys entirely from `cc.neurecore.com/settings/ai` with no SSH required. New endpoints: `POST .../discover-models` (auto-fetches `GET /models` from provider, inserts rows as disabled, admin picks which to enable + default) and `POST .../models/:modelId/set-default` (single-model toggle, clears siblings on shared capabilities). Non-ASCII API keys are rejected at the boundary with a precise codepoint + position error to prevent future undici `ByteString` leaks. Full doc: [ai-gateway/ai-gateway-reference.md](../ai-gateway/ai-gateway-reference.md), [pending-tasks.md §0g](../pending-tasks.md#0g-2026-07-28-ai-gateway-phase-28-db-stored-keys--discover-models--chat-streaming-fix-kilo).

**Critical bug fix (2026-07-28):** `HttpLlmTransport.CHOICE_SCHEMA.finish_reason` was `z.string()` (not nullable) — every DeepSeek/OpenAI streaming chunk with `finish_reason: null` was silently rejected by Zod, the transport skipped the yield, the gateway emitted only `event: done` to the browser — both cc and hq chat bots were unresponsive. Now `z.string().nullable().optional()` — content streams as designed. See [ai-gateway-reference.md §3 "Critical bug fix"](../ai-gateway/ai-gateway-reference.md).

### Key components

| Component | File | Purpose |
|---|---|---|
| `AiGatewayService` | `ai-gateway.service.ts` | Public facade: `select()` / `invoke()` / `stream()` / `invokeStructured()` / `invokeWithTools()`. Phase 2.8: `resolveApiKey` (db→env), `invalidateSecret` |
| `HttpLlmTransport` | `transport/http-llm.transport.ts` | Single `fetch()` for all providers; SSE parsing; error normalization. Phase 2.8: `finish_reason` nullable (chat-streaming bug fix) |
| `CapabilityResolver` | `selection/capability-resolver.ts` | tenant + capability → provider/model resolution (tenant-override > default > fallback chain). Phase 2.8: DB-prefer key resolution |
| `AiModelRepository` | `selection/ai-model.repository.ts` | LRU-cached DB read of `model_providers` + `ai_models` + `tenant_model_overrides` |
| `FallbackChainBuilder` | `failover/fallback-chain.ts` | Ordered provider/model alternates per capability |
| `CircuitBreaker` | `failover/circuit-breaker.ts` | Per-provider CLOSED→OPEN→HALF_OPEN state machine (5 errs/30s → 60s open) |
| `CostAttributorService` | `cost/cost-attributor.service.ts` | Single `CostRecord` writer (idempotent on `sourceEventId`) |
| `StructuredLogger` | `observability/structured-logger.ts` | JSON log per invoke (capability, provider, model, latencyMs, costCents, errorCode) |
| `LangSmithSink` | `observability/langsmith-sink.ts` | Span wrapping per `invoke()` |
| `capability-heuristic` | `selection/capability-heuristic.ts` | Phase 2.8 NEW: `guessCapabilities(modelId)` for auto-tagging discovered models (embed→embedding, reason/r1/o1/o3/think→reasoning, coder/code/codex→coding, else generic chat set) |

### DB schema (new tables)

| Table | Purpose |
|---|---|
| `model_providers` | Provider config: slug, apiBaseUrl, apiKeyEnv, isActive |
| `ai_models` | Model catalog: modelId, capabilities[], contextWindow, costPer1kInput/Output, isDefault |
| `tenant_model_overrides` | Per-tenant per-capability model override (unique on tenantId+capability) |
| `model_catalog_audits` | Admin write trail (actorId, action, entity, before/after snapshots) |

Plus new columns on `cost_records`: `sourceModule` (TEXT), `sourceEventId` (TEXT, UNIQUE), `metadata` (JSONB); `tenantId` loosened to nullable for system-level calls.

### Admin API

| Endpoint | Method | Description |
|---|---|---|
| `/admin/models/providers` | GET | List providers with nested models |
| `/admin/models/providers` | POST | Create provider |
| `/admin/models/providers/:id` | PATCH | Toggle provider isActive |
| `/admin/models` | GET | List models (filterable by capability/provider) |
| `/admin/models` | POST | Create model |
| `/admin/models/:id` | PATCH | Toggle isAvailable/isDefault, change capabilities |
| `/admin/tenants/:tenantId/model-overrides` | POST | Set per-tenant override |
| `/admin/tenants/:tenantId/model-overrides/:id` | DELETE | Remove override |
| `/admin/models/health` | GET | Circuit state per provider + boot status |
| `/admin/models/cost-summary` | GET | Aggregated cost by provider/model/day |

All guarded with `@Roles('SUPER_ADMIN')` + `RolesGuard`.

### Migrated consumers (behind `AI_GATEWAY_V2` flag)

| Consumer | Capability | Method |
|---|---|---|
| `chat.service.ts` | conversation | `invoke()`, `stream()` |
| `chief-of-staff.service.ts` | reasoning | `invoke()` |
| `project-health-ai.service.ts` | reasoning | `invokeStructured()` |
| `rag-pipeline.service.ts` | conversation / reasoning | `invoke()`, `stream()` |
| `retail.service.ts` | conversation / reasoning | `invoke()` |
| `tools/built-in/{query,explain,chat}.tool.ts` | tools / reasoning / conversation | `invoke()` |
| `langgraph-official.ts` (plannerNode) | tools | `invokeWithTools()` |
| `agent-evaluator.service.ts` | evaluation | `invokeStructured()` |
| `hermes-registry.service.ts` | planning | `select()` |
| `thread-summarization.service.ts` | conversation | `invoke()` |
| `digest.service.ts` | reasoning | `invoke()` |
| `conversation-intelligence.service.ts` | reasoning | `invoke()` |

### Capability defaults (seed)

| Capability | Default model | Fallback chain |
|---|---|---|
| conversation | MiniMax-M2.7-highspeed | → MiniMax-M2.5 → MiniMax-Text-01 |
| planning | gpt-4o-mini | → MiniMax-M2.7-highspeed → deepseek-chat |
| execution | gpt-4o-mini | → MiniMax-M2.7-highspeed → deepseek-reasoner |
| evaluation | gpt-4o-mini | → MiniMax-M2.7-highspeed → deepseek-chat |
| coding | deepseek-coder | → MiniMax-M2.7-highspeed |
| reasoning | deepseek-reasoner | → MiniMax-M2.7-highspeed → gpt-4o-mini |
| tools | gpt-4o-mini | → MiniMax-M2.7-highspeed |
| embedding | text-embedding-3-small | — |

### Deploy-time issues resolved

See [fixes.md FIX-037](fixes.md) for the 6 issues found and fixed during the Contabo deploy:
1. Migration SQL: `"Tenant"` → `"tenants"` in FK references
2. NestJS DI: string token → class reference for `SecretProviderService`
3. NestJS DI: `@Optional()` missing on `AiModelRepository` constructor params
4. NestJS DI: `CircuitBreaker` removed from providers (manual construction)
5. Admin `start.sh`: `node .bin/next` → `./.bin/next` (shell script, not JS)
6. Stray `ai-gateway.module.ts` in wrong directory

### Health check

```bash
# Gateway health
curl -sk https://brain.neurecore.com/api/v1/admin/models/health \
  -H "Authorization: Bearer <admin-jwt>"

# Check boot probe in logs
ssh contabo 'pm2 logs neurecore-backend --nostream --lines 30 | grep -i "AiGateway\|boot"'
```

### Reference

- Full implementation plan: [ai-gateway-imp-plan.md](ai-gateway/ai-gateway-imp-plan.md)
- Deploy details: [ai-gateway-imp-plan.md §0](ai-gateway/ai-gateway-imp-plan.md)
- Issues fixed: [fixes.md FIX-037](fixes.md)
- System state: [system-state.md](system-state.md)

---

## 17. Simulation-5: AEIC — Backend Implementation (2026-07-17)

**Status:** ✅ COMPLETE — 6 phases executed, all 15 deliverables produced, 83/100 B+ Production Ready

### Architecture overview

Simulation-5 introduced 5 new tables, 7 new enums, 17 nullable columns, 2 DB triggers, and 10 DB-level safeguards via a single 66-statement migration.

---

## 18. Enterprise Integration Phases 7–14 (2026-07-17)

**Status:** ✅ ALL 14 PHASES COMPLETE — 13 deployed, Phase 14 source complete awaiting deployment

All 14 enterprise integration phases have been implemented and verified. The complete NeuroCore platform layers:

```
P1 (EIE) → P2 (Event Fabric) → P3 (Context Plane) → P4 (Runtime) →
P5 (Cognition) → P6 (Autonomy) → P7 (Enterprise OS) → P8 (Platform Operations) →
P9 (Enterprise Intelligence) → P10 (Platform SDK) → P11 (Cloud Platform) →
P12 (Application Framework) → P13 (AI Governance) → P14 (Platform Evolution)
```

### Phase 7 — Enterprise Operating System & Digital Twin

**Module:** `src/modules/enterprise-operating-system/`

Digital Twin mirrors P3 Context Plane + P6 Autonomy state (never owns business data). Simulation is deterministic: baseline snapshot → arithmetic scenario application → projected twin → Cognition evaluation. Never mutates production.

| Component | File | Purpose |
|---|---|---|
| `EnterpriseOperatingSystemService` | `enterprise-operating-system.service.ts` | Top-level orchestrator (cockpit, simulate, twin, forecast, optimize, performance, resilience, analytics, resource, strategy) |
| `DigitalTwinService` | `twin/digital-twin.service.ts` | Read-only projection from Context Plane + Autonomy; cached snapshot |
| `ScenarioEngine` | `twin/digital-twin.service.ts` | Cognition-driven scenario evaluation |
| `SimulationEngine` | `twin/digital-twin.service.ts` | Deterministic, snapshot-based arithmetic scenario application; persists audit trail to `simulation_records` |
| `AnalyticsEnginesService` | `engines/analytics-engines.service.ts` | ForecastingEngine, OptimizationEngine, ExecutiveAdvisor, EnterpriseAnalytics, EnterprisePerformance, ResilienceEngine, ResourceOptimizer, StrategyMonitor |
| `EnterpriseOperatingSystemController` | `enterprise-operating-system.controller.ts` | Tenant-scoped API (cockpit, twin, forecast, optimize, performance, resilience, analytics, resource, strategy, simulate) |
| `EnterpriseOperatingSystemModule` | `enterprise-operating-system.module.ts` | Imports Cognition + Autonomy; @Global Context Plane + Event Fabric |

**DB migration:** `prisma/migrations/20260714_enterprise_os/migration.sql` — `simulation_records` table (additive, reversible).

**Events registered:** `enterprise.digital_twin.*`, `enterprise.simulation.*`, `enterprise.forecast.*`, `enterprise.optimization.*`, `enterprise.strategy.*`, `enterprise.executive.*`, `enterprise.performance.*`, `enterprise.resilience.*`, `enterprise.analytics.*`.

**Key design:** Digital Twin is a cached, read-only projection. Simulation mutates a JSON copy of the twin snapshot — never the production twin or any capability service. All P7 events are published non-transactionally (post-compute).

---

### Phase 8 — Platform Operations, Reliability & Security

**Module:** `src/modules/platform-operations/`

Read-only operations layer. Consumes existing infrastructure (PrismaService, EVENT_TRANSPORT, CONTEXT_PLANE, ModulesContainer) and produces assessments, exports, traces, diagnostics, and readiness reports. NEVER mutates capability data.

| Component | File | Purpose |
|---|---|---|
| `PlatformOperationsService` | `engines/platform-engines.service.ts` | Top-level delegator |
| `HealthCenterService` | `engines/platform-engines.service.ts` | Cross-layer assessment (P1-P8 + infrastructure); categorical grades |
| `AuditCenterService` | `engines/platform-engines.service.ts` | Tamper-evident SHA-256 export from ActivityEvent table |
| `SecurityCenterService` | `engines/platform-engines.service.ts` | Cross-tenant isolation, auth/authz, secrets health, injection resistance assessment |
| `ObservabilityEngine` | `engines/platform-engines.service.ts` | TraceId/correlationId/tenantId/actorId/missionId/workRunId/simulationId enrichment |
| `DiagnosticsEngine` | `engines/platform-engines.service.ts` | Config validation, provider health, event delivery monitoring, dead-letter tracking |
| `OperationalReadiness` | `engines/platform-engines.service.ts` | NestJS ModulesContainer DI validation at boot (105 modules captured) |
| `DeploymentManager` | `engines/platform-engines.service.ts` | Stub — requires operational CI/CD |
| `BackupManager` | `engines/platform-engines.service.ts` | Stub — requires operational infrastructure |
| `PlatformOperationsController` | `platform-operations.controller.ts` | Tenant-scoped Executive Operations Dashboard |

**DB migration:** NONE (compute layer, no new Prisma models).

**Events registered:** `platform.health`, `platform.audit`, `platform.security_alert`, `platform.incident_resolved`, `platform.backup_completed`, `platform.deployment_completed`.

---

### Phase 9 — Enterprise Intelligence Network & Knowledge Graph

**Module:** `src/modules/enterprise-intelligence/`

Knowledge layer — read-only intelligence. Provides Entity Resolution (graph deduplication), Relationship Engine (infers from Context Plane), Semantic Search (spans graph + project memory), Knowledge Governance (consistency grading), and Ontology (versioned entity/relationship kinds).

| Component | File | Purpose |
|---|---|---|
| `EnterpriseIntelligenceService` | `enterprise-intelligence.service.ts` | Top-level orchestrator |
| `KnowledgeGraphService` | `knowledge-graph/knowledge-graph.service.ts` | Graph storage, entity CRUD, relationship management |
| `RelationshipEngine` | `knowledge-graph/relationship-engine.service.ts` | Infer relationships from Context Plane events; transitive closure |
| `EntityResolutionService` | `knowledge-graph/entity-resolution.service.ts` | Deduplicate entities via semantic similarity |
| `SemanticSearchService` | `knowledge-graph/semantic-search.service.ts` | Vector + keyword search spanning graph + project memory |
| `KnowledgeReasoner` | `knowledge-graph/knowledge-reasoner.service.ts` | LLM-driven reasoning over knowledge graph via Cognition |
| `KnowledgeGovernanceService` | `knowledge-graph/knowledge-governance.service.ts` | Consistency grading, quality metrics |
| `OntologyService` | `knowledge-graph/ontology.service.ts` | Versioned entity kinds (8) + relationship kinds (4) |
| `KnowledgeGraphSyncConsumer` | `knowledge-graph/knowledge-graph-sync.consumer.ts` | Event-driven graph sync from Context Plane events |
| `EnterpriseIntelligenceController` | `enterprise-intelligence.controller.ts` | Knowledge + graph + search + governance API |

**Key design:** Knowledge Graph Sync Consumer subscribes to Context Plane events and keeps the graph synchronized. Relationship Engine uses `RelationshipEngine.infer()` to compute transitive relationships. All operations are read-only — P9 never executes or owns operational state.

---

### Phase 10 — Platform SDK, Extensibility & Six Pools

**Modules:** `src/modules/platform-sdk/`, `src/modules/agents-pool/`, `src/modules/departments-pool/`, `src/modules/industries/`, `src/modules/tier-templates/`, `src/modules/features/`, `src/modules/packages/`

Governed extensibility layer. Plugin registry with full lifecycle (Draft→Installed→Validated→Enabled→Disabled→Deprecated→Removed), permission manager, version compatibility checker (semantic versioning).

**Six orthogonal pools (business composition architecture):**

| Pool | Module | Prisma model | Admin route |
|---|---|---|---|
| AI Employees | `agents-pool/` | `AgentTemplate` (+`enabled`) | `/agents-pool` |
| Departments | `departments-pool/` | `DepartmentTemplate` | `/departments-pool` |
| Industries | `industries/` | `Industry` | `/industries` |
| Tiers | `tier-templates/` | `TierTemplate` | `/tiers` |
| Features | `features/` | `Feature` | `/features` |
| Packages | `packages/` | `Package` (composite root) | `/packages` |

**Pool architecture:**
- `src/common/pool/` — abstract `PoolService` + `PoolController` (DIP primitives)
- Each pool service extends `PoolService` + adds pool-specific methods
- Adding a 7th pool: one service implementing `IPoolAdminService`, one page importing shared UI components, one `navigation.config.ts` entry

**Phase 10 also includes WorkRuntimeEventsConsumer** — subscribes to 12 work-runtime/task events and activates typed Socket.IO helpers that were registered but never called.

---

### Phase 11 — Cloud Platform

**Module:** `src/modules/cloud-platform/`

Multi-cloud abstraction layer. Supports CloudCluster, CloudProvider, CloudRegion, FailoverPolicy, CostAllocation, and CloudHealthEvent types.

| Component | File | Purpose |
|---|---|---|
| `CloudPlatformService` | `cloud-platform.service.ts` | Top-level orchestrator |
| `CloudClusterService` | `services/cloud-cluster.service.ts` | Cluster CRUD, failover validation |
| `CloudProviderService` | `services/cloud-provider.service.ts` | Provider management |
| `CloudRegionService` | `services/cloud-region.service.ts` | Region management |
| `FailoverPolicyService` | `services/failover-policy.service.ts` | Failover configuration |
| `CostAllocationService` | `services/cost-allocation.service.ts` | Cost attribution |
| `CloudHealthMonitor` | `services/cloud-health-monitor.service.ts` | Health event ingestion + alert routing |
| `CloudPlatformController` | `cloud-platform.controller.ts` | 16 API endpoints |
| `CloudPlatformModule` | `cloud-platform.module.ts` | Wiring |

**DB models:** `CloudProvider`, `CloudRegion`, `CloudCluster`, `FailoverPolicy`, `CostAllocation`, `CloudHealthEvent`.

**Events registered:** `cloud.cluster.registered`, `cloud.cluster.health_changed`, `cloud.failover.initiated`, `cloud.cost.allocated`.

---

### Phase 12 — Application Framework

**Module:** `src/modules/application-framework/`

Governed application registry. Applications are tenant-deployable software units with lifecycle: Draft → Active → Deprecated → Retired.

| Component | File | Purpose |
|---|---|---|
| `ApplicationFrameworkService` | `application-framework.service.ts` | App registry, lifecycle management |
| `ApplicationFrameworkController` | `application-framework.controller.ts` | REST API |

**Lifecycle endpoints added:**
- `POST /applications` — register new app
- `PATCH /applications/:id/activate` — activate app
- `PATCH /applications/:id/deprecate` — deprecate app (blocks new deploys)
- `PATCH /applications/:id/retire` — retire app (removes from registry)
- `GET /applications` — list apps
- `GET /applications/:id` — app detail

**Events emitted (via IEnterpriseEventTransport DIP):** `application.registered`, `application.activated`, `application.updated`, `application.deprecated`, `application.retired`.

**Key design:** `deprecate()` and `retire()` both use `(id, tenantId)` compound-where-clause guards to ensure cross-tenant isolation. All write operations emit corresponding enterprise events.

---

### Phase 13 — AI Governance Platform

**Module:** `src/modules/ai-governance/`

Governed AI oversight. Evaluates model outputs, flags hallucinations, records biases, creates governance policies, and decides review cases.

| Component | File | Purpose |
|---|---|---|
| `AIGovernanceService` | `ai-governance.service.ts` | Top-level orchestrator |
| `AIGovernanceController` | `ai-governance.controller.ts` | REST API |

**Operations:**
- `evaluate()` — assess output quality, governance compliance, factuality
- `flagHallucination()` — record detected hallucination events
- `recordBias()` — record detected bias events
- `createPolicy()` — create governance policy
- `decideReview()` — decide a review case (approve/reject/escalate)

**Events emitted (via IEnterpriseEventTransport DIP):** `governance.evaluation.completed`, `governance.hallucination.flagged`, `governance.bias.recorded`, `governance.policy.created`, `governance.review.decided`.

**Key design:** All event emissions use DIP on `IEnterpriseEventTransport`. Non-fatal errors (transport unavailable) are caught and swallowed — the operation itself succeeds.

---

### Phase 14 — Platform Evolution & Adaptive Intelligence

**Module:** `src/modules/platform-evolution/`

Governed technology evolution. Technology Radar, Model Registry, Benchmarking, Experimentation, Feature Lifecycle, Capability Versioning, Migration Planning.

| Component | File | Purpose |
|---|---|---|
| `PlatformEvolutionService` | `platform-evolution.service.ts` | Top-level orchestrator |
| `PlatformEvolutionController` | `platform-evolution.controller.ts` | 16 API endpoints |

**Operations:**
- Technology Radar: EMERGING → TRIAL → ADOPT → HOLD → RETIRE
- Benchmark recording/listing (provider, model, capability, score)
- Experiment lifecycle: DRAFT → RUNNING → COMPLETED
- Feature lifecycle: PROPOSAL → RESEARCH → PROTOTYPE → PILOT → GA → DEPRECATED → RETIRED
- Capability versioning (11 domains: REASONING/PLANNING/MEMORY/KNOWLEDGE/AGENTS/AUTONOMY/VISION/SPEECH/WORKFLOW/SIMULATION/SEARCH)
- Migration planning (MODEL/PROVIDER/SDK/APP/CLOUD/ONTOLOGY target types)

**Events emitted (via IEnterpriseEventTransport DIP):** `evolution.model.registered`, `evolution.benchmark.completed`, `evolution.experiment.completed`, `evolution.feature.lifecycle.updated`, `evolution.migration.generated`.

**Key design:** `addRadarEntry()` emits `evolution.model.registered` only on first creation (not upsert) via `findUnique` check. All event emissions non-fatal.

**DB tables:** `tech_radar`, `benchmark_records`, `experiments`, `feature_lifecycle`, `capability_versions`, `migration_plans`.

---

### Phase Audit Fixes (Honest Remediation)

During the honest audit of phases 9-14, the following genuine gaps were found and fixed:

| Phase | Issue | Fix |
|---|---|---|
| Phase 9 | `RelationshipEngine.infer()` never called | `KnowledgeGraphSyncConsumer` now calls `infer()` after entity/relationship changes |
| Phase 10 | Typed Socket.IO helpers in `WorkRuntimeEventsConsumer` never activated | Consumer now calls all 12 typed helper methods on relevant events |
| Phase 11 | No gaps | Cloud platform fully verified — no code changes needed |
| Phase 12 | Missing `deprecate()` and `retire()` methods; missing all event emissions | Added both methods; added `IEnterpriseEventTransport` injection; added all 5 event emissions |
| Phase 13 | Missing all 6 event emissions | Added `IEnterpriseEventTransport` injection; added private `emit()` helper; added all 6 emissions |
| Phase 14 | Missing all 5 event emissions | Added `IEnterpriseEventTransport` injection; added private `emit()` helper; added all 5 emissions |

### Full Module Map (all 14 phases + Simulation-5)

```
src/modules/
├── agents/                     # AI agent runtime + streaming + deployment
├── agents-pool/                # Phase 10 Pool #1 — AgentTemplate surface
├── agent-templates/             # Legacy agent blueprints
├── ai-gateway/                 # AI Gateway v2 — sole LLM entry point
├── analytics/                   # Usage metrics + reporting
├── application-framework/       # Phase 12 — App registry + lifecycle
├── audit/                       # Append-only audit log
├── auth/                        # JWT login/refresh, Google OAuth
├── chat/                        # AI chat sessions
├── cloud-platform/              # Phase 11 — Multi-cloud abstraction
├── command-center/               # Aggregated dashboard data
├── connectors/                   # External integrations (HubSpot, Brevo, Mailgun)
├── costs/                       # Per-agent cost tracking + budgets
├── department-templates/         # Legacy department blueprints
├── departments/                 # Tenant org chart
├── departments-pool/             # Phase 10 Pool #2 — DepartmentTemplate surface
├── enterprise-intelligence/      # Phase 9 — Knowledge Graph + Reasoning
├── enterprise-operating-system/  # Phase 7 — Digital Twin + Simulation
├── events/                      # Event bus + Socket.IO gateway
├── features/                    # Phase 10 Pool #5 — Feature registry
├── finance/                     # Invoices, expenses, billing
├── goals/                       # OKR tracking
├── governance/                   # Approval rules + policies
├── health/                      # /health/* endpoints
├── hermes/                      # Unified AI agent runtime orchestrator
├── inbox/                       # Unified inbox
├── industries/                  # Phase 10 Pool #3 — Industry taxonomy
├── mission-feed/                # Dashboard-prioritized items
├── models/                      # LLM model registry
├── notifications/               # Multi-channel notifications
├── observability/               # Internal traces + spans
├── onboarding/                  # WS-2 wizard + WS-2.1 checklist
├── orchestration/               # Multi-agent workflows
├── packages/                    # Phase 10 Pool #6 — Package composite root
├── platform-evolution/           # Phase 14 — Technology Radar, Benchmark, Experiment
├── platform-operations/          # Phase 8 — Health, Audit, Security, Diagnostics
├── projects/                    # Cross-functional initiatives
├── reliability/                 # Quota guard, rate limiting, circuit breakers
├── retail/                      # Placeholder
├── routines/                    # Scheduled automations
├── security/                    # Roles + permissions + guards
├── settings/                   # Per-tenant settings
├── solution-packs/             # Vertical solution packs
├──.tenants/                     # Multi-tenancy root
├── tier-templates/              # Phase 10 Pool #4 — TierTemplate surface
├── tiers/                       # Subscription billing tier
├── tools/                       # 50+ structured tools
├── uploads/                    # WS-2.1 — Tenant logos
└── users/                       # User CRUD + sessions

# Simulation-5 modules (Phases 1-6)
src/simulations/                # Simulation lifecycle + day-runner
src/modules/timeline-events/    # First-class event log
src/modules/decision-evaluations/ # Immutable scores snapshot
src/modules/service-identities/  # Workload identity + scoped tokens
src/scoring/v1/                # Deterministic scoring
src/common/idempotency/        # @Global idempotency
src/common/simulation/         # @Global SimulationVisibilityService
```

### Simulation lifecycle

```
simulationId URI:  sim://<YYYY>/<MM>/<DD>/<orgSlug>/<framework>/<seq>
                   allocated transactionally via Postgres sequence per (orgSlug, framework, date)
                   example: sim://2026/07/17/neurecore/aeic/000001

simulationRunId:   cuid row id of the Project record (internal reference)
```

### Modules implemented

| Module | File | Purpose |
|--------|------|---------|
| `SimulationsModule` | `src/simulations/` | Create/list/get + day-run; version enforcement; idempotent day execution |
| `TimelineEventsModule` | `src/modules/timeline-events/` | First-class event log; 12 categories; status transition matrix enforced at DB + app |
| `DecisionEvaluationsModule` | `src/modules/decision-evaluations/` | Immutable scores snapshot; BEFORE UPDATE trigger; atomic `latestEvaluationId` pointer |
| `ServiceIdentitiesModule` | `src/modules/service-identities/` | Workload identity; scoped bearer tokens; `@ServiceIdentityScope` guard |
| `AgentInvocationsModule` | `src/modules/agents/` | Structured output + bounded repair pass (up to 2 retries); JSON Schema validation |
| `SimulationVisibilityModule` | `src/common/simulation/` | `@Global` default exclusion: `SIMULATION_ONLY` knowledge, `simulationId`-tagged timeline/feed items |
| `IdempotencyModule` | `src/common/idempotency/` | `@Global` reusable: SHA-256 body hash, response checksum, replay deduplication |
| `ScoringModule` | `src/scoring/v1/` | Pure-function `computeOrganizationalIntelligence()` — 11 categories, deterministic, no Math.random |

### DB triggers (Simulation-5)

**1. `timeline_events_status_transition_trigger`**
Enforces `ALLOWED_TRANSITIONS` matrix. Rejects invalid transitions (e.g., `FAILED → ACTIVE`) at DB level.

**2. `decision_evaluations_immutable_trigger`**
BEFORE UPDATE on `decision_evaluations` — any attempt to modify an existing evaluation raises an exception.

### Scoring v1 — organizational intelligence

```typescript
computeOrganizationalIntelligence(input: RunningScoresInput, computedAt: string): OrganizationalIntelligenceScorecard
```

- **11 categories**: DecisionQuality(20%), EvidenceQuality(15%), AICollaboration(15%), Adaptability(15%), LongTermPlanning(10%), Governance(10%), WorkflowExecution(5%), Security(5%), Performance(3%), CostEfficiency(2%), PredictionAccuracy(10%)
- **No constant fallbacks**: null score when insufficient evidence
- **Renormalization**: weights renormalized over non-null categories when some are null
- **`partialScore: true`**: emitted when any category is null
- **`predictionAccuracy`**: requires `MIN_PREDICTION_SAMPLE_SIZE = 3` realized outcomes; below threshold → `insufficient_evidence: true`

### Idempotency

```typescript
// State machine
IN_FLIGHT → COMPLETED  (on success)
IN_FLIGHT → FAILED    (on exception)

// Stored: sha256(body) as key, response inline if <256KB
// Replay: responseChecksum verified before returning cached body
// Key reuse with different payload: 422 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD
```

Wired via `app.useGlobalInterceptors()` in `main.ts` (not via `AppModule` providers — avoids NestJS import-order issues).

### SimulationVisibilityService — default exclusion filters

| Entity | Default filter | Opt-in |
|---------|---------------|--------|
| Knowledge | exclude `visibilityScope='SIMULATION_ONLY'` | `includeSimulation: true` |
| TimelineEvent | exclude `category='SIMULATION' AND simulationId IS NOT NULL` | `includeSimulation: true` |
| MissionFeedItem | exclude `simulationId IS NOT NULL` | `includeSimulation: true` |

Production queries use default filters automatically. Simulation overview UI passes `includeSimulation: true`.

### ServiceIdentity — workload auth

```typescript
// Create a service identity
POST /api/v1/service-identities
{ name: "simulation-engine", scope: "simulation-engine" }

// Issue a scoped token
POST /api/v1/service-identities/:id/tokens
→ returns plaintext token (shown once, never stored)

// Use token
Authorization: Bearer <token>
// or
X-Service-Token: <token>

// Guard enforces scope
@ServiceIdentityScope('simulation-engine')
```

### AgentInvocations — structured output + repair

```typescript
POST /api/v1/agents/:id/invocations
{
  structuredOutputSchema: { type: "object", properties: {...} },
  repair: { maxAttempts: 2, maxCumulativeTokens: 4 * expectedBudget },
  ...
}
```

- Attempts JSON Schema validation on LLM output
- On failure: retries with repair prompt (up to `maxAttempts`)
- Aborts: `STRUCTURED_OUTPUT_INVALID` after exhausted retries
- Audit: every raw output, repair attempt, validation error, model, latency, token count persisted to `HermesMessage`

### REST routes (Simulation-5)

```
POST /api/v1/simulations                              → SimulationsController.create (JWT + OWNER/ADMIN)
GET  /api/v1/simulations                             → SimulationsController.list (JWT)
GET  /api/v1/simulations/:id                        → SimulationsController.get (JWT)
POST /api/v1/simulations/:id/days/:day/run         → SimulationsController.runDay (JWT + ServiceIdentityGuard + scope)

POST /api/v1/service-identities                      → ServiceIdentitiesController.create (JWT + ADMIN)
GET  /api/v1/service-identities                     → ServiceIdentitiesController.list (JWT)
POST /api/v1/service-identities/:id/tokens          → ServiceIdentitiesController.issueToken (JWT)
POST /api/v1/service-identities/:id/revoke          → ServiceIdentitiesController.revoke (JWT)

POST /api/v1/agents/:id/invocations                 → AgentInvocationsController.invoke (JWT)
```

### Key files

```
src/simulations/simulations.service.ts        — simulationId URI allocation (transactional sequence)
src/simulations/simulations.day-runner.ts     — vertical slice: creates all records for one simulation day
src/simulations/simulations.controller.ts     — REST endpoints + idempotency wiring
src/scoring/v1/scoring-v1.ts              — pure-function scoring (291 lines, no I/O, no Math.random)
src/common/idempotency/idempotency.service.ts — IN_FLIGHT/COMPLETED/FAILED state machine
src/common/idempotency/idempotency.interceptor.ts — global interceptor (wired in main.ts)
src/common/simulation/simulation-visibility.service.ts — default exclusion filters
src/modules/timeline-events/timeline-events.service.ts — status transition matrix
src/modules/decision-evaluations/decision-evaluations.service.ts — immutable creates
src/modules/service-identities/service-identities.service.ts — workload identity + token issuance
src/modules/agents/agent-invocations.controller.ts — structured output + repair pass
```

### Reference

- Full implementation: `simulations/simulation-5-honest/COMPLETION.md`
- Design docs: `simulations/simulation-5-honest/design/*.md` (8 files)
- Phase 1 migration: `simulations/simulation-5-honest/phase-1-migration/`
- Phase 2 backend: `simulations/simulation-5-honest/phase-2-backend/`
- Execution report: `simulations/simulation-5-implementation/REPORT.md`
- Evidence: `simulations/simulation-5-implementation/simulation-5-evidence/` (92 files, 2.6 MB)

**End of backend.md.**