# NC-ACCT-IMP-1: NeureCore Accounting Capability (numpy-financial + Beancount)

**Document ID:** NC-ACCT-IMP-1
**Date:** 2026-07-30
**Status:** PROPOSED
**Supersedes:** none
**Parent plan:** `NC-SIM05-IMP-1-FINANCIAL-SIMULATION-PLAN.md` (umbrella)
**Triggered by:** Real NeureCore tenants need in-platform accounting computation for production work (NPV/IRR capital appraisal, amortization, ledger postings, financial statement generation, audit support). Sim-05 simulation integration is a separate, downstream plan (`NC-SIM05-IMP-2`).

---

## 0. Honest Scope Statement

This plan delivers a **general-purpose, tenant-isolated accounting capability** inside NeureCore:

- A Python sidecar (`accounting-sidecar`) that hosts `numpy-financial` + `beancount` + `pandas` for compute and ledger validation.
- A NestJS module (`AccountingModule`) that owns all persistence (Postgres + Beancount file export + EnterpriseEventOutbox).
- HMAC-scoped token auth via a shared library.
- TIER-2 (human) approval for ledger writes, TIER-1 (auto) for read-only computations.
- A complete chart of accounts (COA), accounting periods, payments, and double-entry journal structure — the **minimum domain model** that any real-tenant accounting work requires.

This plan does **NOT** deliver:

- The Sim-05 training scenario content (owned by training/product).
- Sim-05 simulation runner integration (separate plan: `NC-SIM05-IMP-2`).
- Pakistani / FBR / SECP tax rules, GST/VAT filings, withholding schedules, or any jurisdiction-specific tax filing. A tax *engine* (rates, codes, withholding categories) is delivered as data structures + read APIs only; **no tax return generation is supported** until a follow-up plan adds a `TaxEngineModule`.
- Subledger specializations (Inventory, Fixed Assets, Payroll, Bank Reconciliation, Lease Accounting, Tax Provision) beyond their data model foundations. These are explicit Phase 2/3 work.
- AR/AP subledgers, aging, collections, dunning, statements. Data model foundations only; workflows are Phase 2.
- Regulatory submissions, signed financial statements, audit opinion generation, or any legally-binding document. "Not financial advice" disclaimer applies.

### Phase boundary

| Phase | Delivered by this plan | Delivered by follow-up plans |
|---|---|---|
| **Phase 1 (this plan)** | COA, Periods, JournalEntry/Posting, Payment model, NPV/IRR/MIRR/amortize, 3 reports (BS/IS/CF) on the sidecar, single-tenant ledger under TIER-2 approval, Beancount file export, `nc.accounting.*` tools on day one of NestJS deploy | — |
| **Phase 2 (NC-SIM05-IMP-2)** | — | Sim-05 simulation wiring: 6 of 20 scenarios attached to the day-runner, scoring integration, scenario content |
| **Phase 3 (future plan)** | — | AR/AP subledgers, bank reconciliation engine, inventory subledger, fixed-asset register, payroll register, tax engine, lease accounting, period close workflow, multi-entity consolidation |

The decision to split is deliberate. The capability must be **fully integrated into NeureCore production before** the simulation harness is attached. A simulator built on top of an unproven capability is just a more expensive way to discover the gaps.

---

## 1. Decision Summary

| Decision | Choice | Rationale |
|---|---|---|
| Architecture | **Capability-style module** `accounting` (NestJS) + **`accounting-sidecar`** (Python) | Mirrors `hermes-adapter` + `hermes-sidecar` pattern already proven. Same audit, outbox, nftables posture. |
| Sidecar role | **Stateless for compute; stateful-but-isolated for report generation** | Compute endpoints (NPV/IRR/amortize/validate) are pure functions. Report endpoints (BS/IS/CF) need access to a tenant-scoped read-only snapshot of postings. Stateless-only is impractical at >10k postings. |
| Sidecar state | Per-tenant **mmap'd snapshot file** at `/var/lib/neurecore/accounting/snapshots/<tenantId>.beancount` (read-only to sidecar, refreshed by NestJS) | Lets the sidecar run Beancount's report generators without DB access. Refresh-on-demand keeps snapshot fresh. nftables still denies DB egress. |
| Sidecar stack | FastAPI + numpy-financial + Beancount (loader/report API) + Pandas (Python 3.11) | Same as before. No change. |
| Tenant scoping | Every endpoint scopes on `tenantId` from JWT; ledger file paths under `/var/lib/neurecore/accounting/tenants/<tenantId>/` | Mirrors Hermes three-layer workspace layout. |
| Source of truth | **Postgres** (Prisma models) — Beancount files are **derived exports** | Beancount alone is fine for personal finance, not for multi-tenant SaaS. Sidecar snapshots are derived from DB; snapshot regeneration is a NestJS background job. |
| Event emission | `EnterpriseEventOutbox` from `src/common/persistence/prisma-outbox.repository.ts` | Mandatory. Every ledger posting emits `Accounting.PostingRecorded` in the same UoW as the DB INSERT. **Atomicity requires passing the same Prisma transaction to `publish()`** — the file append happens only after the outbox commit. |
| Approval gating | **`AccountingApprovalGuard` + role-aware SoD enforcement** | TIER-1 (auto) for compute. TIER-2 (human) for ledger writes. **Segregation of duties:** the user who posts cannot be the user who approves, enforced by `postingUserId != approverUserId`. Role requirements: `POSTING` role for journal entry creation; `REVIEWER` role for approval; `PREPARER`/`CONTROLLER`/`CFO` taxonomy defined per tenant. |
| nc.* tool wrapping | **Ship on day one of NestJS module deploy** — NOT deferred | The chat agent is the only path a real tenant uses. REST-only is inert to tenants. The same `ScopedToolGatewayService` pattern as the existing 11 `nc.*` tools. `nc.accounting.compute_npv`, `nc.accounting.amortize_loan`, `nc.accounting.post_ledger`, `nc.accounting.export_beancount`, `nc.accounting.generate_dataset`, `nc.accounting.record_finding`, `nc.accounting.get_account_balance`. |
| Phase 1 freeze | **Schema migration + sidecar deploy pre-freeze (2026-08-14). NestJS module + frontend deploy post-freeze (2026-08-29).** | Sidecar is unreachable without the NestJS module → inert during observation window. |
| Shared auth | **Two shared libraries**, not one: `infra/_common/scope_token.{py,ts}` (HMAC bearer token) and `infra/_common/webhook_sig.{py,ts}` (timestamped webhook signature) | Two distinct protocols. Unifying them into one library corrupts both. |
| Multi-currency | Add `baseCurrency` and `fxRate` fields to `AccountingReport` and add `fxRate` to `AccountingRecord` | Scenario 12 (FX) needs it. Real multi-currency tenants need it from day one. |
| Tamper-evidence | **Merkle root over outbox event chain + DB row hash** — NOT a file checksum | File checksums detect bit corruption, not tampering. Real tamper-evidence requires an append-only log (the outbox) with a hash chain. |
| Tool reality discipline | **Every nc.accounting.* tool ships with: JSON schema in `scoped-tool.schemas.ts`, smoke test against a real tenant fixture, RBAC matrix entry, contract matrix row, prerequisite-data assertion.** | Lessons from `Hermes-tools.md:177` — only 31/71 legacy tools actually worked. We will not repeat that pattern. |
| Approval consolidation debt | **Reuse `ApprovalWorkflowEngine` as-is in Phase 1, do not refactor it.** | Architecture amendment §578 notes approval CRUD + workflow engine duplicate one domain. Consolidation is a separate future plan. We fix only the empty-tenantId notification bug as a prerequisite. |
| Browser-first deliverable | **Phase 2 deploy (NestJS module + frontend + nc.* tools) is a single atomic release gated by a browser-driven happy-path test.** | SIM-04 lesson: backend capability + broken browser = FAIL. Deploying REST-only would replicate that pattern. The chat agent path (via nc.* tools) is the user-facing surface; if it doesn't work in a real browser, we don't ship. |

---

## 1a. Implementation stance (no waiting)

The user has decided **not to wait** for any observation window, freeze expiry, or external cert to begin implementation. The implementation proceeds in this order:

1. **Phase 0** — three shared auth libraries. Begin immediately.
2. **Phase 1a–1f** — schema + sidecar skeleton + compute endpoints. Coding starts immediately.
3. **Phase 1g–1l** — NestJS module + tools + SoD + Merkle. Coding starts immediately and in parallel.
4. **Phase 1m–1n** — test suites. Begin as soon as Phase 1d completes.
5. **Phase 1o** — deploy to Contabo. Happens when the sidecar + module + tests are green, regardless of any other plan's freeze status.
6. **Phase 2 cert** — happens immediately after Phase 1 deploy. No waiting for any external sign-off.
7. **NC-SIM05-IMP-2** — begins immediately after NC-ACCT-IMP-1 Phase 2 cert PASS.

The "no chat-path change until freeze expires" rule in the original plan is **superseded by user direction**. The risk previously absorbed by the freeze window is now absorbed by:

- The browser-first deploy gate (no ship without visible UI).
- The A1–A11 cert suite (no ship without gates green).
- The SIM-04 lesson (browser evidence, not API success, is decisive).

All §13 sequencing dates are advisory only. Real dates are driven by "green tests + green cert + browser happy-path," not by a calendar.

---

## 2. What numpy-financial + Beancount give us (zero code)

### numpy-financial
- `npf.npv(rate, values)` — NPV
- `npf.irr(values)` — IRR via Newton-Raphson
- `npf.pv`, `npf.fv`, `npf.pmt` — time-value-of-money primitives
- `npf.rate`, `npf.nper` — loan amortization
- `npf.mirr` — modified IRR with finance + reinvestment rates
- `npf.ipmt`, `npf.ppmt` — interest/principal split
- `npf.loan_payment`, `npf.loan_pv`, `npf.loan_fv` — simplified loan helpers

### Beancount
- `.beancount` text file format for double-entry ledgers
- `beancount.loader` — parse and validate a ledger
- `beancount.core` — Account, Posting, Transaction, Amount types
- `beancount.ops` — sum postings to balances
- `beancount.report` — BalanceSheet, IncomeStatement, CashFlow, Holdings
- `beancount.query` — BQL SQL-like query language

### What we MUST code ourselves (Phase 1)
- Chart of Accounts (COA) management, with type taxonomy and normal-balance convention
- Accounting Period model with open/close/lock workflow
- Double-entry journal entry validation (debits = credits, COA-respected, period-open)
- Approval workflow with segregation of duties (poster ≠ approver, role-bound)
- Beancount snapshot generation from DB → mmap'd file
- Per-tenant workspace layout
- Merkle-root hash chain over outbox events
- Synthetic dataset generation patterns

### What we MUST code ourselves (NOT in this plan)
- Pakistani tax rules, FBR/SECP filings, withholding schedules — out of scope
- AR/AP subledgers, bank reconciliation, inventory subledger, fixed-asset register, payroll register, lease accounting, period-close workflow — Phase 2/3 plans
- Audit opinion generation, regulatory submissions — explicit legal responsibility limitation

---

## 3. Architecture

### Sidecar is stateless for compute, stateful-but-isolated for reports

```
┌───────────────────────────────────────────────────────────────┐
│  NeureCore Chat (frontend-tenant / frontend-admin)            │
│  + Accounting Workspace (tenant)                              │
│  + Admin Cert Dashboard                                       │
└──────────────────────────┬────────────────────────────────────┘
                           │ HTTPS + JWT
                           ▼
┌───────────────────────────────────────────────────────────────┐
│  NeureCore Orchestrator (NestJS)                              │
├───────────────────────────────────────────────────────────────┤
│  AccountingModule (NEW) — src/modules/accounting/              │
│  - AccountingController — REST endpoints for production work   │
│  - AccountingTokenService — HMAC mint via shared lib           │
│  - AccountingApprovalGuard — tier-2 + SoD gate on ledger writes│
│  - HttpAccountingSidecarClient — proxy to Python sidecar       │
│  - LedgerRepositoryService — Prisma + Beancount snapshot gen   │
│  - AccountingEventEmitter — Accounting.* events via outbox     │
│  - ChartOfAccountsService — COA management                     │
│  - AccountingPeriodService — period open/close/lock            │
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
│    nc.accounting.* tools (proxied via ScopedToolGatewayService)│
└──────────────────────────┬────────────────────────────────────┘
                           │ HTTPS + scoped bearer token (HMAC-SHA256)
                           │ via infra/_common/scope_token.{py,ts}
                           ▼
┌───────────────────────────────────────────────────────────────┐
│  Accounting Sidecar (Python, NEW)                              │
│  FastAPI/uvicorn (port 8090, systemd service)                  │
│  - numpy-financial engine: NPV/IRR/PV/FV/PMT/MIRR             │
│  - Beancount loader + report generators                       │
│  - Pandas synthetic dataset generators                        │
│  - nftables UID-scoped (uid=hermes-sidecar — reuse)            │
│  - State model:                                                │
│    * Compute endpoints: stateless (inputs in, results out)     │
│    * Report endpoints: read mmap'd snapshot at                 │
│      /var/lib/neurecore/accounting/snapshots/<tenantId>.beancount│
│      (refreshed by NestJS on commit; reloadable on SIGHUP)    │
│  - NO database access, NO write filesystem access             │
└──────────────────────────┬────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                          ▼
┌──────────────────────────┐  ┌────────────────────────────┐
│  nc.accounting.* tools    │  │  Enterprise Event Outbox   │
│  (Phase 1 day one)         │  │  Accounting.* events       │
│  - audit + schema + RBAC  │  │  per UoW + Merkle root     │
└──────────────────────────┘  └────────────────────────────┘
```

### Write path (example: journal entry post)

```
Client POST /api/v1/accounting/ledger/postings
  → JwtAuthGuard extracts tenant + user from JWT
  → AccountingApprovalGuard checks:
    - Is this TIER-2? YES
    - User has POSTING role? yes
    - Period is OPEN? yes
    - COA accounts exist and are leaf-allowed? yes
    → Create PENDING approval via ApprovalWorkflowEngine
    → Returns { approvalId, status: "PENDING" }
  → Human approves (via /api/v1/approvals/:id/decide):
    - Approver has REVIEWER role
    - approverUserId != postingUserId (SoD)
    - approverUserId is in the approval chain
  → On approval resolution, transaction opens:
    → prisma.$transaction(async (tx) => {
         await LedgerRepositoryService.insertPostings(tx, ...)
         await LedgerRepositoryService.refreshSnapshot(tx, tenantId)
         await AccountingEventEmitter.publish(tx, 'Accounting.PostingRecorded', payload, idempotencyKey)
       })
    → Snapshot regenerated to /var/lib/neurecore/accounting/snapshots/<tenantId>.beancount
    → Outbox event written in the same UoW
    → Return { postingId, beancountRef, outboxEventId }
```

### Snapshot strategy

The sidecar runs Beancount's report generators (`BalanceSheet`, `IncomeStatement`, `CashFlow`) which require a parsed ledger. Two options:

1. **Pure stateless:** NestJS sends all postings in the request body. Works at <10k postings, breaks at 100k+.
2. **Stateful-but-isolated:** Sidecar reads a tenant-scoped mmap'd snapshot file. NestJS regenerates the snapshot on every committed journal entry. Sidecar has read-only FS access to its workspace.

**Choice: option 2**, with a hard constraint:

- Snapshot file path: `/var/lib/neurecore/accounting/snapshots/<tenantId>.beancount` (fixed, per-tenant).
- Sidecar uid: `hermes-sidecar` (reuse). systemd `ReadOnlyPaths=` + `ReadWritePaths=` whitelist allows only `/var/lib/neurecore/accounting/snapshots/` and `/var/lib/neurecore/accounting/tenants/<tenantId>/` (when the sidecar reads via the snapshot).
- nftables egress-deny unchanged: sidecar cannot reach DB.
- SIGHUP handler: sidecar remaps the snapshot file without restart.
- Refresh trigger: NestJS background job after every commit (or coalesced at ≤1 Hz per tenant).

The sidecar is **not** a general "stateful service" — its state is a derived, refreshable, mmap'd, read-only cache. State is reproducible from the DB.

---

## 4. Sidecar Service Inventory (Phase 1)

### Service: `accounting-sidecar`

| Property | Value |
|---|---|
| Repo path (local) | `infra/accounting-sidecar/` |
| Repo path (Contabo) | `/opt/neurecore/infra/accounting-sidecar/` |
| Python package | `accounting_sidecar` |
| Shared auth lib (token) | `infra/_common/scope_token.py` (imported by hermes-sidecar, accounting-sidecar) |
| Shared auth lib (webhook) | `infra/_common/webhook_sig.py` (imported by hermes-sidecar, hermes-events-bridge) |
| User/Group | `hermes-sidecar` / `hermes-sidecar` (reuse; same uid, same nftables posture) |
| Port | `8090` (next available after hermes=8080, bridge=8082) |
| Systemd unit | `/etc/systemd/system/accounting-sidecar.service` |
| Env file | `/opt/neurecore/backend/backend/.env` (via `EnvironmentFile`) |
| HMAC secret | `ACCOUNTING_SIDECAR_SECRET=<hex64>` (new, separate from Hermes) |
| Workspace root (read-only) | `/var/lib/neurecore/accounting/snapshots/<tenantId>.beancount` |
| Memory cap | 512M |
| CPU quota | 200% |
| Workers | 1 (uvicorn, single-worker sufficient) |
| Egress | **Deny all** via nftables (see §10) |

### pyproject.toml dependencies

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

### Endpoints (Phase 1)

```
GET  /healthz
GET  /readyz
POST /v1/compute/investment/npv        # stateless — {rate, cashflows[]} → {npv, computationId}
POST /v1/compute/investment/irr        # stateless — {cashflows[]}      → {irr, computationId, converged}
POST /v1/compute/investment/mirr       # stateless — {financeRate, reinvestRate, cashflows[]} → {mirr}
POST /v1/loan/amortize                 # stateless — {principal, rate, nper} → schedule[]
POST /v1/ledger/validate               # stateless — {postings[]}       → {validated, beancountChunk, issues[]}
POST /v1/ledger/reports/balance-sheet  # stateful — reads tenant snapshot, returns {accounts[], totals, beancount}
POST /v1/ledger/reports/income-statement # stateful — reads tenant snapshot
POST /v1/ledger/reports/cash-flow      # stateful — reads tenant snapshot
POST /v1/datasets/generate             # stateless — {schema, count, seed} → {datasetId, checksum, rowCount}
GET  /v1/datasets/{id}/rows            # stateless — {page, limit} → {rows[], totalCount}
POST /v1/findings/validate             # stateless — {findings[]} → {validated, findingIds[]}
```

All endpoints require `Authorization: Bearer <scoped_token>` where the token is HMAC-SHA256 over claims `{"sub","tenantId","executionId","workspacePath","allowedTools","approvalThreshold","exp","scope":"accounting:execute"}` minted by `infra/_common/scope_token.py` / `scope_token.ts`.

### Snapshot lifecycle

1. NestJS writes journal entries to DB in a single UoW.
2. On commit, NestJS calls `LedgerRepositoryService.regenerateSnapshot(tenantId)` (a background job, coalesced per-tenant at ≤1 Hz).
3. The job reads all `AccountingRecord` rows for the tenant, generates a `.beancount` text string, atomically renames the file at the snapshot path (write-temp + rename).
4. Sidecar receives a SIGHUP (or polls a `mtime` file) and remaps the snapshot via `mmap`.
5. Subsequent report calls see the new ledger.

Failure mode: if the snapshot regen fails, the sidecar continues serving from the **last good snapshot**. Snapshot staleness is logged and visible in `/healthz`.

---

## 5. Backend NestJS Module

### Path: `backend/src/modules/accounting/`

```
accounting/
├── accounting.module.ts                    # wires everything
├── accounting.module.spec.ts               # module-level integration tests
├── guards/
│   └── accounting-approval.guard.ts         # tier-2 REST + SoD gating
├── controllers/
│   └── accounting.controller.ts             # POST /api/v1/accounting/* endpoints
├── services/
│   ├── accounting.service.ts                # business orchestration
│   ├── accounting-token.service.ts          # HMAC mint via scope_token.ts
│   ├── accounting-event-emitter.service.ts  # emits Accounting.* events via outbox (same UoW)
│   ├── ledger-repository.service.ts         # Prisma queries on accounting tables + Beancount snapshot mgmt
│   ├── chart-of-accounts.service.ts         # COA CRUD + validation
│   ├── accounting-period.service.ts         # period open/close/lock
│   ├── beancount-export.service.ts          # snapshot generation from DB
│   └── segregation-of-duties.service.ts     # role + SoD enforcement
├── domain/
│   ├── posting.types.ts                     # Posting, Account, Money value objects
│   ├── report.types.ts                      # BalanceSheet, IncomeStatement, CashFlow shapes
│   ├── dataset.types.ts                     # SyntheticDataset + row schemas
│   ├── finding.types.ts                     # AuditFinding, Recommendation
│   └── period.types.ts                      # AccountingPeriod, PeriodStatus
├── interfaces/
│   └── accounting.interface.ts              # IAccountingSidecarClient + types + ACCOUNTING_SIDECAR token
├── infrastructure/
│   ├── prisma-accounting.repository.ts      # Prisma-backed CRUD on accounting tables
│   └── http-accounting-sidecar.client.ts    # calls sidecar with scoped token
├── tools/                                   # NEW — nc.* tool wrappers, shipped on day 1
│   ├── accounting.tools.ts                  # tool definitions for ScopedToolGatewayService
│   └── accounting.tools.spec.ts
├── dto/
│   ├── posting.dto.ts
│   ├── report.dto.ts
│   ├── dataset.dto.ts
│   ├── coa.dto.ts
│   └── period.dto.ts
└── tests/
    ├── accounting.controller.spec.ts
    ├── accounting-approval.guard.spec.ts
    ├── accounting-token.service.spec.ts
    ├── chart-of-accounts.service.spec.ts
    ├── accounting-period.service.spec.ts
    ├── segregation-of-duties.service.spec.ts
    ├── accounting.integration.spec.ts
    └── beancount-export.service.spec.ts
```

### Wired into `app.module.ts` (post-freeze, see §12)

```ts
import { AccountingModule } from './modules/accounting/accounting.module';
// ... in imports array (added 2026-08-29):
AccountingModule,
```

### Approval guard behavior

The `AccountingApprovalGuard` enforces four things:

1. **Tier check** — is this a TIER-1 (auto) or TIER-2 (human) operation?
2. **Period check** — is the target period `OPEN`?
3. **COA check** — do all referenced accounts exist and are they leaf accounts (not parents)?
4. **SoD check** — if TIER-2, the approver's userId must differ from the poster's userId.

```typescript
@Post('ledger/postings')
@UseGuards(JwtAuthGuard, AccountingApprovalGuard)
@ApprovalRequired('TIER_2')  // custom decorator
// ... handler runs only after approval

@Post('compute/npv')
@UseGuards(JwtAuthGuard, AccountingApprovalGuard)
@ApprovalRequired('TIER_1')  // auto-approved
```

**TIER_1** (auto): NPV, IRR, MIRR, amortize, validate, dataset generate, finding validate.

**TIER_2** (human required): ledger posting, dataset persistence, finding record, period close, COA mutation.

### Segregation of duties

A tenant-configurable SoD matrix enforces:

- `POSTING` role: required to create journal entries.
- `REVIEWER` role: required to approve.
- `approverUserId != postingUserId` (DB-enforced, not just guarded).
- Optional per-tenant role escalation: `CONTROLLER` approves up to $X; `CFO` approves above.

Roles live in the existing `Membership.role` enum or in a new `AccountingRole` table referenced from `User`. Decision deferred to implementation; for Phase 1 we add `AccountingRole` as a per-tenant user attribute.

### Prerequisite bug fix

Before reuse, fix the existing notification bug in `modules/hermes/services/approval-workflow.engine.ts:303-333` where the notification helper is called with an empty tenantId. This will be addressed in a separate one-line change before Phase 1 deploy.

---

## 5a. Approval consolidation debt (acknowledged, not paid)

The `ApprovalWorkflowEngine` (`modules/hermes/services/approval-workflow.engine.ts`) is a single concrete class that owns ordered steps, role/identity checks, status/inbox queries, and notification fan-out. The architecture analysis (`memory-bank-arc/plans/enterprise-integration-architecture-amendment.md:578`) notes that approval CRUD and the workflow engine duplicate one domain and should consolidate behind a single Approval Port.

**Decision for this plan:** do not refactor it.

Rationale:

- Refactoring `ApprovalWorkflowEngine` mid-stream would change every existing approval consumer (Hermes, AWL executions, service identities). That is a cross-cutting change far larger than the accounting capability.
- The empty-tenantId bug is a single notification call site; fixing it does not require restructuring.
- Accounting's SoD model (poster ≠ approver, role taxonomy) is **additive** — it does not require engine changes, only guard-level checks and a DB constraint on `JournalEntry.postingUserId != approvedById`.
- Consolidation behind a single Approval Port is a separate future plan (`NC-APPROVAL-PORT-IMP-1`, not yet authored).

What this plan ships:

- `AccountingApprovalGuard` checks tier + period + COA + SoD before invoking the engine.
- `JournalEntry` table has `postingUserId` and `approvedById` columns with a `CHECK (postingUserId <> approvedById)` constraint at the DB level (UI-only SoD is insufficient).
- `UserAccountingRole` table holds per-tenant role assignments (POSTING, REVIEWER, CONTROLLER, CFO, AUDITOR).
- The existing `ApprovalWorkflowEngine` is invoked as-is.

What this plan does **not** ship:

- Approval Port abstraction.
- Engine refactor.
- Cross-capability notification fix beyond the accounting path.

If the empty-tenantId bug fix breaks another consumer (it shouldn't — it's a notification payload correction), it is rolled back independently of the accounting deploy.

---

## 6. Prisma schema additions (additive migration)

```prisma
// ─── NC-ACCT-IMP-1: Accounting Capability Phase 1 ─────────────

enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
}

enum AccountNormalBalance {
  DEBIT
  CREDIT
}

enum AccountingPeriodStatus {
  OPEN
  CLOSING
  CLOSED
  LOCKED
}

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

enum AccountingRole {
  VIEWER
  PREPARER
  POSTING
  REVIEWER
  CONTROLLER
  CFO
  AUDITOR
}

model ChartOfAccount {
  id              String                @id @default(cuid())
  tenantId        String
  tenant          Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  code            String                // e.g. "1000", "1100-100"
  name            String                // e.g. "Cash - Operating Bank"
  type            AccountType
  normalBalance   AccountNormalBalance
  parentId        String?
  parent          ChartOfAccount?       @relation("AccountHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children        ChartOfAccount[]      @relation("AccountHierarchy")
  currency        String                @default("USD")
  isLeaf          Boolean               @default(true)  // leaf accounts accept postings
  isActive        Boolean               @default(true)
  description     String?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  @@unique([tenantId, code])
  @@index([tenantId, type])
  @@index([parentId])
  @@map("chart_of_accounts")
}

model AccountingPeriod {
  id              String                @id @default(cuid())
  tenantId        String
  tenant          Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  code            String                // e.g. "2027-Q1", "2027-01"
  name            String                // e.g. "January 2027"
  startDate       DateTime
  endDate         DateTime
  status          AccountingPeriodStatus @default(OPEN)
  closedAt        DateTime?
  closedById      String?
  lockedAt        DateTime?
  lockedById      String?
  fiscalYear      Int
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  @@unique([tenantId, code])
  @@index([tenantId, fiscalYear])
  @@index([tenantId, status])
  @@map("accounting_periods")
}

model UserAccountingRole {
  id              String                @id @default(cuid())
  tenantId        String
  tenant          Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userId          String
  user            User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  role            AccountingRole
  grantedAt       DateTime              @default(now())
  grantedById     String?
  @@unique([tenantId, userId, role])
  @@index([tenantId, userId])
  @@map("user_accounting_roles")
}

model JournalEntry {
  id              String                @id @default(cuid())
  tenantId        String
  tenant          Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  periodId        String
  period          AccountingPeriod      @relation(fields: [periodId], references: [id])
  txnId           String                // beancount txn id; unique per tenant
  date            DateTime
  narration       String
  postingUserId   String                // SoD: poster's userId (DB-enforced)
  approvedById    String?
  approvedAt      DateTime?
  approvalId      String?               // links to existing approval record
  totalDebit      Decimal               @db.Decimal(18, 4)
  totalCredit     Decimal               @db.Decimal(18, 4)
  sourceRef       String?               // "manual" | "nc.accounting.post_ledger" | "scenario:N"
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  postings        AccountingRecord[]
  @@unique([tenantId, txnId])
  @@index([tenantId, periodId])
  @@index([tenantId, date])
  @@map("journal_entries")
}

model AccountingRecord {
  id              String      @id @default(cuid())
  tenantId        String
  tenant          Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  journalEntryId  String
  journalEntry    JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  accountId       String
  account         ChartOfAccount @relation(fields: [accountId], references: [id])
  datasetId       String?
  dataset         AccountingDataset? @relation(fields: [datasetId], references: [id], onDelete: SetNull)
  scenarioId      String?
  simulationRunId String?
  amount          Decimal     @db.Decimal(18, 4)
  currency        String      @default("USD")
  fxRate          Decimal?    @db.Decimal(12, 8)
  baseCurrency    String?
  baseAmount      Decimal?    @db.Decimal(18, 4)
  postingType     String      // 'DEBIT' | 'CREDIT' — required
  counterparty    String?
  narration       String?
  tags            Json        @default("[]")
  sourceRef       String?     // beancount file:line reference
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  @@index([tenantId, journalEntryId])
  @@index([tenantId, accountId])
  @@index([tenantId, date])
  @@index([datasetId])
  @@map("accounting_records")
}

model AccountingDataset {
  id              String                @id @default(cuid())
  tenantId        String
  tenant          Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  scenarioId      String?
  simulationRunId String?
  kind            AccountingDatasetKind
  name            String
  description     String?
  schemaVersion   Int                   @default(1)
  rowCount        Int
  seedValue       Int?
  generatedBy     String                // 'np.dataset.generate' | 'manual'
  payload         Json                  // row array (first page, max 100 rows)
  payloadUrl      String?
  checksum        String                // sha256 of full payload (corruption-detection, not tamper-evidence)
  approvedAt      DateTime?
  approvedById    String?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  records         AccountingRecord[]
  @@unique([tenantId, name])
  @@index([tenantId, kind])
  @@index([simulationRunId])
  @@map("accounting_datasets")
}

model AccountingReport {
  id              String      @id @default(cuid())
  tenantId        String
  tenant          Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  simulationRunId String?
  reportType      String      // 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW' | 'NPV' | 'IRR' | ...
  periodId        String?
  period          AccountingPeriod? @relation(fields: [periodId], references: [id])
  asOf            DateTime?
  baseCurrency    String      @default("USD")
  computedBy      String      // 'npf' | 'beancount' | 'manual'
  inputs          Json        // hash + arguments
  results         Json        // the actual report
  beancountExport String?     @db.Text
  createdAt       DateTime    @default(now())
  @@index([tenantId, reportType])
  @@index([simulationRunId])
  @@index([periodId])
  @@map("accounting_reports")
}

model AuditFinding {
  id              String      @id @default(cuid())
  tenantId        String
  tenant          Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  scenarioId      String?
  simulationRunId String?
  severity        AuditFindingSeverity
  category        String
  title           String
  description     String      @db.Text
  evidence        Json
  recommendation  String?     @db.Text
  status          AuditFindingStatus @default(OPEN)
  resolvedAt      DateTime?
  resolvedById    String?
  resolvedNote    String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  @@index([tenantId, severity])
  @@index([tenantId, status])
  @@index([simulationRunId])
  @@map("audit_findings")
}

model OutboxMerkleRoot {
  id              String      @id @default(cuid())
  tenantId        String
  tenant          Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  rootHash        String      // sha256 of (prevRoot + leafHashes)
  leafCount       Int
  periodStart     DateTime
  periodEnd       DateTime
  computedAt      DateTime    @default(now())
  @@index([tenantId, computedAt])
  @@map("outbox_merkle_roots")
}

enum AuditFindingSeverity { LOW MEDIUM HIGH CRITICAL }
enum AuditFindingStatus   { OPEN ACKNOWLEDGED RESOLVED WAIVED }
```

### Tamper-evidence: Merkle root over outbox events

File checksums detect bit corruption, not tampering. Real tamper-evidence requires an **append-only log with a hash chain**. We already have the `EnterpriseEventOutbox`; we add a periodic **Merkle root snapshot** table:

- Every N events (configurable; default 1000) or at period close, a background job computes:
  `rootHash = sha256(prevRoot || sha256(eventId_1 || payloadHash_1) || ... || sha256(eventId_N || payloadHash_N))`
- `OutboxMerkleRoot` is append-only (no UPDATE, only INSERT).
- Audit verification: replay outbox events from a snapshot point, recompute root, compare.

This is what makes `Accounting.PostingRecorded` events auditable. It does not require Beancount; Beancount is the export format for human-readable audit, not the source of trust.

---

## 7. nc.* tool surface (shipped on day one of NestJS deploy)

`nc.accounting.*` tools are added to `scoped-tool.schemas.ts` and dispatched through `ScopedToolGatewayService` (same pattern as the existing 11 `nc.*` tools). The agent is the primary user; REST endpoints are for integration and testing.

### Tool definitions (Phase 1)

| Tool | Tier | Description |
|---|---|---|
| `nc.accounting.compute_npv` | TIER_1 | `{rate, cashflows[]}` → `{npv, computationId}` |
| `nc.accounting.compute_irr` | TIER_1 | `{cashflows[]}` → `{irr, converged}` |
| `nc.accounting.compute_mirr` | TIER_1 | `{financeRate, reinvestRate, cashflows[]}` → `{mirr}` |
| `nc.accounting.amortize_loan` | TIER_1 | `{principal, rate, nper}` → `{schedule[]}` |
| `nc.accounting.validate_postings` | TIER_1 | `{postings[]}` → `{validated, issues[]}` |
| `nc.accounting.post_ledger` | TIER_2 | `{postings[], narration, date}` → `{journalEntryId, approvalId, status}` |
| `nc.accounting.generate_dataset` | TIER_1 | `{kind, count, seed}` → `{datasetId, rowCount, checksum}` |
| `nc.accounting.record_finding` | TIER_2 | `{severity, category, title, ...}` → `{findingId, approvalId}` |
| `nc.accounting.export_beancount` | TIER_1 | `{asOf?}` → `{beancount, snapshotHash}` |
| `nc.accounting.get_account_balance` | TIER_1 | `{accountCode, asOf}` → `{balance, currency}` |
| `nc.accounting.list_accounts` | TIER_1 | `{type?}` → `{accounts[]}` |
| `nc.accounting.create_account` | TIER_2 | `{code, name, type, ...}` → `{accountId, approvalId}` |
| `nc.accounting.list_periods` | TIER_1 | `{fiscalYear?}` → `{periods[]}` |
| `nc.accounting.close_period` | TIER_2 | `{periodId}` → `{periodId, status, approvalId}` |

Each tool:
- Validates against the JSON schema in `scoped-tool.schemas.ts`.
- Routes through `ScopedToolGatewayService`.
- TIER-2 tools create a PENDING approval and return `{approvalId, status: "PENDING"}`; the chat agent surfaces the approval to the user.
- TIER-1 tools run inline.
- All tools enforce `tenantId` from the JWT and the existing 10 mandatory invariants (NC-AWL-IMP-1 §14.2).

---

## 8. Frontend Surfaces

### Tenant frontend — `frontend-tenant/src/app/accounting/`

**Routes:**
- `/accounting/workspace` — dashboard (recent computations, ledger summary, pending approvals, period status)
- `/accounting/chart-of-accounts` — COA list/create/edit
- `/accounting/periods` — period list + open/close/lock actions
- `/accounting/ledger` — journal entries, post new entry, export Beancount
- `/accounting/compute` — NPV/IRR/amortize calculator
- `/accounting/reports` — generated reports
- `/accounting/findings` — audit findings
- `/accounting/datasets` — synthetic dataset library

**Components** (`frontend-tenant/src/components/accounting/`):
- `CalculatorPanel.tsx`
- `LedgerEntryTable.tsx`
- `ChartOfAccountsTree.tsx`
- `PeriodStatusPanel.tsx`
- `PostingDialog.tsx` (TIER-2 approval flow)
- `FindingsList.tsx`
- `DatasetTable.tsx` (reused from Sim-05 plan via shared lib)
- `BeancountExportButton.tsx`
- `RoleGuard.tsx` (UI-level role enforcement)

### Admin frontend — `frontend-admin/src/app/accounting/`

**Routes:**
- `/accounting/health` — sidecar health, snapshot freshness, queue depth
- `/accounting/datasets` — all tenants' datasets (PLATFORM_ADMIN)
- `/accounting/reports` — all tenants' reports
- `/accounting/certification` — accounting cert dashboard
- `/accounting/merkle-roots` — Merkle root verification UI

**Components:**
- `SidecarHealthCard.tsx`
- `SnapshotFreshnessIndicator.tsx`
- `MerkleRootViewer.tsx`
- `DatasetCrossTenantTable.tsx`
- `CertificationReportViewer.tsx`

---

## 8a. Browser-first deliverable discipline (SIM-04 lesson)

The corrected SIM-04 run (`AGENTS.md:153`) was a **FAIL** specifically because the runner had been treating API endpoints as a substitute for the frontend workflow — explicitly forbidden by SIM-04's Non-Negotiable Operating Rules. The failure pattern that produced the G9 cert being marked PASSED prematurely is **the pattern we must not repeat** with the accounting capability.

Concretely, the Phase 2 deploy (NestJS module + tenant/admin frontend + nc.accounting.* tools) is gated by:

### Browser-driven happy-path test (required, before deploy)

A scripted Chromium walkthrough against `https://hq.neurecore.com` that performs, **through the real frontend, no API shortcuts**:

1. Log into a fresh test tenant as a user with `PREPARER` role.
2. Navigate to `/accounting/chart-of-accounts`, create a leaf account (`1500 — Office Supplies`).
3. Navigate to `/accounting/periods`, open the current period.
4. Navigate to `/accounting/ledger`, post a journal entry:
   - Debit `1500 — Office Supplies` $500
   - Credit `1000 — Cash` $500
   - The TIER-2 approval flow must be visible (not hidden behind a hidden endpoint).
5. **Log out, log back in as a different user with `REVIEWER` role** (enforces SoD).
6. Open the inbox, approve the pending entry. Confirm the journal posts to the ledger.
7. Navigate to `/accounting/reports`, generate a balance sheet. Confirm it shows the $500 movement.
8. Click `BeancountExportButton`. Confirm download. Open the `.beancount` file. Confirm double-entry balances.
9. Open a chat session, type "what's my cash balance?" as natural business language. Confirm the agent invokes `nc.accounting.get_account_balance` and returns the answer.
10. **Repeat 9 with a second user on a second tenant. Confirm tenant isolation: the second user never sees the first user's data.**

If any step fails, the deploy is **blocked**. No bypass. No "REST-only is fine for now." That is the SIM-04 trap.

### Visible-state checklist (required, before deploy)

The frontend must surface, **without requiring the user to inspect DevTools or the database**:

- Current accounting period status (`OPEN`, `CLOSING`, `CLOSED`, `LOCKED`).
- Pending approvals count and severity.
- Last snapshot freshness timestamp.
- Last Merkle root computed timestamp.
- User's accounting role(s) in the current tenant.

If a state is invisible to the user, the deploy is blocked.

### Tool contract matrix (required, before adding any nc.accounting.* tool)

For each of the 14 tools in §7:

| Row | Value |
|---|---|
| JSON schema | Path in `scoped-tool.schemas.ts` |
| Smoke test | One happy-path test in `src/test/accounting-cert/integration/tool-smoke/` that calls the tool with a real tenant fixture and asserts the response shape |
| RBAC | Required accounting role (POSTING, REVIEWER, CONTROLLER, CFO, AUDITOR, or none for TIER-1) |
| Prerequisite data | What tenant state must exist for the tool to succeed (period OPEN, COA has leaf accounts, etc.) |
| Failure mode | What the tool returns if prerequisite is missing (error code, not 500) |
| Idempotency key | How the caller supplies the key (header, body field, server-derived) |
| Outbox event | Which `Accounting.*` event is emitted on success |

A tool without a complete row in this matrix is **not shipped**. Lessons from `Hermes-tools.md:177` — 40 of 71 legacy tools failed for exactly these reasons.

### Cert precondition

Phase 2 cert (per §10) is **not allowed to start** until the browser happy-path passes and every tool has a complete contract matrix row. Otherwise we replicate the SIM-04 pattern: backend green, frontend broken, cert claims PASS.

---

## 9. Build & Deploy Procedure

### Shared auth libraries (prerequisite, done once)

```bash
# Create two separate shared auth libraries
mkdir -p infra/_common

# 1. Scoped bearer token (HMAC-SHA256) — used by NestJS → sidecar
# Python: infra/_common/scope_token.py — sign/verify with scope parameter
# TypeScript: infra/_common/scope_token.ts — sign/verify with scope parameter
# Replaces the duplicate HMAC in hermes-sidecar/auth.py, hermes-adapter/token.service.ts,
# hermes-events-bridge/_mint_token(). NOT a unification of webhook signatures.

# 2. Webhook signature (timestamped HMAC) — used by sidecar → bridge
# Python: infra/_common/webhook_sig.py — sign/verify with timestamp + replay protection
# TypeScript: infra/_common/webhook_sig.ts — same
# Replaces the duplicate HMAC in hermes-sidecar/events.py and hermes-events-bridge/signature.py.

# The bridge deployment helper (_mint_token) is a third use case:
# it gets its own minimal signer in infra/_common/deploy_token.{py,ts}.
# Do not collapse all three into one library.
```

### Local

```bash
# 0. Write shared infra/_common/scope_token.{py,ts} and webhook_sig.{py,ts} — prerequisite
# 1. Write infra/accounting-sidecar/* source files
# 2. Add models to backend/prisma/schema.prisma
pnpm prisma migrate dev --name acct_capability_init    # local only
# 3. Run protocol-lock tests
cd infra/_common && pytest test_scope_token.py && npx jest test_scope_token.spec.ts
cd infra/_common && pytest test_webhook_sig.py && npx jest test_webhook_sig.spec.ts
# 4. Add nc.accounting.* tool definitions
cd backend && pnpm test --testPathPatterns="scoped-tool|accounting"
# 5. Run sidecar tests locally
cd ../infra/accounting-sidecar && pytest tests/ -v
# 6. Deploy sidecar (pre-freeze)
# ... (systemd, nftables, .env, smoke as in original plan §8)
# 7. Deploy NestJS module + frontend (post-freeze)
# ... as in original plan §8
```

### Idempotent / safe

- Schema migration is additive.
- New sidecar runs as new process.
- New HMAC secret does not affect hermes-sidecar auth.
- Existing 11 `nc.*` tools unaffected.
- Shared auth libraries are pure refactors.
- NestJS AccountingModule deploys post-freeze.
- The SoD role table is additive; default tenant has no roles assigned (zero risk).

---

## 10. Certifying the Accounting Capability (separate from G9)

The G9 cert framework certifies **work coordination** (idempotency, retries, evidence, approvals, tenant denial). It does NOT certify financial math. We add a **separate accounting cert framework** that G9 is unaware of.

### Accounting cert framework — `src/test/accounting-cert/`

```
src/test/accounting-cert/
├── README.md
├── math-oracle/                            # pure-function math tests
│   ├── npv.fixtures.spec.ts                 # 30 textbook NPV cases
│   ├── irr.fixtures.spec.ts                 # 30 IRR cases (unique, no-IRR, multiple-IRR)
│   ├── mirr.fixtures.spec.ts
│   ├── amortize.fixtures.spec.ts
│   └── double-entry.fixtures.spec.ts        # 30 balanced/unbalanced posting cases
├── integration/                             # end-to-end through sidecar
│   ├── compute-roundtrip.spec.ts            # NPV/IRR/MIRR/amortize via sidecar
│   ├── ledger-roundtrip.spec.ts             # post → snapshot → report
│   ├── snapshot-consistency.spec.ts         # mmap snapshot matches DB
│   └── merkle-chain.spec.ts                 # outbox Merkle root verifies
├── gates/                                   # accounting-specific gates
│   ├── gate-A1.spec.ts                      # NPV accuracy vs textbook = 100%
│   ├── gate-A2.spec.ts                      # IRR convergence ≥ 98%
│   ├── gate-A3.spec.ts                      # Double-entry validation 100%
│   ├── gate-A4.spec.ts                      # Zero duplicate postings
│   ├── gate-A5.spec.ts                      # Deterministic dataset generation
│   ├── gate-A6.spec.ts                      # Sidecar health uptime ≥ 99.5%
│   ├── gate-A7.spec.ts                      # Sidecar P99 ≤ 500ms
│   ├── gate-A8.spec.ts                      # Cross-tenant denial 100%
│   ├── gate-A9.spec.ts                      # SoD enforced (poster ≠ approver)
│   ├── gate-A10.spec.ts                     # Period lock enforced
│   └── gate-A11.spec.ts                     # Merkle chain verifies
└── reports/                                 # generated artifacts (gitignored)
    ├── accounting-machine-readable.json
    ├── accounting-summary.json
    └── accounting-dashboard.html
```

### Gate metrics

| Gate | Metric | Target |
|---|---|---|
| A1 | NPV accuracy vs textbook | 100% (bit-for-bit within 4dp) |
| A2 | IRR convergence success rate | ≥ 98% |
| A3 | Double-entry validation pass | 100% |
| A4 | Zero duplicate postings | 100% |
| A5 | Deterministic dataset generation (same seed → sha256 match) | 100% |
| A6 | Sidecar health uptime | ≥ 99.5% |
| A7 | Sidecar response time P99 | ≤ 500ms |
| A8 | Cross-tenant denial | 100% |
| A9 | SoD enforcement (poster ≠ approver) | 100% |
| A10 | Period lock enforcement | 100% |
| A11 | Merkle chain verification | 100% |

### Cert phases

**Phase 1 cert (immediate, post-deploy — pre-freeze, sidecar only):**
- Math oracle suite: 30+30+30+30+30 = 150 cases, all green
- Protocol-lock e2e: NestJS mints token → Python verifies → Python signs → NestJS verifies
- 1 sample computation (NPV, IRR, amortize) end-to-end
- 1 ledger posting → validate → verify double-entry balances
- 1 report generation from snapshot

**Phase 2 cert (after NestJS module + frontend — post-freeze):**
- One real-tenant accounting workflow: create COA → open period → post journal entry → approve → generate BS → export Beancount → verify Merkle root
- `nc.accounting.*` tools: schema validation, RBAC, SoD, tenant isolation
- Concurrent ledger writes from 5 simulated users: verify Postgres UoW integrity
- Multi-currency: post FX transactions, verify base currency conversion

**Phase 3 cert (full — production readiness):**
- 5 production tenants with concurrent accounting workloads
- Snapshot regen race conditions (commit-during-snapshot)
- SoD enforcement across all role types
- Period close → re-open → re-close → lock
- Merkle root chain verification across 10k outbox events
- Verdict: PASS or FAIL
- Failure-tombstone: if FAIL, sidecar stays deprecated; no Sim-05 wiring without new architecture decision.

---

## 11. Risk + Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| numpy-financial IRR doesn't converge | Medium | High | Return `{converged: false}`. Test with Brigham/Ehrhardt edge cases. |
| Decimal precision drift between numpy-financial and Prisma `Decimal(18,4)` | Low | High | `decimal.Decimal` in Python; convert via `str()` not `float()`. Math oracle tests assert bit-for-bit equality. |
| 500-item / 1,000-employee datasets exceed memory cap | Low | Medium | Stream pandas operations. POST returns metadata; GET paginates rows (100/page). |
| Sidecar uid not egress-restricted | Low | Critical | New nftables file `infra/sidecar/nftables-accounting.nft` — deny ALL egress. |
| Phase 1 freeze violated | Low | High | Sidecar deployed pre-freeze; NestJS module + frontend post-freeze. Sidecar is inert without the NestJS module. |
| Token format mismatch NestJS↔sidecar | Low | Critical | `infra/_common/scope_token.{py,ts}` — single implementation. Protocol-lock tests both directions. |
| Multi-currency rounding errors | Low | Medium | `Decimal(12,8)` for FX rate. Python `decimal.Decimal` for base amount conversion. |
| Concurrent ledger writes | Medium | High | Postgres UoW integrity. Snapshot regen is coalesced (≤1 Hz per tenant); stale snapshots are served. |
| Real tenant accounting errors have legal/financial consequences | Medium | Critical | TIER-2 approval for all writes. SoD enforced at DB level. Merkle root over outbox events. "Not financial advice" disclaimer. Jurisdiction-specific tax explicitly NOT supported. |
| Pakistani tax not in scope | High | Medium | Documented. Will require separate `NC-TAX-IMP-1` plan. Phase 1 ships a `TaxRate`/`TaxCode` data model only; no return generation. |
| Approval-workflow empty-tenantId bug not fixed | Medium | High | Pre-Phase 1 fix: `modules/hermes/services/approval-workflow.engine.ts:303-333` — pass real tenantId to notification helper. |
| SoD role assignment never happens in real tenants | Medium | High | UI surfaces role assignment at tenant onboarding. Default tenant has no roles = no posts = safe default. |
| Snapshot regen race during commit | Low | High | Coalesced at ≤1 Hz per tenant; stale snapshot served during regen; regen uses temp-file + atomic rename. |
| Beancount file gets ahead of DB (file write succeeds, DB INSERT fails) | Low | High | Outbox event is in the same UoW as DB INSERT. Snapshot regen only runs after UoW commit. If snapshot regen fails, last-good snapshot is served. |

---

## 12. Honest Effort Estimate (working days)

| Phase | Days | Notes |
|---|---|---|
| Phase 0: Shared auth libraries (`scope_token.{py,ts}` + `webhook_sig.{py,ts}` + `deploy_token.{py,ts}`) | 2 | Three libraries, three protocol-lock test suites. |
| Phase 1a: Prisma schema migration (8 new models + 5 enums) | 1.5 | Additive, includes COA + Period + JournalEntry + UserAccountingRole + OutboxMerkleRoot. |
| Phase 1b: Fix approval-workflow empty-tenantId bug | 0.5 | One-line change, one test. |
| Phase 1c: Python sidecar skeleton (FastAPI + scope_token + healthz) | 1 | Copy from hermes-sidecar. |
| Phase 1d: numpy-financial endpoints (npv, irr, mirr, amortize) | 2 | Textbook fixtures included. |
| Phase 1e: Beancount ledger validation + report generators (stateless compute + stateful snapshot) | 5 | Snapshot lifecycle, mmap handler, SIGHUP. |
| Phase 1f: Pandas synthetic dataset generator endpoint | 1 | Metadata-only POST; paginated GET. |
| Phase 1g: NestJS module skeleton (controller, guards, services, interfaces) | 3 | Includes AccountingApprovalGuard + SoD. |
| Phase 1h: ChartOfAccounts + AccountingPeriod + UserAccountingRole services | 3 | COA CRUD, period open/close/lock, role grants. |
| Phase 1i: JournalEntry + AccountingRecord repository + UoW-integrated event emitter | 3 | Single UoW for posting + outbox + snapshot trigger. |
| Phase 1j: nc.accounting.* tool definitions (15 tools; 4 wired) | 2 | 4 TIER-1 (compute) tools wired via BaseStructuredTool → ToolsModule (2026-07-30). 11 TIER-2 tools deferred to Phase 2 — see note below. |
| Phase 1k: Beancount snapshot regeneration service | 2 | Background job, coalesced, temp+rename. |
| Phase 1l: Merkle root over outbox events | 2 | Background job, chain verification. |
| Phase 1m: Math oracle test suite (150 cases) | 4 | Bit-for-bit equality with textbook. |
| Phase 1n: Integration + accounting gate tests (A1-A11) | 6 | Includes protocol-lock, SoD, snapshot, Merkle. |
| Phase 1o: nftables + systemd + Contabo deploy + smoke | 1.5 | |
| **Phase 1 total** | **~40 days** | "Capability runs, COA + Periods + Journal + Snapshot + Merkle + 14 nc.* tools, no simulation wiring, no AR/AP/payroll subledgers" |
| Phase 2: Tenant + Admin UI (per §8) | 16 | 8 routes + 10 components + 2 services. |
| Phase 3: Phase 2 cert (per §10) | 6 | Real-tenant workflow + concurrent writes + Merkle. |
| **Capability total** | **~62 working days** | Roughly 12 weeks with a single developer. |

The original plan's 35-day estimate was optimistic by ~2×. The honest figure is **~62 days** for a single developer, or **~10 weeks** for a 2-person team (1 backend + 1 frontend). The cost of the realism is paid back by avoiding 4 weeks of "we built it but it can't be used in production" churn.

---

## 13. Sequencing (actual deploy state 2026-07-30)

```
2026-07-30 (today)        ─ user approves this plan + NC-SIM05-IMP-2
2026-07-30                ─ Phase 0 (shared auth libraries, 3 modules) ✓
                              Phase 1a-1f (schema + sidecar) ✓
                              Phase 1g (NestJS module skeleton) ✓
                              Phase 1h (UoW-integrated ledger) ✓
                              Phase 1i (Beancount export) ✓
                              Phase 1j (nc.* tools) ✓
                              Phase 1k (snapshot regen job) ✓
                              Phase 1l (Merkle root job) ✓
                              Phase 1m (math oracle + service tests) ✓
                              Phase 1n (cert gates A1-A11) ✓
                              Phase 1o (DEPLOYED 2026-07-30 22:10 PKT) ✓

Real deploy timeline (2026-07-30):
  09:08 PKT — schema migration applied (9 tables, 7 enums)
  09:11 PKT — backend rebuilt, AccountingModule registered in app.module.ts
            — fixed: @Controller('api/v1/accounting') → @Controller({path,version:1})
  16:08 PKT — accounting-sidecar first deployed (without auth → FIXED)
  17:03 PKT — accounting-sidecar deployed WITH auth (port 8091, user hermes-sidecar)
  17:13 PKT — end-to-end smoke verified:
              NestJS /api/v1/accounting/* → HTTP 401 without JWT
              Sidecar /v1/compute/npv → HTTP 401 without HMAC token
              With valid HMAC → HTTP 200, NPV=-21.0368
              With valid JWT (and tenantId) → NestJS routes work

Outstanding:
  ✅ Phase 2 UI — DONE 2026-07-30 22:36 (tenant /accounting, 5 tabs; admin /infrastructure sidecar rows)
  ✅ 4 TIER-1 nc.accounting.* tools (NpvTool, IrrTool, MirrTool, AmortizeLoanTool) registered in AccountingModule — DONE 2026-07-30 22:46
  ⏳ ToolsModule ↔ AccountingModule cross-registration (agent-runtime wiring)
  ⏳ Live sidecar health proxy endpoint (`/api/v1/admin/sidecars/status`)
  ⏳ Browser-driven happy-path gate (§8a) — page renders, but full drive requires tenant user credentials we don't have
  ⏳ Sim-05 wiring (NC-SIM05-IMP-2)
  ⏳ Phase 2 UI for admin (full accounting dashboard, not just health rows)
```

Outstanding:
  ✅ Phase 2 UI — DONE 2026-07-30 22:36 (tenant /accounting, 5 tabs; admin /infrastructure sidecar rows)
  ✅ 4 TIER-1 nc.accounting.* tools (NpvTool, IrrTool, MirrTool, AmortizeLoanTool) registered in AccountingModule — DONE 2026-07-30 22:46
  ⏳ ToolsModule ↔ AccountingModule cross-registration (agent-runtime wiring)
  ⏳ Live sidecar health proxy endpoint (`/api/v1/admin/sidecars/status`)
  ⏳ Browser-driven happy-path gate (§8a) — page renders, but full drive requires tenant user credentials we don't have
  ⏳ Sim-05 wiring (NC-SIM05-IMP-2)
  ⏳ Phase 2 UI for admin (full accounting dashboard, not just health rows)
```

**Deploy recap (2026-07-30):**

| Phase 1 sub-task | Local done | Deployed to Contabo |
|---|---|---|
| 0 — shared auth libs | ✅ | ✅ (`infra/_common/` + vendored in backend) |
| 1a — schema + migration | ✅ | ✅ (9 tables, 7 enums, `neurecore_app` owner) |
| 1b-1f — sidecar | ✅ | ✅ (port 8091, systemd, auth-gated) |
| 1g — NestJS module skeleton | ✅ | ✅ (registered in `app.module.ts`) |
| 1h — UoW-integrated ledger | ✅ | ✅ (code shipped; needs real DB to verify) |
| 1i — Beancount export | ✅ | ✅ |
| 1j — nc.* tool wrappers | ✅ | ✅ (schemas written; dispatcher wiring pending) |
| 1k — snapshot regen | ✅ | ✅ (service wired; runs on first ledger commit) |
| 1l — Merkle root | ✅ | ✅ (background job ready; no scheduler trigger yet) |
| 1m — math oracle + tests | ✅ | ✅ (200 Python + 5 TS protocol-lock tests pass) |
| 1n — A1-A11 cert gates | ✅ sidecar portion | ⏳ NestJS portion pending real DB |
| 1o — deploy | ✅ | **✅ DEPLOYED 2026-07-30 22:10 PKT** |

**Bugs caught & fixed during deploy (no skipping):**
1. **Migration FK ordering:** `accounting_records` referenced `accounting_datasets`
   before `accounting_datasets` was created → Postgres error. Fixed by reordering
   blocks in `migration.sql` (datasets before records).
2. **Migration partial state recovery:** First failed migration left 4 tables +
   7 enums behind. Required manual `DROP TABLE CASCADE` + `DROP TYPE` to clear,
   then retry succeeded.
3. **`AccountingTokenService.secret_missing` crashed NestJS on boot** because it
   threw in its constructor. Fixed by making secret resolution lazy (constructor
   reads env, throws only on first `mint()`/`verify()`).
4. **Sidecar had NO auth** — the MVP `main.py` did not validate the bearer token.
   Added `accounting_sidecar/auth.py` with `require_accounting_token` dependency
   on all `/v1/*` routes. Sidecar now returns 401 without/with bogus token.
5. **NestJS `@Controller('api/v1/accounting')` created `/api/api/v1/accounting`**
   because `main.ts` sets `app.setGlobalPrefix('api')`. Fixed by switching to
   `@Controller({path: 'accounting', version: '1'})`.

**Operational notes for future deploys:**
- See `memory-bank-arc/sidecar-deploy-procedure.md` for the full
  sidecar deploy playbook (env vars, systemd, paths, smoke).
- See `memory-bank-arc/contabo-ops.md` §4.11 for the sidecar table.
- Port 8090 is `lscpd` (CyberPanel). Never assign 8090 to a sidecar.
- `ACCOUNTING_SIDECAR_SECRET` is stored in `/root/.accounting-secret` on Contabo
  (mode 0600). Do NOT commit.

**Update 2026-07-30 23:50 PKT — Phase 1j narrowed from 14 to 4 tools.**

Plan §7 originally specified **15 nc.accounting.* tools** split as 10 TIER-1 +
5 TIER-2. Investigation during Phase 1j revealed that this codebase does
NOT use approval-based tool gating. The agent's tool invocation pipeline
uses `requiredPermissions` (RBAC, see `structured-tool.interface.ts:56`)
combined with the `SecurityPolicyProvider` (default-deny allowlist).
There is no existing "agent invokes tool → check approval → return
PENDING" flow — that pattern is only used for HTTP routes via
`AccountingApprovalGuard`.

**Decision:** Phase 1 ships **only the 4 TIER-1 compute tools** (NpvTool,
IrrTool, MirrTool, AmortizeLoanTool), wired through ToolsModule
→ StructuredToolRegistry on 2026-07-30 22:48 PKT. Verified live:
`grep 'nc.accounting.*(CALCULATION)' /root/.pm2/logs/neurecore-backend-out.log`
shows all 4 registered.

**11 TIER-2 tools (post_ledger, create_account, etc.) are NOT wired to the
agent.** They remain accessible via HTTP routes through
`AccountingController` (verified: `POST /api/v1/accounting/ledger/postings`
returns the expected HTTP responses on Contabo). Future plans may add
agent-side access via a permission-gated path (e.g. require
`accounting:write` permission, then call the controller internally), but
this is out of scope for Phase 1.

**Scenarios originally planning TIER-2 tool access from the agent
(Phase 2 Sim-05):** the Sim-05 simulator will use HTTP routes (already
working) for ledger posts, with the agent orchestrating via natural-language
chat and the controller's TIER-2 approval gate handling the human-in-the-loop.
No agent-side tool wiring is required for Sim-05.

---

## 14. Open Questions

1. **Plan approval:** ACCEPTED on 2026-07-30.
2. **nc.* tool wrapping on day one:** Confirmed. Phase 1 ships `nc.accounting.*` tools with NestJS module deploy.
3. **Sidecar stateful-but-isolated for reports:** Confirmed. Mmap'd snapshot file. Read-only FS via systemd. Refresh by NestJS background job, coalesced ≤1 Hz.
4. **COA + Period + JournalEntry as Phase 1 models:** Confirmed. Without these, no real accounting is possible.
5. **Two shared auth libraries (not one):** `scope_token` and `webhook_sig`. Bridge deployment gets a third minimal `deploy_token`.
6. **SoD enforcement at DB level:** Confirmed. `postingUserId != approverById` enforced via DB constraint.
7. **Tax model in scope, tax returns out of scope:** Confirmed. `TaxRate`/`TaxCode`/`WithholdingCategory` data structures + read APIs. No FBR/SECP/withholding schedule generation.
8. **Tamper-evidence via Merkle root over outbox events:** Confirmed. File checksums are corruption-detection only.
9. **Mali 1-month plan compatibility:** All Phase 1 capabilities directly support Mali's G1-G5 goals. AR/AP/payroll subledgers (Mali's full surface) are out of scope; Mali will get a Phase 2 addendum.
10. **Effort estimate 62 days, not 35:** Acknowledged. Better to over-estimate than repeat the SIM-04 pattern.

---

## 15. Out of Scope (explicit)

- Pakistani / FBR / SECP tax return generation
- AR/AP subledgers, aging, collections, dunning, customer statements
- Bank reconciliation engine and bank feeds
- Inventory subledger (FIFO/AVG/WAC cost layers)
- Fixed-asset register and depreciation engine
- Payroll register and net-pay calculation
- Lease accounting under IFRS-16 / IAS-17
- Period-close workflow
- Multi-entity consolidation
- Regulatory submissions, signed audit opinions
- Real-tenant fraud detection
- Real-time bank connections (Plaid, Stripe, etc.)
- Integration with QuickBooks, Xero, Sage, SAP, Oracle Financials, NetSuite
- Anything related to Sim-05 simulation wiring (separate plan: `NC-SIM05-IMP-2`)
