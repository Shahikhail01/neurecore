# Hermes Tools

> Hermes = upstream NousResearch agent runtime, wrapped behind a scoped-token gateway. Last refreshed: 2026-07-31.

---

## 1. Architecture

```
┌────────────────────────┐
│ NestJS Backend         │
│  modules/              │
│  ├─ hermes-adapter/    │  ←─ scoped-token gateway
│  ├─ hermes/            │  ←─ legacy gateway (kept during cutover)
│  ├─ tools/             │  ←─ StructuredToolRegistry
│  └─ agents/            │
└──────────┬─────────────┘
           │ HTTP + Bearer (scoped, short-lived)
           ▼
┌────────────────────────┐
│ infra/hermes-sidecar/  │  ←─ FastAPI, per-tenant execution
│  ├─ hermes/            │  ←─ vendored upstream agent
│  └─ tools/             │
└──────────┬─────────────┘
           │ stdio / sqlite
           ▼
┌────────────────────────┐
│ NousResearch           │
│ hermes-agent           │
└────────────────────────┘
```

The sidecar is **isolated from Postgres** by design — it has no
`DATABASE_URL`. All data access flows back through the gateway, which
enforces tenant scoping.

---

## 2. Vendored upstream

- Path: `infra/hermes/hermes-agent/`
- Pinned SHA: `infra/hermes/UPSTREAM_VERSION.sha256` (referenced by
  `infra/hermes/UPSTREAM_VERSION.md`)
- The sidecar copies its own working tree from the vendored upstream and
  runs it under `infra/hermes-sidecar/hermes_sidecar/`.

`infra/sidecar/RENAME-INVENTORY.md` documents the rename inventory if the
upstream changes (NC-AWL-IMP-2 Phase A).

---

## 3. NestJS gateway — `backend/src/modules/hermes-adapter/`

### 3.1 Module
`backend/src/modules/hermes-adapter/hermes-adapter.module.ts` wires:
- `HermesAdapterController` (HTTP boundary for execution events + tool
  invocations).
- `HermesAdapterService` — the scoped-token issuer.
- `HermesSidecarClient` — HTTP client to the sidecar.
- `HermesScopedToolGatewayService` — pass-through for tool invocations.
- `HermesAuditLogService` — writes to `HermesAuditLog` Postgres table.
- Tools registry mirrors the structured-tool layer.

### 3.2 Token issuance
- Tokens are short-lived, scoped to `(tenantId, executionId,
  allowedTools, expiresAt)`.
- HMAC-signed by `infra/_common/scope_token.py` (and the TS port at
  `infra/_common/scope_token.ts`).
- Sidecar verifies via the shared `_common` package; mismatched scope =
  401.

### 3.3 Endpoints (HMAC-exempt from CSRF)
- `POST /api/v1/hermes-adapter/executions/:executionId/events`
- `POST /api/v1/hermes-adapter/executions/:executionId/tools/:toolId`

These authenticate by the scoped bearer, not by cookie. They are listed
in `CsrfProtectionMiddleware.HMAC_SERVICE_PATHS`
(`backend/src/common/auth/csrf.middleware.ts:52-55`).

### 3.4 HMAC for inbound sidecar events
- Sidecar signs `POST /events` and `POST /tools/:toolId` requests with a
  shared HMAC-SHA256 over `(timestamp, body)`.
- `infra/_common/webhook_sig.py` (and TS port) verify on both sides.

---

## 4. Tool permission levels

Defined in `backend/src/modules/tools/built-in/hermes-tools.ts`:

| Level | Description |
|---|---|
| `ALLOW` | Unrestricted |
| `READ_ONLY` | Cannot mutate |
| `APPROVAL_REQUIRED` | Requires human approval per conditions |
| `DENY` | Never allowed |

`HERMES_TOOL_SETS` maps each `HermesAgentType` to its descriptors.

---

## 5. HermesAgentType → toolsets

(`comms/hermes-tools.md` is the canonical reference; partial reproduction
here. Verify against the file when in doubt.)

| Agent | Allowed | Approval-required |
|---|---|---|
| HR | email, calendar, documents, tasks, query, reports | `terminate_employee` (3 approvers, type FIRE), `update_payroll` (2 approvers, type BUDGET) |
| FINANCE | email, query, reports, documents, sheets, calendar, approve_expense | `process_invoice` ($1k threshold, type VENDOR_PAYMENT), `execute_payment` ($5k + 2 approvers), `sync_erp` (1 approver, CUSTOM) |
| SALES | email, calendar, documents, query, reports, create_deal, update_contact, generate_quote | `apply_discount` (max 20% per BUDGET) |
| MARKETING | email, documents, query, reports, sheets, calendar, http_request | `publish_content` (1 approver, CUSTOM) |

(See `comms/hermes-tools.md` for the rest — LEGAL, OPS, ENGINEERING,
CUSTOMER_SUCCESS, etc.)

---

## 6. StructuredToolRegistry

`backend/src/modules/tools/`:
- `tools.module.ts` — Nest module that registers every `StructuredTool`
  provider at boot.
- `built-in/hermes-tools.ts` — descriptors (metadata).
- `built-in/neurecore-tools.ts` — NestJS-injectable `StructuredTool`
  implementations (e.g. `queryCustomer`, `createTask`,
  `draftEmail`). Each tool is implemented as a Nest provider so it
  can inject Prisma, TenantContext, etc.
- Each tool declares:
  - `name`
  - `description` (LLM-facing)
  - `permission` (`ALLOW | READ_ONLY | APPROVAL_REQUIRED | DENY`)
  - `schema` (Zod for input validation)
  - `execute(input, ctx)` — the actual implementation.

Tool calls flow through `ScopedToolGatewayService` which:
1. Resolves the calling `(tenantId, userId, agentId)` from the JWT.
2. Looks up the descriptor and checks permission.
3. For `APPROVAL_REQUIRED`, emits an `Approval` event and waits.
4. On `ALLOW`, executes and writes an audit log entry.

---

## 7. Sidecar (`infra/hermes-sidecar/hermes_sidecar/`)

### 7.1 What it does
- Receives an execution request (HTTP).
- Loads the agent's tools (subset of the registry) into a tool context.
- Runs the agentic loop with the vendored upstream (`hermes-agent`).
- Streams tool invocations back through `POST /events` to the gateway.
- Receives tool results via `POST /tools/:toolId`.
- Writes nothing to Postgres; receives the result from the gateway.

### 7.2 Endpoints (FastAPI)
- `/healthz`, `/readyz` — for systemd / load balancer probes.
- `POST /executions/{executionId}/events` — inbound event from gateway
  (HMAC-signed).
- `POST /executions/{executionId}/tools/{toolId}` — tool result from
  gateway (HMAC-signed).
- Per-tool handlers defined in `infra/hermes-sidecar/hermes_sidecar/tools/`.

### 7.3 Network isolation
- systemd unit at `infra/sidecar/systemd/hermes-sidecar.service`.
- Egress restricted by `infra/sidecar/nftables-hermes.nft` to a defined
  allow-list (`infra/sidecar/egress-allowlist.yaml`).
- No `DATABASE_URL` in env.

---

## 8. Events bridge (`infra/hermes-events-bridge/`)

Phase 1.4 webhook receiver (development/test only). Runs a FastAPI app that
listens for signed events from the sidecar and captures them to a local
SQLite store (`hermes_events.db` at repo root in dev). Production
counterpart is `hermes-adapter` writing to the `HermesAuditLog` Postgres
table.

`infra/hermes-events-bridge/README.md` documents this in full.

---

## 9. Observability

- Every scoped-token issuance logged to audit log.
- Every tool invocation logged to `HermesAuditLog` (Postgres).
- Every tool approval gate recorded in `Approval`.
- Slow request alarm (>1500ms) catches runaway loops in NestJS access log.

---

## 10. Source pointers

- `backend/src/modules/hermes-adapter/hermes-adapter.module.ts`
- `backend/src/modules/hermes/hermes.module.ts` (legacy, being phased out)
- `backend/src/modules/tools/tools.module.ts`
- `backend/src/modules/tools/built-in/hermes-tools.ts`
- `backend/src/modules/tools/built-in/neurecore-tools.ts`
- `infra/hermes-sidecar/hermes_sidecar/`
- `infra/hermes-events-bridge/`
- `infra/hermes/hermes-agent/` (vendored upstream)
- `infra/hermes/UPSTREAM_VERSION.md` + `.sha256`
- `infra/sidecar/RUNBOOK.md` — operator runbook for the sidecar
- `infra/sidecar/nftables-hermes.nft` + `egress-allowlist.yaml`
- `infra/_common/scope_token.py` + `webhook_sig.py`
- `comms/hermes-tools.md` — full tool permission reference