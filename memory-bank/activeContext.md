# Active Context — NeureCore Development

## Last Updated

2026-04-04T12:00:00Z (update 24 — LangChain Phase 2: OpenClaw adapter, new tools (12), HITL, pgvector, frontend wiring)

---

## Update 24 — LangChain Phase 2 Complete (April 4, 2026)

**Build result**: 289 files compiled with SWC (326.78ms), 0 TypeScript errors, `prisma generate` success.

### Phase A — OpenClaw Channel Adapter

New files:

- `backend/src/modules/ai-gateway/openclaw.controller.ts` — `@Public()` inbound webhook at `POST /api/v1/openclaw/message`; HMAC-SHA256 via `timingSafeEqual`; fail-closed (rejects all if `OPENCLAW_WEBHOOK_SECRET` not set); verifies tenant/agent ownership; creates Task; fire-and-forget `executorService.executeTask()`
- `backend/src/modules/ai-gateway/openclaw-adapter.module.ts` — `@Module({ imports: [AgentsModule], controllers: [OpenClawWebhookController] })`

Modified files:

- `backend/src/main.ts` — `rawBody: true` for HMAC validation
- `backend/src/modules/ai-gateway/ai-gateway.module.ts` — `rateLimitRps: number` added to `OpenClawConfig`; factory reads `OPENCLAW_RATE_LIMIT_RPS ?? 10`
- `backend/src/modules/ai-gateway/openclaw-gateway.service.ts` — `TokenBucket` rate limiter, audit logging, sanitized error responses
- `backend/src/app.module.ts` — added `OpenClawAdapterModule`
- `backend/src/modules/agents/services/agent-executor.service.ts` — injected `OpenClawGatewayService` + `ApprovalsService`; interrupt detection in stream loop (`__interrupt__` chunk → task PENDING + WS `task:approval:required`); outbound relay after completion (if `channelSource === 'openclaw'` → `openClawGateway.sendMessage()`); added `resumeGraph()` method

### Phase B — New Tools + Registry Fix

Critical bug fixed: `StructuredToolRegistry.toLangChainTools()` returned empty array because no tools were ever registered. Fixed via `ToolsInitializerService implements OnModuleInit`.

New files:

- `backend/src/modules/tools/built-in/web-search.tool.ts` — Serper API; SSRF guard (only `google.serper.dev`); 10s timeout; `maxResults` bounded 1-10
- `backend/src/modules/tools/built-in/database-query.tool.ts` — SELECT-only regex gate; parameterized `$queryRawUnsafe`; max 100 rows
- `backend/src/modules/tools/built-in/email-send.tool.ts` — Nodemailer SMTP; 10/hour/tenant sliding window; plain text only; `import('nodemailer/lib/smtp-transport').Options` for TS overload
- `backend/src/modules/tools/built-in/agent-messaging.tool.ts` — EventsGateway; tenant isolation via DB check; message capped 1000 chars
- `backend/src/modules/tools/built-in/document-summary.tool.ts` — LLMFactory `'execution'` tier; content capped 50,000 chars
- `backend/src/modules/tools/tools-initializer.service.ts` — `OnModuleInit` registers all 7 tools into registry

Modified:

- `backend/src/modules/tools/tools.module.ts` — added `forwardRef(() => EventsModule)` + `ModelsModule` imports; all new tools as providers; `ToolsInitializerService`

Dependency added: `nodemailer@8.0.4` + `@types/nodemailer@7.0.11`

### Phase B.2 — 12 New Agent Tools (April 4, 2026)

All 12 high-priority tools implemented and registered in StructuredToolRegistry:

| #   | Tool                | File                      | Actions                                           |
| --- | ------------------- | ------------------------- | ------------------------------------------------- |
| 1   | Calendar Management | `calendar.tool.ts`        | list, create, update, delete events; availability |
| 2   | Task Management     | `task-management.tool.ts` | CRUD tasks, assign, status updates                |
| 3   | CRM Integration     | `crm.tool.ts`             | HubSpot, Pipedrive - contacts, deals              |
| 4   | Spreadsheet         | `spreadsheet.tool.ts`     | Google Sheets CRUD                                |
| 5   | Document Creation   | `document.tool.ts`        | Templates, format conversion                      |
| 6   | Social Media        | `social-media.tool.ts`    | Twitter, LinkedIn posting                         |
| 7   | Knowledge Base      | `knowledge-base.tool.ts`  | Articles, categories, search                      |
| 8   | Vector Search       | `vector-search.tool.ts`   | pgvector semantic search                          |
| 9   | Code Deployment     | `code-deployment.tool.ts` | Vercel, Netlify deploy                            |
| 10  | Alerting            | `alerting.tool.ts`        | Email, SMS, Slack notifications                   |
| 11  | Banking             | `banking.tool.ts`         | Balance, transactions, transfers                  |
| 12  | Maps                | `maps.tool.ts`            | Geocoding, directions, places                     |

Build result: 301 files compiled with SWC, 0 TypeScript errors.

### Phase C — Frontend Wiring

- `frontend-tenant/src/app/(app)/approvals/page.tsx` — fixed broken endpoint (`api.post('/approvals/${id}/approve')` → `api.patch('/approvals/${id}/review', { status: 'APPROVED'|'REJECTED' })`); added `hqEventBus.on('approval:requested')` real-time refresh; `useCallback` for `fetchApprovals`
- `frontend-tenant/src/app/(app)/tasks/new/page.tsx` — complete rewrite: agent dropdown from `GET /agents`; dispatch via `POST /tasks` → `POST /agents/:id/dispatch`; live WebSocket streaming log (`task:step:start`, `task:tool:call`, `task:completed`, `task:failed`); `hqEventBus.on('task:update')`; auto-scroll ref

### Phase D — LangGraph Human-in-the-Loop

- `backend/src/modules/agents/langgraph/langgraph-official.ts` — added `interrupt`, `MemorySaver`, `Command` from `@langchain/langgraph`; `requiresApproval: Annotation<boolean>` + `approvalId: Annotation<string | null>` in state; `HUMAN_REVIEW_NODE`; `humanReviewNode` calls `approvalsService.create()` then `interrupt()`; `MemorySaver` checkpointer in `initializeGraph()`; `resumeGraph({ threadId, decision })` via `Command`; all 3 initialState objects include `requiresApproval: false, approvalId: null`
- `backend/src/modules/agents/agents.controller.ts` — `GraphResumeDto` class; `POST :id/graph-resume` endpoint

### Phase E — pgvector

- `backend/prisma/schema.prisma` — `embeddingVector Unsupported("vector(1536)")?` on `MemoryEntry`
- `backend/prisma/migrations/20260404_enable_pgvector/migration.sql` — `CREATE EXTENSION IF NOT EXISTS vector`; `ALTER TABLE memory_entries ADD COLUMN IF NOT EXISTS embedding_vector vector(1536)`; `CREATE INDEX USING ivfflat ... vector_cosine_ops WITH (lists = 100)` — **must be applied via Neon SQL console, not `prisma migrate dev`**
- `backend/src/modules/memory/memory.service.ts` — `ENABLE_VECTOR_SEARCH` env flag; when on: `$executeRaw` for vector upsert in `store()`; `$queryRaw` with `<=>` cosine order in `search()`
- `backend/scripts/backfill-embeddings.ts` — batch backfill from existing JSON `embedding` column (100 rows/batch); usage: `npx ts-node -r tsconfig-paths/register scripts/backfill-embeddings.ts`

### Architecture Law (LOCKED)

```
Inbound:  User → OpenClaw → POST /api/v1/openclaw/message (HMAC validated)
                                    ↓
                          AgentExecutorService → OfficialAgentGraph
                          (LangChain/LangGraph owns ALL reasoning)

Outbound: AgentGraph result → OpenClawGatewayService.sendMessage() → OpenClaw → User
```

### HITL Production Flow

Reviewers call `POST /agents/:id/graph-resume` with `{ threadId: UUID, approvalId: UUID, decision: 'APPROVED'|'REJECTED', reason?: string }`

### Environment Variables Added (Phase 2)

| Variable                                           | Purpose                                                        |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `OPENCLAW_WEBHOOK_SECRET`                          | HMAC-SHA256 inbound webhook validation (fail-closed if absent) |
| `OPENCLAW_RATE_LIMIT_RPS`                          | Token bucket RPS per tenant (default: 10)                      |
| `SERPER_API_KEY`                                   | Web search tool                                                |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Email send tool                                                |
| `ENABLE_VECTOR_SEARCH`                             | `true` to activate pgvector path in memory service             |

---

## Update 23 — Chat Module, Analytics Summary, Tenants/Me (April 4, 2026)

---

## Update 23 — Chat Module, Analytics Summary, Tenants/Me (April 4, 2026)

### New Endpoints

| Endpoint                 | Controller              | Notes                                                |
| ------------------------ | ----------------------- | ---------------------------------------------------- |
| `POST /chat/messages`    | chat.controller.ts      | Send message, returns AI reply (data-driven, no LLM) |
| `GET /chat/history`      | chat.controller.ts      | Last 50 messages for tenant                          |
| `DELETE /chat/history`   | chat.controller.ts      | Clear all messages for tenant                        |
| `POST /chat/suggestions` | chat.controller.ts      | Returns 4 contextual suggestion strings              |
| `GET /analytics/summary` | analytics.controller.ts | Returns agents/tasks/workflows counts                |
| `GET /tenants/me`        | tenants.controller.ts   | Current tenant from JWT (no role restriction)        |

### New Files Created

- `backend/src/modules/chat/chat.service.ts` — pure Prisma, no LLM; stores/retrieves ChatMessage records
- `backend/src/modules/chat/chat.controller.ts` — 4 routes for send/history/clear/suggestions
- `backend/src/modules/chat/chat.module.ts` — no extra imports needed (DatabaseModule + CacheModule are @Global)
- Registered `ChatModule` in `app.module.ts`

### TypeScript Fixes Applied

- `chat.controller.ts`: removed invalid import of `CurrentUser` (use `@Req() req`)
- `chat.module.ts`: corrected `PrismaModule` path → `DatabaseModule`
- `chat.service.ts`: `agent.role` → `agent.type`; `TaskStatus.IN_PROGRESS` → `TaskStatus.RUNNING`

### Critical: `nest start --watch` SWC Output Behaviour

SWC watch mode writes compiled output to `dist/` (no `src/` prefix). `start:prod` uses `dist/src/main.js`.
These are **different paths** — watch mode does NOT update the `start:prod` path.

**Reliable dev start**: `cd backend && node dist/main.js >> /tmp/nodetest.log 2>&1 &`

After code changes: run `pnpm run build` to update `dist/src/`, then restart with `node dist/src/main.js`.

### E2E Test Status (April 4, 2026)

- File: `backend/e2e-dashboard-comprehensive.mjs` (15 phases)
- Test user: `jane@gmail.com` / `Jane1234`, tenantId: `2c5dfced-7289-48bc-8605-052c3849d742`
- **Result: 29 PASSED, 0 FAILED, 15 WARNINGS** (unimplemented endpoints are expected warnings)

### Prisma Enum Facts (use these, never guess)

| Enum           | Valid values                                                              |
| -------------- | ------------------------------------------------------------------------- |
| `TaskStatus`   | `PENDING, QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED` (no IN_PROGRESS) |
| `TaskPriority` | `LOW, MEDIUM, HIGH, CRITICAL` (uppercase)                                 |
| `Agent.type`   | string field (not `role`)                                                 |

---

## Architecture Overview

- **Production Backend**: NestJS on Contabo (PM2 id 24), port 3003, proxied via LiteSpeed → `brain.neurecore.com`
- **Production/Dev DB**: **Neon PostgreSQL** — `ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech/neondb` (confirmed April 3, 2026)
- **Production/Dev Cache**: **Upstash Redis REST** — `lasting-gobbler-72608.upstash.io`
- **Contabo VPS**: Legacy — SSH tunnel details obsolete. Both env files point to Neon + Upstash.
- **Docker**: Not in active use

### Contabo Server

- **IP**: `109.123.248.253`, SSH alias `contabo` (`~/.ssh/id_contabo`)
- **OS**: Ubuntu 24.04.3 LTS, 11GB RAM, 96GB disk
- **PostgreSQL**: 16.13 — `neurecore_prod` (**39 tables**, 11 migrations applied)
- **Redis**: 7.0.15, password protected, `maxmemory 512MB`, bound to `127.0.0.1` only
- **LiteSpeed**: `brain.neurecore.com` VHost working
- **PM2**: Backend id 24 (`neurecore-backend`) — using Contabo DB + Redis directly

### 9. Registration → Onboarding Wizard Redirect — FIXED (April 1, 2026)

- **Root cause**: `useEffect` guard in `register/page.tsx` always redirected authenticated users
  to `/dashboard`, overriding the intended `/onboarding` redirect after `setUser()` was called.
  New users with `tenantId: null` bypassed the onboarding wizard entirely.
- **Fixes**:
  - `frontend-tenant/src/app/register/page.tsx`: guard now checks `user.tenantId`; null → `/onboarding`, set → `/dashboard`
  - `frontend-tenant/src/app/onboarding/page.tsx`:
    - Added auth guard: unauthenticated → `/register`; already-onboarded (`user.tenantId` set) → `/dashboard`
    - After `completeWizard()`, calls `authService.me()` to refresh auth store with the new `tenantId`, preventing re-redirect loop back to onboarding on subsequent navigation
- **Result**: New registrations land on onboarding wizard; completed users proceed to dashboard ✅

### 10. Full Registration → Onboarding → Dashboard-v2 Flow — FIXED (April 1, 2026 evening)

Complete audit and overhaul of the sign-up journey. Five root causes fixed:

**Backend fixes:**

- `onboarding.service.ts` — `completeWizard()`: no longer unconditionally creates a new user. If email already exists (registered via `/auth/register`), updates the existing user's `tenantId` instead of crashing with a unique-constraint error. Also creates the tenant inline if the departments step was skipped.
- `onboarding.service.ts` — new `startAuthenticatedWizard(email)` method: creates a Redis wizard state using an authenticated user's email without the email-conflict check that `startOnboarding` enforces.
- `onboarding.controller.ts` — new `POST /onboarding/start-authenticated` (JWT-guarded): calls `startAuthenticatedWizard` with the JWT-decoded email. Imports: `UseGuards`, `Request`, `JwtAuthGuard`.
- `auth.controller.ts` — `me()` and `profile()` enriched: both now query `prisma.tenant` (with tier) and return `{ ...user, tenant: { id, name, slug, logoUrl, industry, tier: { id, name, slug, maxAgents, maxUsers } } }`.

**Frontend fixes:**

- `types/auth.types.ts`: added `TenantProfile` interface; `AuthUser.tenant?: TenantProfile | null`.
- `services/onboarding.service.ts`: added `startAuthenticatedWizard(accessToken)` method (POST with Bearer token).
- `app/register/page.tsx`: **completely redesigned** — dark theme (`bg-[#0d0d12]`, violet accents), 2-step UI (account details → plan selection with 3 tier cards). On submit: calls `/auth/register`, then `startAuthenticatedWizard` using `tokenManager.getAccessToken()`, sets `wizardId`/`tempToken` in onboardingStore, skips to `WizardStep.ORGANIZATION`, navigates to `/onboarding`.
- `app/onboarding/page.tsx`: if authenticated + no `wizardId` → auto-calls `startAuthenticatedWizard` and skips `WelcomeStep`. `completeWizard` now redirects to `/dashboard-v2`. Loading spinner styled dark.
- `components/TenantShell.tsx`: brand area now shows `user.tenant.logoUrl` as `<img>` (or letter-avatar fallback) and `user.tenant.name` (falls back to "NeureCore"). Tier name shown as subtitle.
- `components/onboarding/AgentsStep.tsx`: replaced no-op with a tier-aware grid of 8 named AI employees (Eva, Marcus, Aria, Leo, etc.) sliced to `tier.maxAgents`. Shows name, role, icon. "Deploy Team" button advances the wizard.

**Build result**: 30 pages compiled, 0 TypeScript errors ✅

**Flow now**:

```
register (2-step: account + plan) → /auth/register → startAuthenticatedWizard → wizardId stored
→ /onboarding (ORGANIZATION step, WelcomeStep skipped)
→ ... org / admin / plan / departments / team / integrations / agents / security / review
→ completeWizard() → existing user linked to new tenant → authService.me() refresh
→ /dashboard-v2 (TenantShell shows company name/logo from tenant data)
```

### 11. Register Race Condition + Legacy `/dashboard` Escape Hatch — FIXED (April 1, 2026 late evening)

- **Race condition** (`register/page.tsx`): `setUser()` was called immediately after `/auth/register`, firing the `useEffect` guard before `startAuthenticatedWizard` completed. The onboarding page could mount with no `wizardId`. Fixed by moving `setUser()` to **last** — after `startWizard()` and `setCurrentStep()` have updated the store.
- **Legacy dashboard** (`dashboard/page.tsx`): any path hitting `/dashboard` now immediately does `router.replace("/dashboard-v2")`. Added `useRouter` import. Prevents stale sessions from looping to `/login` via the dead legacy page.
- 0 TypeScript errors ✅, dev server hot-reloaded ✅

### 13. Dashboard TypeError + Stale Cache Fix (April 3, 2026)

- **Error**: `TypeError: (intermediate value)(intermediate value)(intermediate value).slice is not a function` at `page.tsx:82`
- **Root cause**: Browser running a stale `.next` compiled bundle from before the `Array.isArray` guard was added. Source-map line numbers were off by ~100 lines.
- **Secondary cause**: `try...finally` (no `catch`) in dashboard `useEffect` → unhandled promise rejection on any load error.
- **Fixes**:
  - Cleared entire `.next` build cache (`find .next -mindepth 1 -delete`)
  - Added `catch {}` block to `load()` in `frontend-tenant/src/app/(app)/dashboard/page.tsx` — dashboard degrades silently to empty state on API errors
- **Note**: `Array.isArray` guards before every `.slice()` are correct in source AND compiled code.

## Production Fixes Applied (March 31, 2026) ✅

### LiteSpeed 404 Root Cause — FIXED

### 12. Workspace Auto-Provisioning Feature — COMPLETE (April 3, 2026)

Full 8-phase implementation on branch `tenant-base`. Zero TypeScript errors after completion.

**DB**: 2 new tables (`provisioning_configs`, `provisioning_jobs`), 5 new enums — created via raw SQL (Neon drift prevents `migrate dev`), then `prisma generate` run.

**Backend module**: `backend/src/modules/workspace-provisioning/` — 8 files, SOLID:

- PROVISIONING_PROVIDERS Symbol token (OCP), IProvisioningProvider interface (DIP), ProvisioningJobService (SRP), ProvisioningOrchestratorService (OCP+DIP)
- 8 REST endpoints under `/api/v1/workspace-provisioning`
- OAuth: Google (`admin.directory.v1` — stub TODO) + Microsoft (`Graph API` — stub TODO)
- OAuth tokens stored plaintext with TODO to encrypt (AES-256-GCM)
- Hooked into `completeWizard`: creates ProvisioningConfig + ProvisioningJob[] when `wp.enabled`

**Frontend**:

- `types/onboarding.types.ts` — 3 new enums + 3 new interfaces + WizardData extended
- `stores/onboardingStore.ts` — `setWorkspaceProvisioningData` action
- `services/workspace-provisioning.service.ts` — 6 methods, triple-fallback extract
- `IntegrationsStep.tsx` — workspace provisioning panel renders when storage integration selected
- `dashboard/WorkspaceProvisioningBanner.tsx` — amber banner with sessionStorage dismiss, CTA → `/settings?tab=workspace`
- `dashboard/page.tsx` — banner rendered above KPI bar, status fetched in parallel
- `settings/page.tsx` — full rewrite; 5th "Workspace" tab: config summary, Connect OAuth button, jobs table, "Provision all pending" button

**Key patterns**:

- `?tab=workspace` URL param auto-selects workspace tab (Suspense + useSearchParams)
- `sessionStorage` key `wp_banner_dismissed` for banner dismiss
- `window.location.href` redirect for OAuth (not `router.push`)
- Jobs table: Name / Invited Email / Corporate Email (or "Pending") / Status chip

---

### Previous Fixes (March–April 2026)

in `/usr/local/lsws/conf/httpd_config.conf` (line ~388). All subsequent VHosts
(including `brain.neurecore.com`) were parsed as nested inside endtime — invisible
as top-level VHosts.

- **Fix**: `sed` inserted missing `}` after the `restrained 1` line.
- **VHost config** (`/usr/local/lsws/conf/vhosts/brain.neurecore.com/vhost.conf`):
  restored to CyberPanel format — `extprocessor nodeapi { type proxy; address 127.0.0.1:3003 }`
- **Result**: `brain.neurecore.com` returns HTTP 200 ✅

### Neon DB Schema Fixes — FIXED

- `tiers` table: added 13 missing columns (`slug`, `isDefault`, `monthlyPrice`, `yearlyPrice`,
  `currency`, `sortOrder`, `maxApiCalls`, `maxConversationMessages`, `maxFileSizeMB`,
  `allowCustomBranding`, `allowApiAccess`, `allowSso`, `allowAuditExport`)
- Renamed `maxStorageGb` → `maxStorageGB` (Prisma casing match)
- Set slugs: `starter` (isDefault=true, sortOrder=1), `professional`, `enterprise`
- `tenants.tierId`: set to `'tier_starter'` for NULL rows; column made NOT NULL with default

### `agents.isSelected` Column Added — FIXED (March 31, 2026 11:15)

- **Root cause**: Neon DB `agents` table was missing the `isSelected` column which exists
  in `prisma/schema.prisma` line 493 (`isSelected Boolean @default(true)`). The column
  was present in schema but no migration had applied it against Neon.
- **Symptom**: `GET /api/v1/agents` → HTTP 500: `The column 'agents.isSelected' does not exist`
- **Fix**: `ALTER TABLE agents ADD COLUMN IF NOT EXISTS "isSelected" BOOLEAN NOT NULL DEFAULT true;`
  applied directly to Neon DB. `prisma migrate status` confirmed all 10 migrations now up to date.
- **Result**: `/agents` returns HTTP 200, all frontend-admin data endpoints working ✅

### Data on Contabo DB (April 1, 2026) ✅

| Table                | Records |
| -------------------- | ------- |
| tiers                | 3       |
| tenants              | 2       |
| users                | 8       |
| agent_templates      | 99      |
| department_templates | 9       |
| agents               | 0       |
| All other tables     | 0       |

## Current Running Services (Local Dev) ✅

| Service         | Port        | Database                                    |
| --------------- | ----------- | ------------------------------------------- |
| NestJS Backend  | 3000        | Contabo PG via SSH tunnel (127.0.0.1:15433) |
| Frontend Tenant | 3001        | —                                           |
| Frontend Admin  | 3002        | —                                           |
| SSH Tunnel      | 15433/16380 | Contabo PG + Redis                          |

> Start tunnel: `ssh -f -N -L 15433:127.0.0.1:5432 -L 16380:127.0.0.1:6379 contabo`
> Backend: `cd backend && npm run start:dev`
> Frontend: `cd frontend-tenant && npm run dev`

> Start local dev: `ssh -f -N -L 15433:127.0.0.1:5432 -L 16380:127.0.0.1:6379 contabo && pnpm run start:local-contabo`

## Session 2 Fixes (March 31, 2026 — afternoon) ✅

### Neon DB — 4 Tables camelCase Column Drift Fixed

Prisma expects camelCase column names but migration SQL created snake_case. Applied `ALTER TABLE` to add missing columns:

- `crm_connectors`: added `"createdAt"`, `"updatedAt"`
- `analytics_models`: added `"tenantId"`, `"createdAt"`, `"updatedAt"`
- `analytics_features`: added `"tenantId"`, `"createdAt"`
- `tenant_limits`: added `"tenantId"`, `"createdAt"`, `"updatedAt"`

### Recharts Width(-1) Warning Fixed

- `frontend-admin/src/components/charts/AreaChart.tsx`: Added `width: "100%"` to container div
- `frontend-admin/src/components/charts/LineChart.tsx`: Added `width: "100%"` to container div

### Finance Module — SUPER_ADMIN 500 Fixed

- **File**: `backend/src/modules/finance/services/invoice.service.ts`
  - `findAll(tenantId: string | null, ...)` — null means no WHERE filter (all invoices)
- **File**: `backend/src/modules/finance/controllers/finance.controller.ts`
  - `listInvoices()` passes `null` for SUPER_ADMIN with no explicit `tenantId` param
- **Pattern**: `resolveTenantId()` throws for SUPER_ADMIN; bypass by checking role first
- **Verified**: `GET /finance/invoices` → 200 ✅

### Observability Module — SUPER_ADMIN 403 Fixed

- **Root cause**: All 5 endpoints had `if (!user.tenantId) throw ForbiddenException('Tenant context required')`
- **File**: `backend/src/modules/observability/observability.controller.ts`
  - All endpoints now check `isSuperAdmin` — SUPER_ADMIN passes `null` tenantId, no 403
- **File**: `backend/src/modules/observability/services/observability.service.ts`
  - All method signatures updated to `tenantId: string | null`
  - When null: WHERE clause omitted → platform-wide data returned
  - `getTenantKpis(null)` → delegates to `getPlatformSummary()`
- **Verified**: `/observability/logs`, `/observability/kpis`, `/observability/metrics` → 200 ✅

### Backend Rebuilt & Restarted

- Rebuilt after finance fix (PID 241197), then again after observability fix (PID 251433)
- Port 3000 LISTEN confirmed after each restart

### Pattern to Watch: SUPER_ADMIN Tenant-Guard Failures

Any controller using `if (!user.tenantId) throw ForbiddenException('Tenant context required')` will fail for SUPER_ADMIN. Pattern to apply:

```typescript
const isSuperAdmin = ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(
  user.role ?? "",
);
if (!user.tenantId && !isSuperAdmin)
  throw new ForbiddenException("Tenant context required");
const tenantId = user.tenantId ?? null; // pass null to service
// In service: (tenantId !== null && { tenantId }) — omit filter when null
```

## Environment Configuration (backend/.env — local dev)

- **NODE_ENV**: development
- **DATABASE_URL**: `postgresql://neurecore_app:NeureCoreApp2026!SecureDBPass@127.0.0.1:15433/neurecore_prod?sslmode=prefer`
- **REDIS_URL**: `redis://:kPzbcTiOQBWwTs6dr4xinAWfXhbUv3AFjRdkjhvxQ=@127.0.0.1:16380/0`
- **TENANT_FRONTEND_URL**: `http://localhost:3001`
- **ADMIN_FRONTEND_URL**: `http://localhost:3002`
- **ADDITIONAL_CORS_ORIGINS**: `http://localhost:3001,http://localhost:3002,https://hq.neurecore.com,https://cc.neurecore.com`

> Local dev script: `pnpm run start:local-contabo` (uses `.env.local-contabo`)

## Superadmin Credentials

- **Email**: `mnpiracha@gmail.com`
- **Password**: `Admin@123!`
- **Script**: `backend/scripts/make-superadmin.mjs`

## SSH Tunnel Management

```bash
# Check tunnel status
ss -tlnp | grep -E '15433|16380'

# Start tunnel (if down)
ssh -f -N \
  -L 15433:localhost:5432 \
  -L 16380:localhost:6379 \
  root@109.123.248.253

# PID stored at: /tmp/neurecore_tunnel.pid (currently 85338)
```

## Recent DevOps Operations (March 31, 2026)

1. Fixed LiteSpeed httpd_config.conf missing `}` → `brain.neurecore.com` now 200
2. Fixed Neon `tiers` schema drift (13 columns added, slug populated)
3. Fixed `tenants.tierId` NULL → `'tier_starter'` for existing rows
4. Verified all production data via live API (brain.neurecore.com)
5. Updated `backend/.env` for local dev (NODE_ENV=development, localhost CORS)
6. Started full local dev stack: backend (3000), admin (3002), tenant (3001) — all connected to Contabo DBs via SSH tunnel
7. Created `docs/CONTABO_MIGRATION_PLAN.md` — comprehensive 6-phase plan
8. Added merge+delete `neurecore_dev`, local Docker cleanup to plan
9. UMB sync: Updated `progress.md` + `activeContext.md`

## Contabo Migration Plan Summary

**See**: `docs/CONTABO_MIGRATION_PLAN.md` for full details.

| Phase | Description                                            | Status  |
| ----- | ------------------------------------------------------ | ------- |
| 1     | Security hardening (Redis pass, pg_hba, firewall)      | ✅ Done |
| 2     | DB merge `neurecore_dev` → `neurecore_prod` + drop dev | ✅ Done |
| 3     | Backend config pointing to Contabo DBs                 | ✅ Done |
| 4     | Neon — dev branching only                              | ✅ Done |
| 5     | Production cutover (local)                             | ✅ Done |
| 6     | Full deployment (Contabo backend + Vercel frontends)   | Pending |

## SSH Tunnel (Local Access to Contabo)

**IMPORTANT**: Contabo PostgreSQL binds to 127.0.0.1 only (security hardening).

**Solution**: SSH tunnel for local development access

```bash
./backend/scripts/ssh-tunnel.sh start   # Start tunnel
./backend/scripts/ssh-tunnel.sh stop    # Stop tunnel
./backend/scripts/ssh-tunnel.sh status   # Check status
```

**Ports**:

- PostgreSQL: `localhost:15433` → `contabo:5432`
- Redis: `localhost:16380` → `contabo:6379`

## Deployment Architecture

### CURRENT SETUP (Phase 5a - March 30, 2026) ✅

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LOCAL DEVELOPMENT MACHINE                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │   Backend    │  │  Tenant UI   │  │  Admin UI    │                 │
│  │  localhost   │  │  localhost   │  │  localhost   │                 │
│  │   :3000      │  │   :5173      │  │   :3001      │                 │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                 │
│         │                  │                  │                          │
│         └──────────────────┴──────────────────┘                          │
│                               │                                           │
│                    ┌──────────▼──────────┐                               │
│                    │     SSH Tunnel      │                               │
│                    │  127.0.0.1:15433 ───┼──► Contabo :5432 (PG)       │
│                    │  127.0.0.1:16380 ───┼──► Contabo :6379 (Redis)    │
│                    └─────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTABO SERVER (109.123.248.253)                 │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL 16        Redis 7                                          │
│  neurecore_prod       (bound to 109.123.248.253)                       │
│  neurecore_dev        Password: kPzbcTiOQBWw...                        │
│                                                                         │
│  ✅ Vercel IPs allowed (76.76.0.0/16)                                   │
│  ✅ UFW ports open for Vercel                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### FUTURE SETUP (Phase 6 - Later)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           VERCEL CLOUD                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐                                    │
│  │  Tenant UI   │  │  Admin UI    │                                    │
│  │ hq.neurecore │  │ cc.neurecore  │                                    │
│  │   .com       │  │   .com        │                                    │
│  └──────┬───────┘  └──────┬───────┘                                    │
│         │                  │                                            │
│         └────────┬─────────┘                                            │
│                  │                                                      │
│                  ▼                                                      │
│         ┌───────────────┐                                               │
│         │   Backend     │  (Vercel Serverless Functions)                │
│         │  (Contabo)    │                                               │
│         └───────┬───────┘                                               │
│                 │                                                       │
└─────────────────┼─────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONTABO SERVER (109.123.248.253)                 │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL 16        Redis 7                                          │
│  neurecore_prod       (bound to 109.123.248.253)                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## Configuration Files

### Local Development (Current)

| Component | Config File                       | Connects To                          |
| --------- | --------------------------------- | ------------------------------------ |
| Backend   | `backend/.env.local-prod`         | SSH tunnel (127.0.0.1:15433, :16380) |
| Tenant UI | `frontend-tenant/.env.local-prod` | localhost:3000                       |
| Admin UI  | `frontend-admin/.env.local-prod`  | localhost:3000                       |

### Vercel Deployment (Future)

| Component | Config File           | Connects To                      |
| --------- | --------------------- | -------------------------------- |
| Backend   | `backend/.env.vercel` | Contabo direct (109.123.248.253) |
| Frontends | Vercel Dashboard      | Vercel Backend                   |

## Phase 5: Production Cutover — COMPLETED ✅ (March 30, 2026)

### Contabo Infrastructure Configuration

**PostgreSQL (Contabo):**

- ✅ pg_hba.conf: Vercel IPs (76.76.0.0/16) allowed
- ✅ UFW: Port 5432 open for 76.76.0.0/16
- ✅ DATABASE_URL: postgresql://neurecore_app:...@109.123.248.253:5432/neurecore_prod?sslmode=require

**Redis (Contabo):**

- ✅ Redis bind: Changed from 127.0.0.1 to 109.123.248.253
- ✅ UFW: Port 6379 open for 76.76.0.0/16
- ✅ REDIS_URL: redis://:kPzbcTiOQBWwTs6dr4xinAWfXhbUv3AFjRdkjhvxQ=@109.123.248.253:6379/0

### Local Backend Test (via SSH Tunnel)

- ✅ Backend running on localhost:3000
- ✅ PostgreSQL connected (SSH tunnel: 127.0.0.1:15433 → Contabo:5432)
- ✅ Redis connected (SSH tunnel: 127.0.0.1:16380 → Contabo:6379)
- ✅ Health check: GET /api/v1/health → 200 OK

## Notes

- All services are ready for development
- SSH tunnel is REQUIRED for local backend to connect to Contabo DBs
- Docker containers to remain until Contabo is fully tested
- Phase 3 complete: Prisma schema synced to Contabo PostgreSQL ✓

## ✅ RESOLVED: Prisma Column Drift ("Column Does Not Exist" Error)

**Date resolved**: 2026-04-01  
**Root cause**: Production backend was still pointing to Neon cloud DB (via `/opt/neurecore/backend/backend/.env`) instead of Contabo. Neon had missing/mismatched columns from ad-hoc SQL patches.  
**Fix**: Migrated all data from Neon to Contabo. Updated production env files (correct path: `/opt/neurecore/backend/backend/.env` and `.env.production`). Baselined all 11 Prisma migrations. Removed `driftSafeAgentSelect` and `driftSafeTenantSelect` fallback guards from services.  
**Result**: Contabo schema is clean, all columns exist as Prisma expects. ✅

## 🆕 NEXT PRIORITY: Agent Tool Connectors

**See**: `memory-bank/progress.md` → "NEXT: Agent Tool Connectors"

| Capability                         | Priority    |
| ---------------------------------- | ----------- |
| Email (SMTP/IMAP)                  | 🔴 Critical |
| Document Creation                  | 🔴 Critical |
| Spreadsheet                        | 🔴 Critical |
| File Storage                       | 🔴 Critical |
| Social APIs (Meta, LinkedIn, etc.) | 🔴 Critical |

This enables agents to function as true "digital employees".

## 🆕 NEXT PRIORITY: Next.js Metadata Fix

**Date**: 2026-03-31
**Status**: ✅ RESOLVED

### Problem Summary

Next.js 15.5.12 was throwing warnings about `themeColor` being configured in `metadata` export instead of `viewport` export:

```
Unsupported metadata themeColor is configured in metadata export in /login. Please move it to viewport export instead.
```

### Root Cause

Next.js 15 introduced the `generateViewport` function (or `viewport` export) for viewport-specific metadata, including `themeColor`. The `themeColor` property should no longer be in the `metadata` export.

### Fix Applied

**File**: `frontend-tenant/src/app/layout.tsx`

- Imported `Viewport` type from 'next'
- Removed `themeColor: '#09090b'` from `metadata` export
- Added new `viewport` export with `themeColor` property

```typescript
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "NeureCore — Tenant Portal",
  description: "Tenant workspace",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};
```

### Verification

- ✅ No more warnings about `themeColor` in metadata export
- ✅ All pages (/login, /dashboard, /departments, etc.) will now use the correct viewport configuration
- ✅ Next.js 15.5.12 supports the `viewport` export

### Files Modified

- `frontend-tenant/src/app/layout.tsx` - Moved `themeColor` from `metadata` to `viewport`

---

## April 2, 2026 — Redis Upstash Double-Serialization Fix

**Root cause**: `RedisService.setJson/getJson` was calling `JSON.stringify/parse` on values that Upstash REST client already auto-serializes. Fixed by bypassing JSON operations when `upstashClient` is active.

**File**: `backend/src/infrastructure/cache/redis.service.ts`

---

## April 3, 2026 — Full 9-Step Wizard Rebuild + E2E Verified

### Wizard Steps (9 active, WELCOME skipped)

ORGANIZATION → ADMIN → PLAN → DEPARTMENTS → TEAM → INTEGRATIONS → AGENTS → SECURITY → REVIEW

### Components Rebuilt

- **AgentsStep.tsx**: Fetches real templates from `/onboarding/agent-templates`, calls `POST /onboarding/agents`
- **TeamStep.tsx**: firstName/lastName/email/role form, calls `POST /onboarding/invitations`
- **IntegrationsStep.tsx**: Toggle UI for 9 types, stores locally — `completeWizard` creates DB records
- **onboarding/page.tsx `ACTIVE_STEPS`**: Expanded from 5 → 9 steps

### Backend Changes

- `InvitationInputDto.departmentId`: `@IsOptional()` (service doesn't use it)
- `AgentConfigInputDto.departmentId`: `@IsOptional()`
- `WizardData` interface: both `departmentId` fields optional
- `configureAgents`: Tenant creation fallback if departments step was skipped
- `completeWizard`: Idempotent — deploys agents/invitations/integrations from wizard state

### Frontend Fixes

- AgentsStep: removed duplicate old code (was 330 lines → 191 clean)
- IntegrationsStep: removed duplicate interface (was 121 lines → 115 clean)
- `frontend-tenant/src/types/onboarding.types.ts`: `InvitationInputDto.departmentId` optional

### E2E Test

**File**: `backend/e2e-wizard-full.mjs`
All 11 steps pass: register → start-authenticated → 9 wizard steps → completeWizard → tenantId confirmed

### Correct Onboarding Endpoint Reference

| Endpoint                          | Method | Success Status                 |
| --------------------------------- | ------ | ------------------------------ |
| `/onboarding/start-authenticated` | POST   | 201 (requires JWT)             |
| `/onboarding/organization`        | PUT    | 200                            |
| `/onboarding/admin`               | PUT    | 200                            |
| `/onboarding/plans`               | GET    | 200                            |
| `/onboarding/plan`                | PUT    | 200                            |
| `/onboarding/departments`         | POST   | 201                            |
| `/onboarding/invitations`         | POST   | 201                            |
| `/onboarding/integrations`        | POST   | 201 (one call per integration) |
| `/onboarding/agent-templates`     | GET    | 200                            |
| `/onboarding/agents`              | POST   | 201                            |
| `/onboarding/security`            | PUT    | 200                            |
| `/onboarding/complete`            | POST   | 200                            |

### Enum Values

- `Industry`: `TECHNOLOGY`, `FINANCE`, `HEALTHCARE`, `RETAIL`, `MANUFACTURING`, `EDUCATION`, `LEGAL`, `CONSULTING`, `MEDIA`, `REAL_ESTATE`, `HOSPITALITY`, `TRANSPORTATION`, `ENERGY`, `GOVERNMENT`, `NON_PROFIT`, `OTHER`
- `CompanySize`: `STARTUP`, `SMALL`, `MEDIUM`, `LARGE`, `ENTERPRISE`
- `UserRole`: `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `AGENT`, `VIEWER`
- `BillingCycle`: `MONTHLY`, `YEARLY`

### Build Status

- Backend: ✅ Clean
- Frontend-tenant: ✅ Clean (29 pages, `/onboarding` = 9.73 kB)

---

## April 3, 2026 — Admin ↔ Tenant Architecture Mapped

### Connection Model

Both frontends hit the **same** NestJS backend (brain.neurecore.com/api/v1). No direct frontend-to-frontend communication.

### Auth Separation

- Admin frontend: `localStorage.admin_accessToken`, SUPER_ADMIN JWT role
- Tenant frontend: `tokenManager` / key `hq_accessToken`, TENANT roles
- Backend enforces role separation per endpoint

### Admin Controls That Affect Tenants

1. **Tier/Plan CRUD** (`/tiers`) — sets `maxAgents`, `maxUsers`, features for every tenant subscribing to that plan
2. **Platform Agent Templates** (`/agent-templates/platform`) — the templates tenants see in wizard step
3. **Dept Template Deployment** (`POST /deploy/tenants/{id}/dept-template`) — creates Department records inside a tenant
4. **Direct Agent Deployment** (`POST /deploy/tenants/{id}/agents`) — bypasses tenant wizard
5. **Cross-tenant agent fleet** (`GET /agents`) — all agents across all tenants
6. **Global user management** (`GET /users`) — all users across all tenants
7. **Platform settings** (`PATCH /platform/*`) — security policy, notifications, integrations
8. **Admin Metrics / KPIs** — cross-tenant usage dashboards

---

## April 3, 2026 — Recurring Bug Patterns Fixed (Session 2)

### 1. Register 400 — lastName empty string

**Root cause**: Single "Full name" field split on space → `lastName = ''` → fails `@MinLength(1)`.
**Files changed**:

- `backend/src/modules/auth/dto/register.dto.ts`: `lastName` → `@IsOptional()`, removed `@MinLength(1)`
- `backend/src/modules/auth/interfaces/auth.interface.ts`: `RegisterInput.lastName` → `lastName?: string`
- `backend/src/modules/auth/services/auth.service.ts`: `data.lastName ?? ''` (DB requires non-null String)
- `frontend-tenant/src/types/auth.types.ts`: `RegisterPayload.lastName` → `lastName?: string`
- `frontend-tenant/src/app/register/page.tsx`: single-name → `lastName = undefined`, spread-omits from payload

### 2. Dashboard `.slice() is not a function` crash

**Root cause**: `TransformResponseInterceptor` wraps all responses in `{ status, data, meta }`. Paginated list endpoints (agents, tasks) return `{ data: [], total, page, ... }` themselves. Array is at `axiosResponse.data.data.data` (3 levels). Pages only did `res.data?.data` → got pagination object → `.slice()` crash.
**Fix pattern**: `res.data?.data?.data ?? res.data?.data ?? res.data ?? []` + `Array.isArray()` guard.
**Files changed**:

- `frontend-tenant/src/app/(app)/dashboard/page.tsx`: both `rawAgents` and `rawTasks` extraction fixed
- `frontend-tenant/src/app/(app)/agents/page.tsx`: `setAgents` extraction fixed
- `frontend-tenant/src/app/(app)/workflows/page.tsx`: `setWorkflows` extraction fixed

### 3. WebSocket repeated connection failures

**Root cause**: `auth: { token: tokenManager.getAccessToken() }` captures token at socket-object-creation time. Socket is created before user logs in → `null` token → gateway rejects → retry loop.
**Fix**: Changed to callback form `auth: (cb) => cb({ token: tokenManager.getAccessToken() })` — token is read fresh on every connection/reconnection attempt.
**Files changed**:

- `frontend-tenant/src/services/socket.ts`
- `frontend-tenant/src/core/infrastructure/socket/SocketManager.ts`

### Lint / type errors fixed

- `backend/src/modules/onboarding/onboarding.service.ts`: remove unused `UserRole` import
- `backend/src/modules/onboarding/onboarding.controller.ts`: remove unused `Version` import
- `backend/src/modules/onboarding/dto/onboarding.dto.ts`: remove unused `IsPhoneNumber` import
- All `user?.name` references replaced with `user.firstName`/`user.lastName` (AuthUser has no `name` field)
- `frontend-tenant/src/app/(app)/agents/new/page.tsx`: remove conflicting `block` class from `flex` label
- `backend/e2e-wizard-full.mjs`: add `/* eslint-disable no-console */` at top

---

## April 3, 2026 — Infrastructure Correction: Back on Neon + Upstash

**Previous entries saying "Contabo is production, Neon/Upstash obsolete" are WRONG as of this session.**

Both `backend/.env` (local dev) and `backend/.env.production` currently point to:

- **Database**: Neon PostgreSQL (`ep-summer-pond-adpkqy1m-pooler.c-2.us-east-1.aws.neon.tech/neondb`)
- **Cache**: Upstash Redis (`lasting-gobbler-72608.upstash.io`) via REST client

**Contabo VPS + SSH tunnel are obsolete** — not referenced in any active .env file.
The `backend/scripts/ssh-tunnel.sh` and `contabo/` folder can be disregarded.

### Current Active Infrastructure (April 3, 2026)

| Layer                 | Service                                          |
| --------------------- | ------------------------------------------------ |
| Database              | Neon PostgreSQL (pooled, AWS us-east-1)          |
| Cache / Sessions      | Upstash Redis (REST client via `@upstash/redis`) |
| Backend (dev)         | Local NestJS port 3000                           |
| Backend (prod)        | Vercel — `brain.neurecore.com`                   |
| Frontend-tenant (dev) | Local Next.js port 3001                          |
| Frontend-admin (dev)  | Local Next.js port 3002                          |
| Frontend (prod)       | Vercel — `hq.neurecore.com` / `cc.neurecore.com` |

---

## April 3, 2026 — Connector Duplicate Bug Fix + Dashboard E2E Verification

### Bug: Duplicate connectors created after wizard completion

**Root cause**: `onboarding.service.ts` `addIntegration` was pushing `integration.id` (a UUID) into `wizardData.integrations[]`. `completeWizard` iterated those values as type strings (e.g. `CRM_SALESFORCE`) — the idempotency check `findFirst({ provider: <uuid> })` never matched → created a second connector per integration with the UUID as its provider. Result: 4 connectors instead of 2.

**Fix** (one line in `addIntegration`):

```ts
// Before: integrations.push(integration.id);
// After:
integrations.push(dto.type); // store the type string, not the record UUID
```

### New E2E test: `backend/e2e-dashboard-flow.mjs`

Full 6-phase test covering the complete user journey:

1. `POST /auth/register` (201)
2. `POST /onboarding/start-authenticated` (201)
3. All wizard steps — organization, admin, plan, departments, invitations, integrations, agents, security
4. `POST /onboarding/complete` (200) — gets tenantId
5. `POST /auth/login` — re-login to get tenant-scoped JWT (ADMIN role + tenantId now set)
6. Dashboard verification:
   - `GET /departments` → both wizard-created departments present
   - `GET /agents` → correct number of agents (IDLE status)
   - `GET /connectors` → exactly 2 connectors (no duplicates)
   - Team invitations confirmed (pending accept via ApiKey token)

**All 6 phases pass ✅**. Run with: `node e2e-dashboard-flow.mjs` from `/backend`.

### Key behaviour confirmed

- Re-login after `completeWizard` is required: initial registration token has `role: USER, tenantId: null`. `completeWizard` updates the user to `role: ADMIN, tenantId: <id>`. Fresh JWT (via re-login) is needed to access tenant-scoped endpoints.
- `GET /onboarding/progress` after complete correctly returns 401 (wizard session cleared from Redis).
