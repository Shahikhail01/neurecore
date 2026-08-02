# Sim-05 Plan: numpy-financial + Beancount Integration (UMBRELLA)

**Document ID:** NC-SIM05-IMP-1
**Date:** 2026-07-30
**Status:** SUPERSEDED — decomposed into two sub-plans
**Supersedes:** none
**Sub-plans:**
- **`NC-ACCT-IMP-1-NEURECORE-CAPABILITY.md`** — the NeureCore accounting capability (the runtime, the sidecar, the schema, the nc.* tools, the cert). **This is the foundation.**
- **`NC-SIM05-IMP-2-SIMULATION-INTEGRATION.md`** — the Sim-05 simulation wiring (the 20 scenarios, the day-runner integration, the scenario cert). **Depends on the capability reaching cert PASS first.**

**Triggered by:** Sim-05 scenarios (20 accounting/finance case studies) require financial computation, structured ledger entities, and synthetic data generation. The autonomous work layer (certified 2026-07-30) can coordinate but cannot perform accounting work. Additionally, real NeureCore tenants need in-platform accounting computation for production work (NPV/IRR capital appraisal, lease accounting, inventory aging, financial statement generation, audit support).

---

## 0. Why this plan was decomposed

The original `NC-SIM05-IMP-1` conflated two distinct workstreams:

1. **A general-purpose, tenant-isolated accounting capability** that any real NeureCore tenant can use for production accounting work.
2. **A simulation harness** that wires 20 training scenarios (Sim-05) to that capability and produces a certifiable training product.

These have different success criteria, different cert frameworks, and different stakeholders. Conflating them produced a plan that:

- Over-claimed "production accounting readiness" while shipping only NPV/IRR + a single ledger.
- Punted Pakistani tax as "out of scope" while certifying a Pakistani tax scenario.
- Deferred `nc.accounting.*` tool wrapping to "Phase 2.5" while the chat agent is the only path a real tenant uses.
- Reused `infra/_common/auth.{py,ts}` to unify two distinct HMAC protocols (scoped token + webhook signature).
- Integrated financial math cert into the G9 work-coordination cert.
- Estimated 35 days for what is honestly 115+ days of work.

The decomposition fixes each of these. **Read `NC-ACCT-IMP-1` for the capability plan, and `NC-SIM05-IMP-2` for the simulation integration plan. This umbrella document retains the original analysis for reference and the final sequencing.**

---

## 0a. Honest Scope Statement (umbrella)

Sim-05 defines 20 training scenarios (warehouse audits, financial statement audits, NPV/IRR capital appraisal, fraud investigation, lease accounting, etc.) **and** enables real tenant accounting work. Today's platform covers the **work coordination** (plan → assign → track → approve) but not the **actual accounting work** (calculations, ledger entries, structured entities).

After certification on 2026-07-30 the platform can:
- Create Customer, Project, Goal, Task, Assignment, Notification
- Wait for human approval
- Use only real IDs from execution context
- Emit a complete audit trail

It cannot:
- Compute NPV, IRR, depreciation, ratios, FX, aging
- Persist a 500-item inventory, 1,000-employee payroll register, 50 leases
- Generate 5 years of internally consistent financials
- Produce a reproducible audit opinion with auditable math

The two sub-plans deliver:
- **`NC-ACCT-IMP-1`**: COA + Periods + Journal + nc.* tools + NPV/IRR/MIRR/amortize + 3 reports + Beancount export + Merkle-rooted outbox. Phase 1 cert by 2026-09-12. ~62 working days.
- **`NC-SIM05-IMP-2`**: 20 scenarios wired, of which 6 in Phase A (compute-required) and 14 in Phase B (judgment). Phase B cert by 2026-10-22. ~53 working days.

Neither sub-plan delivers:
- The Sim-05 training content itself (separate curriculum effort owned by training/product).
- Pakistani / FBR / SECP tax rules (separate `NC-TAX-IMP-1` plan).
- AR/AP subledgers, payroll subledger, fixed-asset register, bank reconciliation engine, period-close workflow, multi-entity consolidation (Phase 2/3 of the capability roadmap).
- Integration with QuickBooks, Xero, Sage, SAP, Oracle Financials, NetSuite (separate integration plans).
- Real-time bank connections (Plaid, Stripe) (separate integration plans).

---

## 1. Decision Summary

| Decision | Choice | Rationale |
|---|---|---|
| Architecture | **Capability-style module** `accounting` (NestJS) + **`accounting-sidecar`** (Python) | Mirrors `hermes-adapter` + `hermes-sidecar` pattern already proven. Same auth, audit, outbox, nftables posture. |
| Sidecar role | **Stateless compute engine only** — no file I/O, no DB access | Sidecar receives inputs, computes results, returns them. NestJS module owns all persistence (Postgres writes, Beancount file generation, event emission). Eliminates file-lock races, simplifies deployment, aligns with Hermes sidecar statelessness. |
| Sidecar stack | **FastAPI + numpy-financial + Beancount (loader/report API) + Pandas** (Python 3.11) | numpy-financial covers NPV/IRR/PV/FV/PMT/MIRR/loan amortization. Beancount library for ledger validation + report generation. Pandas for synthetic dataset generation at scale (500 items, 1,000 employees). |
| Simulation lifecycle | **Integrate with existing `SimulationsModule`** at `src/simulations/` (not a parallel module) | The existing module already provides `POST /api/v1/simulations` (transactional sequence allocation, URI scheme `sim://YYYY/MM/DD/orgSlug/framework/seq`), day-runner with scoring, and idempotent day execution. Accounting attaches as a `ServiceIdentity` within that lifecycle. Non-simulation tenant work bypasses the sim lifecycle and calls accounting endpoints directly. |
| Tenant scoping | Every endpoint scopes on `tenantId` from JWT; ledger file paths under `/var/lib/neurecore/accounting/tenants/<tenantId>/` | Mirrors Hermes three-layer workspace layout. Per-tenant Beancount files + per-tenant Postgres index rows. |
| Source of truth | **Postgres** (Prisma models) — Beancount files are **derived exports generated by NestJS** | Beancount alone is fine for personal finance, not for multi-tenant SaaS. Postgres gives queries, relations, indexes. The sidecar returns Beancount-formatted strings; NestJS writes them to disk and emits events. |
| Event emission | `EnterpriseEventOutbox` from `src/common/persistence/prisma-outbox.repository.ts` | Mandatory per `enterprise-integration-architecture-amendment.md`. Every ledger posting emits `Accounting.PostingRecorded` in the same UoW. |
| UI surfaces | Tenant frontend (simulation list + per-scenario runner + accounting workspace), Admin frontend (certification dashboard, sidecar health, cross-tenant oversight) | Tenant = run simulations AND production accounting work. Admin = operate the platform. |
| Approval gating | **Existing `ServiceIdentityGuard` + new `AccountingApprovalGuard`** for REST endpoints. Tier-2 (human) for ledger postings, Tier-1 (auto) for read-only computations. nc.* tool wrapping (Phase 2.5) adds `approvalRequiredTools` routing through `ScopedToolGatewayService`. | REST endpoints need approval gating even without nc.* wrapping. The guard checks `approvalThreshold` from the scoped token and routes to the existing `ApprovalWorkflowEngine`. Production accounting (real money) demands mandatory approval. |
| Phase 1 freeze | **Schema migration + sidecar deploy pre-freeze (2026-08-14). NestJS module deploys post-freeze (2026-08-29).** | Schema is additive/non-behavioral. Sidecar has no chat-path blast radius and no access to NeureCore DB. The NestJS module adds new REST endpoints and Prisma queries — that is behavioral, so it waits until the 30-day observation window closes. |
| HMAC auth | **Shared library** `infra/_common/auth.py` (Python) + `infra/_common/auth.ts` (NestJS) | A single HMAC-SHA256 token implementation shared by hermes-sidecar, accounting-sidecar, hermes-events-bridge, and the accounting token service. Eliminates triple duplication and protocol-lock risk. |
| Multi-currency | **Add `baseCurrency` and `fxRate` fields to `AccountingReport`** and **add `fxRate` to `AccountingRecord`** | Scenario 12 (Foreign Exchange Analysis) requires multi-currency. Production tenants operating in multiple currencies need FX support from day one. |

---

## 2. What we gain vs what we code

### What numpy-financial gives us (zero code)
- `npf.npv(rate, values)` — NPV
- `npf.irr(values)` — IRR via Newton-Raphson (well-tested edge cases)
- `npf.pv`, `npf.fv`, `npf.pmt` — time-value-of-money primitives
- `npf.rate`, `npf.nper` — loan amortization
- `npf.mirr` — modified IRR with finance + reinvestment rates
- `npf.ipmt`, `npf.ppmt` — interest/principal split
- `npf.loan_payment`, `npf.loan_pv`, `npf.loan_fv` — simplified loan helpers

### What Beancount gives us (zero code)
- `.beancount` text file format for double-entry ledgers
- `beancount.loader` — parse and validate a ledger
- `beancount.core` — Account, Posting, Transaction, Amount types
- `beancount.ops` — sum postings to balances
- `beancount.report` — BalanceSheet, IncomeStatement, CashFlow, Holdings
- `beancount.query` — BQL SQL-like query language

### What we MUST code ourselves
- Pakistani tax rules (no open-source covers them: Sales Tax return schedules, SECP filings, withholding statements) — **out of scope for this plan**; will be a follow-up
- Synthetic dataset generation patterns specific to Sim-05 scenarios (the LLM will be prompted; we just need the persistence tools)

### What we get for free
- All 20 Sim-05 scenarios can run on top of this infrastructure
- Real tenant accounting work (NPV, IRR, depreciation, aging, ratios, FX, leases, inventory, payroll)
- Reproducible audits (math is in numpy-financial which is deterministic)
- Multi-tenant ledger exports as `.beancount` files

---

## 3. Architecture

### Sidecar is stateless compute — NestJS owns persistence

```
┌───────────────────────────────────────────────────────────────┐
│  NeureCore Chat (frontend-tenant / frontend-admin)            │
│  + Accounting Workspace (tenant) + SimulationRunner (tenant)  │
│  + Admin Cert Dashboard                                       │
└──────────────────────────┬────────────────────────────────────┘
                           │ HTTPS + JWT
                           ▼
┌───────────────────────────────────────────────────────────────┐
│  NeureCore Orchestrator (NestJS)                              │
├───────────────────────────────────────────────────────────────┤
│  SimulationsModule (EXISTING)                                  │
│  - POST /api/v1/simulations                 — create sim       │
│  - POST /api/v1/simulations/:id/days/:day/run — run one day   │
│  - SimulationsDayRunner → timeline + decisions + scoring       │
│  - AccountingService attaches as a ServiceIdentity within this │
│    lifecycle for sim scenarios                                 │
├───────────────────────────────────────────────────────────────┤
│  AccountingModule (NEW) — src/modules/accounting/              │
│  - AccountingController — REST endpoints for production work   │
│  - AccountingTokenService — HMAC mint via shared lib           │
│  - AccountingApprovalGuard — tier-2 gate on ledger writes      │
│  - HttpAccountingSidecarClient — proxy to Python sidecar       │
│  - LedgerRepositoryService — Prisma + Beancount file mgmt      │
│  - AccountingEventEmitter — Accounting.* events via outbox     │
│  Routes:                                                       │
│    POST /api/v1/accounting/compute/npv                        │
│    POST /api/v1/accounting/compute/irr                        │
│    POST /api/v1/accounting/compute/mirr                       │
│    POST /api/v1/accounting/loans/amortize                     │
│    POST /api/v1/accounting/ledger/postings                    │
│    POST /api/v1/accounting/ledger/reports/balance-sheet       │
│    POST /api/v1/accounting/ledger/reports/income-statement    │
│    POST /api/v1/accounting/ledger/reports/cash-flow           │
│    POST /api/v1/accounting/datasets/generate                  │
│    GET  /api/v1/accounting/datasets/{id}                      │
│    GET  /api/v1/accounting/datasets/{id}/rows?page=&limit=    │
│    GET  /api/v1/accounting/ledger/export.beancount            │
│    POST /api/v1/accounting/findings                           │
│    GET  /api/v1/accounting/findings                           │
└──────────────────────────┬────────────────────────────────────┘
                           │ HTTPS + scoped bearer token (HMAC-SHA256)
                           │ via infra/_common/auth.{py,ts}
                           ▼
┌───────────────────────────────────────────────────────────────┐
│  Accounting Sidecar (Python, NEW, stateless)                   │
│  FastAPI/uvicorn (port 8090, systemd service)                  │
│  - numpy-financial engine: NPV/IRR/PV/FV/PMT/MIRR             │
│  - Beancount loader + report generators                       │
│  - Pandas synthetic dataset generators                        │
│  - nftables UID-scoped (uid=hermes-sidecar — reuse)            │
│  - Stateless: receives inputs, returns results                 │
│  - NO file I/O, NO database access                             │
└───────────────────────────────────────────────────────────────┘
                           │
              ┌──────────────┴──────────────┐
              ▼                             ▼
┌──────────────────────────────┐  ┌────────────────────────────┐
│  Scoped NeureCore Tools       │  │  Enterprise Event Outbox   │
│  nc.accounting.* (Phase 2.5)  │  │  Accounting.* events       │
│  (proxied REST)               │  │  per UoW                   │
│  - audit + schema + RBAC      │  │                            │
└──────────────────────────────┘  └────────────────────────────┘
```

### Write path (example: ledger posting)

```
Client POST /api/v1/accounting/ledger/postings
  → AccountingApprovalGuard checks: is this tier-2?
    → YES → create PENDING approval, return { approvalId, status: "PENDING" }
    → NO/APPROVED → continue
  → AccountingController → AccountingService
    → Validate postings (debits = credits, tenant-scoped)
    → Call sidecar POST /v1/ledger/validate { postings }
      → Sidecar returns { validated: true, beancountChunk, issues[] }
    → Write AccountingRecord rows to Postgres (Prisma, UoW)
    → Append beancountChunk to tenant's ledger.beancount file
    → Emit Accounting.PostingRecorded via EnterpriseEventOutbox
    → Return { postingId, beancountRef }
```

### Data flow for simulation scenarios

```
POST /api/v1/simulations/:id/days/:day/run
  → SimulationsDayRunner (existing)
    → Triggers accounting computation via AccountingService
      → AccountingService calls sidecar for NPV/IRR/amortize
      → Results stored in AccountingReport via LedgerRepositoryService
      → Events emitted via AccountingEventEmitter
    → DayRunner continues with timeline/decision/scoring pipeline
```

---

## 4. Sidecar Service Inventory (Phase 1)

### Service: `accounting-sidecar`

| Property | Value |
|---|---|
| Repo path (local) | `infra/accounting-sidecar/` |
| Repo path (Contabo) | `/opt/neurecore/infra/accounting-sidecar/` |
| Python package | `accounting_sidecar` |
| Shared auth lib | `infra/_common/auth.py` (imported by both hermes-sidecar and accounting-sidecar) |
| User/Group | `hermes-sidecar` / `hermes-sidecar` (reuse; same uid, same nftables posture) |
| Port | `8090` (next available after hermes=8080, bridge=8082) |
| Systemd unit | `/etc/systemd/system/accounting-sidecar.service` |
| Env file | `/opt/neurecore/backend/backend/.env` (via `EnvironmentFile`) |
| HMAC secret | `ACCOUNTING_SIDECAR_SECRET=<hex64>` (new, separate from Hermes) |
| Workspace root | `/var/lib/neurecore/accounting/tenants/<tenantId>/` (managed by NestJS, not sidecar) |
| Beancount file | `/var/lib/neurecore/accounting/tenants/<tenantId>/ledger.beancount` (generated by NestJS) |
| Memory cap | 512M |
| CPU quota | 200% |
| Workers | 1 (uvicorn, single-worker sufficient for stateless compute) |
| Egress | **Deny all** via nftables (see §10) |

### pyproject.toml dependencies (mirrors hermes-sidecar + adds scientific stack)
```toml
[project]
name = "accounting-sidecar"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.27.0",
    "pydantic>=2.6.0",
    "pydantic-settings>=2.2.0",
    "httpx>=0.27.0",
    "numpy-financial>=1.0.0",
    "pandas>=2.0.0",
    "beancount>=3.2.0",
    "python-dateutil>=2.6.0",
]
```

### Endpoints (Phase 1, Phase 2 will add more)

```
GET  /healthz
GET  /readyz
POST /v1/compute/investment/npv        # {rate, cashflows[]} → {npv, computationId}
POST /v1/compute/investment/irr        # {cashflows[]}      → {irr, computationId, converged}
POST /v1/compute/investment/mirr       # {financeRate, reinvestRate, cashflows[]} → {mirr}
POST /v1/loan/amortize                 # {principal, rate, nper} → schedule[]
POST /v1/ledger/validate               # {postings[]}       → {validated, beancountChunk, issues[]}
POST /v1/ledger/reports/balance-sheet  # {postings[]}       → {accounts[], totals, beancount}
POST /v1/ledger/reports/income-statement # {postings[]}     → {accounts[], totals, beancount}
POST /v1/ledger/reports/cash-flow      # {postings[]}       → {accounts[], totals, beancount}
POST /v1/datasets/generate             # {schema, count, seed} → {datasetId, checksum, rowCount}
GET  /v1/datasets/{id}/rows            # {page, limit}      → {rows[], totalCount}
POST /v1/findings/validate             # {findings[]}       → {validated, findingIds[]}
```

Key change from original plan: **sidecar endpoints accept data as inputs, return computed results and Beancount strings. They do NOT read/write files or databases.** The NestJS layer is responsible for:
1. Persisting results to Postgres
2. Writing Beancount strings to the tenant's Beancount file
3. Serving `GET /v1/accounting/ledger/export.beancount` directly from the file

All endpoints require `Authorization: Bearer <scoped_token>` where the token is HMAC-SHA256 over claims `{"sub","tenantId","executionId","workspacePath","allowedTools","approvalThreshold","exp","scope":"accounting:execute"}`. Token format is shared via `infra/_common/auth.py` and `infra/_common/auth.ts`.

---

## 5. Backend NestJS Module

### Path: `backend/src/modules/accounting/`

```
accounting/
├── accounting.module.ts                    # wires everything
├── accounting.module.spec.ts               # module-level integration tests
├── guards/
│   └── accounting-approval.guard.ts         # tier-2 REST approval gating
├── controllers/
│   └── accounting.controller.ts             # POST /api/v1/accounting/* endpoints
├── services/
│   ├── accounting.service.ts                # business orchestration
│   ├── accounting-token.service.ts          # HMAC mint via shared lib (infra/_common/auth.ts)
│   ├── accounting-event-emitter.service.ts  # emits Accounting.* events to EnterpriseEventOutbox
│   ├── ledger-repository.service.ts         # Prisma queries on accounting tables + Beancount file mgmt
│   └── beancount-export.service.ts          # generates .beancount file from Postgres rows
├── domain/
│   ├── posting.types.ts                     # Posting, Account, Money value objects
│   ├── report.types.ts                      # BalanceSheet, IncomeStatement, CashFlow shapes
│   ├── dataset.types.ts                     # SyntheticDataset + row schemas
│   └── finding.types.ts                     # AuditFinding, Recommendation
├── interfaces/
│   └── accounting.interface.ts              # IAccountingSidecarClient + types + ACCOUNTING_SIDECAR token
├── infrastructure/
│   ├── prisma-accounting.repository.ts      # Prisma-backed CRUD on accounting tables
│   └── http-accounting-sidecar.client.ts    # calls sidecar with scoped token
├── dto/
│   ├── posting.dto.ts
│   ├── report.dto.ts
│   └── dataset.dto.ts
└── tests/
    ├── accounting.controller.spec.ts
    ├── accounting-approval.guard.spec.ts
    ├── accounting-token.service.spec.ts
    ├── accounting.integration.spec.ts
    └── beancount-export.service.spec.ts
```

### Integration with existing SimulationsModule

```typescript
// simulations/simulations.module.ts — add AccountingModule to imports
import { AccountingModule } from '../modules/accounting/accounting.module';

@Module({
  imports: [
    // ... existing imports
    AccountingModule,  // NEW — enables AccountingService in SimulationsDayRunner
  ],
})
export class SimulationsModule {}

// simulations/simulations.day-runner.ts — inject AccountingService
constructor(
  // ... existing deps
  private readonly accounting: AccountingService,  // NEW
) {}
```

### Prisma schema additions (additive migration)

```prisma
// ─── Sim-05 / NC-SIM05-IMP-1 ───────────────────────────────────

enum AccountingDatasetKind {
  INVENTORY_ITEM
  PAYROLL_EMPLOYEE
  PAYROLL_RUN
  LEASE_CONTRACT
  FIXED_ASSET
  BANK_ACCOUNT
  BANK_TRANSACTION
  INVOICE
  CUSTOMER_RECEIVABLE
  FINANCIAL_STATEMENT
  VENDOR_PAYABLE
  TAX_RETURN
  FX_TRANSACTION
}

model AccountingDataset {
  id            String                @id @default(cuid())
  tenantId      String
  tenant        Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  scenarioId    String?               // Sim-05 scenario id (1..20); null for production work
  simulationRunId String?             // ties to enterprise_initiations or SimulationsModule
  kind          AccountingDatasetKind
  name          String                // "Ali Wood - Q3 2026 Inventory"
  description   String?
  schemaVersion Int                   @default(1)
  rowCount      Int
  seedValue     Int?                  // RNG seed for reproducibility
  generatedBy   String                // 'np.dataset.generate' | 'manual'
  payload       Json                  // row array (first page, max 100 rows)
  payloadUrl    String?               // presigned URL to full row data (S3 or local file) for >100 rows
  checksum      String                // sha256 of full payload for tamper-detection
  approvedAt    DateTime?
  approvedById  String?
  createdAt     DateTime              @default(now())
  updatedAt     DateTime              @updatedAt
  @@unique([tenantId, name])          // changed from [tenantId, scenarioId, name] — allow re-generation
  @@index([tenantId, kind])
  @@index([simulationRunId])
  @@map("accounting_datasets")
}

model AccountingRecord {
  id            String      @id @default(cuid())
  tenantId      String
  tenant        Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  datasetId     String?
  dataset       AccountingDataset? @relation(fields: [datasetId], references: [id], onDelete: SetNull)
  scenarioId    String?
  simulationRunId String?
  txnId         String                  // beancount txn id
  date          DateTime
  account       String                  // "Assets:Bank:Checking"
  counterparty  String?                 // "Acme Corp"
  amount        Decimal                 @db.Decimal(18, 4)  // increased from 14,4 — supports up to ~10B+ values
  currency      String      @default("USD")
  fxRate        Decimal?    @db.Decimal(12, 8)  // exchange rate to base currency (for multi-currency support)
  baseCurrency  String?                  // tenant's reporting currency; null if same as currency
  baseAmount    Decimal?    @db.Decimal(18, 4)  // amount converted to base currency
  narration     String?
  tags          Json        @default("[]")
  sourceRef     String?                 // beancount file:line reference
  postingType   String?                 // 'DEBIT' | 'CREDIT' — nullable for backward compat; required for double-entry validation
  approvedAt    DateTime?
  approvedById  String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt   // added for audit trail
  @@unique([tenantId, txnId, account])
  @@index([tenantId, date])
  @@index([tenantId, account])
  @@index([datasetId])
  @@map("accounting_records")
}

model AccountingReport {
  id            String      @id @default(cuid())
  tenantId      String
  tenant        Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  simulationRunId String?
  reportType    String      // 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW' | 'NPV' | 'IRR' | ...
  periodStart   DateTime?
  periodEnd     DateTime?
  asOf          DateTime?
  baseCurrency  String      @default("USD")   // reporting currency for this report
  computedBy    String      // 'npf' | 'beancount' | 'manual'
  inputs        Json        // hash + arguments
  results       Json        // the actual report
  beancountExport String?   @db.Text           // Beancount-formatted representation
  createdAt     DateTime    @default(now())
  @@index([tenantId, reportType])
  @@index([simulationRunId])
  @@map("accounting_reports")
}

model AuditFinding {
  id            String      @id @default(cuid())
  tenantId      String
  tenant        Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  scenarioId    String?
  simulationRunId String?
  severity      AuditFindingSeverity
  category      String      // 'INVENTORY_DISCREPANCY' | 'UNAUTHORIZED_EXPENSE' | ...
  title         String
  description   String      @db.Text
  evidence      Json        // refs to dataset rows, ledger postings, source docs
  recommendation String?    @db.Text
  status        AuditFindingStatus @default(OPEN)
  resolvedAt    DateTime?
  resolvedById  String?
  resolvedNote  String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  @@index([tenantId, severity])
  @@index([tenantId, status])
  @@index([simulationRunId])
  @@map("audit_findings")
}

enum AuditFindingSeverity { LOW MEDIUM HIGH CRITICAL }
enum AuditFindingStatus   { OPEN ACKNOWLEDGED RESOLVED WAIVED }
```

Key schema changes from the original proposal:
1. `AccountingRecord.amount` increased to `Decimal(18,4)` — supports values up to ~1 trillion
2. `AccountingRecord.updatedAt` added for audit trail
3. `AccountingRecord.fxRate`, `baseCurrency`, `baseAmount` added for multi-currency support (Scenario 12)
4. `AccountingRecord.postingType` added for double-entry validation (DEBIT/CREDIT)
5. `AccountingDataset.@@unique` changed to `[tenantId, name]` — dropping `scenarioId` from unique constraint allows regeneration
6. `AccountingDataset.payloadUrl` added — for large datasets (>100 rows), payload stores first page and full data is accessible via URL
7. `AccountingDataset.scenarioId` made optional (null for production tenant work)
8. `AccountingReport.baseCurrency` added
9. `infra/_common/auth.py` + `infra/_common/auth.ts` — shared HMAC library referenced

### Wired into `app.module.ts` (post-freeze, see §12)
```ts
import { AccountingModule } from './modules/accounting/accounting.module';
// ... in imports array (added 2026-08-29):
AccountingModule,
```

### Approval guard behavior

The `AccountingApprovalGuard` is applied at the controller level:

```typescript
@Post('ledger/postings')
@UseGuards(JwtAuthGuard, AccountingApprovalGuard)
@ApprovalRequired('TIER_2')  // custom decorator
// ... handler runs only after approval

@Post('compute/npv')
@UseGuards(JwtAuthGuard, AccountingApprovalGuard)
@ApprovalRequired('TIER_1')  // auto-approved for read-only computations
```

**TIER_1** (auto): Computations that don't persist to ledger — NPV, IRR, MIRR, amortize schedules. Approved inline.

**TIER_2** (human required): Anything that posts to the ledger, generates datasets, or records findings. Creates a `PENDING` approval via the existing `ApprovalWorkflowEngine`, returns `{ approvalId, status: "PENDING" }`. The actual write happens only after the approval is resolved.

---

## 6. nc.* tool surface (deferred, Phase 2.5 — after freeze expiry)

Phase 1 endpoints are **first-class REST** (`/api/v1/accounting/...`), accessed by the LLM via the AI Gateway or by the frontend. We do NOT wrap them as `nc.accounting.*` tools in Phase 1 because:

1. The Hermes agent is currently in a 30-day observation window (NC-AWL-IMP-2 Gate 8).
2. Wrapping would add new `allowedTools` entries, requiring new approval flows and audit.
3. Direct REST + AI Gateway structured output is simpler and proven.

After the observation window closes (2026-08-29), we add `nc.accounting.compute_npv`, `nc.accounting.post_ledger`, `nc.accounting.export_beancount`, `nc.accounting.generate_dataset`, `nc.accounting.record_finding` to `scoped-tool.schemas.ts` and dispatch them through `ScopedToolGatewayService` (the same pattern as the existing 11 `nc.*` tools). This is **Phase 2.5** and is explicitly gated on freeze expiry.

For production tenants, the `nc.accounting.*` tools are the primary day-to-day interface. Phase 1 REST is available for integration and testing; Phase 2.5 is the production path.

---

## 7. Frontend Surfaces

### Existing ScenarioSimulator component

The frontend-tenant already has a `ScenarioSimulator` component at `src/features/strategy/components/ScenarioSimulator.tsx` backed by `useScenarioSimulator` hook and `ScenarioService`. This was built for the earlier simulation system. For Sim-05, we **retire** this component in favor of the new dedicated simulation pages — `ScenarioService` was in-memory only and doesn't support the persistence/scoring requirements of Sim-05.

### Tenant frontend — `frontend-tenant/src/app/simulations/` (trainings)

**Routes:**
- `/simulations` — list of all Sim-05 scenarios (20 cards), each clickable to start a run
- `/simulations/[scenarioId]` — detail view with: scenario description, input dataset state, generated datasets list, reports, findings, export buttons
- `/simulations/[scenarioId]/run` — execution view (chat-style, drives the agent through steps)

**Components to add** (`frontend-tenant/src/components/simulations/`):
- `SimulationCard.tsx` — one of 20 scenario cards
- `SimulationRunner.tsx` — chat-like runner using the same `UnifiedChatPanel` pattern
- `DatasetTable.tsx` — generic table that renders `AccountingDataset.payload` (a JSONB array) with filter + search + pagination (handles datasets >100 rows via `payloadUrl`)
- `ReportViewer.tsx` — renders `AccountingReport.results` as balance sheet / income statement / cash flow / NPV / IRR
- `FindingsPanel.tsx` — lists `AuditFinding` rows with severity badge
- `BeancountExportButton.tsx` — calls `GET /api/v1/accounting/ledger/export.beancount`

**Service** (`frontend-tenant/src/services/simulations.service.ts`):
- `listScenarios()` → returns the 20 scenario specs from `simulations/Sim-05`
- `listDatasets(scenarioId?)` → `AccountingDataset[]`
- `getDataset(id)` → `AccountingDataset` (header metadata only)
- `getDatasetRows(id, page, limit)` → `{ rows[], totalCount }` (paginated payload access)
- `generateDataset(scenarioId, kind, seed?)` → POST → `AccountingDataset`
- `listReports(scenarioId?)` → `AccountingReport[]`
- `generateReport(scenarioId, reportType, period?)` → POST → `AccountingReport`
- `listFindings(scenarioId?)` → `AuditFinding[]`
- `recordFinding(scenarioId, finding)` → POST → `AuditFinding`
- `exportBeancount(scenarioId)` → GET → raw text (Content-Type: text/plain)
- `runScenario(scenarioId, prompt)` → POST → starts via SimulationsModule

**Navigation integration:** Simulations routes added to the tenant sidebar under a "Simulations" section, alongside existing entries (Projects, Customers, Finance, etc.).

### Tenant frontend — `frontend-tenant/src/app/accounting/` (production work)

**Routes:**
- `/accounting/workspace` — accounting workspace dashboard (recent computations, ledger summary, pending approvals)
- `/accounting/ledger` — view/add ledger postings, export Beancount
- `/accounting/compute` — NPV/IRR/amortize calculator
- `/accounting/reports` — generated reports
- `/accounting/findings` — audit findings

**Components to add** (`frontend-tenant/src/components/accounting/`):
- `CalculatorPanel.tsx` — NPV/IRR/amortize input forms
- `LedgerEntryTable.tsx` — view/post ledger entries
- `FindingsList.tsx` — audit findings with severity badges

**Service** (`frontend-tenant/src/services/accounting.service.ts`):
- `computeNpv(rate, cashflows)` → POST → `{ npv, computationId }`
- `computeIrr(cashflows)` → POST → `{ irr, converged }`
- `computeMirr(financeRate, reinvestRate, cashflows)` → POST → `{ mirr }`
- `amortizeLoan(principal, rate, nper)` → POST → `{ schedule[] }`
- `postJournalEntry(postings)` → POST → `{ postingId, beancountRef, approvalId? }`
- `generateReport(type, period)` → POST → `{ AccountingReport }`
- `listReports(type?, period?)` → `AccountingReport[]`
- `recordFinding(finding)` → POST → `{ AuditFinding, approvalId? }`
- `getExportBeancount()` → GET → raw text

### Admin frontend — `frontend-admin/src/app/accounting/`

**Routes:**
- `/accounting/health` — sidecar health, queue depth, last computation timestamps
- `/accounting/datasets` — all tenants' datasets (for PLATFORM_ADMIN support)
- `/accounting/reports` — all tenants' reports
- `/accounting/certification` — Phase 9 G9-style accounting certification dashboard

**Components to add:**
- `SidecarHealthCard.tsx` — `/healthz` and `/readyz` poll
- `DatasetCrossTenantTable.tsx` — with tenant filter
- `CertificationReportViewer.tsx` — reuses G9 dashboard patterns

**Navigation integration:** Admin routes added to the Admin shell sidebar under an "Accounting" section.

---

## 8. Build & Deploy Procedure

### Shared HMAC library (prerequisite, done once)

```bash
# Create shared auth library
mkdir -p infra/_common
# Python: infra/_common/auth.py — same HMAC sign/verify as hermes-sidecar/auth.py
#   but scope-agnostic (scope checked by caller, not hardcoded to 'hermes:execute')
# TypeScript: infra/_common/auth.ts — same HMAC sign/verify as token.service.ts
#   Re-exported by hermes-adapter/token.service.ts and accounting/token.service.ts

# hermes-sidecar imports from ../_common/auth.py instead of local copy
# accounting-sidecar imports from ../_common/auth.py instead of duplicating
# accounting-token.service.ts imports from ../../../infra/_common/auth.ts
```

### Local

```bash
# 0. Write shared infra/_common/auth.{py,ts}  — prerequisite
# 1. Write infra/accounting-sidecar/* source files
# 2. Write backend/src/modules/accounting/* source files
#    (skipped if deploying pre-freeze — only schema + sidecar)
# 3. Add models to backend/prisma/schema.prisma
pnpm prisma migrate dev --name sim05_accounting_init    # local only
# 4. Run protocol-lock tests (critical: NestJS mints → Python verifies)
cd infra/_common && pytest test_auth.py && npx jest test_auth.spec.ts
# 5. Run backend unit + integration tests
cd backend && pnpm test --testPathPatterns=accounting
# 6. Run sidecar tests locally
cd ../infra/accounting-sidecar && pytest tests/ -v
# 7. Deploy backend
cd ../../ && bash scripts/deploy.sh backend
# 8. Deploy shared lib to venv
ssh contabo "rsync -avz -e ssh infra/_common/ /opt/neurecore/infra/_common/"
# 9. Deploy sidecar (NEW procedure)
ssh contabo "mkdir -p /opt/neurecore/infra/accounting-sidecar"
rsync -avz -e ssh --exclude='__pycache__' --exclude='*.pyc' \
    /home/najeeb/Linux-Dev/neurecore-2026/neurecore/infra/accounting-sidecar/ \
    contabo:/opt/neurecore/infra/accounting-sidecar/
ssh contabo "cd /opt/neurecore/infra/accounting-sidecar && \
    /opt/neurecore/infra/venv/bin/pip install -e ."
# 10. Deploy nftables rules
ssh contabo "rsync -avz -e ssh infra/sidecar/nftables-accounting.nft \
    contabo:/tmp/ && sudo nft -f /tmp/nftables-accounting.nft"
# 11. Install systemd unit
ssh contabo "rsync -avz -e ssh infra/sidecar/systemd/accounting-sidecar.service \
    contabo:/tmp/ && sudo mv /tmp/accounting-sidecar.service /etc/systemd/system/"
ssh contabo "systemctl daemon-reload && systemctl enable accounting-sidecar && \
    systemctl start accounting-sidecar"
# 12. Add HMAC secret to .env
ssh contabo "grep -q ACCOUNTING_SIDECAR_SECRET /opt/neurecore/backend/backend/.env || \
    echo 'ACCOUNTING_SIDECAR_SECRET=<new-hex>' >> /opt/neurecore/backend/backend/.env"
# 13. Reload backend to pick up env
ssh contabo "pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save"
# 14. Smoke test
ssh contabo "curl -s http://127.0.0.1:8090/healthz"  # expect {"status":"ok"}
# 15. Protocol-lock e2e (NestJS → sidecar roundtrip with real token)
curl -s http://127.0.0.1:3003/api/v1/accounting/health  # expect {"sidecar":"ok"}
```

### Idempotent / safe
- Schema migration is additive (no existing tables changed)
- New sidecar runs as new process — does not touch existing hermes-sidecar
- New HMAC secret does not affect hermes-sidecar auth
- Existing 11 `nc.*` tools unaffected
- Shared auth library is a pure refactor of hermes-sidecar/auth.py — no behavior change
- NestJS AccountingModule is deployed post-freeze (see §12)

---

## 9. Certifying Sim-05

### Integration with existing G9 certification framework

Rather than a standalone cert pipeline, accounting certification is integrated into the existing `src/test/certification/` framework:

**New certification scenarios (added to `certification-runner.ts`):**

| Scenario | Count | What it tests |
|---|---|---|
| NPV computation | 30 | Correct values, edge cases (negative cashflows, zero rate), convergence |
| IRR computation | 30 | Unique IRR, no-IRR, multiple-IRR edge cases, convergence reporting |
| Double-entry ledger | 30 | Postings balance, tenant isolation, approval gating |
| Beancount roundtrip | 20 | Post → validate → export → re-parse → verify |
| Dataset generation | 20 | Determinism (same seed → same data), large datasets (500+ items) |
| Multi-currency FX | 10 | FX rate application, base currency conversion, gain/loss calc |
| Cross-tenant denial | 5 | Tenant A's token cannot read Tenant B's data |
| **Total** | **145** | Cumulative with existing 105 G9 scenarios |

### New Gate metrics (for `GateG9Summary`)

| Metric | Target |
|---|---|
| NPV accuracy vs textbook | 100% (bit-for-bit within 4dp) |
| IRR convergence success rate | ≥ 98% |
| Double-entry validation pass | 100% |
| Zero duplicate postings | 100% |
| Deterministic dataset generation | 100% (same seed → sha256 match) |
| Sidecar health uptime | ≥ 99.5% |
| Sidecar response time P99 | ≤ 500ms |
| Cross-tenant denial | 100% |

### Phase 1 cert (immediate, post-deploy — pre-freeze)
- `pnpm test --testPathPatterns=accounting` — all green
- `pytest infra/accounting-sidecar/tests/` — all green
- `pytest infra/_common/test_auth.py` — all green
- `npx jest infra/_common/test_auth.spec.ts` — all green
- Sidecar `/healthz` and `/readyz` return 200
- Protocol-lock e2e: NestJS mints token → Python verifies → Python signs → NestJS verifies
- 1 sample computation (NPV, IRR, amortize) end-to-end via direct sidecar call
- 1 ledger posting → validate → verify double-entry balances

### Phase 2 cert (after frontend + NestJS module — post-freeze)
- One happy-path Sim-05 scenario (e.g. scenario 2: Annual Financial Statement Audit) driven through the tenant UI
- One production tenant accounting workflow (ledger posting + report generation + Beancount export)
- Datasets generated, reports produced, findings recorded, Beancount export downloadable
- Output validated against known textbook cases (NPV/IRR convergence, balance sheet footing)
- Multi-currency test: post FX transactions, verify base currency conversion

### Phase 3 cert (full certification — post-freeze)
- Reuse the SIM-04 provisioning pattern: spawn 20 clean tenants, run all 20 Sim-05 scenarios against each, verify
- Plus: spawn 5 production tenants with concurrent accounting workloads, verify isolation
- Per-tenant duplicate-record evidence (no double-posted ledger entries across runs)
- Output goes to `simulations/SIM-05-Accounting-Full-Flow/certification/`
- Verdict: PASS or FAIL
- Failure-tombstone (NC-AWL-IMP-2 §5): if FAIL, sidecar stays deprecated and the cert path is closed; no follow-up domain build without new architecture decision.

---

## 10. Risk + Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| numpy-financial IRR doesn't converge for some cashflow | Medium | High | Return `{converged: false}` instead of crashing. Test with textbook edge cases (Brigham/Ehrhardt). |
| Decimal precision drift between numpy-financial and Prisma `Decimal(18,4)` | Low | High | Use `decimal.Decimal` in Python; convert via `str()` not `float()`. Tests assert bit-for-bit equality with hand-calculated textbook results. |
| 500-item / 1,000-employee datasets exceed memory cap | Low | Medium | Stream pandas operations. Return metadata-only from POST; paginate row retrieval via GET. 100 rows per page default. |
| Sidecar uid not egress-restricted | Low | Critical | **New nftables file** `infra/sidecar/nftables-accounting.nft` — deny ALL egress for `uid hermes-sidecar` on port 8090. No outbound network needed. |
| Phase 1 freeze violated | Low (with new sequencing) | High | **Sequencing fix:** schema migration + sidecar deploy pre-freeze (2026-08-14). NestJS module + frontend deploy post-freeze (2026-08-29). The sidecar is unreachable without the NestJS module, so it's inert during the observation window. |
| Token format mismatch between NestJS mint and sidecar verify | Low | Critical | **Shared `infra/_common/auth.{py,ts}`** — single implementation for all HMAC operations. Protocol-lock tests verify NestJS→Python and Python→NestJS roundtrip. |
| Multi-currency rounding errors | Low | Medium | FX rates stored as `Decimal(12,8)` — 8 decimal places sufficient for all major currency pairs. Base amount computed in Python with `decimal.Decimal`. |
| Production tenant concurrent ledger writes | Medium | High | Postgres transactional integrity handles concurrent writes. Beancount file is append-only, managed by NestJS with file locking. Sidecar is stateless — no concurrency concerns. |
| Real tenant accounting errors have legal/financial consequences | Medium | Critical | All ledger writes require TIER-2 approval. Full audit trail via EnterpriseEventOutbox. Beancount export is tamper-evident (sha256 checksums). "Not financial advice" disclaimer in tenant ToS. |
| Pakistani tax rules not in scope | High | Medium | Explicitly out of scope. Documented. Will require separate initiative if needed. |

---

## 11. Honest Effort Estimate (working days)

| Phase | Days | Notes |
|---|---|---|
| Phase 0: Shared HMAC library (`infra/_common/auth.*`) | 1 | Extract from hermes-sidecar + create TS equivalent. Protocol-lock tests. |
| Phase 1a: Prisma schema migration + 4 new models + 3 enums | 1 | Additive only, low risk |
| Phase 1b: Python sidecar skeleton (FastAPI + HMAC via shared lib + healthz) | 1 | Copy from hermes-sidecar; use shared `_common/auth.py` |
| Phase 1c: numpy-financial endpoints (npv, irr, mirr, amortize) | 2 | Textbook-test fixtures included |
| Phase 1d: Beancount ledger validation + report generators (BS, IS, CF) | 3 | Stateless: accepts postings, returns validated result + beancount string |
| Phase 1e: Pandas synthetic dataset generator endpoint | 1 | Metadata-only POST; paginated GET for rows |
| Phase 1f: NestJS module skeleton (controller, guards, service, interfaces) | 2 | Includes AccountingApprovalGuard; wired post-freeze |
| Phase 1g: NestJS-side ledger repository + event emitter + Beancount file mgmt | 2 | Uses existing PrismaUnitOfWork + EnterpriseEventOutbox |
| Phase 1h: Unit + integration tests (backend) — 90+ tests | 3 | Includes protocol-lock, approval gating, tenant isolation |
| Phase 1i: Sidecar pytest (lifecycle, finance correctness, ledger roundtrip, determinism) | 2 | |
| Phase 1j: nftables + systemd unit + Contabo deploy + smoke | 1 | |
| **Phase 1 total** | **~19 days** | "Sidecar runs, compute endpoints work, no UI, no NestJS module until freeze lifts" |
| Phase 2a: Tenant UI — simulations list + runner + dataset table + report viewer + findings | 5 | New pages + components + service |
| Phase 2b: Tenant UI — accounting workspace (calculator, ledger, reports) | 3 | Production tenant accounting UI |
| Phase 2c: Admin UI — health + cross-tenant datasets + certification | 3 | |
| **Phase 2 total** | **~11 days** | Phase 2 = "full UI for both simulation and production" |
| Phase 3: Sim-05 cert harness + G9 integration + 145-scenario matrix | 5 | Mirrors SIM-04 cert pattern; integrated into G9 framework |
| **Phase 3 total** | **~5 days** | Phase 3 = "certified" |
| **Grand total** | **~35 working days** | Roughly 7 weeks with a single developer (includes Phase 0, expanded scope for production tenants) |

---

## 12. Sequencing (respects the freeze)

```
2026-07-30 (today)        ─ user approves this plan
2026-07-30 .. 2026-08-01  ─ Phase 0 (shared HMAC library)
2026-07-30 .. 2026-08-14  ─ Phase 1a..1e (schema + sidecar, NO NestJS module)
2026-08-14                ─ code freeze for Phase 1a-e; deploy to Contabo
                              (schema migration + sidecar deploy + nftables)
                              Sidecar is INERT — no NestJS module routes traffic to it
                              NO chat-path code, NO hermes integration
2026-08-14 .. 2026-08-21  ─ Phase 1f..1j (NestJS module coding but NOT deployed)
2026-08-21                ─ Phase 1 sidecar-only cert: PASS / FAIL
                              if FAIL → failure-tombstone, sidecar deprecated
2026-08-21 .. 2026-08-28  ─ Phase 2a..2c (UI coding but NOT deployed)
2026-08-28                ─ NC-AWL-IMP-2 Gate 8 observation window ends
                              if zero rollback → proceed to Phase 2 deploy
2026-08-29                ─ Deploy NestJS module + frontend (full Phase 1 + Phase 2)
2026-08-29 .. 2026-09-05  ─ Phase 3 (Sim-05 + production certification)
2026-09-05                ─ Final certification report
                              if PASS → Sim-05 + production accounting certified
                              if FAIL → failure-tombstone
```

Hard constraint: **No code change to the chat path until 2026-08-29**. The sidecar is deployed pre-freeze but is unreachable (no NestJS module routes traffic to it). The NestJS module + frontend deploy on the same day the freeze expires.

---

## 13. Open Questions (resolved or requiring user decision)

1. **Plan approval:** ACCEPTED on 2026-07-30.

2. **Phase 2 (UI) — tenant only, or also admin?** Tenant UI includes both simulation pages AND production accounting workspace. Admin UI includes health, cross-tenant oversight, and certification. Both.

3. **nc.* tool wrapping (Section 6):** Phase 2.5 after freeze. The Phase 1 REST endpoints are sufficient for initial use; nc.* tools are the production path for real tenants and go live immediately after NestJS module deploy (2026-08-29).

4. **Pakistani tax rules:** Confirmed out of scope. Acceptable.

5. **Decimal precision:** Use `Decimal(18,4)` in Postgres. Sidecar returns results as strings (`"1234.5678"`). NestJS converts to `Decimal(18,4)` via Prisma. Confirm: the sidecar uses `decimal.Decimal` internally and converts via `str()`. Accepted.

6. **Phase 1 deploy sequence:** Confirmed: schema migration + sidecar only (pre-freeze, 2026-08-14). NestJS module + frontend (post-freeze, 2026-08-29). Accepted.

7. **New: Shared HMAC library:** `infra/_common/auth.{py,ts}`. This replaces duplicated HMAC code in hermes-sidecar, hermes-events-bridge, and will be used by accounting-sidecar + accounting-token.service. Acceptable?

8. **New: Production tenant scope increases Phase 1 effort from 16 to 19 days and total from 29 to 35 days.** Acceptable?

9. **New: Approval gating for REST endpoints via AccountingApprovalGuard.** All ledger writes require TIER-2 (human) approval. Computations are TIER-1 (auto-approved). Acceptable?

---

## 14. Decomposition into sub-plans (2026-07-30 revision)

This umbrella is retained for reference. The actual implementation is in two new sub-plans:

### `NC-ACCT-IMP-1-NEURECORE-CAPABILITY.md`

The NeureCore accounting capability. Everything in the original plan §1-§13 except the Sim-05-specific simulation wiring. Key changes from the original:

- Added `ChartOfAccount`, `AccountingPeriod`, `JournalEntry`, `UserAccountingRole`, `OutboxMerkleRoot` models (5 of the original plan's 4 missing domain foundations).
- Sidecar made **stateful-but-isolated** for report generation via mmap'd snapshot file (rejects "pure stateless" at >10k postings).
- `nc.accounting.*` tools shipped on day one of NestJS deploy (not deferred to Phase 2.5).
- Three shared auth libraries (`scope_token`, `webhook_sig`, `deploy_token`) instead of one.
- Segregation-of-duties at DB level with role taxonomy (POSTING, REVIEWER, CONTROLLER, CFO, AUDITOR).
- Tamper-evidence via Merkle root over outbox events (not file checksums).
- Separate accounting cert framework (gates A1-A11), not bundled into G9.
- 62-day effort estimate (vs. original 35).
- Prerequisite bug fix: `approval-workflow.engine.ts:303-333` empty-tenantId.
- Realistic Phase 1 deliverable: COA + Period + Journal + 3 reports + Beancount export + 14 nc.* tools. **No** AR/AP/payroll/fixed-asset/bank-recon/tax subledgers.

### `NC-SIM05-IMP-2-SIMULATION-INTEGRATION.md`

The Sim-05 simulation wiring. Depends on NC-ACCT-IMP-1 reaching Phase 2 cert PASS. Key changes from the original:

- 20 scenarios split into 6 Phase A (compute-required) + 14 Phase B (judgment).
- Reuses existing `SimulationsModule` + `SimulationsDayRunner` via `ServiceIdentity` family.
- Adds `Sim05ScenarioRegistry`, `Sim05DayExecutor`, `Sim05ScoringEngine`.
- Separate Sim-05 cert framework (gates S1-S8), uses G9 (work coordination) + A1-A11 (accounting) + LLM-as-judge.
- Scenario 6 (Tax Audit) is re-scoped to generic tax OR held until `NC-TAX-IMP-1`.
- Curriculum content (full scenario briefs, reference oracles, scoring rubrics) authored by training/product team.
- 53-day effort estimate.

### Sequencing

```
2026-07-30 .. 2026-08-14  ─ NC-ACCT-IMP-1 Phase 0, 1a-1f (auth libs + schema + sidecar)
2026-08-14                ─ Sidecar deploy pre-freeze
2026-08-14 .. 2026-08-21  ─ NC-ACCT-IMP-1 Phase 1g-1l (NestJS module)
2026-08-21                ─ Sidecar-only cert PASS / FAIL
2026-08-21 .. 2026-08-28  ─ NC-ACCT-IMP-1 Phase 1m-1n + UI coding
2026-08-28                ─ NC-AWL-IMP-2 Gate 8 observation window ends
2026-08-29                ─ Deploy NestJS module + frontend + nc.accounting.* tools
2026-08-29 .. 2026-09-12  ─ NC-ACCT-IMP-1 Phase 2 cert
2026-09-12                ─ NC-ACCT-IMP-1 Phase 2 cert PASS
2026-09-12 .. 2026-10-22  ─ NC-SIM05-IMP-2 Phase A + B
2026-10-22                ─ NC-SIM05-IMP-2 cert PASS / FAIL
```

### What stays in this umbrella

- The original 13-section analysis (architecture, schema, cert, risk, effort) is retained for traceability. **The sub-plans are the source of truth; this document is the historical record of the decomposition.**
- The 105 → 145 G9 scenario expansion is **superseded** by NC-ACCT-IMP-1 §10 (150 math oracle cases + 11 gates A1-A11) and NC-SIM05-IMP-2 §4 (gates S1-S8).
- The original §13 open questions are answered in the sub-plans (NC-ACCT-IMP-1 §14 and NC-SIM05-IMP-2 §5).
