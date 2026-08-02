# Databases

> Postgres (primary), Redis (cache/idempotency), Neo4j (context graph), SQLite (sidecar event log). Last refreshed: 2026-07-31.

---

## 1. PostgreSQL — primary store

### 1.1 Stack
- Prisma 5.22 (`@prisma/client`) — `backend/package.json:89, 142`.
- Schema: `backend/prisma/schema.prisma`.
- Migrations: `backend/prisma/migrations/`.
- Connection: `DATABASE_URL` env (validated by `ConfigurationModule`).

### 1.2 Schema size
- **174 Prisma models** (`grep -c '^model ' backend/prisma/schema.prisma`).
- Multi-tenant: most domain models carry `tenantId` + a compound unique on
  `(tenantId, …)` enforced at the DB level.

### 1.3 Migration history (most recent)
```
20260727_awl_g6_review_lifecycle
20260728_ai_gateway_db_keys
20260728_align_review_decision_enum
20260728_align_review_decision_enum_step2
20260728_sim04_g07_timeline_customer_id
20260728_sim04_nc_sim04_003_customer_enums
20260728_sim04_task_due_date
20260728_task_status_enum_extension
20260730_acct_capability_init
```

`20260730_acct_capability_init` is the **accounting capability** migration —
introduces ledger tables, accounting period tables, chart of accounts
(versioned), and the segregation-of-duties `CHECK` constraint
(`posting_user_id <> approved_by_user_id`).

### 1.4 Notable domain clusters (model names; verify in `schema.prisma`)
- **Identity:** `User`, `Tenant`, `ServiceIdentity`, `AccountLockout`,
  `RefreshToken`, `PasswordResetToken`, `Session`.
- **Work:** `Project`, `Goal`, `Task`, `ExecutionAttempt`, `Review`,
  `EvidenceArtifact`, `Deliverable`, `ProjectStage`, `ProjectMember`,
  `ProjectType`, `ProjectTemplate`, `ApprovalChain`, `Approval`.
- **AWL (reconstructed):** `Command`, `CommandIdempotencyRecord`,
  `IdempotencyRecord`, `OutboxEvent`, `OutboxDeadLetter`, `CorrelationId`.
- **Events:** `TimelineEvent`, `DecisionEvaluation`, `EnterpriseEvent`,
  `ProjectEvent`, `HermesAuditLog`.
- **Agents:** `Agent`, `AgentTemplate`, `AgentPool`, `AgentPoolMember`,
  `Memory`, `MemoryChunk`, `Tool`, `ToolDescriptor`, `Model`, `AIGatewayKey`.
- **Departments:** `Department`, `DepartmentTemplate`, `DepartmentPool`.
- **Industry / Tier / Package:** `Industry`, `IndustryGroup`, `Tier`,
  `TierTemplate`, `Package`, `PackageItem`, `Feature`, `SolutionPack`,
  `MarketplaceListing`.
- **Tenant config:** `TenantTemplate`, `TenantFeatureFlag`, `ProjectType`.
- **CRM:** `Customer`, `Contact`, `Deal`, `Connector`, `Integration`.
- **Finance:** `Invoice`, `Expense`, `Budget`, `Vendor`, `Payment`.
- **Accounting (NEW 2026-07-30):** `ChartOfAccounts`, `ChartOfAccountsVersion`,
  `LedgerAccount`, `JournalEntry`, `JournalLine`, `AccountingPeriod`,
  `AccountingApproval`, `AccountingApprovalStep`,
  `BeancountSnapshot`, `MerkleRoot`. Plus SoD-enforcing CHECK on
  `JournalEntry`.
- **Onboarding:** `OnboardingState`, `OnboardingAnswer`, `QuestionPack`,
  `OnboardingAllocator`.
- **Compliance / Reliability:** `ComplianceChecklist`, `ComplianceItem`,
  `HealthSnapshot`, `ReliabilityEvent`, `Incident`.
- **Inbox / Routines / Costs:** `InboxItem`, `Routine`, `RoutineRun`,
  `CostRecord`, `BudgetEvent`.
- **Portal:** `PortalAccess`, `PortalInvitation`.
- **Notifications:** `Notification`, `NotificationChannel`.
- **Audit:** `AuditLog`, `AuditEvent`.

### 1.5 Seed scripts
All under `backend/prisma/`. Notable:
- `seed-platform-templates.cjs` — base templates.
- `seed-business-composition.cjs` — six-pool composition seed.
- `seed-industry-templates.cjs` (and 5 sector variants) — industry packs.
- `seed-question-packs.cjs` — onboarding question packs.
- `seed-project-types.cjs` — project type library.
- `seed-onboarding-allocator.cjs` — allocator rules.
- `seed-accounting-agent-slugs.cjs` — accounting agent registrations.
- `seed-accounting-packages.cjs` — accounting solution packs.
- `seed-phase4.cjs`, `seed-phase7.cjs`, `seed-phase8-*.cjs` — phased demo data.
- `seed-tenant.cjs` — base tenant.

`pnpm seed:industry-templates:all` runs the six sector seeders in order.

---

## 2. Redis — cache + idempotency window

- Client: `ioredis` 5.9 + `@upstash/redis` 1.37 (HTTP fallback for
  serverless).
- URL: `REDIS_URL` env.
- Used for:
  - Cache: tenant feature flags, command-center aggregates, dashboard
    snapshots, LLM response caching.
  - Idempotency window: `idempotency_records` rows are mirrored to Redis
    for fast dedup before hitting Postgres.
  - Rate limit counters (ThrottlerGuard).

---

## 3. Neo4j — context graph

- Used by `EnterpriseIntelligenceNetworkModule` for the org context graph
  (departments ↔ projects ↔ agents ↔ customers ↔ goals).
- Driver: `neo4j-driver` (see `backend/package.json`).
- Config: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` env.

Note: Neo4j is referenced in the EAOS vision but is **not** wired in every
environment; check `docker-compose.prod.yml` and the contabo setup before
assuming it's live.

---

## 4. SQLite — Hermes events bridge (local-only)

`hermes_events.db` at repo root is a SQLite store used by the
`hermes-events-bridge` Python service for **dev/test** webhook capture
(Phase 1.4 deliverable). Production writes go to the `HermesAuditLog`
Postgres table via `events-ingest.service.ts`.

`infra/hermes-events-bridge/README.md:18-22` documents this.

---

## 5. Migrations — operational notes

### 5.1 Apply
```bash
cd backend
pnpm prisma migrate deploy
```

### 5.2 Generate
```bash
cd backend
pnpm prisma generate
```
Runs automatically as part of `pnpm install` (`postinstall`).

### 5.3 Create
```bash
pnpm prisma migrate dev --name <name>
```
Generates SQL + Prisma client.

### 5.4 Deploy safety
The atomic deploy script (`scripts/deploy/neurecore-deploy.sh`) runs
`prisma migrate deploy` against the new release's `current` symlink with
bounded retry + exponential backoff. Lock failures abort without touching
the live release.

---

## 6. Backups

Documented in `memory-bank-arc/disaster-recovery.md`. TL;DR (verify against
current ops):
- Postgres: daily pg_dump to offsite bucket.
- Redis: AOF enabled; restart replays.
- Sidecar stores: stateless (Python services regenerate from Postgres).

---

## 7. Connection pool & limits

- Prisma default pool (num_connections=10). Tunable via `?connection_limit=`
  in `DATABASE_URL`.
- Throttler: 100 req/min/IP (NestJS Throttler backed by Redis).

---

## 8. Source pointers

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/` (newest: `20260730_acct_capability_init/`)
- `backend/prisma/seed-*.cjs`
- `backend/src/infrastructure/database/database.module.ts`
- `backend/src/infrastructure/database/prisma.service.ts`
- `backend/src/infrastructure/cache/cache.module.ts`
- `infra/hermes-events-bridge/README.md`
- AGENTS.md at repo root (Phase 9 cert mentions 10 mandatory invariants and
  the persistence-layer integration spec).