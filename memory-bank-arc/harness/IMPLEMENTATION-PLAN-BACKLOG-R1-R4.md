# Implementation Plan — Phase 10 Deferred / Backlog Items (R1–R4 + D2–D4)

**Document:** NC-PLAN-PHASE10-BACKLOG
**Date:** 2026-08-06
**Branch (target):** `0010-harness-base`
**Authoritative source:** `neurecore/memory-bank-arc/harness/PHASES-0-10-STATUS-AND-BACKLOG.md` §3 (REMAINING) and §4 (DEFERRED).
**Companion live state:** `PHASES-0-10-STATUS-AND-BACKLOG.md` §2, §6 (gates) — must be re-verified after each item ships.

> This plan is **execution-ready**. Every file path, line number, contract, and test
> is grounded in the existing codebase (verified by Explore subagent on 2026-08-06).
> No code is written until a unit of work is approved — this document is the
> contract.

---

## 0. Executive summary

| # | Item | Branch scope | Risk | Effort | Order | Status |
|---|------|--------------|------|--------|-------|--------|
| **R2** | Wire `nc.run_ai_twin` → real LangGraph run (twin graph) | `0011-ai-twin-graph` | **Low** — pure wiring; no schema, no new deps | **S** (1–2 days) | 1 | Not started |
| **R3** | Add `Deal` model + Deal-stage forecast in `nc.forecast_pipeline` | `0012-deal-model-forecast` | Medium — Prisma migration, FK backfill, regression risk on `Quote` | **M** (3–4 days) | 2 | Not started |
| **R4** | Live OAuth for MS Graph (wire existing) + Zoom + Twilio (new) | `0013-live-oauth-ms-zoom-twilio` | High — credential capture, real network calls, webhooks | **L** (5–7 days) | 3 | Partial (MS auth service exists, controller missing) |
| **R1** | Phase 10.6 — tenant domain screens (deals, leads, cases, opps, quotes, campaigns, emails) | `0014-phase10-6-domain-screens` | High — many surfaces, biggest UX delta | **XL** (10–14 days) | 4 | Deferred |
| **D2** | 9 pre-existing prediction test failures | sub-bugfix commits in R3 branch | Low — well-scoped | **S** | 1a (parallel with R2) | Pre-existing |
| **D3** | 11 pre-existing skipped tests | investigate + either enable or formally `it.skip` with reason | Low | **S** | 1a (parallel with R2) | Pre-existing |
| **D4** | Drift-observability backtest cron | small script in `backend/scripts/` + PM2 entry | Low | **S** | after R2 | Backend ships; cron wires later |

### Why this order

- **R2 first** because it is the highest-leverage, lowest-risk item: zero schema,
  zero new dependency, no UI, no deploy-time config. The existing
  `OfficialAgentGraph` + `AgentCheckpointService` cover every requirement. It
  proves the integration test pattern before tackling heavier items.
- **R3 next** because it is contained, has a single Prisma migration with a clear
  backfill strategy, and unlocks a real forecast improvement that other items
  will compose on.
- **R4 then** because live OAuth is the highest operational risk (real network
  calls, real credentials, real webhooks). Doing it after R2/R3 means the
  rollback story is well-practiced.
- **R1 last** because it is the largest and benefits from R2/R3/R4 being live
  (deals/quotes/cases will compose on the new domain model and on real
  integrations).

### Gates we must re-verify after each item

Re-run from `PHASES-0-10-STATUS-AND-BACKLOG.md` §6:

```bash
cd neurecore/backend
pnpm exec jest --config jest.config.js --testPathPatterns='llm-registry|ai-twin|dsr|domain-agents|channel|service-ops|chat|hermes-adapter|coding-agent-sdk|sales-outreach|residency|governance|lead-scoring-calibration|in-process-mock'
./node_modules/.bin/nest build
pnpm routes:scan
pnpm tenancy:scan
cd neurecore/frontend-tenant && npx tsc --noEmit
bash neurecore/scripts/solid-guard.sh
```

Plus the two pre-existing gates we will repair in this plan:

```bash
pnpm exec jest --config jest.config.js --testPathPatterns='p5-prediction-providers|service-gateway-v2/prediction'
pnpm exec jest --config jest.config.js --testPathPatterns='skipped-suite-tracker'
```

---

## 1. Engineering principles (locked, applies to all 4 items)

These are non-negotiable. Violation of any of them is a PR-blocker.

### 1.1 SOLID

| Principle | How we enforce it in this plan |
|---|---|
| **S**ingle responsibility | One class per concern. `TwinGraphExecutor` only composes the twin envelope + graph; it does not audit, persist, or send email. Audit is `AiTwinService.recordRunAudit`. |
| **O**pen/closed | New domain screens extend `EntityTable`-style list pages, never fork them. New adapters implement `IChannelAdapter`; the registry consumes the interface. |
| **L**iskov | Every stub adapter today returns `{ok: true}`. The live adapter must keep that contract for callers, but fail closed when credentials are missing (throw `IntegrationNotConnectedException`) — this is a *narrowing* of the contract, not a widening. Document it. |
| **I**nterface segregation | `IIntegrationAuthProvider` is split from `IChannelAdapter` from `ICredentialStore` from `IIntegrationTokenRefresher`. Twilio does not implement `IIntegrationTokenRefresher` (Basic auth, no refresh). |
| **D**ependency inversion | All new services depend on injected interfaces (e.g. `IAgentGraph`, `ICredentialStore`), never on Prisma directly outside repositories. The existing `Repository` pattern in `backend/src/modules/<domain>/repositories/` is extended. |

### 1.2 Zero duplication (concrete rules)

1. **No new chat tool handler.** R2 replaces one branch in
   `scoped-tool-gateway.service.ts`. It does not add a new tool file.
2. **No new Prisma client wrapper.** All new repositories follow the
   `prisma-<entity>.repository.ts` pattern in
   `backend/src/modules/<domain>/repositories/`.
3. **No new list-page skeleton.** R1 extends the `EntityTable` Creatio
   component, not a parallel table implementation.
4. **No new OAuth boilerplate.** New auth clients extend the
   `IAuthProvider` interface implemented by `MicrosoftGraphAuthService`
   and `GoogleAuthClient`.
5. **No new DTO file per controller action.** Use existing `*Dto.ts`
   files; add the new DTOs to the domain DTO module that already exists.
6. **No copy-paste of tenantId guards.** The single
   `assertTenantContext(c)` helper at
   `backend/src/modules/hermes-adapter/tools/scoped-tool-gateway.service.ts`
   is the only place tenant context is validated. All new chat tools use it.
7. **No copy-paste of list-page filters.** Extend
   `frontend-tenant/src/components/tables/EntityTable.tsx` rather than
   re-implementing filter chips per page.

### 1.3 Zero errors of any kind

| Class of error | How it is prevented |
|---|---|
| Cross-tenant data leak | Every new Prisma `where` includes `tenantId`. New repositories inherit `assertTenantContext`. Architecture test `NO_TENANT_WILDCARD` is extended to the new repository directories (see D2 / follow-up §4 of `duplicate-removal-plan.md`). |
| N+1 queries | New list endpoints pre-compute aggregations in a single query (use `groupBy`, `include` with `_count`). |
| Null pointer exceptions | DTOs use `class-validator` decorators; services throw typed exceptions from a `domain-errors.ts`; controllers map to HTTP via a single `AllExceptionsFilter`. |
| Approval bypass | Mutating chat tools (`nc.run_ai_twin`, `nc.generate_quote`, `nc.resolve_case`, `nc.dispatch_channel`) flow through the existing `HermesApprovalGate` — no new approval surface. |
| Migration drift | All schema changes go through `prisma migrate dev` (local) and `prisma migrate deploy` (prod) — never `db push`. Migration file is reviewed in the same PR. |
| Toast/state race | Frontend mutations use the existing `useMutationWithToast` hook. No new toast subsystem. |
| Silent stub | Regression guard `NO_CONNECTOR_STUB_MARKERS` (`service-gateway-v2/architecture.spec.ts`) is extended to all channel-adapter files we touch. |
| Duplicate external effect | Every new `dispatch()` call uses the existing `Idempotency-Key` header pattern; the new integration tests assert no second call is made when the key is replayed. |
| Approval-required mutation bypassing approval | All new mutating services call `assertApprovalRequiredOrThrow()` at the top. |
| Pre-existing test regression | `git bisect` is run before merge on the base branch. |

### 1.4 Observability (no silent failure)

- Every new service emits a structured `pino` log with `tenantId`, `actorId`, `action`, `outcome`.
- Every new HTTP endpoint registers a request-scoped counter in `TelemetryService`.
- Every new Prisma repository method is wrapped by the existing `withTenantContext(tenantId, fn)` helper from `backend/src/common/context/`.

---

## 2. R2 — Wire `nc.run_ai_twin` to a real LangGraph run

### 2.1 Goal

Replace the audit-log-only stub at
`backend/src/modules/hermes-adapter/tools/scoped-tool-gateway.service.ts:369-401`
with a real execution: the chat tool now invokes the same
`OfficialAgentGraph` that the chat already uses, parameterised by the
twin's allow-list and intent, and persists the result with a `TwinRun`
record (re-using `HarnessAuditEvent`-style append-only).

### 2.2 Constraints

- Zero new dependency. `@langchain/langgraph ^1.2.5` is already installed
  (`backend/package.json:97`).
- Zero new schema. The result is persisted to the existing
  `ai_twin_audit_logs` table
  (`backend/prisma/schema.prisma` around the `AiTwin` model). The
  optional `TwinRunId` field is stored in `HarnessAuditEvent` metadata
  if a dedicated `TwinRun` table is later added — for this PR we
  reuse `ai_twin_audit_logs` with a new `runPayload` column added via
  a small migration **only if** it is genuinely required; if we can
  fit into existing columns, no migration.

### 2.3 Design

#### 2.3.1 New file: `backend/src/modules/ai-twin/twin-graph.executor.ts`

```ts
// Responsibility: compose AiTwinService envelope + OfficialAgentGraph.
// Does NOT audit, persist beyond the graph's own state, or send messages.
@Injectable()
export class TwinGraphExecutor {
  constructor(
    private readonly twins: AiTwinService,
    private readonly graphs: OfficialAgentGraph,
    private readonly checkpoints: AgentCheckpointService,
  ) {}

  async invoke(params: TwinInvokeParams): Promise<TwinInvokeResult> { ... }
}
```

Contract (`twin-graph.executor.ts`):
```ts
export interface TwinInvokeParams {
  readonly tenantId: string;       // asserted != '*'
  readonly actorId: string;
  readonly twinId: string;
  readonly intent: string;         // free text from chat
  readonly scopesUsed: ReadonlyArray<string>;
  readonly allowedTools: ReadonlyArray<string>;
  readonly threadId?: string;      // for AgentCheckpointService resume
}

export interface TwinInvokeResult {
  readonly runId: string;
  readonly status: 'completed' | 'awaiting_approval' | 'aborted';
  readonly output: unknown;        // whatever the graph produced
  readonly toolCalls: ReadonlyArray<{ tool: string; args: unknown; result: unknown }>;
  readonly checkpoints: ReadonlyArray<string>;
  readonly durationMs: number;
}
```

#### 2.3.2 Single-responsibility split

| Concern | File | Function |
|---|---|---|
| Compose twin envelope + graph | `twin-graph.executor.ts` (new) | `invoke()` |
| Twin allow-list / permission mirror | `ai-twin.service.ts` (existing) | `buildEnvelopeForAction` |
| Agent graph execution | `agents/langgraph/langgraph-official.ts` (existing) | `invoke()` |
| State persistence + resume | `agents/langgraph/checkpoint.service.ts` (existing) | `save` / `load` |
| Audit log write | `ai-twin.service.ts` (existing) | `recordRunAudit` (new method) |

#### 2.3.3 Replace the stub in `scoped-tool-gateway.service.ts:369-401`

```ts
case 'nc.run_ai_twin': {
  const tenantId = assertTenantContext(c);                    // existing helper
  const twin = await this.prisma.aiTwin.findFirst({ where: { id: args.twinId, tenantId } });
  if (!twin) throw new NotFoundException(`Twin ${args.twinId} not found`);
  if (twin.status !== 'ACTIVE') throw new ConflictException(`Twin is ${twin.status}`);

  const envelope = await this.aiTwinService.buildEnvelopeForAction({
    actor: { id: c.userId, roles: c.roles },
    twinId: twin.id,
    intent: 'RUN',
    scopesUsed: args.scopesUsed ?? [],
  });

  const result = await this.twinGraphExecutor.invoke({
    tenantId,
    actorId: c.userId,
    twinId: twin.id,
    intent: args.intent ?? 'Run my AI twin',
    scopesUsed: envelope.scopesUsed,
    allowedTools: envelope.allowedTools,
    threadId: args.threadId,
  });

  await this.aiTwinService.recordRunAudit({ twinId: twin.id, runId: result.runId, result });
  return { twinId: twin.id, runId: result.runId, status: result.status, output: result.output };
}
```

The existing 6-line happy-path test in
`scoped-tool-gateway.service.spec.ts:389-393` is updated to expect a
`TwinInvokeResult` and to assert that the stub audit log line is
replaced by a real `recordRunAudit` call (mocked).

### 2.4 Tests added (no new patterns; extend existing)

| Test file | New cases |
|---|---|
| `backend/src/modules/ai-twin/twin-graph.executor.spec.ts` (new) | 8 unit tests: tenant wildcard rejected, twin not found, twin paused, envelope built, graph invoked, checkpoints persisted, audit recorded, return shape. |
| `backend/src/modules/hermes-adapter/tools/scoped-tool-gateway.service.spec.ts` | Replace 1 case, add 3: happy path (real graph), twin paused, twin not found. |
| `backend/src/test/certification/invariants/mandatory-invariants.spec.ts` | Add `twin_run_produces_audit_log` invariant. |

### 2.5 Gates

- All R2 unit tests pass.
- `nest build` clean.
- The `INTEGRATION_TEST` env-gated happy-path test runs against a real
  `OfficialAgentGraph` mock and asserts that the stub branch in
  `nc.run_ai_twin` is no longer reachable.
- The architecture guard `NO_TENANT_WILDCARD` continues to pass.
- `solid-guard.sh` reports 0.

### 2.6 Rollback

Single-file revert. `TwinGraphExecutor` is only wired by
`scoped-tool-gateway.service.ts:369-401`. Reverting the case branch
restores audit-log-only behavior in 1 file.

### 2.7 File list (≤ 7)

1. `backend/src/modules/ai-twin/twin-graph.executor.ts` (new)
2. `backend/src/modules/ai-twin/twin-graph.executor.spec.ts` (new)
3. `backend/src/modules/ai-twin/ai-twin.service.ts` — add `recordRunAudit`
4. `backend/src/modules/ai-twin/ai-twin.module.ts` — provide `TwinGraphExecutor`
5. `backend/src/modules/hermes-adapter/tools/scoped-tool-gateway.service.ts` — replace branch
6. `backend/src/modules/hermes-adapter/tools/scoped-tool-gateway.service.spec.ts` — update + add cases
7. `backend/src/test/certification/invariants/mandatory-invariants.spec.ts` — add invariant

---

## 3. R3 — Add `Deal` model + Deal-stage forecast in `nc.forecast_pipeline`

### 3.1 Goal

Add a first-class `Deal` aggregate so the parity forecast can speak
about weighted pipeline (stage × amount × probability), not only
`Quote.total`. `nc.forecast_pipeline` aggregates from `deals` first,
falls back to `quote` totals for coverage, and returns both so the
chat can show "weighted forecast" + "committed (quotes) forecast".

### 3.2 Constraints

- One Prisma migration.
- `Quote.dealId` is a bare `String` today. The migration must:
  1. Create `deals` table.
  2. **Backfill** a `Deal` row for every distinct non-null
     `Quote.dealId` value (carrying the parent tenantId from the
     Quote). The `amount` is set to `Quote.total` (max of duplicates),
     `stage` to `PROPOSAL` (conservative), `source` to `LEGACY_BRIDGE`,
     `createdAt` to `Quote.createdAt`.
  3. Add the FK `Quote.dealId` → `Deal.id` `ON DELETE SET NULL`.
  4. **Decision:** we do not delete orphan quotes. We backfill.
- `Project.status` already has a `LEAD` enum value
  (`schema.prisma:2707-2850`); `Deal` uses its own `DealStage` enum
  (do not couple to `ProjectStatus` — different lifecycles).

### 3.3 Schema (new, exact)

```prisma
enum DealStage {
  LEAD
  QUALIFIED
  PROPOSAL
  NEGOTIATION
  WON
  LOST
}

enum DealSource {
  INBOUND
  OUTBOUND
  PARTNER
  REFERRAL
  EVENT
  LEGACY_BRIDGE    // backfilled from Quote.dealId
}

model Deal {
  id                String         @id @default(cuid())
  tenantId          String
  customerId        String?
  contactId         String?
  projectId         String?        // nullable: deal may precede project
  ownerUserId       String?
  name              String
  stage             DealStage      @default(LEAD)
  source            DealSource     @default(INBOUND)
  amount            Decimal        @default(0) @db.Decimal(18, 2)
  currency          String         @default("USD") @db.VarChar(3)
  probability       Decimal        @default(0.10) @db.Decimal(5, 4)  // 0..1
  expectedCloseDate DateTime?
  aiScore           Decimal?       @db.Decimal(5, 4)
  notes             String?
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  tenant   Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  customer Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  contact  Contact?  @relation(fields: [contactId], references: [id], onDelete: SetNull)
  project  Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  owner    User?     @relation(fields: [ownerUserId], references: [id], onDelete: SetNull)
  quotes   Quote[]

  @@unique([tenantId, name, customerId])   // soft unique, customer-scoped
  @@index([tenantId, stage, updatedAt])
  @@index([tenantId, expectedCloseDate])
  @@index([tenantId, ownerUserId])
}
```

In `model Customer` add `deals Deal[]` (single line).
In `model Project` add `deals Deal[]`.
In `model Quote` change `dealId String?` to `dealId String?` (kept) and add relation `deal Deal? @relation(fields: [dealId], references: [id], onDelete: SetNull)`.

### 3.4 Migration file: `backend/prisma/migrations/20260806_add_deal_model/migration.sql`

```sql
-- 1. Create enum types
CREATE TYPE "DealStage" AS ENUM ('LEAD','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST');
CREATE TYPE "DealSource" AS ENUM ('INBOUND','OUTBOUND','PARTNER','REFERRAL','EVENT','LEGACY_BRIDGE');

-- 2. Create table
CREATE TABLE "deals" (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL,
  "customerId" text,
  "contactId" text,
  "projectId" text,
  "ownerUserId" text,
  "name" text NOT NULL,
  "stage" "DealStage" NOT NULL DEFAULT 'LEAD',
  "source" "DealSource" NOT NULL DEFAULT 'INBOUND',
  "amount" numeric(18,2) NOT NULL DEFAULT 0,
  "currency" varchar(3) NOT NULL DEFAULT 'USD',
  "probability" numeric(5,4) NOT NULL DEFAULT 0.1000,
  "expectedCloseDate" timestamptz,
  "aiScore" numeric(5,4),
  "notes" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX "deals_tenantId_stage_updatedAt_idx" ON "deals"("tenantId","stage","updatedAt" DESC);
CREATE INDEX "deals_tenantId_expectedCloseDate_idx" ON "deals"("tenantId","expectedCloseDate");
CREATE INDEX "deals_tenantId_ownerUserId_idx" ON "deals"("tenantId","ownerUserId");
CREATE UNIQUE INDEX "deals_tenantId_name_customerId_key" ON "deals"("tenantId","name","customerId");

-- 4. FKs
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL;
ALTER TABLE "deals" ADD CONSTRAINT "deals_contactId_fkey"  FOREIGN KEY ("contactId")  REFERENCES "contacts"("id")  ON DELETE SET NULL;
ALTER TABLE "deals" ADD CONSTRAINT "deals_projectId_fkey"  FOREIGN KEY ("projectId")  REFERENCES "projects"("id")  ON DELETE SET NULL;
ALTER TABLE "deals" ADD CONSTRAINT "deals_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id")     ON DELETE SET NULL;

-- 5. Backfill: one Deal per distinct non-null Quote.dealId per tenant
INSERT INTO "deals" ("id","tenantId","name","stage","source","amount","currency","createdAt","updatedAt")
SELECT
  'deal_legacy_' || md5(q."tenantId" || '|' || q."dealId"),
  q."tenantId",
  'Legacy bridge: ' || q."dealId",
  'PROPOSAL'::"DealStage",
  'LEGACY_BRIDGE'::"DealSource",
  COALESCE(MAX(q."total"), 0),
  COALESCE(MAX(q."currency"), 'USD'),
  MIN(q."createdAt"),
  now()
FROM "quotes" q
WHERE q."dealId" IS NOT NULL
GROUP BY q."tenantId", q."dealId";

-- 6. Point Quote.dealId at the backfilled Deal
UPDATE "quotes" q
SET "dealId" = 'deal_legacy_' || md5(q."tenantId" || '|' || q."dealId")
WHERE q."dealId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "deals" d
    WHERE d."id" = 'deal_legacy_' || md5(q."tenantId" || '|' || q."dealId")
  );

-- 7. Add FK on quotes.dealId
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL;
```

### 3.5 New module: `backend/src/modules/sales-outreach/deals/`

```
deals/
├── deals.module.ts
├── deals.controller.ts
├── deals.service.ts
├── repositories/
│   └── prisma-deal.repository.ts
├── dto/
│   ├── create-deal.dto.ts
│   ├── update-deal.dto.ts
│   └── list-deals.dto.ts
└── deals.service.spec.ts
```

#### 3.5.1 Controller surface (REST)

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| GET | `/api/v1/deals` | `?stage=&ownerUserId=&customerId=&q=&page=&limit=&sort=` | list, tenant-scoped |
| GET | `/api/v1/deals/:id` | — | detail |
| POST | `/api/v1/deals` | `CreateDealDto` | require approval: false (low risk) |
| PATCH | `/api/v1/deals/:id` | `UpdateDealDto` | require approval: true (mutation of pipeline) |
| POST | `/api/v1/deals/:id/transitions` | `{toStage, reason}` | dedicated state machine; requires approval |
| POST | `/api/v1/deals/:id/quotes` | `{ items, validUntil }` | delegates to existing `QuoteService.createDraft` (already does) |
| DELETE | `/api/v1/deals/:id` | — | soft delete only (`stage=LOST` + `deletedAt`) |

`@UseGuards(JwtAuthGuard, TenantContextGuard)` already used in
`backend/src/modules/customers/customers.controller.ts:39-178` — same.

#### 3.5.2 Domain invariants enforced in service

- `transitionTo(twinStage)` only allows the edges:
  `LEAD → QUALIFIED → PROPOSAL → NEGOTIATION → WON | LOST` and
  `* → LOST` (any stage can be marked lost). Any other transition
  throws `InvalidDealTransitionException`.
- `amount` must be `>= 0`; `probability` must be in `[0, 1]`. Defaults
  are set per stage (e.g. `LEAD: 0.10`, `QUALIFIED: 0.25`,
  `PROPOSAL: 0.50`, `NEGOTIATION: 0.75`, `WON: 1.00`, `LOST: 0.00`).
- `expectedCloseDate` is required when stage ≥ PROPOSAL.
- `customerId` is rejected if it belongs to a different tenant.

#### 3.5.3 Repository

`prisma-deal.repository.ts` extends the existing
`prisma-<entity>.repository.ts` pattern. Rejects `'*'` tenantId
(`TENANT_WILDCARD_FORBIDDEN` — same constant used in
`agents.service.ts`).

### 3.6 Update `nc.forecast_pipeline` in `scoped-tool-gateway.service.ts:240-272`

The tool now returns a richer payload:

```ts
return {
  tenantId,
  horizonDays,
  asOf: new Date().toISOString(),
  deals: {
    counts: { byStage: { ... } },
    weightedTotal: number,        // sum(amount * probability)
    committedTotal: number,       // sum(amount where stage in ['NEGOTIATION','WON'])
    bestCaseTotal: number,        // sum(amount where stage not in ['LOST'])
    byStage: Array<{ stage, count, weightedAmount, countAmount }>,
  },
  quotes: {
    counts: { byStatus: { ... } },    // existing logic preserved
    total: number,
    byStatus: { DRAFT: n, SENT: n, ACCEPTED: n, REJECTED: n },
  },
  summary: string,                  // one-line human summary the chat can quote
};
```

The chat-side `customer-facing` formatter is unchanged (it still
returns a human string), but the underlying data is richer.

### 3.7 Tests added

| Test file | New cases |
|---|---|
| `deals.service.spec.ts` (new) | 14 unit: create, update, transition matrix, ownership checks, tenant wildcard, soft delete |
| `prisma-deal.repository.spec.ts` (new) | 6: CRUD, tenant filter, soft delete, FK cascade |
| `deals.controller.spec.ts` (new) | 8: route guards, RBAC, 404 cross-tenant |
| `scoped-tool-gateway.service.spec.ts` | 5 new cases on `nc.forecast_pipeline`: weighted total, committed total, best case, by-stage breakdown, deals+quotes combined |
| `architecture.spec.ts` | Extend `NO_TENANT_WILDCARD` to scan `deals/` |
| `integration/golden-path-invariants.integration.spec.ts` | Add invariant: "stage transition matrix is enforced" |

### 3.8 Frontend side-effect (R1 prep)

A single **stub** page is added at `frontend-tenant/src/app/deals/page.tsx`
using `WorkspaceModuleBuilder` so the route exists for the chat link
before the full screen ships. This is in the R1 plan (§4) but the
route is created in R3 so the chat redirect does not 404.

### 3.9 Gates

- Migration applies cleanly on local + staging.
- `prisma migrate status` shows no drift.
- All new unit tests pass.
- All pre-existing tests still pass (regression on Quote).
- `architecture.spec.ts` `NO_TENANT_WILDCARD` green.
- The 9 pre-existing prediction test failures (D2) are *not* in scope
  for R3 but the new deal-pipeline tests must not regress them.

### 3.10 Rollback

Two-step:
1. `prisma migrate rollback --to <previous>` (uses the file we ship).
2. Revert service + controller. The `quotes.dealId` column is dropped
   back to nullable with no FK — confirmed safe because the backfilled
   `Deal` rows can be deleted by the same rollback.

### 3.11 File list (≤ 12)

1. `backend/prisma/schema.prisma` — new model + 3 relation lines
2. `backend/prisma/migrations/20260806_add_deal_model/migration.sql` (new)
3. `backend/src/modules/sales-outreach/deals/deals.module.ts` (new)
4. `backend/src/modules/sales-outreach/deals/deals.controller.ts` (new)
5. `backend/src/modules/sales-outreach/deals/deals.service.ts` (new)
6. `backend/src/modules/sales-outreach/deals/repositories/prisma-deal.repository.ts` (new)
7. `backend/src/modules/sales-outreach/deals/dto/create-deal.dto.ts` (new)
8. `backend/src/modules/sales-outreach/deals/dto/update-deal.dto.ts` (new)
9. `backend/src/modules/sales-outreach/deals/dto/list-deals.dto.ts` (new)
10. `backend/src/modules/sales-outreach/deals/deals.service.spec.ts` (new)
11. `backend/src/modules/sales-outreach/deals/prisma-deal.repository.spec.ts` (new)
12. `backend/src/modules/sales-outreach/deals/deals.controller.spec.ts` (new)
13. `backend/src/modules/sales-outreach/deals/deals.module.ts` — register
14. `backend/src/modules/sales-outreach/sales-outreach.module.ts` — import DealsModule
15. `backend/src/modules/hermes-adapter/tools/scoped-tool-gateway.service.ts` — extended forecast branch
16. `backend/src/modules/hermes-adapter/tools/scoped-tool-gateway.service.spec.ts` — new cases
17. `backend/src/test/certification/architecture.spec.ts` — extend guard
18. `frontend-tenant/src/app/deals/page.tsx` (stub via WorkspaceModuleBuilder)

---

## 4. R4 — Live OAuth for MS Graph / Zoom / Twilio

### 4.1 Goal

Replace the 12 stub `OOB_CHANNEL_ADAPTERS` in
`backend/src/modules/channels/channel-adapter.registry.ts:509-522` with
real adapters for the three highest-value providers, gated by tenant
OAuth credentials. Microsoft already has a 456-line auth service
(`MicrosoftGraphAuthService`); we wire its missing controller + replace
the two MS adapter stubs. Zoom + Twilio are net-new.

### 4.2 Constraints

- Zero new env vars on the *server* side except the three pairs:
  - `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` (already in
    `microsoft-graph-auth.service.ts:101-118`).
  - `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` (new).
  - `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` (new, Basic auth — no
    refresh).
- No new dependency at runtime. The Twilio API is called via
  `fetch` (Node 18+ has it). Zoom and MS Graph are also `fetch`-only.
- All adapter `dispatch()` calls carry an `Idempotency-Key` header
  (request-scoped UUID v4) so retries never double-send.

### 4.3 Interface segregation (SOLID/I)

```ts
// backend/src/modules/integrations/interfaces/integration-auth.interface.ts (new)
export interface IIntegrationAuthProvider<P = unknown, C = unknown> {
  readonly provider: IntegrationProvider;
  buildAuthorizationUrl(tenantId: string, redirectUri: string, state: string): string;
  exchangeAuthorizationCode(tenantId: string, code: string, redirectUri: string): Promise<C>;
  getCredentials(tenantId: string): Promise<C | null>;
  revoke(tenantId: string): Promise<void>;
}

// Optional — only for OAuth (not Basic auth like Twilio)
export interface IIntegrationTokenRefresher<C> {
  refreshIfExpiring(tenantId: string, skewSeconds?: number): Promise<C>;
}
```

- `MicrosoftGraphAuthService` implements both interfaces (already does).
- `ZoomAuthService` implements both (new, OAuth Server-to-Server supported).
- `TwilioAuthService` implements **only** `IIntegrationAuthProvider` (no
  refresh). It returns `TwilioCredentials { accountSid, apiKey, apiSecret }`.

### 4.4 Schema migration: extend `IntegrationProvider` enum

```prisma
enum IntegrationProvider {
  GOOGLE
  BREVO
  SLACK
  MICROSOFT
  ZOOM        // new
  TWILIO      // new
}
```

`backend/prisma/migrations/20260806_add_zoom_twilio_providers/migration.sql`:
```sql
ALTER TYPE "IntegrationProvider" ADD VALUE 'ZOOM';
ALTER TYPE "IntegrationProvider" ADD VALUE 'TWILIO';
```

Postgres note: `ALTER TYPE ... ADD VALUE` cannot run inside a
transaction block. The migration must be marked with
`migration.sql` containing only the `ALTER TYPE` statements; the
`prisma migrate deploy` wraps each migration in a transaction by
default, so we set the migration's `transactional` flag to `false` via
`--create-only` + manual edit (Prisma allows `prisma migrate resolve`
to apply non-transactional migrations).

### 4.5 Credential shape (extends existing store)

`integration-credential.store.ts:14-16` — new types:

```ts
export type ZoomCredentials = {
  accessToken: string;       // user context: user OAuth
  refreshToken?: string;     // user context only
  expiresAt: string;         // ISO
  userId?: string;           // Zoom user id (for /users/me calls)
};

export type TwilioCredentials = {
  accountSid: string;
  apiKey: string;            // SK...
  apiSecret: string;         // not user-scoped; tenant-scoped
  fromNumber?: string;       // default "From" for SMS
};
```

The existing `integration_credentials` table is reused (the
`credentials Json` column carries the shape — no schema change).

### 4.6 New auth services (≤ 4 new files + 2 edits)

1. `backend/src/modules/integrations/zoom/zoom-auth.client.ts` (new)
2. `backend/src/modules/integrations/zoom/zoom-auth.client.spec.ts` (new)
3. `backend/src/modules/integrations/twilio/twilio-auth.client.ts` (new)
4. `backend/src/modules/integrations/twilio/twilio-auth.client.spec.ts` (new)
5. `backend/src/modules/integrations/microsoft/microsoft-auth.controller.ts` (new — `POST /integrations/microsoft/authorize`, `GET /integrations/microsoft/callback`)
6. `backend/src/modules/integrations/microsoft/microsoft-auth.controller.spec.ts` (new)
7. `backend/src/modules/integrations/integrations.controller.ts` — add `ZoomController` and `TwilioController` methods (or mount new controllers in `integrations.module.ts`)

### 4.7 Replace adapter stubs

| File | Current | New |
|---|---|---|
| `channel-adapter.registry.ts:333` (`MsTeamsAdapter.dispatch`) | `{ok: true}` | `msTeamsClient.sendChatMessage({tenantId, channelId, message, idempotencyKey})` via `MicrosoftGraphAuthService.getAccessToken` + fetch. |
| `channel-adapter.registry.ts:366` (`MsOutlookAdapter.dispatch`) | `{ok: true}` | `msOutlookClient.sendMail(...)` (Mail.Send scope). |
| `channel-adapter.registry.ts:436` (`ZoomAdapter.dispatch`) | `{ok: true}` | `zoomClient.createMeeting({tenantId, topic, startTime, duration, idempotencyKey})`. |
| `channel-adapter.registry.ts:246` (`SmsAdapter.dispatch`) | `{ok: true}` | `twilioClient.sendSms({tenantId, to, body, idempotencyKey})`. |
| `channel-adapter.registry.ts:282` (`VoiceAdapter.dispatch`) | `{ok: true}` | `twilioClient.placeCall({tenantId, to, twiml, idempotencyKey})`. |

The new clients (`MsTeamsClient`, `MsOutlookClient`, `ZoomClient`,
`TwilioClient`) live in their own files under
`backend/src/modules/channels/clients/` and use the auth service to
acquire tokens, then `fetch` the real API.

Each client is a thin **adapter** (`@Injectable()`) that takes a
`tenantId` and a typed params object, returns the upstream response,
and throws typed exceptions on failure.

### 4.8 Tenant UI: add three new integration cards

Pattern: clone `GoogleIntegrationCard` at
`frontend-tenant/src/app/settings/integrations/page.tsx:39+`.

New files (or sections in the same file — pick the same-file pattern
to avoid 3 component files):

- Add to `page.tsx`:
  - `MsGraphIntegrationCard` (~120 lines)
  - `ZoomIntegrationCard` (~120 lines)
  - `TwilioIntegrationCard` (~120 lines)

Each card:
- Shows `Connected` / `Not connected` status (calls
  `GET /api/v1/integrations/<provider>/status`).
- Has a "Connect" button that opens an OAuth popup.
- Has a "Disconnect" button that calls
  `POST /api/v1/integrations/<provider>/revoke`.
- Mirrors the `GoogleIntegrationCard` UX exactly — same props shape.

### 4.9 Wizard entries

Add `MsGraphWizard.tsx`, `ZoomWizard.tsx`, `TwilioWizard.tsx` under
`frontend-tenant/src/app/settings/wizard/[slug]/wizards/`. Each is a
typed copy of `GoogleWorkspaceWizard.tsx` (no logic; the work happens
in the backend).

### 4.10 Admin UI: extend `/admin/settings/integrations`

`frontend-admin/src/app/settings/integrations/page.tsx`:
- Add a `provider` filter that defaults to `all`.
- Add a `provider` column to the tenant status table.
- Three new revoke buttons per row (only for the providers that
  exist for that tenant).

### 4.11 Tests added (≥ 24 across files)

| Test file | New cases |
|---|---|
| `zoom-auth.client.spec.ts` (new) | 8: buildAuthUrl, exchangeCode, refreshIfExpiring, getCredentials returns null, revoke clears, rate limit, expired token, scope validation. |
| `twilio-auth.client.spec.ts` (new) | 6: Basic auth header correct, no refresh, accountSid validation, fromNumber default, revoke. |
| `microsoft-auth.controller.spec.ts` (new) | 5: authorize starts flow, callback persists, missing state rejected, tenant context required, revoke. |
| `channel-adapter.registry.spec.ts` | 5 new: each new dispatch() actually calls fetch with the right URL, returns the response, errors map to typed exceptions, idempotency header present. |
| `integration-credential.store.spec.ts` | 3 new: Zoom credentials round-trip, Twilio credentials round-trip, no cross-tenant access. |
| `architecture.spec.ts` | Extend `NO_CONNECTOR_STUB_MARKERS` to the 5 files we replaced. |

### 4.12 Gates

- All 4 auth services covered by unit tests.
- Adapter stubs replaced; architecture guard green.
- Live network tests are marked `it.skip` outside `INTEGRATION_TESTS=1`
  (no CI access to real Zoom/Twilio accounts); manual smoke after
  deploy validates real `dispatch()`.
- The existing G9/G10 gates remain green.

### 4.13 Rollback

- Schema migration is reversible (`ALTER TYPE ... DROP VALUE` is
  not directly supported in Postgres 16; we ship a forward-only
  migration but the credential rows are nullable + isolated, so the
  application can fall back to "ZOOM/TWILIO not configured" by
  checking enum presence at boot).
- Adapter stubs can be restored by reverting the 5 `dispatch()`
  methods.

### 4.14 File list (≤ 18)

1. `backend/prisma/schema.prisma` — extend enum
2. `backend/prisma/migrations/20260806_add_zoom_twilio_providers/migration.sql` (new)
3. `backend/src/modules/integrations/interfaces/integration-auth.interface.ts` (new)
4. `backend/src/modules/integrations/zoom/zoom-auth.client.ts` (new)
5. `backend/src/modules/integrations/zoom/zoom-auth.client.spec.ts` (new)
6. `backend/src/modules/integrations/twilio/twilio-auth.client.ts` (new)
7. `backend/src/modules/integrations/twilio/twilio-auth.client.spec.ts` (new)
8. `backend/src/modules/integrations/microsoft/microsoft-auth.controller.ts` (new)
9. `backend/src/modules/integrations/microsoft/microsoft-auth.controller.spec.ts` (new)
10. `backend/src/modules/integrations/integrations.module.ts` — register new providers
11. `backend/src/modules/channels/clients/ms-teams.client.ts` (new)
12. `backend/src/modules/channels/clients/ms-outlook.client.ts` (new)
13. `backend/src/modules/channels/clients/zoom.client.ts` (new)
14. `backend/src/modules/channels/clients/twilio.client.ts` (new)
15. `backend/src/modules/channels/channel-adapter.registry.ts` — replace 5 stubs
16. `backend/src/modules/channels/channel-adapter.registry.spec.ts` — new cases
17. `backend/src/test/certification/architecture.spec.ts` — extend guards
18. `frontend-tenant/src/app/settings/integrations/page.tsx` — 3 new cards
19. `frontend-tenant/src/app/settings/wizard/[slug]/wizards/MsGraphWizard.tsx` (new)
20. `frontend-tenant/src/app/settings/wizard/[slug]/wizards/ZoomWizard.tsx` (new)
21. `frontend-tenant/src/app/settings/wizard/[slug]/wizards/TwilioWizard.tsx` (new)
22. `frontend-admin/src/app/settings/integrations/page.tsx` — provider column + filter

---

## 5. R1 — Phase 10.6: Tenant domain screens

### 5.1 Goal

Surface the parity capabilities on real, full-featured domain screens
for the tenant frontend, following the existing `/customers` and
`/projects` pattern. The chat capabilities exist; the screens make
them discoverable + give them a UI home for browsing and editing.

### 5.2 Scope (7 surfaces)

| Surface | List route | Detail route | Backend module | Notes |
|---|---|---|---|---|
| Deals | `/deals` | `/deals/[id]` | `sales-outreach/deals` (R3) | New module ships with R3 |
| Leads | `/leads` | `/leads/[id]` | `sales-outreach/leads` (new) | New module |
| Cases | `/workspace/cases` (already stubbed) | `/workspace/cases/[id]` | `service-ops/cases` (new controller wrapping `CaseTriageService`) | Reuse the workspace stub |
| Opportunities | `/opportunities` | `/opportunities/[id]` | reuses Deals module (opportunity = deal in our model; new alias routes only) | thin |
| Quotes | `/quotes` | `/quotes/[id]` | extends `service-ops/phase7.controller.ts` (quotes/* already exist) | add list + detail page only |
| Campaigns | `/workspace/campaigns` (already stubbed) | `/workspace/campaigns/[id]` | new `marketing/campaigns` module | small |
| Emails | `/emails` | `/emails/[id]` | new `comms/emails` module (reuses `HermesMessage` table) | bigger — needs thread view |

### 5.3 Architecture (one page = one component composition)

Each page is a composition of:

```
TenantShell
└── PageHeader (GlassPanel)
    ├── Breadcrumb
    ├── Title + Description
    └── PageHeaderActions (New button, Filter, AI button)
└── FilterBar (GlassPanel)
    ├── SearchInput
    ├── FilterChips (status, owner, date)
    ├── PageSizeSelect
    └── SortDropdown
└── EntityTable (Creatio component, list)
    ├── Columns (typed per entity)
    ├── RowActionMenu (edit, delete, AI)
    └── BulkActions (approval gate)
└── EntityFormModal (create/edit)
    ├── TabBar (Details, AI, Audit, Attachments)
    ├── FieldGrid (typed)
    └── Footer (Save, Cancel, AI Action)
```

A new shared component `EntityDetailTabs` carries the
Details / AI / Audit / Attachments tabs (referenced in the chat
"inline AI" pattern already used on `/customers`).

### 5.4 SOLID

- **S** — Each list page is a stateless presentation layer; all logic
  is in `<entity>.service.ts` (Repository pattern).
- **O** — New pages add to `EntityTable`'s column registry, not fork
  it.
- **L** — All list pages share the `ListPageProps` interface; a new
  page can be substituted where another is expected.
- **I** — `IEntityService<T>` is one interface per entity
  (List, Get, Create, Update, Delete). Pages depend on this.
- **D** — Components depend on `useEntityService<T>()` hook, which
  returns the service for the entity from a registry.

### 5.5 Backend modules added (new, ≤ 6)

1. `backend/src/modules/sales-outreach/leads/` (mirror of `deals/`)
2. `backend/src/modules/service-ops/cases/` (controller wrapping `CaseTriageService`)
3. `backend/src/modules/marketing/campaigns/` (small)
4. `backend/src/modules/comms/emails/` (reuses `HermesMessage`)
5. `backend/src/modules/sales-outreach/opportunities/` (alias routes only — opportunity IS a deal)
6. `backend/src/modules/service-ops/quotes/` (controller extension — list + detail)

Each module follows the same skeleton:
```
<entity>/
├── <entity>.module.ts
├── <entity>.controller.ts
├── <entity>.service.ts
├── repositories/prisma-<entity>.repository.ts
├── dto/{create,update,list}-<entity>.dto.ts
└── <entity>.service.spec.ts
```

### 5.6 Frontend files (new, ≤ 21)

For each of the 7 surfaces, 3 files:
- `<surface>/page.tsx` (list)
- `<surface>/[id]/page.tsx` (detail)
- `<surface>/components/<surface>-form.tsx` (create/edit modal)

Plus shared (3):
- `frontend-tenant/src/components/tables/EntityDetailTabs.tsx` (new)
- `frontend-tenant/src/hooks/useEntityService.ts` (new, factory hook)
- `frontend-tenant/src/lib/industryNavigation.ts` — register all 7 routes per group

Plus the 7 service files mirroring `customers.service.ts`:
- `frontend-tenant/src/services/{deals,leads,cases,opportunities,quotes,campaigns,emails}.service.ts`

**Total: 7×3 + 3 + 7 = 31 new files. Pushed to 21 in the budget** by
reusing one shared form component and one shared detail-page wrapper.

### 5.7 Tests (must reach parity with `/customers`)

For each surface:
- 1 list-page test (renders rows, pagination, filter)
- 1 detail-page test (renders all tabs, including AI)
- 1 form test (validation, submit)
- 1 service test (CRUD, tenant isolation, RBAC)
- 1 repository test (Prisma where-clause correctness)

**Total: 7 surfaces × 5 = 35 new test files.**

### 5.8 Gates

- All 35 new test files green.
- All existing 152-row gate matrix still green.
- New pages registered in `industryNavigation.ts` are visible in
  headed-browser screenshots for one industry per major (accounting,
  manufacturing, retail, financial services).
- The `NO_TENANT_WILDCARD` guard covers the new repositories.

### 5.9 Rollout strategy (de-risk)

Roll out **2 surfaces at a time** across 4 sub-branches to keep PRs
reviewable:

1. **Sub-PR 5A:** Deals + Opportunities (R3 already ships the backend).
2. **Sub-PR 5B:** Leads + Quotes.
3. **Sub-PR 5C:** Cases + Campaigns.
4. **Sub-PR 5D:** Emails (highest complexity, done last).

### 5.10 File list (cumulative, ≤ 40 new + 5 edits)

5.10.1 Backend new modules (≤ 6):
- `backend/src/modules/sales-outreach/leads/`
- `backend/src/modules/service-ops/cases/`
- `backend/src/modules/marketing/campaigns/`
- `backend/src/modules/comms/emails/`
- `backend/src/modules/sales-outreach/opportunities/` (alias)
- `backend/src/modules/service-ops/quotes/` (list+detail extension)

5.10.2 Frontend new pages (≤ 14):
- `frontend-tenant/src/app/{deals,leads,opportunities,quotes,emails}/page.tsx`
- `frontend-tenant/src/app/{deals,leads,opportunities,quotes,emails}/[id]/page.tsx`
- `frontend-tenant/src/app/workspace/{cases,campaigns}/page.tsx` (replace stub)
- `frontend-tenant/src/app/workspace/{cases,campaigns}/[id]/page.tsx`

5.10.3 Frontend shared (3):
- `EntityDetailTabs.tsx`
- `useEntityService.ts`
- `entityRegistry.ts` (central entity metadata)

5.10.4 Frontend services (7):
- `services/{deals,leads,cases,opportunities,quotes,campaigns,emails}.service.ts`

5.10.5 Edits (5):
- `industryNavigation.ts` (add 7 entries)
- `EntityTable.tsx` (add 7 column sets)
- `IconRail.tsx` (no change — uses `getIndustryNavConfig`)
- `CustomersListPage` (extract shared form into `EntityFormModal`)
- `fe-filters.ts` (add 7 filter sets)

5.10.6 Tests (35): listed in §5.7.

### 5.11 Risk register

| Risk | Mitigation |
|---|---|
| 35 frontend tests in one PR blocks review | Split into 4 sub-PRs (§5.9) |
| Cross-tenant data via inline AI | AI prompts include `tenantId` from server context, not client (existing pattern) |
| Form regressions in existing /customers | We extract `EntityFormModal` *without* changing the call signature; existing tests must remain green |
| Performance — 7 new list pages can be slow | All list endpoints use the composite indexes from `20260721_perf_composite_indexes`; we add `(tenantId, status, updatedAt)` index on `deals` and `(tenantId, customerId, createdAt)` on `quotes` if missing |
| Mobile responsiveness | New pages inherit `EntityTable`'s responsive wrapper (already used on /customers) |

---

## 6. D2 — 9 pre-existing prediction test failures (separate small bugfix)

### 6.1 Goal

Per `PHASES-0-10-STATUS-AND-BACKLOG.md` §4 D2: 9 tests in
`p5-prediction-providers` and `service-gateway-v2/prediction` fail at
HEAD. They are confirmed pre-existing. Goal: fix in a 1–2 file PR
**before** R3 so that the deal-pipeline tests have a clean baseline.

### 6.2 Approach

1. Run the failing tests, capture the actual error.
2. Open each, classify:
   - **Flaky** (timing, network) → re-enable with `it.fixme` + a
     `// TODO(ph9-prediction): <reason>` comment.
   - **Drift** (interface changed) → fix the test.
   - **Regression** (genuine bug) → fix the code, not the test.
3. Add a CI check that no test is added with a `.skip` / `.fixme` /
   `.todo` without a corresponding `// TODO(phase):` comment
   (`scripts/assert-no-bare-skips.sh`).

### 6.3 File list (≤ 4)

- `backend/src/test/certification/architecture.spec.ts` — add
  `NO_BARE_SKIPS` guard.
- `scripts/assert-no-bare-skip.sh` (new).
- The 2-3 spec files being fixed.

---

## 7. D3 — 11 pre-existing skipped tests

### 7.1 Approach

For each skip, document the reason in a `// TODO(phase): <reason>`
header above the `it.skip` line. The new `NO_BARE_SKIPS` guard from
§6.2 enforces this going forward.

### 7.2 File list (≤ 12): the spec files + 1 helper script.

---

## 8. D4 — Multi-tenant drift-observability backtest cron

### 8.1 Goal

`backend/src/modules/residency/` ships the drift service. The cron
that runs the backtest on a schedule is the missing piece.

### 8.2 Approach

1. New script `backend/scripts/drift-backtest.cron.ts` (CLI:
   `--tenants=*` or `--tenantId=...`, `--windowDays=30`).
2. PM2 entry added to `contabo-ops.md` §3.2 ecosystem file
   (`neurecore-backend/drift-backtest`) running daily at 02:30.
3. The script logs to `pino`, emits a single
   `drift.backtest.completed` telemetry event per tenant per day.

### 8.3 File list (≤ 3)

- `backend/scripts/drift-backtest.cron.ts` (new)
- `scripts/pm2/ecosystem.config.js` (edit, add 1 entry)
- `neurecore/memory-bank-arc/contabo-ops.md` (doc edit, +1 row in §3.2)

---

## 9. Verification matrix (cross-item)

| Gate | R2 | R3 | R4 | R1 | D2 | D3 | D4 |
|------|----|----|----|----|----|----|----|
| `nest build` exit 0 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| `tsc --noEmit` (tenant FE) | ✓ | ✓ | ✓ | ✓ | n/a | n/a | n/a |
| `routes:scan` 0 collisions | ✓ | ✓ | ✓ | ✓ | n/a | n/a | n/a |
| `tenancy:scan` 0 unsafe | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| `solid-guard.sh` 0 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| `NO_TENANT_WILDCARD` | ✓ | ✓ (extended) | ✓ | ✓ (extended) | ✓ | n/a | n/a |
| `NO_CONNECTOR_STUB_MARKERS` | ✓ | ✓ | ✓ (extended) | ✓ | n/a | n/a | n/a |
| `NO_BARE_SKIPS` (new) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| G9 105/105 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| G10 8/8 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | n/a |
| 354 Phase-10-pattern tests | ✓ | ✓ | ✓ | ✓ | n/a | n/a | n/a |
| Headed-browser screenshots | n/a | deals stub | n/a | 7 new surfaces | n/a | n/a | n/a |
| Live `nc.run_ai_twin` run | ✓ (new) | n/a | n/a | n/a | n/a | n/a | n/a |
| Live `nc.forecast_pipeline` w/ deals | n/a | ✓ (new) | n/a | n/a | n/a | n/a | n/a |
| Live MS Graph email send | n/a | n/a | ✓ (new) | n/a | n/a | n/a | n/a |
| Live Zoom meeting create | n/a | n/a | ✓ (new) | n/a | n/a | n/a | n/a |
| Live Twilio SMS send | n/a | n/a | ✓ (new) | n/a | n/a | n/a | n/a |

---

## 10. Sequencing & dependencies

```
        ┌─── R2 (1-2 days) ───┐
        │                     │
START ──┤                     ├──► R3 (3-4 days) ──► R4 (5-7 days) ──► R1 sub-PR 5A → 5B → 5C → 5D
        │                     │
        ├─── D2 (½ day) ──────┤
        ├─── D3 (½ day) ──────┤
        └─── D4 (½ day, after R2) ─────────────────────────────────────┘
```

- R2 and D2/D3 are independent; can run in parallel branches.
- D4 runs after R2 (telemetry infra is exercised by R2).
- R3 depends on D2 being fixed (clean test baseline).
- R4 depends on R2 (R2's solid audit pattern is the template).
- R1 sub-PR 5A depends on R3 (deals backend ships first).

---

## 11. Open decisions for the user

| # | Decision | Default if no answer |
|---|----------|----------------------|
| Q1 | Approve ordering R2 → R3 → R4 → R1? | Yes (recommended) |
| Q2 | Approve splitting R1 into 4 sub-PRs (5A-5D)? | Yes (recommended) |
| Q3 | Approve the `Deal` backfill strategy (insert legacy `Deal` rows for distinct `Quote.dealId`)? | Yes (alternative: orphan `Quote.dealId` set to null) |
| Q4 | Approve the `ALTER TYPE ... ADD VALUE` non-transactional migration for `IntegrationProvider`? | Yes (only safe path in Postgres 16) |
| Q5 | Approve Twilio using Basic auth (no OAuth refresh) instead of full OAuth? | Yes (Twilio's recommendation) |
| Q6 | Approve headed-browser visual verification for each new surface in R1? | Yes (matches Phase 9 pattern) |

---

## 12. Appendix — file inventory (consolidated, ≤ 80)

### 12.1 R2 — 7 files
*(listed in §2.7)*

### 12.2 R3 — 18 files
*(listed in §3.11)*

### 12.3 R4 — 22 files
*(listed in §4.14)*

### 12.4 R1 — 40 + 35 = 75 files
*(breakdown in §5.10)*

### 12.5 D2/D3/D4 — 18 files

### Total ≈ **140 files** across all 7 items.

This is consistent with the size of prior phase deliveries
(Phase 9 alone touched 152 matrix items in a single sweep; R1+R3+R4
are roughly equivalent).

---

## 13. Document control

- **2026-08-06** — created. Author: planning session from
  `PHASES-0-10-STATUS-AND-BACKLOG.md` §3 + §4.
- Owner: `@planning`. Reviewers: `@platform`, `@agents`, `@integrations`,
  `@frontend`, `@chat-product` (one per major item).
- This document is the **contract** for the next 4–6 weeks of work.
  It will be re-issued at the end of each item with the actual
  commit SHAs and a `STATUS: SHIPPED` header.
