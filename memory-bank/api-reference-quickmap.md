# API Reference — Quickmap

> Curated index of the API surface grouped by feature. Not a full OpenAPI dump — that lives at `https://brain.neurecore.com/api/docs` (Swagger UI) and `backend/openapi/openapi.json`. Last refreshed: 2026-07-31.

**Base URL:** `https://brain.neurecore.com/api/v1`
**All prefixes below are appended to that base.**
**Auth:** cookie (`__Host-nc_at`, `__Host-nc_rt`) + `X-CSRF-Token`
header for mutating requests. See `auth.md`.
**Idempotency:** include `Idempotency-Key: <uuid>` on POST/PUT/PATCH for
dedup.

> **Convention:** the controllers use `@Controller({ path: 'foo', version: '1' })`
> so all endpoints below are implicitly under `/api/v1`. A few controllers
> (`approvals` approval-port, `assignments`, `auth` registration-style)
> declare the path explicitly with no version; they are still `/api/v1`
> because of the global prefix + versioning in `main.ts:112-113`.

---

## 1. Auth (`/auth`)

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | csrf-exempt |
| POST | `/auth/login` | csrf-exempt; sets cookies |
| POST | `/auth/google` | csrf-exempt; Google ID token |
| POST | `/auth/refresh` | csrf-exempt; uses refresh cookie |
| POST | `/auth/logout` | clears cookies |
| GET | `/auth/me` | current user |
| GET | `/auth/profile` | profile |
| POST | `/auth/forgot-password` | token + email |
| POST | `/auth/reset-password` | consumes token |

Source: `backend/src/modules/auth/controllers/auth.controller.ts`.

## 2. Users / Tenants

| Method | Path | Notes |
|---|---|---|
| GET/POST/PATCH/DELETE | `/users`, `/users/:id` | user admin |
| GET/POST/PATCH/DELETE | `/tenants`, `/tenants/:id` | tenant admin |

Source: `modules/users/`, `modules/tenants/`.

## 3. Projects & tasks

| Method | Path | Notes |
|---|---|---|
| GET/POST/PATCH/DELETE | `/projects` + `:id` | project CRUD |
| GET/POST/PATCH | `/projects/:id/stages` | stage progression |
| GET/POST/PATCH/DELETE | `/projects/:id/members` | member mgmt |
| GET/POST/PATCH/DELETE | `/projects/:projectId/cos/messages` | Chief-of-staff chat |
| GET | `/projects/:projectId/cos/snapshot` | CoS snapshot |
| POST | `/projects/new` (FE-only) | redirects to project creation page |
| GET/POST/PATCH | `/tasks`, `/tasks/:id` | task CRUD |
| GET/POST | `/tasks/:id/assignments` | assign/release |
| GET | `/assignments/eligible-agents/:taskId` | which agents qualify |

Source: `projects/`, `tasks/`, `assignments/`,
`chief-of-staff/`.

## 4. Goals, inbox, routines, workflows

| Method | Path | Notes |
|---|---|---|
| GET/POST/PATCH | `/goals`, `/goals/:id` | goal tree |
| GET | `/inbox`, `/inbox/:id` | unified inbox |
| GET/POST/PATCH | `/routines`, `/routines/:id/runs` | routines |
| GET/POST/PATCH | `/workflows`, `/workflows/:id/executions` | workflows |

## 5. Approvals

| Method | Path | Notes |
|---|---|---|
| POST | `/approvals/request` | create an approval (ADR-006 port) |
| POST | `/approvals/decide` | approve / reject |
| GET | `/approvals/status/:approvalId` | poll status |
| GET | `/approvals/evaluate` | dry-run an evaluation |
| DELETE | `/approvals/:approvalId` | cancel |
| POST | `/approval-chains/resolve` | multi-step chain |
| GET | `/approval-chains/pending` | queue |
| GET | `/approval-chains/:workflowId/current-step` | current step |
| POST | `/approval-chains/:workflowId/advance` | advance |
| GET | `/approvals/stratified` | approvals grouped |
| POST | `/approvals/feedback` | learning loop feedback |
| POST | `/approvals/:approvalId/approve` | shortcut |
| POST | `/approvals/:approvalId/reject` | shortcut |

## 6. CRM (customers, contacts)

| Method | Path | Notes |
|---|---|---|
| GET/POST/PATCH/DELETE | `/customers`, `/customers/:id` | customer CRUD |
| POST | `/customers/:id/lifecycle` | advance lifecycle (G-07) |
| GET/POST | `/customers/:id/contacts` | contacts |

## 7. Departments

| Method | Path | Notes |
|---|---|---|
| GET/POST/PATCH/DELETE | `/departments`, `/departments/:id` | tenant departments |
| GET/POST/PATCH/DELETE | `/departments-pool/:id` | pool admin |
| GET/POST/PATCH | `/dept-templates`, `/dept-templates/:id` | templates |

## 8. Agents + agent templates

| Method | Path | Notes |
|---|---|---|
| GET/POST/PATCH/DELETE | `/agents`, `/agents/:id` | agent CRUD |
| GET | `/agents/:id/status` | runtime status |
| PATCH | `/agents/:id/permissions` | tool permissions |
| PATCH | `/agents/:id/integration-config` | model + provider |
| POST | `/agents/:id/pause` / `:id/resume` | lifecycle |
| PATCH | `/agents/:id/archive` / `:id/deprecate` / `:id/restore` | state |
| POST | `/agents/:id/dispatch` | trigger execution |
| POST | `/agents/:id/invocations` | record invocation |
| GET | `/agents/streaming/sessions` | streaming sessions |
| GET | `/agents/streaming/sessions/:id` | single session |
| POST | `/agents/streaming/sessions` | open session |
| POST | `/agents/streaming/sessions/:id/execute` | execute |
| DELETE | `/agents/streaming/sessions/:id` | close |
| GET | `/agents/streaming/sessions/:id/events` | event stream |
| GET | `/agents/streaming/tools` | tool catalog |
| POST | `/deploy/agents/from-template/:templateId` | instantiate |
| POST | `/deploy/tenants/:tenantId/agents` | tenant deploy |
| POST | `/deploy/tenants/:tenantId/dept-template` | dept deploy |
| POST | `/deploy/tenants/:tenantId/departments` | dept create |
| GET/POST/PATCH/DELETE | `/agent-templates` + `:id` | template CRUD |
| POST | `/agent-templates/:id/clone` | clone |
| GET | `/agent-templates/:id/instantiate` | preview |
| GET/POST/PATCH/DELETE | `/agent-templates/platform` + `:id` | platform library |
| PATCH | `/agents-pool/:id/enabled` | pool toggle |
| POST | `/agents-pool/:id/duplicate` | dup |

## 9. AI Gateway & models

| Method | Path | Notes |
|---|---|---|
| GET | `/settings/ai/providers` + `:id` | platform providers |
| POST | `/settings/ai/providers` | add provider |
| PATCH | `/settings/ai/providers/:id` | update |
| PATCH | `/settings/ai/providers/:id/toggle` | enable/disable |
| POST | `/settings/ai/providers/:id/set-default` | default provider |
| POST | `/settings/ai/providers/:id/test` | test creds |
| POST | `/settings/ai/providers/:id/discover-models` | enumerate |
| GET | `/settings/ai/providers/:providerId/models` | list models |
| POST | `/settings/ai/providers/:providerId/models` | add |
| PATCH | `/settings/ai/providers/:providerId/models/:modelId` | update |
| DELETE | `/settings/ai/providers/:providerId/models/:modelId` | remove |
| PATCH | `/settings/ai/providers/:providerId/models/:modelId/toggle` | toggle |
| GET/POST/PATCH | `/admin/models/providers` + `:id` | admin providers |
| GET/POST/PATCH | `/admin/models` + `:id` | model admin |
| POST | `/admin/models/tenants/:tenantId/overrides` | tenant model override |
| DELETE | `/admin/models/tenants/:tenantId/overrides/:id` | remove |
| GET | `/admin/models/health` | gateway health |
| GET | `/admin/models/cost-summary` | cost rollup |

## 10. AI actions

| Method | Path | Notes |
|---|---|---|
| GET | `/ai-actions/available` | for current user |
| POST | `/ai-actions/execute` | invoke |
| GET | `/ai-actions/:invocationId` | status |
| GET | `/ai-actions/:invocationId/stream` | SSE |
| POST | `/ai-actions/:invocationId/cancel` | cancel |

## 11. Chat

| Method | Path | Notes |
|---|---|---|
| POST | `/chat/messages` | csrf-exempt, non-streaming |
| POST | `/chat/stream` | csrf-exempt, SSE |
| GET | `/chat/history` | paginated, persisted |
| DELETE | `/chat/history` | clear |
| POST | `/chat/suggestions` | slash commands stub (mostly client-side) |
| GET | `/chat/conversations` | user's conversations |
| GET | `/chat/agents` | available chat agents |

## 12. Context plane (ADR-002)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/context-plane/providers` | provider list |
| GET | `/admin/context-plane/cache-stats` | cache stats |
| POST | `/admin/context-plane/trace` | trace resolver |

## 13. Command Center

| Method | Path | Notes |
|---|---|---|
| GET | `/command-center/summary` | dashboard summary |
| GET | `/command-center/timeline` | dashboard timeline |

## 14. Hermes adapter (ADR-003 / scoped-token gateway)

`backend/src/modules/hermes-adapter/controllers/`:
- `POST /hermes-adapter/executions` — open a new execution; returns a
  scoped bearer token.
- `GET  /hermes-adapter/executions/:id` — fetch execution state.
- `POST /hermes-adapter/executions/:id/cancel` — revoke scoped token.
- `POST /hermes-adapter/executions/:id/resume` — resume a suspended run.
- `POST /hermes-adapter/executions/:id/approvals/:approvalId` — record
  approval decision for a gated step.
- `POST /hermes-adapter/sidecar-events` — inbound event from upstream
  Hermes sidecar (HMAC-signed).
- `POST /hermes-adapter/tools/:toolName` — bounded tool invocation
  (HMAC-signed, not user auth).
- `GET  /hermes-adapter/model-lease` — model leasing state.

Auth model:
- Sidecar HMAC is exempt from CSRF
  (`csrf.middleware.ts:55-62`).
- Tenant context from JWT for tenant-scoped endpoints above.

## 15. Analytics

| Method | Path | Notes |
|---|---|---|
| GET | `/analytics/models` | analytics model list |
| GET | `/analytics/report` | run report |
| GET | `/analytics/features` | features |
| POST | `/analytics/score` | score record |
| POST | `/analytics/forecast` | forecast |
| POST | `/analytics/anomaly` | anomaly detect |
| POST | `/analytics/embed` | embed text |

## 16. Compliance + Reliability

| Method | Path | Notes |
|---|---|---|
| GET | `/compliance/checklist/:industryGroup` | checklist |
| GET | `/compliance/checklists` | all |
| GET | `/compliance/score/:industryGroup` | score |
| GET | `/compliance/dashboard-metrics` | dashboard |
| GET/POST/PATCH | `/compliance/acceptance/...` + `/compliance/acceptance/:residency`, `/compliance/acceptance/:retention` | AUP / DPA / residency / retention |

## 17. Connectors / integrations

| Method | Path | Notes |
|---|---|---|
| GET | `/connectors/providers` | catalog |
| GET | `/connectors/oauth/hubspot/authorize` | OAuth start |
| GET | `/connectors/oauth/hubspot/callback` | OAuth end |
| GET/POST/DELETE | `/connectors`, `/connectors/:id` | connector CRUD |
| POST | `/connectors/:id/connect` / `:id/disconnect` / `:id/sync` | ops |
| (plus `/integrations` for Google Workspace + Brevo OAuth state) | | |

## 18. Costs

| Method | Path | Notes |
|---|---|---|
| GET | `/costs/summary` | rollup |
| GET | `/costs/by-agent` | per agent |
| GET | `/costs/by-model` | per model |
| GET | `/costs/by-provider` | per provider |
| GET | `/costs/records` | records |
| GET/POST/PATCH/DELETE | `/costs/budgets` + `:id` | budgets |
| GET | `/costs/incidents` | over-budget events |
| POST | `/costs/incidents/:id/acknowledge` / `:id/resolve` | ack/resolve |
| GET | `/costs/breakdown/by-agent` / `/costs/breakdown/by-model` | breakdown |

ADR-007 consumer at `costs/consumers/finance-project.consumer.ts`.

## 19. Activity + threads

| Method | Path | Notes |
|---|---|---|
| GET | `/activity` | activity feed |
| (Thread endpoints are under `/threads`.) | | |

## 20. Audit

| Method | Path | Notes |
|---|---|---|
| GET | `/audit-logs` | cross-tenant (admin) |
| GET | `/audit-logs/tenant` | tenant-scoped |
| GET | `/audit-logs/agent/:agentId` | per-agent |

## 21. Solutions, marketplace, packages, tenant templates

| Method | Path | Notes |
|---|---|---|
| `solution-packs.controller.ts` | `GET/POST/PATCH /solution-packs`, `GET /:slug`, `GET /:slug/preview`, `POST /:slug/install`, `DELETE /:slug`, `GET /installed`, `GET /installed/history`, `POST /:id/publish` | |
| `marketplace.controller.ts` | `GET /marketplace`, `GET /marketplace/tabs`, `GET /marketplace/items`, `GET /marketplace/packs` + `:slug` + install, `GET /marketplace/agent-templates`, `/connectors`, `/workflows`, `/knowledge-packs`, `/docs-json` | |
| `packages.controller.ts` | `GET/POST/PATCH /packages` + `:id`, `PATCH /:id/composition`, `POST /preview`, `POST /deploy`, `GET /deploy/preview` | |
| Tenant templates | under `/tenant-templates` + `/tenant-template/...` | |

## 22. Industries, tiers, features, packages, agents pool, depts pool

| Method | Path | Notes |
|---|---|---|
| (Pool #3) industries | `/admin/industries` | |
| (Pool #4) tiers | `/admin/tiers`, `/admin/tier-templates` | |
| (Pool #5) features | `/admin/features` | |
| (Pool #6) packages | `/admin/packages` | |

## 23. Accounting

| Method | Path | Notes |
|---|---|---|
| GET/POST/PATCH | `/accounting/accounts` + `:id` | ChartOfAccount CRUD |
| GET | `/accounting/accounts/by-code/:code` | lookup |
| GET | `/accounting/accounts/:code/balance` | balance |
| POST | `/accounting/periods` | open period |
| GET | `/accounting/periods` | list |
| POST | `/accounting/periods/:id/close` | close period |
| POST | `/accounting/compute/npv` | NPV (sidecar) |
| POST | `/accounting/compute/irr` | IRR (sidecar) |
| POST | `/accounting/compute/mirr` | MIRR (sidecar) |
| POST | `/accounting/loans/amortize` | amortisation (sidecar) |
| POST | `/accounting/ledger/postings` | journal entry (UoW + outbox + snapshot regen) |

Source: `modules/accounting/`. See `accounting-sidecar.md` for
sidecar internals.

## 24. Admin sidecar health + simulation stubs

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/sidecars/status` | aggregate sidecar status |

## 25. Enterprise OS / Cloud Platform / EAOS layers

| Method | Path | Notes |
|---|---|---|
| `application-framework.controller.ts` | `/application-framework/catalog`, `/apps`, `/apps/:id/activate|deprecate|retire`, `/domains`, `/solutions`, `/workspaces` | phase 12 |
| `cloud-platform.controller.ts` | `/cloud-platform/regions`, `/clusters`, `/place`, `/route`, `/failover`, `/global-health` | phase 11 |
| `enterprise-ai-governance/` | `/ai-governance/...` | phase 13 |
| `enterprise-cognition/`, `enterprise-autonomy/`, `enterprise-operating-system/` | under `/enterprise-...` | phase 5–7 |
| `enterprise-intelligence-network/` | `/enterprise-intelligence-network/...` | phase 9 |
| `platform-sdk/`, `platform-evolution/`, `platform-operations/`, `phase8/` | `/platform-...`, `/phase8/...` | phases 8–14 |

## 26. Uploads, knowledge, entities, workflows, mission feed, threads

| Method | Path | Notes |
|---|---|---|
| `/uploads/logo` (POST) + static `/cdn/<file>` | | tenant logos (WS-2.1) |
| `/knowledge/...` | `/knowledge/packs`, etc. | knowledge hub |
| `/entities/...` | entity workspace | EAOS-1 |
| `/mission-feed/...` | mission feed | |
| `/threads/...` | threads | |
| `/workflows/...` | workflow management | |

## 27. Health, metrics, docs

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | liveness |
| GET | `/api/health/ready` | readiness |
| GET | `/api/health/live` | liveness |
| GET | `/api/metrics` | Prometheus exposition |
| GET | `/api/docs` | Swagger UI |
| GET | `/api/docs-json` | raw OpenAPI JSON |

## 28. Source pointers

- `backend/src/main.ts:112-113, 204-225` (global prefix + OpenAPI).
- `backend/src/modules/*/controllers/*.controller.ts` (each path above).
- `backend/openapi/openapi.json` (generated at boot).
- `https://brain.neurecore.com/api/docs` (live Swagger UI).
- `memory-bank/backend.md §6` (architecture surface).
- `memory-bank/auth.md §CSRF` (which endpoints are csrf-exempt).