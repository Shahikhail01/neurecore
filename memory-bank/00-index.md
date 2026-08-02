# NeureCore — Memory Bank (New)

> Canonical, current, working documentation for the NeureCore platform.
> Last refreshed: 2026-07-31.
>
> Legacy and out-of-date material lives in `../memory-bank-arc/`. This folder
> is the single source of truth going forward. When a doc here contradicts a
> doc in `memory-bank-arc/`, **this folder wins**.

---

## What is NeureCore?

NeureCore is an **Enterprise AI Operating System (EAOS)** — a multi-tenant
NestJS backend with two Next.js frontends (admin + tenant), three Python
sidecars (Hermes execution, Accounting, Hermes-events-bridge), and a Postgres
+ Redis + Neo4j data plane. It is deployed on a single Contabo VPS and is
governed by an EAOS "Architectural Constitution" with phased capabilities
(Phases 1–14).

The system implements:
- Multi-tenant AI workforce orchestration (agents, departments, projects)
- Governed execution runtime with command pattern + transactional outbox
- Cookie-only session auth with CSRF double-submit
- A scoped gateway that brokers calls into an upstream Hermes agentic runtime
- An accounting capability (Beancount ledger + numpy-financial compute)
- A package/industry/tier marketplace for tenant onboarding

---

## Monorepo Layout

```
neurecore-2026/
├── neurecore/                  ← active monorepo root
│   ├── backend/                ← NestJS 11 API (port 3003 prod / 3000 dev)
│   ├── frontend-admin/         ← Next.js 15 admin portal (port 3020)
│   ├── frontend-tenant/        ← Next.js 15 tenant portal (port 3001)
│   ├── infra/                  ← Python sidecars + vendored Hermes-agent
│   │   ├── accounting-sidecar/        (FastAPI, port 8001)
│   │   ├── hermes-sidecar/            (FastAPI, port 8002)
│   │   ├── hermes-events-bridge/      (FastAPI webhook receiver)
│   │   ├── hermes/hermes-agent/       (vendored upstream Hermes, pinned)
│   │   ├── _common/                   (shared HMAC/scope-token helpers)
│   │   └── sidecar/                   (systemd units + nftables egress)
│   ├── scripts/                ← local deploy + ops scripts
│   ├── memory-bank/            ← THIS FOLDER — canonical docs
│   ├── memory-bank-arc/        ← legacy docs (do not use as truth)
│   ├── comms/                  ← comms channel references (hermes-tools.md)
│   ├── simulations/            ← end-to-end Playwright + Node runners
│   ├── docs/                   ← legacy handoff / runbooks (some current)
│   └── Temp/                   ← scratch / experimental
├── backend/                    ← duplicate/legacy? See deployments-ops
└── neurecore-ci-check/         ← CI helper scripts
```

---

## Document Index

| File | Purpose |
|---|---|
| [`backend.md`](./backend.md) | NestJS architecture, modules, command/outbox pattern, key services |
| [`frontend-admin.md`](./frontend-admin.md) | Admin portal: routing, auth, SUPER_ADMIN middleware, admin domains |
| [`frontend-tenant.md`](./frontend-tenant.md) | Tenant portal: routing, auth client, chat, projects, dashboards |
| [`auth.md`](./auth.md) | Cookie auth, CSRF, JWT strategy, RBAC, lockout, refresh flow |
| [`databases.md`](./databases.md) | Postgres schema (174 models), Redis cache, Neo4j graph, migrations |
| [`data-model-tour.md`](./data-model-tour.md) | Walk-through of the 174 Prisma models by domain cluster |
| [`architecture-decisions.md`](./architecture-decisions.md) | ADR-0001/001/002/003/004/006/007/009/011–014 index + summary |
| [`contabo-ops.md`](./contabo-ops.md) | VPS layout, PM2 processes, CORS proxy, domains, SSH |
| [`deployment-ops.md`](./deployment-ops.md) | Deploy pipeline (local → Contabo), rollback, smoke tests |
| [`hermes-tools.md`](./hermes-tools.md) | Hermes gateway, scoped tokens, tool registry, agent types |
| [`accounting-sidecar.md`](./accounting-sidecar.md) | Accounting FastAPI service, Beancount snapshot, NPV/IRR compute |
| [`chat-and-agents.md`](./chat-and-agents.md) | Unified chat surface + agent/tool graph composition |
| [`solutions-and-marketplace.md`](./solutions-and-marketplace.md) | SolutionPacks + Package + TenantTemplate + Marketplace flow |
| [`onboarding.md`](./onboarding.md) | Tenant onboarding wizard, industry packs, allocator |
| [`simulations-and-testing.md`](./simulations-and-testing.md) | Phase 9 cert + SIM-04 + unit/integration test layers |
| [`api-reference-quickmap.md`](./api-reference-quickmap.md) | Curated REST endpoint index grouped by feature |
| [`common-patterns.md`](./common-patterns.md) | Recipes: add module, model, seed, tool, command, scenario… |
| [`pending-tasks.md`](./pending-tasks.md) | Open defects, G-series gaps, Phase N work still to do |
| [`fixes.md`](./fixes.md) | Notable bug fixes shipped with commit/tag references |
| [`runbook.md`](./runbook.md) | Operator runbook: restart, health, kill switches, recovery |
| [`Plans/NeureCore-Hermes-Integration-Implementation-Plan.md`](./Plans/NeureCore-Hermes-Integration-Implementation-Plan.md) | Original integration plan (kept; treated as historical) |

---

## Glossary (Quick)

- **EAOS** — Enterprise AI Operating System (the platform vision).
- **AWL** — Autonomous Work Layer (the reconstruction of command/outbox/runtime).
- **Tenant** — A customer organisation; everything is scoped to `tenantId`.
- **HERMES** — Upstream NousResearch agent runtime; called via the
  `hermes-adapter` module using scoped bearer tokens.
- **Sidecar** — A Python process that the NestJS backend calls over HTTP for
  specialised work (Hermes execution, Accounting compute, event ingestion).
- **Beancount** — Plain-text double-entry accounting; the snapshot is generated
  server-side and mmap'd by the accounting sidecar.
- **Phase 9** — Auth hardening (cookie + CSRF) plus the 105-scenario
  certification gate (`pnpm certify:phase9:all`).
- **SIM-04** — The accounting customer HITL walkthrough; current verdict is
  ❌ FAIL with two FE defects open (see `pending-tasks.md`).

---

## How to update this folder

1. Each doc declares its **Last refreshed** date at the top. Update it.
2. Each doc uses `file_path:line_number` references back to source. Keep them.
3. If you discover a doc in `memory-bank-arc/` is still authoritative, link
   to it explicitly from here rather than duplicating — single source of truth.
4. After landing a non-trivial change, the doc touched is the one updated.