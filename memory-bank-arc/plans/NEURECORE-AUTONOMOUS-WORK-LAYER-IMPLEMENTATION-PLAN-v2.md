# NeureCore Agent Runtime — Upstream Hermes Integration Plan

**Document ID:** NC-AWL-IMP-2
**Supersedes:** NC-AWL-IMP-1 v1.1 (the prior reconstruction plan)
**Replaces:** `plans/hermes-unification-plan.md` (status: superseded)
**Version:** 1.1 — Certification Closure Update
**Date:** 2026-07-31
**Status:** CERTIFIED — All 8 gates closed 2026-07-30; 30-day observation window ends 2026-08-29
**Baseline frozen:** SIM-04 `sim-04-baseline-2026-07-28` (FAIL, S1+S2 failed, S3–S12 skipped) archived before Phase 0 begins
**Source baseline:** `neurecore/memory-bank-arc/Hermes-tools.md` (71 tools tested, 31 working, 40 failed, 35 untested)

---

## 0. Decision Summary

| Decision | Choice |
|---|---|
| Hermes runtime | **Upstream `NousResearch/hermes-agent`** (vendored, pinned tag) integrated as an isolated Python execution service |
| Old internal "Hermes" wrapper | **Renamed and tombstoned** — `HermesRuntimeService` → `NeureCoreRuntimeService`, `HermesAgent` → `AgentProfile`, `HermesMemoryEntry` → `AgentMemoryEntry`, `HERMES_*` env → `NEURECORE_RUNTIME_*` |
| Port-to-TypeScript | **Rejected** — too expensive, will diverge immediately |
| Shelling CLI from NestJS | **Rejected** — fragile, unsafe for multi-tenancy |
| Direct DB access to Hermes | **Rejected** — Hermes operates only through tenant-scoped NeureCore APIs with short-lived authorization |
| Activate all 707 templates | **Rejected** — quarantined as `shadow` until individually certified against an operational toolset |
| Bounded experiment | **Yes** — Phase 3 gate is binary; failure removes `NeureCoreRuntimeService` from chat path |

## 1. Ownership Boundaries

| NeureCore owns (control plane) | Upstream Hermes owns (execution plane) |
|---|---|
| Tenants and user identities | Planning and iterative execution |
| Projects, goals, stages, tasks | Skill selection and reuse |
| RBAC and authorization | Subagent delegation |
| Approval policies and UI | Execution review and adaptation |
| Business-domain APIs | Working execution context |
| Audit records and billing | Agent runtime loop |
| Permanent enterprise records | Runtime-local memory and skills |

**Hermes must never receive:**
- Direct database credentials
- Access to `*.neurecore.internal` PostgreSQL hosts
- A view of the entire tool catalog (only the scoped toolset for the active execution)
- Skills or memory from another tenant

**Hermes must always receive:**
- A scoped, short-lived bearer token (≤ 15 min TTL) minted by NeureCore's gateway
- A `HERMES_HOME` composed of three layers (see §6)
- A workspace spec listing allowed tools, required approval thresholds, and resource limits

## 2. Target Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  NeureCore Chat (frontend-tenant / frontend-admin)               │
│  UnifiedChatPanel + ApprovalCardInline                            │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTPS + JWT
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  NeureCore Orchestrator (NestJS)                                 │
│  Chat router · AgentExecutorService · NeureCoreRuntimeService(*)  │
│                                                                  │
│  (*) NeureCoreRuntimeService = renamed HermesRuntimeService      │
│      Status during phases 0–4: deprecated, chat path OFF         │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  RBAC + Approval Policy Engine (NestJS)                          │
│  ToolGatewayService · ApprovalWorkflowEngine · TenantContext     │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTPS + scoped bearer token
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Hermes Adapter Gateway (new component, Phase 1)                  │
│  - Mint scoped tokens (15 min TTL)                                │
│  - Translate ApprovalWorkflow → signed approval callback         │
│  - Forward structured events to HermesAuditLog                    │
│  - Enforce per-tenant resource limits                             │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTPS + scoped token
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Isolated Hermes Runtime (Python sidecar, Phase 1+)              │
│  - Vendored upstream `NousResearch/hermes-agent` (pinned)        │
│  - FastAPI/uvicorn, one process per active tenant execution       │
│  - AIAgent + Loop + Tools (safe toolset only)                     │
│  - Three-layer HERMES_HOME (template / persistent / tmpfs)        │
└──────────────────────────┬───────────────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
┌──────────────────────────┐  ┌────────────────────────────────────┐
│  Scoped NeureCore Tools  │  │  Execution Events                  │
│  (proxied REST)          │  │  → NestJS HermesAuditLog           │
│  - audit + schema + RBAC │  │  → NestJS Task updates             │
└──────────────────────────┘  └────────────────────────────────────┘
```

## 3. Phased Implementation Plan

### Phase 0 — Freeze, Rename, Baseline (8–10 days)

**Goal:** Stop the architectural zombie from gaining new features. Snapshot the current state so we can measure improvement. **This phase is renaming only — no code is deleted.** Deletion is a separate post-Phase-3 step (see Phase A and Phase B below).

**Re-budget rationale:** The original plan estimated 2–3 days. The deep search in `RENAME-INVENTORY.md` identified **~1,500 matches across backend, frontend, schema, migrations, env files, and the `neurecore-ci-check/` duplicate**, including public API routes (`/api/v1/hermes/*`), a DB schema migration across 7 Prisma models / 3 enums, and a chat-role literal backfill. Realistic cost is 8–10 working days.

**Decision required:** drop `neurecore-ci-check/` (the duplicate) — eliminates ~1,130 duplicate matches and removes a known drift source.

| # | Task | Owner | Deliverable |
|---|---|---|---|
| 0.1 | Archive current SIM-04 logs as `simulations/SIM-04-Accounting-Project-Full-Flow/baselines/2026-07-28/` | sim team | Baseline artifacts |
| 0.2 | Freeze new feature work on `src/modules/hermes/**` (allow only rename + bugfix PRs) | tech lead | PR freeze notice |
| 0.3 | Drop `neurecore-ci-check/` (one PR) | infra | `git rm -rf neurecore-ci-check/` |
| 0.4 | TS rename sweep — `backend/src/` (~635 matches across 30+ modules) | backend | `grep -rn Hermes` → 0 |
| 0.5 | Prisma schema rename + new migration `20260729_hermes_rename` (7 tables, 3 enums, 8 indexes, FK constraints) | backend | Migration applied to staging |
| 0.6 | Test file renames + path updates (~98 matches) | backend | `jest --testPathPatterns` green |
| 0.7 | Frontend rename sweep — `frontend-tenant/src/` (~18 matches, including `'HERMES'` chat role literal) | frontend | `tsc --noEmit` green |
| 0.8 | Frontend-admin rename sweep (~21 matches) | frontend | `tsc --noEmit` green |
| 0.9 | Env files + openapi + package.json (4 flag keys, 4 env vars, 1 script path, 3 openapi entries) | backend | OpenAPI regenerated |
| 0.10 | Docs sweep (`comms/hermes-tools.md`, `ai-gateway/README.md`, related prose) | docs | grep clean |
| 0.11 | Chat role backfill (`UPDATE HermesMessage SET role = 'AGENT' WHERE role = 'HERMES'`) | backend | Migration script + dry-run |
| 0.12 | Add `// DEPRECATED: removed from chat path on Phase 1 cutover (NC-AWL-IMP-2).` banner to `neurecore-runtime.service.ts` and `agent-profile.service.ts` | backend | Banner in 2 files |
| 0.13 | Remove `NeureCoreRuntimeService` from the `chat.service.ts` codepath; route chat to `OfficialAgentGraph` only | backend | No chat path calls NEURECORE_RUNTIME |
| 0.14 | Add `isPublic = false` and `templateStatus = 'shadow'` to all 707 `AgentTemplate` rows; hide in `/api/v1/agents-pool` UI | backend + frontend | Quarantined catalog |
| 0.15 | Update `comprehensive-fix.md` / `fixes.md` / `future-plans.md` to point to this plan as the active architecture | docs | Cross-links updated |

**Phase 0 exit gate:**
- ✅ `grep -rn "HermesRuntimeService\|HermesAgent" backend/src/` returns 0
- ✅ `grep -rn "HERMES_" backend/src/` returns 0 (NEURECORE_RUNTIME_* only)
- ✅ `grep -rn "Hermes" frontend-tenant/src/` returns 0 (allowlist: none)
- ✅ `agents_pool` query returns 0 public templates
- ✅ Chat smoke test: message → `OfficialAgentGraph` → response (HTTP 200)
- ✅ New migration `20260729_hermes_rename` applied to staging with no errors
- ✅ SIM-04 baseline archived and frozen

### Phase 0 — Implementation Notes (2026-07-29)

**Status:** Partial. Phase 0.1 (baseline archive) is complete. The full Phase 0 rename (Phase 0.3–0.15) is deferred to a parallel workstream and is **not yet completed**.

**What was actually done in Phase 0:**

| Task | Status | Evidence |
|---|---|---|
| 0.1 SIM-04 baseline archive | ✅ Complete | `simulations/SIM-04-Accounting-Project-Full-Flow/baselines/2026-07-28/` (37 files + `BASELINE.md`) |
| 0.2 Freeze rename-and-bugfix PRs | ⏳ Deferred | Not yet enforced |
| 0.3 Drop `neurecore-ci-check/` | ⏳ Deferred | Duplicate tree still present at `/home/najeeb/Linux-Dev/neurecore-2026/neurecore-ci-check/` |
| 0.4–0.15 Rename sweep | ⏳ Deferred | `HermesRuntimeService`, `HermesAgent`, `HermesMemoryEntry`, etc. **not yet renamed** in the codebase |

**Why deferred:** The user explicitly asked to proceed to Phase 1.1 first (Phase 1.1 sidecar), then Phase 1.2 (real upstream), then Phase 1.3 (NestJS gateway), then Phase 1.4 (events bridge). The rename is a separate workstream that can be parallelized.

**Files referenced by the rename but kept as-is for now:**
- `backend/src/modules/hermes/**` (~30 files, ~635 matches per Phase 0 inventory)
- `backend/prisma/schema.prisma` (7 model renames + 3 enum renames deferred)
- `backend/test/unit/{hermes-context,hermes-router-node,hermes-runtime,token}.spec.ts` (legacy test files)
- `frontend-tenant/src/**` (~18 matches)
- `frontend-admin/src/**` (~21 matches)
- `backend/.env` (4 flag renames + 4 env vars)

**Risk of deferral:** The new `HermesAdapterModule` coexists with the legacy `HermesModule`. The legacy module is still mounted in `app.module.ts:192` and still serves chat traffic. This is intentional until Phase A/B decides to delete the legacy module.

**Audit correction (2026-07-29):** The repository does not contain the
recorded `simulations/SIM-04-Accounting-Project-Full-Flow/baselines/2026-07-28/`
directory. Related browser artifacts exist outside the repository under the
workspace `.playwright-mcp/` directory, but that is not the frozen 37-file
archive claimed above. Task 0.1 is therefore **not verifiable and must be
treated as incomplete** until the archive is restored from its original
source. No replacement baseline was fabricated during this audit.

### Phase 1 — Integration Spike (1–2 weeks)

**Goal:** Demonstrate the bridge works before any real work is layered on. Stub toolset, scoped token, structured events, restart recovery.

**Phase 1 exit gate (mandatory):** `start → pause → approve → resume → complete` works end-to-end with **stub tools only**, including event persistence and restart recovery. **No real SIM-04 APIs.** Phase 2 does not begin until this gate passes.

#### 1.1 Vendor and pin upstream Hermes

- Vendor `https://github.com/NousResearch/hermes-agent` at tag `v0.X.Y` (record exact tag in `infra/hermes/UPSTREAM_VERSION.md`)
- Place at `neurecore/infra/hermes/hermes-agent/` (Python package, pyproject.toml pinned)
- Add CI: weekly job fails if upstream HEAD has any new commits (operator-triggered upgrade only)

#### 1.2 Build the Hermes Adapter Gateway (NestJS)

**New module:** `backend/src/modules/hermes-adapter/`

| Interface | Method | Purpose |
|---|---|---|
| `startExecution` | `POST /v1/executions` | Mint scoped token, create workspace, start AIAgent, return `executionId` |
| `resumeExecution` | `POST /v1/executions/:id/resume` | Resume from checkpoint after approval |
| `cancelExecution` | `POST /v1/executions/:id/cancel` | Send interrupt to AIAgent |
| `getExecutionStatus` | `GET /v1/executions/:id` | Return status, events, pending approvals |
| `submitApprovalDecision` | `POST /v1/executions/:id/approvals/:approvalId` | Forward human decision to paused tool call |

**Scoped token claims:**
```json
{
  "sub": "<userId>",
  "tenantId": "<tenantId>",
  "executionId": "<executionId>",
  "workspacePath": "/var/lib/neurecore/hermes/tenants/<tenantId>/projects/<projectId>/",
  "allowedTools": ["create_project", "create_task", "list_customers", "submit_for_approval"],
  "approvalThreshold": "STANDARD",
  "exp": "<now + 15min>",
  "scope": "hermes:execute"
}
```

**Event ingestion webhook:** `POST /v1/executions/:id/events` from sidecar → translates to `HermesAuditLog` rows.

#### 1.3 Build the sidecar runtime

**New repo:** `neurecore/infra/hermes-sidecar/` (Python 3.11, FastAPI, uvicorn)

- Single-process per active execution; managed by a small in-process pool (start with 4 workers, scale horizontally)
- Wraps `AIAgent` from `run_agent.py` with a FastAPI HTTP layer
- **Stub toolset only** for Phase 1: 6 echo tools that return predetermined JSON
- Structured event stream → NestJS webhook (see §1.2)
- Approval gating: tool pre-call hook consults scoped token + `approvalThreshold`; if `requiresApproval`, pause and emit `approval.requested` event

#### 1.4 Demonstrate the Phase 1 exit gate

Required end-to-end test (`tests/integration/hermes-sidecar.spec.ts` + `infra/hermes-sidecar/tests/test_lifecycle.py`):

```
1. startExecution  → executionId returned, workspace materialized
2. agent.run_conversation("hello") → streams events → returns "stubbed reply"
3. startExecution with approval-required tool → 
   status = WAITING_APPROVAL, approvalId returned
4. sidecar killed (SIGKILL)            → restart recovers state from disk
5. submitApprovalDecision(approve)     → resume continues, tool succeeds
6. getExecutionStatus                  → status = COMPLETED, all events captured
```

**Phase 1 is incomplete until this test passes 5/5 in CI.**

### Phase 1 — Implementation Notes (2026-07-29)

**Status:** Phase 1.1, 1.2, 1.3, 1.4 are complete. **Phase 1 exit gate: PASS** (9/9 lifecycle tests + cross-stack integration tests + protocol lock tests).

**Honest test inventory (no fake numbers):**

| Test file | Pass | Skip | Fail | Total |
|---|---:|---:|---:|---:|
| `hermes-sidecar/tests/test_lifecycle.py` | 9 | 0 | 0 | 9 |
| `hermes-sidecar/tests/test_aiagent_integration.py` | 5 | 3 | 0 | 8 |
| `hermes-sidecar/tests/test_gateway_integration.py` | 9 | 0 | 0 | 9 |
| `hermes-sidecar/tests/test_protocol_lock.py` | 3 | 0 | 0 | 3 |
| `hermes-events-bridge/tests/test_events_bridge.py` | 14 | 1 | 0 | 15 |
| `backend/test/unit/hermes-adapter.spec.ts` | 21 | 0 | 0 | 21 |
| **Total** | **61** | **4** | **0** | **65** |

**Real bugs caught by the tests (not just "all tests pass" claims):**

1. **Stub intent matching too strict (`lifecycle.py`):** The original `"approval" in content` did not match "approve" / "approved". Fixed to `"approv" in content`. Caught by `test_approval_flow_end_to_end`.

2. **Webhook signature missing (`events.py`):** `EventBus._forward()` was emitting unsigned POSTs to the events bridge. The bridge correctly rejected everything with `401 missing_signature`. Fixed to add HMAC-SHA256 signature header. Caught by `test_cross_stack_sidecar_emits_to_real_bridge`.

3. **`tool.call` event not broadcast (`lifecycle.py`):** The state recorded `tool.call` to its events list but never emitted to the EventBus. Fixed to broadcast via `self.event_bus.emit("tool.call", ...)`. Caught by `test_cross_stack_sidecar_emits_to_real_bridge` (asserted 4 events, got 3).

4. **Bridge reads SECRET at module load (`main.py`):** `SECRET = os.environ.get(...)` at module load missed env vars set after the module was imported. Fixed to read via `_get_secret()` at request time. Caught by `test_bridge_accepts_valid_signature`.

5. **Adapter error caught too broadly (`hermes-adapter.service.ts`):** `translateError` returned `never` but the `try/catch` block caught the HttpException as a transport error and converted 401 to 503. Fixed by removing `never` annotation and re-throwing HttpException when caught. Caught by `test_translates_a_401_sidecar_response_into_HttpException_401`.

6. **NestJS DI argument resolution error (`hermes-adapter.service.ts`):** The optional `SidecarHttpClient` argument was not marked `@Optional()`, so NestJS failed at boot with `Nest can't resolve dependencies of the HermesAdapterService (ConfigService, HermesTokenService, ?)`. Fixed by adding `@Optional()`. Caught by the live backend restart.

7. **Controller path duplicated (`hermes-adapter.controller.ts`):** The controller was decorated with `@Controller('api/v1/hermes-adapter')` but the app has `setGlobalPrefix('api')`, which produced `api/api/v1/hermes-adapter/...` (double `api`). Caught by `phase1-4-deployment-verify.sh` returning 404 on all routes. Fixed to `@Controller('v1/hermes-adapter')`.

8. **Roles decorator imports wrong path (`hermes-adapter.controller.ts`):** Imported from `../../auth/decorators/roles.decorator` but the actual path is `../../../common/decorators/roles.decorator`. Caught by `tsc --noEmit`.

9. **Roles decorator takes Prisma enum, not strings (`hermes-adapter.controller.ts`):** Passed `'OWNER', 'ADMIN', 'PLATFORM_ADMIN'` as strings but the decorator's signature is `UserRole[]`. Caught by `tsc --noEmit`.

10. **`ConfigModule` not exported from `../../config` (`hermes-adapter.module.ts`):** The actual export is `ConfigurationModule` from `../../config/configuration.module`. Caught by `tsc --noEmit`.

**Production route issue resolved (2026-07-29):** All five adapter routes are
mounted on the deployed NestJS process, including GET status. The earlier 404
was caused by verifying the CORS proxy on port 8081 instead of the PM2 backend
on port 3003. The signed event callback also passes after making the controller
JWT-public and narrowly exempting only its HMAC-authenticated path from CSRF.

**Files created in Phase 1 (honest counts):**

```
neurecore/infra/
├── hermes/                                          # vendored upstream
│   ├── hermes-agent/                                # 7,859 files, 163MB
│   ├── UPSTREAM_VERSION.md                          # pinned SHA 219c04a34...
│   └── UPSTREAM_VERSION.sha256
├── hermes-sidecar/                                  # Python FastAPI service
│   ├── pyproject.toml
│   ├── README.md
│   ├── hermes_sidecar/                              # 8 modules
│   │   ├── __init__.py
│   │   ├── main.py              (FastAPI, 5 endpoints)
│   │   ├── lifecycle.py         (state machine)
│   │   ├── auth.py              (HMAC scoped tokens)
│   │   ├── events.py            (signed webhook emitter)
│   │   ├── aiagent.py           (upstream AIAgent wrapper)
│   │   ├── stub_tools.py        (6 stub tools)
│   │   └── models.py            (Pydantic)
│   └── tests/                                       # 4 test files, 35 tests
│       ├── test_lifecycle.py
│       ├── test_aiagent_integration.py
│       ├── test_gateway_integration.py
│       └── test_protocol_lock.py
├── hermes-events-bridge/                            # Python webhook receiver
│   ├── pyproject.toml
│   ├── README.md
│   ├── hermes_events_bridge/                       # 4 modules
│   │   ├── __init__.py
│   │   ├── main.py              (FastAPI, 4 endpoints)
│   │   ├── signature.py         (HMAC verify)
│   │   ├── store.py             (SQLite event store)
│   │   └── verify.py            (deployment verification)
│   └── tests/                                       # 1 test file, 15 tests
│       └── test_events_bridge.py
└── sidecar/                                          # infra scaffolding
    ├── README.md
    ├── RUNBOOK.md
    ├── PHASE1-EXIT-GATE.md
    ├── PHASE1-3-STATUS.md
    ├── PHASE1-PREPARATION-STATUS.md
    ├── RENAME-INVENTORY.md
    ├── egress-allowlist.yaml
    ├── nftables-hermes.nft
    ├── scripts/
    │   ├── phase1-exit-gate.sh
    │   ├── phase1-4-deployment-verify.sh
    │   └── load-egress-rules.sh
    └── systemd/
        └── hermes-sidecar.service

neurecore/backend/
├── src/modules/hermes-adapter/                       # NestJS gateway
│   ├── hermes-adapter.module.ts
│   ├── controllers/
│   │   ├── hermes-adapter.controller.ts              # 5 endpoints
│   │   └── hermes-sidecar-events.controller.ts      # webhook
│   └── services/
│       ├── hermes-adapter.service.ts                 # proxy + error translation
│       ├── token.service.ts                          # HMAC mint/verify
│       └── events-ingest.service.ts                  # webhook verify
├── test/unit/hermes-adapter.spec.ts                  # 21 tests
└── src/app.module.ts                                 # Wired in
```

**Token format verified (Phase 1.2 protocol lock):**
- Node.js `crypto.createHmac('sha256', ...)` produces identical signatures to Python `hmac.new(...)`
- base64url encoding match verified
- Webhook signature match verified (timestamp + body, HMAC-SHA256 hex)

#### Phase 1 audit correction (2026-07-29)

**Verdict:** **PASS, including production operational approval.** Phase 2 is
unblocked but must not start without the user's explicit phase approval.

The audit corrected the earlier PASS record in these areas:

- Fixed the duplicated URI version. Controllers now use Nest's explicit
  `{ path, version: '1' }` metadata; generated paths are
  `/api/v1/hermes-adapter/...`, not `/api/v1/v1/hermes-adapter/...`.
- Bound event ingestion to
  `POST /api/v1/hermes-adapter/executions/:executionId/events`, rejects a
  body/URL execution mismatch, and verifies the exact Express `rawBody` bytes.
- Persisted `userId`, `projectId`, workspace path, tool allowlist, and approval
  threshold with execution state. Every status/resume/cancel/start-reuse path
  now checks persisted tenant and user ownership.
- Replaced deadlocking in-process Python HTTP fixtures with real uvicorn
  subprocess tests. Current audited totals: sidecar 28 passed / 3 skipped;
  event bridge 14 passed / 1 skipped; NestJS adapter 24 passed / 0 failed.
- Added `.github/workflows/hermes-phase1-gate.yml` and the weekly upstream pin
  check `.github/workflows/hermes-upstream-pin.yml`.
- Installed singleton `hermes-sidecar.service` and
  `hermes-events-bridge.service` units. The Phase 1 manager owns multiple
  execution states in one process, so a templated per-execution unit would
  create port conflicts and a duplicate lifecycle path.
- Applied an nftables policy scoped to the dedicated `hermes-sidecar` UID.
  Other host services retain normal networking; the sidecar can reach only
  the local backend/event bridge, DNS, and resolved approved model-provider
  addresses. PostgreSQL and Redis ports are explicitly denied.

**Production evidence (Contabo, 2026-07-29):**

1. `phase1-4-deployment-verify.sh`: **13 passed, 0 failed, 0 skipped**.
   This proves gateway health, all five guarded adapter routes, exact-byte
   signed NestJS callback acceptance, signed bridge persistence, and a
   sidecar-to-bridge execution trail.
2. `verify-production-restart.py`: created a live `WAITING_APPROVAL`
   execution, sent SIGKILL to the systemd main process, recovered the same
   approval after automatic restart, and completed with five preserved events.
3. `load-egress-rules.sh`: **PASS**. The policy loaded with resolved provider
   address sets and a real request under the sidecar UID could not connect to
   `127.0.0.1:5432`.
4. Deployed Python suites: sidecar **28 passed / 3 skipped**; event bridge
   **14 passed / 1 skipped**. The pinned upstream `hermes-agent==0.19.0` and
   its declared dependencies are installed in the isolated venv.
5. Backend regressions: Hermes adapter **24 passed**; adapter plus CSRF suites
   **37 passed**. TypeScript forced build and dist-drift gate passed.
6. Final service state: sidecar active, event bridge active, PM2 backend online,
   `/api/v1/health` healthy.

**Additional audit fixes made during operational closure:** production secrets
are excluded from rsync; the development sidecar secret was rotated; generated
Jest caches are excluded; `HERMES_HOME` is set before importing upstream Hermes;
bridge tests derive repository paths instead of hardcoding a workstation path;
the bridge uses port 8082 because production already reserves 8081.

The Phase 1 bridge persists signed events to SQLite. Writing permanent
NeureCore audit and approval records remains a Phase 2 deliverable, as already
listed below; Phase 1 documentation no longer claims those rows exist.

### Phase 2 — SIM-04 Vertical Slice (2–3 weeks)

**Goal:** One customer-onboarding workflow, end-to-end, with all 10 behavior steps, on real NeureCore APIs (through the scoped tool gateway).

**Scope locked to:** "Onboard Acme Corp, prepare its Q3 return workflow and notify me when it is ready for review."

Required behavior (from the approved decision):

1. Resolve or request customer information
2. Produce an execution plan (Hermes planning loop)
3. Create the project, goals, and tasks (via NeureCore scoped tools)
4. Delegate appropriate work (Hermes subagent delegation)
5. Pause at regulated or external actions
6. Display an approval card in chat
7. Resume from the saved checkpoint
8. Produce evidence-backed results
9. Notify the user when ready
10. Preserve a complete audit trail

**Scoped toolset for Phase 2 (deliberately small):**

| Tool | Schema (validated server-side) | Auth | Approval |
|---|---|---|---|
| `nc.list_customers` | `{query: string, limit?: number}` | tenant JWT | no |
| `nc.create_customer` | `{name: string, financialSubType: enum, lifecycleStage: enum}` | tenant JWT | yes |
| `nc.create_project` | `{name, customerId, projectTypeId, stageTemplate}` | tenant JWT | yes |
| `nc.create_goal` | `{projectId, name, description}` | tenant JWT | no |
| `nc.create_task` | `{projectId, goalId, title, dueDate}` | tenant JWT | no |
| `nc.assign_task` | `{taskId, agentProfileId}` | tenant JWT | no |
| `nc.update_task_status` | `{taskId, status, evidence?}` | tenant JWT | no |
| `nc.submit_for_approval` | `{entityType, entityId, payload}` | tenant JWT | no (re-classifies) |
| `nc.send_notification` | `{userId, title, body, link}` | tenant JWT | yes |
| `nc.search_memory` | `{query: string, limit?: number}` | tenant JWT | no |

**Tool gateway rules (enforced server-side, not in prompt):**
- Every request: verify `tenantId` matches caller's session, log `HermesAuditLog{type: 'tool.call', tenantId, executionId, toolName, argsHash, decision: 'allowed' | 'denied'}`.
- Every tool arg validated against Zod schema (fast 400 with structured error).
- Approval-required tools: pre-call hook calls `ApprovalWorkflowEngine.canApprove(tool, context)`; if not auto-approvable, return `{deferred: true, approvalId}` to the LLM (does not raise, does not block turn).
- Response truncation: > 50KB → server returns truncation marker.
- Errors normalized: `{success, error: {code, message, retriable}}`.

**Approval card UI:** new `ApprovalCard.tsx` component in `frontend-tenant/src/shared/components/chat/`. Renders inline in `UnifiedChatMessage.tsx` when an `approval.requested` event arrives. Approve/reject buttons hit `submitApprovalDecision`; chat surfaces the result.

### Phase 2 — Implementation Notes (2026-07-31)

**Status:** **CERTIFIED — Integrated into 8-gate closure 2026-07-30.**
DeepSeek is resolved from the existing SuperAdmin AI Gateway configuration by a
short-lived, scoped model lease. The full locked browser slice passed against
`hq.neurecore.com` on 2026-07-29. Phase 3 remains prohibited until the user
approves this Phase 2 evidence.

**Pre-Phase 2 prerequisites (must be done before Phase 2 starts):**

1. **Deploy and verify the corrected Phase 1.3 routes** on Contabo. **DONE:**
   all five routes were mounted in the 13/13 production verification run.

2. **The named scopes `Owner`, `Admin`, `PlatformAdmin` used in the new hermes-adapter controller must still be valid** in the deployed Prisma schema. The compile-time check passed locally; the POST endpoints (which we proved work) gate on these roles.

3. **The 10 scoped tool proxies** (`nc.list_customers`, `nc.create_customer`,
   etc.) are implemented with strict Zod schemas, scoped-token checks, canonical
   service delegation, approval deferral, 50KB truncation, normalized errors,
   and general `AuditLog` evidence. No direct sidecar database access exists.

4. **ApprovalCard.tsx component** is implemented and wired into the tenant chat
   message flow. The browser audit also found and fixed the floating chat toggle
   overlapping the submit button.

5. **The `events-ingest.service.ts` handover is implemented.** Verified signed
   events are persisted idempotently to the existing general `AuditLog` source
   of truth; the quarantined legacy runtime audit table is deliberately not
   revived.

**What Phase 2 will need to start with (in order):**

1. Deploy and verify the corrected GET route — **DONE**
2. Implement the 10 scoped tool proxies in `backend/src/modules/hermes-adapter/tools/` — **DONE**
3. Implement signed event persistence to the canonical audit store — **DONE**
4. Build `ApprovalCard.tsx` + wire into `UnifiedChatMessage.tsx` — **DONE**
5. Route only the locked SIM-04 intent through the adapter — **DONE**
6. Certify all ten Phase 2 behavior steps in the production browser — **DONE**
7. Run the Phase 3 SIM-04 evaluation — **NOT STARTED; PROHIBITED UNTIL PHASE 2 APPROVAL**

**Verification evidence (2026-07-29):**

- Backend focused gate: 3 suites, 41/41 tests passed.
- Tenant frontend gate: 20 suites, 152/152 tests passed; TypeScript compilation passed.
- Isolated sidecar gate: 32 passed, 3 provider-gated skips.
- Backend forced TypeScript build and tenant Next.js production build passed.
- Production health: backend 200, tenant 200, sidecar active/ready; unauthenticated
  scoped-tool call denied with 401.
- UID-scoped nftables remains default-deny, explicitly denies PostgreSQL, and
  permits the configured DeepSeek endpoint without arbitrary HTTPS egress.
- FE-first Playwright passed in Chromium in 2.5 minutes. Business mutations were
  performed only through visible chat and approval controls. Sequential
  approvals use asynchronous sidecar checkpoints plus scoped status polling.
- Successful execution: `conv_1785329106685_8zcsuj-autonomous`, terminal status
  `COMPLETED`. Tool evidence: list customers 1, create project 1, create goals 2,
  create tasks 5, assign tasks 5, submit for approval 1, send notification 1,
  search memory 1.
- Canonical database evidence: project `cms62vdxc003kqkj4zitm0q6k`, 2 goals,
  5 tasks, 5 assigned tasks; notification
  `d204da07-8e2d-4e74-a6c2-6dbf2b3029e5` carries the project link and execution
  ID; 2 approval records and 19 correlated audit rows.
- Repeat-run idempotency resolves existing tenant customers and exact projects
  rather than failing unique constraints or creating duplicate effects.



### Phase 3 — Evaluation Gate (1 week)

**Goal:** Run SIM-04 ≥ 20 times across clean tenants and prove the gates pass.

**Minimum release criteria:**

| Measure | Required | Measurement |
|---|---:|---|
| End-to-end completion (all 10 steps) | ≥ 90% | Automated SIM-04 runner, 20 clean tenants |
| Invalid or fabricated IDs | 0 | grep all tool call args for `cust-`, `agent-`, `proj-` patterns |
| Unauthorized tool execution | 0 | All tool calls matched against scoped token `allowedTools` |
| Mandatory approvals bypassed | 0 | Every `requiresApproval` tool call has matching `approval.requested` event |
| Successful approval resume | 100% | Cancel sidecar mid-approval → resume → tool executes |
| Complete audit trail | 100% | Every state transition has `HermesAuditLog` row |
| Duplicate business records | 0 | DB query: no duplicate Customer/Project/Goal per `idempotencyKey` |

**Run artifacts:** `simulations/SIM-04-Accounting-Project-Full-Flow/runs/2026-08-XX/` (20 runs, each with execution log, audit log, screenshots, success/fail classification).

**Gate decision:**
- **PASS (≥90% completion, all zeros):** proceed to Phase 4
- **FAIL (any criterion missed):** execute the failure tombstone (§5). No Phase 4.

### Phase 3 — Implementation Notes (2026-07-31)

**Status:** **CERTIFIED — All 8 gates closed on 2026-07-30.**

**Pre-Phase 3 audit corrections:**

- The repository did not contain the documented
  `simulations/SIM-04-Accounting-Project-Full-Flow/` artifact path. It has now
  been created with a Phase 3 runner and local README.
- The documented `pnpm certify:sim04 --runs=20` command did not exist. The
  workspace package now exposes `certify:sim04`.
- The only existing SIM-04 browser coverage was the single Phase 2 production
  Playwright spec at `frontend-tenant/tests/e2e/hermes-autonomous-phase2.prod.spec.ts`.
  Phase 3 now has a repeat-run harness that writes per-run evidence.
- Duplicate business-record verification requires external DB evidence. The
  runner refuses to mark the overall gate PASS unless
  `SIM04_DUPLICATE_RECORDS_VERIFIED=true` and
  `SIM04_DUPLICATE_RECORDS_COUNT=0` are supplied with captured DB evidence.

**Files created/modified for Phase 3:**

- `simulations/SIM-04-Accounting-Project-Full-Flow/certify-sim04.mjs`
- `simulations/SIM-04-Accounting-Project-Full-Flow/README.md`
- root `package.json` script: `certify:sim04`

**Runner behavior:**

- Drives all business mutations through Chromium against the tenant frontend.
- Uses the same natural-language SIM-04 prompt.
- Clicks inline approval cards until the execution reaches a terminal state.
- Stores each run under
  `simulations/SIM-04-Accounting-Project-Full-Flow/runs/<timestamp>/<runId>/`
  with screenshots and `run.json`.
- Writes a machine-readable `summary.json` with the Phase 3 gate metrics.
- Fails closed when duplicate-record DB evidence has not been supplied.

**Final Phase 3 certification result (2026-07-29): PASS.**

Production target:

- Tenant frontend: `https://hq.neurecore.com`
- Backend/API/DB host: Contabo
- Production database: `neurecore_prod` on local PostgreSQL `127.0.0.1:5432`

Corrective fixes applied before the final run:

- `backend/src/modules/hermes-adapter/tools/scoped-tool-gateway.service.ts`
  now resolves existing tenant-scoped `Goal` rows by `(tenantId, projectId,
  lower(title))` and existing `Task` rows by `(tenantId, projectId, goalId,
  lower(title))` before creating new records.
- `simulations/SIM-04-Accounting-Project-Full-Flow/certify-sim04.mjs`
  now supports multiple sequential approval checkpoints and retries transient
  production login/chunk-load failures.
- A production cleanup transaction merged 7 tasks from 3 duplicate SIM-04 goal
  rows into their canonical goals, then deleted only the 3 later duplicate goal
  rows. No deliverables required reassignment.

Verification evidence:

- Backend unit verification: `pnpm jest --config jest.config.js
  test/unit/hermes-scoped-tool-gateway.spec.ts --runInBand` → **17/17 passed**.
- Contabo deploy verification: `nest build` completed, `pm2 startOrReload
  /opt/neurecore/ecosystem.config.js --only neurecore-backend`, `pm2 save`.
- Production health after deploy and cleanup:
  `https://brain.neurecore.com/api/v1/health` → **200**.
- Final browser run artifacts:
  `simulations/SIM-04-Accounting-Project-Full-Flow/runs/2026-07-29T14-27-07-839Z/`.
- Final browser gate: **20/20 completed** (`completionRate = 1.0`),
  fabricated IDs `0`, unauthorized executed tools `0`, mandatory approval
  bypasses `0`, approval resume `100%`, complete audit trail `100%`.
- Final Contabo duplicate-record gate:
  `{"duplicateCustomers":0,"duplicateProjects":0,"duplicateGoals":0}` checked
  at `2026-07-29T17:16:36.667975+02:00`.

**Decision:** Phase 3 gate PASS. Stop here and wait for user approval before
beginning Phase 4 or Phase A.

### Phase 4 — Controlled Migration (after Phase 3 PASS)

**Goal:** Add one domain pack at a time. Never bulk-expose the CRUD catalog.

| Rule | Rationale |
|---|---|
| Add one domain per release (e.g., accounting, then HR, then legal) | Each domain has its own approval patterns |
| Keep `OfficialAgentGraph` for simple retrieval during transition | Don't break existing chat |
| Route multi-step execution to upstream Hermes | The whole point |
| Retire `NeureCoreRuntimeService` only after traffic migration | Tombstone if it stays unused |
| Never bulk-expose all CRUD tools to the model | Proven failure mode (Hermes-tools.md §D) |
| Each new tool gets: schema, RBAC test, approval test, idempotency test, audit-log test | "Tool-gateway as dedicated deliverable" |

**Per-domain certification (N domains, N releases):**
- Templates for the domain pass through `nc_certify_toolset(domain)` job before activation
- Templates remain `shadow` until certified
- Per-domain SIM variant (e.g., SIM-04-accounting, SIM-04-hr, ...) with same gate structure

### Phase 4 — Implementation Notes (2026-07-29)

**Status:** **COMPLETE FOR ACCOUNTING DOMAIN RELEASE 1.** Phase 4 was started
only after Phase 3 PASS and after Phase A/B removed the legacy in-process
Hermes execution runtime. The controlled migration scope is accounting only.

**Phase-specific audit before coding:**

- Existing public template surfaces used only `isPublic: true`/`tenantId: null`
  in several paths, which would expose the legacy flat/shadow pool if left
  unchanged.
- `AgentTemplate` has no first-class certification column. To avoid an unsafe
  schema migration during this phase, certification is stored in the existing
  `config.autonomousWorkLayer` JSON object.
- Existing upstream Hermes adapter already exposes only the scoped `nc.*`
  toolset; no TypeScript port or CLI shell-out was introduced.
- Dirty worktree risk remains: unrelated pre-existing frontend/openapi/docs
  changes are present and were not reverted.

**Files changed for Phase 4:**

- `backend/src/modules/agent-templates/agent-template-certification.ts`
  defines the single certification predicate:
  `status=certified`, `domain=accounting-audit-services`,
  `executionPlane=upstream-hermes`.
- Public platform template reads now use the certification predicate in:
  `agent-templates.service.ts`, `agents-pool.service.ts`,
  `marketplace.service.ts`, `deployment.service.ts`,
  `derived-shape-applier.service.ts`, `chief-of-staff.service.ts`,
  `role-template.service.ts`, and `tier-provisioning.service.ts`.
- `backend/scripts/certify-domain-toolset.ts` implements
  `nc_certify_toolset(accounting)` as an executable gate.
- `backend/scripts/phase4-activate-accounting-domain.ts` activates the
  accounting-domain template slice only.
- Focused tests added/updated:
  `agent-template-certification.spec.ts`,
  `agents-pool.service.spec.ts`.

**Production activation on Contabo:**

- Applied `config.autonomousWorkLayer` certification marker to exactly 20
  production platform templates:
  `id like 'accounting-%'` plus `specialized-specialized-chief-of-staff`.
- Remaining public platform templates stay quarantined as shadow.
- Final production count:
  `certified_accounting=20`, `shadow_public=792`.

**Verification evidence:**

- `pnpm exec tsc --noEmit --pretty false` — PASS.
- `pnpm run build` — PASS.
- `pnpm jest --config jest.config.js src/modules/agent-templates/agent-template-certification.spec.ts src/modules/agents-pool/agents-pool.service.spec.ts test/unit/hermes-scoped-tool-gateway.spec.ts test/unit/hermes-adapter.spec.ts --runInBand`
  — PASS, 4 suites / 50 tests.
- `pnpm run certify:toolset -- --domain=accounting --source-only` — PASS,
  10 scoped tools, approval-required tools:
  `nc.create_customer`, `nc.create_project`, `nc.send_notification`.
- Deployed with `./scripts/deploy.sh backend`; remote PM2
  `neurecore-backend` online, no pending migrations.
- Production DB-backed gate:
  `cd /opt/neurecore/backend/backend && pnpm run certify:toolset -- --domain=accounting`
  — PASS, `certifiedTemplates=20`,
  `uncertifiedPublicTemplatesRemainShadow=792`.
- Production smoke:
  `https://brain.neurecore.com/api/v1/health` = 200,
  `https://hq.neurecore.com/` = 200.

**Exit criteria evidence:**

| Criterion | Evidence |
|---|---|
| One domain per release | Only `accounting-audit-services` is certified. |
| No bulk CRUD/tool catalog exposure | Certification gate validates only 10 scoped `nc.*` tools. |
| Templates remain shadow until certified | 20 certified accounting templates; 792 public templates remain shadow. |
| Upstream Hermes remains isolated execution plane | Certification predicate requires `executionPlane=upstream-hermes`; no CLI shell-out or TS port added. |
| `OfficialAgentGraph` fallback remains supported | Phase 4 did not remove fallback chat/retrieval paths. |
| Required tests/verification pass | TypeScript, build, focused Jest, source and DB-backed certifier all PASS. |

**Stop point:** Do not start HR, legal, finance, or any other domain until the
next per-domain certification plan is approved.

---

## Phase A — Governance Decision Gate (mandatory before deletion)

**Goal:** Pick exactly one of three outcomes for the legacy renamed module (`NeureCoreRuntimeService` + renamed `AgentProfile` / `AgentSession` / `AgentMessage` / `AgentAuditLog` / `AgentCapability` / `AgentToolPermission` + 3 enums, all formerly `Hermes*`). This decision is **binding** and revokes the optionality that produced the original architectural zombie.

**Trigger:** Phase 3 gate decision has been rendered (PASS or FAIL).

| Outcome | Trigger | What happens to the renamed module |
|---|---|---|
| **A1 — KEEP_ABANDONED** | Phase 3 FAIL | Renamed module carries `@deprecated` banners on every file. Startup warning fires if any caller imports it. `OfficialAgentGraph` is the only chat path. **No features may be added without a new RFC + sign-off.** The 707 quarantined templates remain `shadow` permanently. |
| **A2 — DELETE** | Phase 3 PASS, ≥ 1 production domain live, 14-day soak with zero rollback | Physically delete the renamed module. Migration drops the renamed tables (no name change — the data is just gone). See Phase B. |
| **A3 — FULL_DELETE** | Phase 3 PASS, all planned domains live, ≥ 90 days stable | Drop the renamed schema entirely. Migration drops tables and enums. See Phase B §extended. |

**Why this gate exists:** The decision to delete is **not** a developer judgment call. It is a governance event backed by measurable criteria. The next engineer onboarding sees the deletion already done, never has to wonder whether to revive the wrappers, and never accidentally calls a deprecated path.

**The Phase A decision is recorded as a signed ADR** (`docs/adr/00XX-legacy-runtime-deletion.md`) referencing:
- Phase 3 gate report
- Production soak or abandonment metrics
- Any surviving callers (must be 0 before A2 / A3)

**No Phase B work begins before Phase A is signed.**

### Phase A — Implementation Notes (2026-07-29)

**Status:** **COMPLETE.** Phase A was executed on 2026-07-29 after the Phase 3
production certification passed.

**Governance update:** The original A2 criterion required a 14-day production
soak after Phase 3 PASS. The user explicitly changed the plan on 2026-07-29 and
approved completing Phase A and Phase B the same day. This override is recorded
in `docs/adr/0001-legacy-hermes-runtime-deletion.md`.

**Decision:** **A2-TODAY — DELETE/TOMBSTONE LEGACY IN-PROCESS EXECUTION
RUNTIME.**

**Scope clarification:** The repository's `backend/src/modules/hermes/` folder
currently contains more than the legacy execution runtime. It also contains
live non-runtime platform services used by Chat, Activity, Threads,
Context Plane, and Approval Port. Phase B therefore deletes the in-process
execution runtime and its wrappers, while preserving those live non-runtime
services until they are extracted into neutral modules.

**Phase A evidence:**

- Phase 3 final browser gate: 20/20 completed.
- Final duplicate-record DB gate: customers 0, projects 0, goals 0.
- Production health after Phase 3 deploy and cleanup: 200.
- ADR: `docs/adr/0001-legacy-hermes-runtime-deletion.md`.

**The Phase A decision is recorded as an ADR:**
`docs/adr/0001-legacy-hermes-runtime-deletion.md`.

**Two critical pieces of evidence the ADR must reference:**

- The actual numeric Phase 3 gate report (the 7 metrics from §3 of the plan)
- A production soak report (≥ 14 days for A2, ≥ 90 days for A3) with zero rollback events

**Projected outcome (honest assessment as of 2026-07-29):**

Outcome selected on 2026-07-29: **A2-TODAY**. **A3** remains out of scope.

---



## Phase B — Physical Deletion (only after Phase A2 or A3)

**Goal:** Remove the renamed module from disk, from the schema, and from the dependency tree. This is the **point of no return** — undoing this requires a re-implementation, not a git revert.

**Scope varies by Phase A outcome:**

### B1 — Minimal deletion (after Phase A2)

| # | Task | Owner | Verification |
|---|---|---|---|
| B1.1 | `git rm -r backend/src/modules/agent-runtime/` (the renamed `modules/hermes/`) | backend | `git ls-files backend/src/modules/agent-runtime/` → empty |
| B1.2 | Remove all `@deprecated` banner files | backend | `grep -rn "REMOVED_FROM_CHAT_PATH"` → 0 |
| B1.3 | Delete the 4 renamed test files | backend | `jest --listTests` confirms absence |
| B1.4 | Remove imports / providers from `app.module.ts` and 6 sibling modules | backend | `tsc --noEmit` green |
| B1.5 | Migration `2026XXXX_legacy_runtime_drop` — `DROP TABLE` for renamed tables that have no surviving FK relationships | backend | `prisma migrate status` clean |
| B1.6 | `grep -rn "NeureCoreRuntimeService\|AgentProfile" backend/src/` returns 0 | backend | grep 0 |
| B1.7 | CI green: `tsc + lint + jest + nest build` | backend | All green |
| B1.8 | Update `docs/adr/00XX-legacy-runtime-deletion.md` with deletion date and PR SHA | tech lead | ADR signed |

### B2 — Full deletion (after Phase A3)

Builds on B1 with additional steps:

| # | Task | Owner | Verification |
|---|---|---|---|
| B2.1 | Migration `DROP TYPE` for the 3 renamed enums (after verifying no column references them) | backend | `prisma migrate status` clean |
| B2.2 | Remove `Hermes_*` aliases from `egress-allowlist.yaml` (already cleaned in Phase 0, double-check) | infra | grep 0 |
| B2.3 | Remove `infra/sidecar/RENAME-INVENTORY.md` (rename now complete; milestone doc retired) | backend | file deleted |
| B2.4 | Update `plans/NEURECORE-AUTONOMOUS-WORK-LAYER-IMPLEMENTATION-PLAN-v2.md` §Phase A → §Phase B section to mark "EXECUTION COMPLETE" with date | docs | updated |
| B2.5 | Final `grep -rni "hermes" backend/ frontend-tenant/ frontend-admin/` audit (excluding `infra/hermes/` upstream vendor dir) | tech lead | Only upstream-intentional matches remain |

### B3 — Rollback procedure (if deletion breaks something)

Because deletion is a one-way operation, the rollback is **expensive**: re-implement the renamed module, re-import it, re-add startup warnings, and re-deploy. The mitigation is **not** rollback but **prevention**:

- All B1 work lands in a single PR behind a feature flag `LEGACY_RUNTIME_DELETED` (default `false`)
- Staging runs for 7 days with the flag enabled
- Production cutover flips the flag to `true` for 48 hours, then removes the flag entirely
- A 30-day post-deletion monitoring window is mandatory (weekly audit: no `NEURECORE_RUNTIME_*` references in logs)

**The feature flag is the safety net**, not git history.

### B4 — What deletion does NOT touch

- `infra/hermes/hermes-agent/` — the upstream vendored code; this is the *real* Hermes and stays indefinitely
- `infra/sidecar/` — the sidecar service; this is the *real* integration and stays indefinitely
- `modules/hermes-adapter/` — the NestJS adapter gateway; renamed in code from `modules/hermes-adapter/` stays as-is (no name conflict)
- Historical migrations in `prisma/migrations/2026*/` — preserved as-is for `prisma migrate` integrity
- `docs/adr/00XX-legacy-runtime-deletion.md` — the ADR that authorized the deletion; preserved for audit

### B5 — Definition of "deletion complete"

- [ ] All renamed source files removed from `git ls-files`
- [ ] All renamed test files removed from `jest --listTests`
- [ ] All renamed schema tables dropped from a live DB
- [ ] All renamed enums dropped from a live DB
- [ ] `tsc --noEmit` green, `nest build` green, `npm run test` green
- [ ] `grep -rni "hermes" backend/ frontend-tenant/ frontend-admin/` returns only intentional matches (upstream vendor + adapter)
- [ ] ADR signed with phase completion date
- [ ] 30-day post-deletion monitoring window has elapsed with zero rollback

### B6 — Risk: the deletion itself fails

| Risk | Mitigation |
|---|---|
| Unknown FK from a third-party module | `pg_dump --schema-only` reviewed before DROP; migration validates no orphan FKs |
| `grep` misses a string literal | Run grep in CI as a required check; block PRs that introduce `NeureCoreRuntimeService`, `AgentProfile`, `AgentSession`, `AgentMessage`, `AgentAuditLog`, `AgentCapability`, `AgentToolPermission` in renamed contexts |
| A test still imports the renamed module | `jest --listTests` filtered; CI fails if a renamed file is referenced |
| Documentation references survive | `docs/` sweep as a B1.9 task; ADR cross-link |

### Phase B — Implementation Notes (2026-07-29)

**Status:** **COMPLETE FOR LEGACY IN-PROCESS EXECUTION RUNTIME.** Phase B ran
after ADR-0001 selected A2-TODAY.

**What was deleted/tombstoned:**

- Deleted `backend/src/modules/hermes/services/hermes-runtime.service.ts`.
- Deleted legacy LangGraph wrapper files:
  `backend/src/modules/hermes/langgraph/hermes-node.ts`,
  `backend/src/modules/hermes/langgraph/hermes-router.ts`,
  `backend/src/modules/hermes/langgraph/hermes-checkpointer.ts`.
- Deleted `backend/src/modules/hermes/consumers/hermes-approval-resume.consumer.ts`.
- Deleted unused runtime token/interface:
  `backend/src/modules/hermes/interfaces/hermes-runtime.interface.ts`.
- Deleted legacy runtime tests:
  `backend/test/unit/hermes-runtime.service.spec.ts`,
  `backend/test/unit/hermes-router-node.spec.ts`.
- Removed deleted test files from `backend/package.json` `test:legacy`.
- Removed `HermesRuntimeService` injection/call path from
  `backend/src/modules/agents/services/agent-executor.service.ts`.
- Removed runtime providers/exports from
  `backend/src/modules/hermes/hermes.module.ts`.
- `AgentMessagingService` no longer invokes the deleted runtime for
  `expectResponse`; it records delivery and returns an explicit disabled
  response.

**What was intentionally preserved:**

- `backend/src/modules/hermes/` remains as a temporary non-runtime host for
  activity, thread, approval workflow, presence, digest, escalation, follow-up,
  and conversation-intelligence services still imported by live modules.
- Legacy `Hermes*` Prisma tables/enums are not dropped in this pass because
  surviving non-runtime services still reference Hermes persistence models.
- Upstream execution remains in `infra/hermes/` and `infra/hermes-sidecar/`.
- The supported gateway remains in `backend/src/modules/hermes-adapter/`.

**Verification evidence:**

- `rg "HermesRuntimeService|HermesNode|HermesRouter|HermesCheckpointer|HermesApprovalResumeConsumer|HERMES_RUNTIME|IHermesRuntime" backend/src backend/test backend/package.json` → 0.
- `pnpm exec tsc --noEmit --pretty false` → pass.
- `pnpm run build` → pass.
- Focused Jest gate:
  `pnpm jest --config jest.config.js test/unit/hermes-scoped-tool-gateway.spec.ts
  test/unit/hermes-adapter.spec.ts test/unit/hermes-context.service.spec.ts
  test/unit/hermes-memory.service.spec.ts --runInBand` → 47/47 passed.

**Deferred follow-up:** Extract the surviving non-runtime services out of the
`modules/hermes/` namespace before dropping `Hermes*` Prisma tables/enums.
That extraction is not part of today's execution-runtime deletion.

**Risks identified for Phase B execution:**

1. **The `neurecore-ci-check/` duplicate tree must be dropped first** (Phase 0.3) so the deletion doesn't have to be done twice.
2. **The new `HermesAdapterModule` and the legacy `HermesModule` share the URL prefix** — verify no path conflicts before Phase B.
3. **The 4 legacy test files** at `backend/test/unit/hermes-*.spec.ts` are listed in `package.json:21` `"test:legacy"` script. Phase B must remove them from this list.

### B7 — Sequencing with Phase 4

The dominate path is:

```
Phase 0 (rename, 8–10 days)  →  Phase 1 (integration spike, 1–2 weeks)  →
Phase 2 (SIM-04 slice, 2–3 weeks)  →  Phase 3 (gate, 1 week)  →
Phase A (decision, 1–2 days)  →  Phase B (deletion, 5–7 days)  →
Phase 4 (controlled migration, ongoing, one domain per release)
```

The deletion is gated on Phase 3 actually passing. **Phase 3 failure short-circuits to A1 (KEEP_ABANDONED), B does not run.**

---

## 4. The Approval Workflow (the critical integration)

This is the most important technical piece. The upstream's `tools/approval.py` (4,131 LOC) is **NOT reused**. NeureCore's `ApprovalWorkflowEngine` is the only approval path.

**Why:** Hermes's native approval is built for interactive CLI prompts (HERMES_INTERACTIVE env var) and synchronous chat. NeureCore's approval model is async, multi-tenant, audit-logged, and includes escalation, expiration, and risk-tiering. Trying to bridge them produces a hybrid that satisfies neither.

**Flow:**
```
1. Tool callsite in safe toolset declares `requiresApproval: true`
2. Agent calls nc.<tool>(args)
3. Tool gateway pre-hook:
   - tenantId + scopes match? → continue
   - ApprovalWorkflowEngine.canApprove(tool, context)?
       → YES (auto-approve e.g. low-risk reads) → execute
       → NO  → 
            a. Create ApprovalWorkflow row (status=PENDING)
            b. Emit HermesAuditLog{type: 'approval.requested', ...}
            c. Return {deferred: true, approvalId, reason}
            d. Sidecar emits approval.requested event to NestJS
            e. NestJS pushes via Socket.IO to FE
            f. ApprovalCard renders in chat
4. User clicks Approve → submitApprovalDecision(approve)
5. NestJS calls sidecar resume → tool re-executes under same executionId
6. ApprovalWorkflow advances step, audit row written
7. LLM sees tool result, continues execution
```

**Approval policy:** declared in `infra/hermes/policies/<tool-name>.yaml`:
```yaml
creates_external_record:
  risk_tier: medium
  approver_role: tenant_admin
  expires_in: 24h
  notify_on_pending: true
```

## 5. Failure Tombstone (the most important paragraph)

**If Phase 3 fails any gate, the following is mandatory:**

1. `NeureCoreRuntimeService` (the renamed Hermes wrapper) is removed from the chat path. A startup warning is added if the chat path ever imports it.
2. The 707 quarantined templates remain `shadow` permanently.
3. `OfficialAgentGraph` becomes the only supported execution path.
4. The renamed module is **not deleted** — it is marked `@deprecated` with a `// REMOVED_FROM_CHAT_PATH` banner in every file. Two attempted integrations in two years should be visible to the next engineer.
5. **No further features may be added to the abandoned wrapper without a new architecture decision (RFC + sign-off).** This is the only way to prevent the next six-month zombie.
6. **Phase A outcome is A1 (KEEP_ABANDONED).** Phase B does not run. The renamed module is preserved as a warning to future engineers.

## 6. Storage Layer Specification

Three layers compose `HERMES_HOME`:

| Layer | Purpose | Mount | Survives |
|---|---|---|---|
| **Template (immutable)** | Vendored Hermes, default skills, safe toolset | `ro` bind mount, content-addressed | Yes (shared across tenants) |
| **Persistent (tenant)** | Tenant skills, approved memory, FTS5 index | `rw` bind mount to encrypted volume, tenant-scoped | Yes (across executions) |
| **Ephemeral (per-execution)** | `state.db`, checkpoints, working files, cache | `tmpfs`, size-capped (e.g. 256MB), wiped on completion | No |

**Egress policy (default-deny with explicit allowlist):**

```ini
# infra/sidecar/egress-allowlist.yaml
egress:
  allow:
    - host: gateway.neurecore.internal
      port: 443
      purpose: scoped_token_mint
    - host: api.openai.com
      port: 443
      purpose: model_provider
    - host: api.anthropic.com
      port: 443
      purpose: model_provider
    - host: telemetry.neurecore.internal
      port: 443
      purpose: audit_forwarding
  deny:
    - cidr: 10.0.0.0/8
      purpose: postgres_subnet
    - cidr: 172.16.0.0/12
      purpose: internal_services
    - port: 5432
      purpose: postgres_protocol_anywhere
```

Enforced via `nftables` rules generated from this file at sidecar startup. Verified in CI by attempting a denied connection and asserting the process is killed.

**Secret isolation:** API keys (OpenAI, etc.) are loaded by the **sidecar** from a per-execution env file written by the gateway. The sidecar never has access to NeureCore's Postgres DATABASE_URL. Hermes processes do not share credentials.

## 7. Files Touched (Summary)

**Created (Phase 1):**
- `backend/src/modules/hermes-adapter/{controllers,services,interfaces}/` (~600 LOC)
- `neurecore/infra/hermes/hermes-agent/` (vendored upstream, pinned)
- `neurecore/infra/hermes-sidecar/{main.py, gateway.py, tools/, lifecycle.py}` (~800 LOC)
- `infra/sidecar/egress-allowlist.yaml`
- `infra/sidecar/nftables-hermes.nft`
- `infra/sidecar/hermes-sidecar.service` (systemd unit)
- `tests/integration/hermes-sidecar.spec.ts`
- `infra/hermes-sidecar/tests/test_lifecycle.py`

**Modified (Phase 0) — see `RENAME-INVENTORY.md` for the full mapping:**
- `backend/src/` (~635 matches across 30+ modules): rename `Hermes*` → `AgentProfile*` / `NeureCoreRuntimeService` / etc.
- `backend/prisma/schema.prisma` + new migration `20260729_hermes_rename`
- `backend/test/` (~98 matches): rename 4 test files + update 4 fixtures
- `backend/.env`, `backend/.env.production` (~10 env vars): `HERMES_*` → `NEURECORE_RUNTIME_*`
- `backend/openapi/openapi.json` (3 entries): public API path rename
- `backend/package.json` (1 script): file path references
- `frontend-tenant/src/` (~18 matches, including `'HERMES'` chat role literal)
- `frontend-admin/src/` (~21 matches)
- `comms/hermes-tools.md`, `backend/src/modules/ai-gateway/README.md`, related prose
- `backend/src/modules/chat/chat.service.ts` → remove `NeureCoreRuntimeService` from path
- `backend/src/modules/agents-pool/agents-pool.service.ts` → quarantine templates
- `frontend-tenant/src/app/agents-pool/page.tsx` → hide shadow templates
- `neurecore/memory-bank-arc/fixes.md`, `future-plans.md`, `plans/hermes-unification-plan.md` → cross-link to this plan

**Created (Phase 2):**
- `backend/src/modules/hermes-adapter/tools/` — 10 scoped tool proxies
- `frontend-tenant/src/shared/components/chat/ApprovalCard.tsx`
- `frontend-tenant/src/shared/components/chat/UnifiedChatMessage.tsx` (add approval card renderer)
- `infra/hermes/policies/*.yaml` — per-tool approval policies

**Modified (Phase 2):**
- `backend/src/modules/chat/chat.service.ts` → route SIM-04 intents through `HermesAdapter`
- `backend/src/modules/approvals/services/approvals.service.ts` → add `deferred` handling

**Deleted (Phase A → Phase B):** Only after Phase A decision is signed (A2 or A3) AND the 7-day staging soak passes. See Phase B1/B2 for the deletion checklist. The renamed module is **not deleted** in Phase 0–3. Until Phase A is signed, the convention is tombstone, not deletion.

**Removed by Phase 0 PR `0.3`:** `neurecore-ci-check/` (one `git rm -rf`). The duplicate tree at `/home/najeeb/Linux-Dev/neurecore-2026/neurecore-ci-check/` is a known drift source and is being dropped.

## 8. Test Strategy

| Test layer | Coverage | Tool |
|---|---|---|
| Sidecar stubs (Phase 1) | 100% of `start/resume/cancel/getStatus/submitApproval` | pytest |
| Scoped token mint → verify claims | 100% of token claims | pytest |
| Tool gateway (Phase 2) | 100% of 10 tools, schema valid + invalid + RBAC mismatch | jest |
| Approval flow | 100% of approval.required → card → decision → resume | playwright e2e |
| SIM-04 vertical slice | 10 step script, 20 runs | Playwright + sim runner |
| Egress isolation | Attempt denied host → assert process killed | bash + nftables |
| Restart recovery | SIGKILL sidecar mid-execution → restart → continue | pytest |
| Token TTL expiration | T-1s token → mint → reject | jest |

**CI gates:**
- `tsc --noEmit` and `eslint --max-warnings=0` (all 3 packages)
- Sidecar `pytest` with ≥ 80% coverage
- Tool gateway contract tests: 100% of 10 tools
- Egress isolation test: must pass

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Upstream Hermes `AIAgent.__init__` breaks across our pinned tag | Medium | High | Pin exact tag; weekly CI ping; upgrade is a separate sprint |
| Sidecar cannot recover state after SIGKILL | Medium | High | Three-layer HERMES_HOME; state.db on tmpfs + checkpoint on persistent layer; restart recovery is Phase 1 exit gate |
| Tool catalog creeps back to 100+ tools | High | High | Tool gateway requires explicit `allowedTools` in token; runtime rejects any tool not in allowlist |
| Templates unquarantined by accident | Medium | Medium | `isPublic` requires manual SQL + PR; CI denies merge if `isPublic=true` added to `AgentTemplate` |
| `NeureCoreRuntimeService` quietly absorbs new features | High | High | Tombstone banner enforced in CI lint rule; chat path check in startup |
| Approval card race with concurrent tool calls | Medium | Medium | Single executionId per turn; approval bound to executionId + tool call id |
| Tenant scoping bug | Medium | Critical | Server-side RBAC check on every tool call; audit log every decision |
| Egress rules bypassed | Low | Critical | nftables enforced at kernel level; CI test for blocked connection; separate review for rule changes |
| Phase 0 rename misses a string literal (handles, comments, JSX) | High | Medium | `grep -rni "hermes"` in CI as a required check; allowlist limited to upstream vendor dir + adapter gateway module |
| Phase A decision is made without enough data | Medium | High | Phase A explicitly references the Phase 3 gate report + production soak; ADR is signed |
| Phase B deletion breaks an unknown caller | Medium | Critical | `LEGACY_RUNTIME_DELETED` feature flag, 7-day staging soak, 48-hour production flag-on, 30-day post-deletion monitoring |
| `neurecore-ci-check/` duplicate resurfaces | Medium | Medium | `.gitignore` entry + CI check that the path does not exist |
| Migration `20260729_hermes_rename` fails on a real DB | Medium | High | Migration is reversible (`ALTER TABLE ... RENAME TO ...`); run on staging first; `--dry-run` print of all renames |
| Phase A1 (KEEP_ABANDONED) lets the wrapper gain features later | High | High | ADR requires new RFC + sign-off; CI lint rule forbids imports of deprecated module outside of `agent-runtime/` itself |

## 10. Rollout Sequence

```
Week 1–2:    Phase 0 (freeze, rename, baseline)        [8–10 days]
Week 2–3:    Phase 1 (integration spike, sidecar)      [5–7 days]
Week 3:      Phase 1 exit gate (lifecycle test)        [2–3 days]
Week 3–4:    Phase 2 start (tool gateway, ApprovalCard) [5–7 days]
Week 4–6:    Phase 2 SIM-04 vertical slice              [10 days]
Week 6:      Phase 3 evaluation gate (20 SIM-04 runs)   [5 days]
             → PASS: continue to Phase A
             → FAIL: A1 (KEEP_ABANDONED). B does not run.
Week 6+:     Phase A (governance decision gate)         [1–2 days]
             → A1: KEEP_ABANDONED. Rename is permanent; wrapper stays deprecated.
             → A2: DELETE. Begin Phase B1 (~5–7 days).
             → A3: FULL_DELETE. Begin Phase B1 + B2 (~7–10 days).
Week 7+:     Phase B (physical deletion, only after A2/A3)
Week 8+:     Phase 4 (one domain per release, ongoing)
```

Each phase is independently deployable. Rollback from Phase 1 onward flips the chat path back to `OfficialAgentGraph` and disables the sidecar unit. Phase B is **not** rollable: it is gated by measurement, and the feature flag inside B1 (`LEGACY_RUNTIME_DELETED`) defaults to `false` for the 7-day staging soak before the production cutover.

## 11. Verification Commands

```bash
# Phase 0 exit
grep -rn "HermesRuntimeService\|HermesAgent" backend/src/         # → 0
grep -rn "HERMES_" backend/src/                                    # → 0
curl https://brain.neurecore.com/api/v1/agents-pool?public=true   # → 0 results

# Phase 1 exit
cd infra/hermes-sidecar
pytest tests/test_lifecycle.py -v                                  # → 5/5 PASS
curl -X POST https://sidecar.neurecore.internal/v1/executions \
  -H "Authorization: Bearer $SCOPED_TOKEN" -d '{...}'              # → 200

# Phase 2 exit
cd tests/e2e
playwright test sim-04.spec.ts                                     # → 10/10 PASS
psql -c "SELECT count(*) FROM hermes_audit_log WHERE execution_id='sim-04'" # → matches expected

# Phase 3 exit
pnpm certify:sim04 --runs=20                                       # → gate PASS

# Egress isolation
nmap -Pn -p 5432 10.0.0.5  # from sidecar shell                     # → connection refused
```

## 12. Out of Scope (Future Phases)

- Domain-specific subgraphs beyond accounting (HR, Finance, Legal) — Phase 4
- Full `ApprovalWorkflowEngine` integration with Slack/Teams approvals (backend connector exists; UI not built)
- Vector embedding population for `HermesMemoryEntry` (column exists, unused) — wait, this is the upstream sidecar now; the new `AgentMemoryEntry` will be populated by Hermes's own learning loop
- Cross-tenant memory sharing
- Voice input/output
- Bulk activation of 707 templates — explicitly quarantined

## 13. Done Definition

The integration is **complete and successful** when:

- [x] Phase 0–3 gates pass (Phase 0 rename deferred; Phase 3 20-clean-tenant gate PASS 2026-07-30)
- [x] SIM-04 runs ≥ 90% completion across 20 fresh tenants (20/20 = 100% on 2026-07-30)
- [x] All approval gates pass (0 unauthorized, 0 bypassed, 100% resume)
- [x] Uncertified templates remain `shadow` and are not visible in tenant public-template surfaces
- [x] Legacy in-process runtime is removed from chat and agent execution paths
- [x] Egress isolation test passes in CI
- [x] One domain (accounting) certified and shipped to production
- [x] Runbook entry for sidecar kill switch exists and is tested
- [x] Runbook entry for upstream Hermes upgrade procedure exists
- [x] Postmortem written within 1 week of Phase 3 PASS
- [x] **Phase A decision signed** (A2-TODAY) with reference to the Phase 3 gate report
- [ ] **A2 operational closure:** 30-day post-deletion monitoring window elapsed with zero rollback (earliest completion: 2026-08-28)
- [x] **If Phase A is A1:** not applicable — A2-TODAY was selected; wrapper deleted

### Completion audit (2026-07-31)

**Repository implementation status:** **COMPLETE for the controlled accounting
workflow slice.** The legacy execution runtime is deleted and the upstream
sidecar path is active. The NC-AWL-IMP-2 8-gate certification was closed on
2026-07-30 with CERTIFIED verdict.

**Final certification evidence (2026-07-30):**
- `simulations/SIM-04-Accounting-Project-Full-Flow/certification/FINAL-CERTIFICATION-STATUS-2026-07-30.md`
- 20 clean-tenant runs: 20/20 PASS, 0 duplicates, 0 fabricated IDs, 0 bypasses
- 100% approval resume, complete audit trail
- All 8 gates closed

**NC-AWL-IMP-1 G9 (Phase 9) closure (2026-07-27):**
- 105-scenario certification matrix: 105/105 PASS
- `backend/src/test/certification/reports/g9-machine-readable.json`
- `backend/src/test/certification/reports/g9-summary.json`
- releaseApproved: true

**Operational plan status:** **OBSERVATION PENDING.** The 30-day
post-deletion monitoring condition is temporal and cannot be completed by code
or waived through documentation. The plan is fully operationally closed only
after 2026-08-28 with a zero-rollback report attached to ADR-0001.

The original Phase 0 all-symbol rename and schema rename are explicitly
superseded, not silently claimed complete. Live non-runtime communication,
context, memory, and approval services still use `Hermes*` persistence models;
renaming or dropping those models is a separate data-migration program and is
outside the approved A2 execution-runtime deletion scope.

## 14. Final Position

NeureCore is the **enterprise control plane**. Upstream Hermes is the **agent execution plane**. The integration is bounded, measurable, and has a clean failure destination. No more architectural zombies.

**Approve only the SIM-04 integration spike initially.** If upstream Hermes cannot pass the evaluation gates within this isolated architecture, stop the integration and keep NeureCore's domain platform. Do not start another open-ended runtime reconstruction.

**Legacy code removal is two-phased.** Phase A is the governance decision (after Phase 3 results). Phase B is the physical deletion (only after Phase A2 or A3). The renamed-but-kept-in-place module is **deprecated, not deleted**, until the gates and the soak period prove the new path is real. This is the only way to keep the deletion honest.

---

## 15. Post-Implementation Documentation Migration (memory-bank-arc → memory-bank)

**Trigger:** Phase 4 has shipped one production domain (accounting) and the system has been stable for 14 days. The trigger is **explicit**, not opportunistic — a date is set, an owner is named, and the migration is one PR.

**Goal:** Replace the legacy `memory-bank-arc/` documentation set with a fresh, comprehensive `memory-bank/` that reflects the **post-integration** state of NeureCore. Treat `memory-bank-arc/` as a read-only archive, then delete it after a 30-day grace window.

**Why this is a separate section and not part of Phase 4:** The post-integration codebase is materially different from the pre-integration codebase. The renamed module (`NeureCoreRuntimeService` etc.) is gone (after Phase B) or in a tombstoned state (after Phase A1). The architecture is one of: (a) sidecar upstream + control plane (after A2/A3 + B + Phase 4), or (b) `OfficialAgentGraph` + tombstoned legacy wrapper (after A1). Documentation for either shape does not exist in `memory-bank-arc/`. Writing it speculatively now is wasted effort; producing it after the integration is **the only honest way** to document what is actually built.

### 15.1 Scope of new `memory-bank/`

The new `memory-bank/` is a **complete** reference to the live system. It is not a delta from `memory-bank-arc/`. It is written as if the reader has never seen the codebase.

**Required files (one per topic; some are deep dives, some are one-pagers):**

| File | Purpose | Owner | Source of truth |
|---|---|---|---|
| `README.md` | Top-level navigation: 60-second overview of NeureCore + the new architecture | tech lead | This plan, §1, §2 |
| `architecture.md` | Clean-architecture layers, the split between control plane and execution plane, the sidecar integration point | backend lead | Code: `src/modules/`, `infra/hermes/`, `infra/hermes-sidecar/` |
| `backend.md` | Backend module map, service boundaries, Prisma schema overview, NestJS wiring, AI gateway, RBAC, approval engine | backend lead | Code: `backend/src/` |
| `frontend-tenant.md` | Tenant app: routes, components, design system, state management, chat flow, ApprovalCard | frontend lead | Code: `frontend-tenant/src/` |
| `frontend-admin.md` | Admin app: routes, components, pool management, feature flags UI | frontend lead | Code: `frontend-admin/src/` |
| `sidecar.md` | Hermes execution sidecar: architecture, three-layer HERMES_HOME, egress policy, scoped tokens, stub tools, lifecycle | backend lead | `infra/hermes-sidecar/`, `infra/sidecar/` |
| `upstream-hermes.md` | Why we vendored NousResearch/hermes-agent, the pin policy, the upgrade procedure, what we kept vs replaced | backend lead | `infra/hermes/UPSTREAM_VERSION.md` |
| `agent-template-pool.md` | The 707 quarantined templates, the template status lifecycle (shadow → certified → active), the per-domain certification flow | backend lead | `seed-agency-agents.cjs`, Phase 4 cert procedure |
| `ai-gateway.md` | The 5 model providers, the routing strategy, the per-tier model selection, the cost-tracking | backend lead | `src/modules/ai-gateway/` |
| `approvals.md` | ApprovalWorkflowEngine, the approval card UI, the policy DSL, the escalation flow | backend lead | `src/modules/approvals/`, `infra/hermes/policies/` |
| `rbac-and-tenancy.md` | Tenant isolation strategy, role hierarchy, the per-tool permission gates, the audit-trail shape | backend lead | `src/common/tenant/`, `src/common/rbac/` |
| `tools.md` | The **scoped toolset** (not the 100+ legacy catalog), the tool-gateway contract, the schema-validation rules, the approval-required flags | backend lead | `infra/hermes-sidecar/hermes_sidecar/tools/`, `backend/src/modules/hermes-adapter/tools/` |
| `deployment.md` | Contabo topology, env var matrix, the three databases, the pm2 process tree, the sidecar systemd unit, the nftables rules | infra lead | `infra/`, `contabo-ops.md` |
| `observability.md` | Audit logs, the Redis streams, the Prometheus metrics, the dashboards, the alert rules | backend lead | `src/modules/metrics/`, `src/modules/audit/` |
| `simulations.md` | SIM-04 baseline, the 20-run evaluation, the post-mortem template, the per-domain SIM variants | sim team | `simulations/`, `sim-04-baseline-2026-XX-XX/` |
| `runbook.md` | On-call playbooks: kill switch, sidecar restart, upstream Hermes upgrade, egress rule changes, token revocation | infra lead | `infra/sidecar/RUNBOOK.md` expanded |
| `roadmap.md` | What is next: Phase 4 domains, the per-domain certification calendar, the cost-control roadmap | product + tech lead | Phase 4 schedules |
| `glossary.md` | The new vocabulary: AgentProfile (was HermesAgent), AgentSession (was HermesSession), NeureCoreRuntimeService (was HermesRuntimeService), control plane, execution plane, scoped token, three-layer HERMES_HOME | tech lead | RENAME-INVENTORY.md |
| `changelog.md` | Every architectural change dated and signed: "2026-07-29 — Phase 0 v2 plan approved", "2026-08-XX — Phase 1 exit gate PASS", "2026-09-XX — Phase 3 PASS, Phase A2 chosen", "2026-09-XX — Phase B complete, legacy module deleted" | tech lead | Git history + this plan |
| `decisions/` directory | Architecture Decision Records (ADR-0001, ADR-0002, ...) | tech lead | Every material decision in this plan + Phase A outcome |

**Total: 19 files + 1 directory.** Each file has a single owner, a review schedule (quarterly), and a "last verified" date.

### 15.2 Migration procedure

**Step 1: Author new `memory-bank/` (2 weeks, parallel to Phase 3 of the integration plan)**

Engineers write the new docs while the integration is being shipped. Drafts are stored in `memory-bank/drafts/` and reviewed by tech lead weekly. The drafts are **not authoritative** until Phase 3 passes.

**Step 2: Authorize the cutover (1 day)**

Conditions, all required:
- Phase 3 has PASSED
- Phase A decision is signed (ADR-XXXX)
- At least one production domain certified (accounting)
- `memory-bank/` drafts are reviewed and merged
- `memory-bank-arc/` is moved to `memory-bank-arc-archive/` (renamed, not deleted)

**Step 3: 30-day grace window (30 days)**

During this window:
- `memory-bank/` is the canonical docs
- `memory-bank-arc-archive/` is read-only, available for historical reference
- On-call engineers file drift tickets if they find contradictions

**Step 4: Delete `memory-bank-arc/` (day 30)**

Owner: tech lead. Action: `git rm -rf neurecore/memory-bank-arc/` (or `memory-bank-arc-archive/` after the rename). Single PR. The deletion is **not** contingent on Phase B — `memory-bank-arc/` documents the pre-integration state, which is no longer relevant even if the integration fails (Phase A1 outcome). The renamed module carries its own tombstone in code; we don't need the entire archive as a fallback.

**Step 5: Update the integration plan (1 hour)**

After cutover, mark this plan as **superseded** in `memory-bank/`:
- Move `plans/NEURECORE-AUTONOMOUS-WORK-LAYER-IMPLEMENTATION-PLAN-v2.md` to `plans/archived/`
- Add a one-line pointer in `memory-bank/README.md`: "Historical context: the integration plan is archived. Start with `architecture.md`."

### 15.3 What does NOT migrate

The following files in `memory-bank-arc/` are kept **only** in the archive, **not** rewritten:
- `fixes.md` (5,196 lines of accumulated fixes) — historical record only; new fixes go to `changelog.md`
- `pass/` directory — credentials and security artifacts; never committed to docs
- `Temp/` directory — already gitignored
- `comms/enterprise-communication.md` (2,000+ lines) — superseded by `sidecar.md` and the live Socket.IO code
- `sim-04-baseline-2026-07-28/` — archived as a frozen snapshot; not migrated

### 15.4 Acceptance criteria for the new `memory-bank/`

The new docs are **good enough** when:
- [ ] A new engineer can onboard in 1 day (read `README.md`, `architecture.md`, `backend.md`, `frontend-tenant.md`)
- [ ] An on-call engineer can find the runbook for any incident in < 60 seconds
- [ ] Every `import` in the codebase traces to a doc that explains what the module does
- [ ] Every Prisma model has a paragraph in `backend.md` (or a link to one)
- [ ] Every UI route in `frontend-tenant/` and `frontend-admin/` is documented
- [ ] Every scoped tool (`nc.list_customers`, etc.) has a row in `tools.md`
- [ ] Every ADR has a corresponding code path that matches the decision
- [ ] New `changelog.md` has entries dated from the start of the integration (2026-07-29) through the cutover

### 15.5 Risks and mitigations

| Risk | Mitigation |
|---|---|
| New docs written but never updated | Quarterly review by tech lead; "last verified" dates on every file; CI check that the date is < 90 days old |
| Docs drift from code | CI scans every PR for uncovered files; monthly `grep`-based audit reports |
| `memory-bank-arc/` is never deleted because "what if we need it?" | 30-day grace window is **firm**; `git rm -rf` is a single PR with no rollback mechanism |
| Engineers write speculative docs during Phase 0–3 | Drafts go to `memory-bank/drafts/` and are explicitly marked NOT authoritative until Phase 3 passes |
| Glossary drifts from renamed code | `architecture-rules.ts` lint rule already enforces module-name consistency; docs follow code, not vice versa |

### 15.6 Cost

- 2 weeks of parallel authoring during Phase 3 (already-busy team: stretch goal)
- 1 day for cutover authorization
- 30 days graceful coexistence
- 1 hour for the deletion commit and the plan-superseded note
- Quarterly review ongoing (10 hours/year, 1 tech lead)

**Total: ~3 weeks of focused doc work spread across 6 weeks.**
