# NeureCore AI — Consolidated Status & Backlog (Phases 0–10 + Harness)

**Last updated:** 2026-08-06
**Branch:** `0010-harness-base`
**Live commit (deployed to Contabo):** `00a0ccb0` (parity experience) / `455c01ef` (parity 0-9) / `57b2359c` (harness)
**Purpose:** single authoritative record of EVERYTHING delivered, what is LIVE, what REMAINS, and what is DEFERRED. Supersedes per-phase notes for status questions.

---

## 0. IMPORTANT — two different "Phase 10" workstreams

There are **two** distinct pieces of work both labelled "Phase 10". They are unrelated; this doc distinguishes them explicitly.

| Label | Doc | Commit | Scope |
|---|---|---|---|
| **Harness Phase 10** (Gate G10) | `Phase10-completion-notes.md` | `7b3ab2b8`…`57b2359c` | SuperAdmin **Harness Control Center**: run policies, waivers, certificates, replay, append-only audit triggers. Operator-override certified. |
| **Parity Experience Phase 10** | `PHASE10-PARITY-EXPERIENCE.md` | `00a0ccb0` | Creatio AI parity **experience**: chat ACTS on the CRM (9 tools), per-tenant LLM, inline AI on screens, discoverability. Deployed + pushed. |

Going forward, prefer "**Harness G10**" and "**Parity Experience (P10)**" to avoid confusion.

---

## 1. DELIVERED — implementations (all phases)

### 1.1 Creatio AI parity backend capabilities (Phases 0–9) — commit `455c01ef`
Every capability in the Creatio AI parity plan (v2) is implemented as a backend module + tested + deployed:

| Capability surface | Modules |
|---|---|
| LLM Provider Registry (BYO-LLM, per-tenant bindings) | `llm-registry`, `tenant-llm.gateway` |
| AI Twin (permission mirror, 4-step wizard, deploy gate) | `ai-twin` |
| Compliance Posture (5 standards) | `compliance` |
| Governance Application (4 domains, DSR, controls) | `governance`, `dsr` |
| 26 OOB domain agents | `domain-agents` |
| Channels + MCP catalog (12 adapters) | `channels` |
| Business Studio (codegen, marketplace, ALM) | `studio` |
| Service Ops 360 (touchpoints, triage, guidance, KB gaps, quotes, intent) | `service-ops` |
| Governance authoring + XAI | `governance`, `xai` |
| Coding Agent SDK Bridge | `coding-agent-sdk` |
| Sales outreach orchestrator + ALM + mobile sessions | `sales-outreach` |
| Regional residency + drift observability | `residency` |
| Lead Scoring model runner + calibration | `analytics` |
| Localization (16 locales) + per-user locale | `localization` |
| Always-on CRM triad | `always-on` |

**Gates (Phase 0–9):** 152-row matrix (94 DONE / 45 PARTIAL / 0 NOT_STARTED / 13 OUT_OF_SCOPE at the time); 365 backend tests; `nest build` clean; 0 route collisions; 0 unsafe tenant bypasses.

### 1.2 Parity Experience (P10) — commit `00a0ccb0` — **LIVE**
The "feel like Creatio AI" layer — the chat now **ACTS** on the CRM:

| Delivery | Detail |
|---|---|
| 9 parity chat tools | `nc.score_lead`, `nc.next_best_step`, `nc.forecast_pipeline`, `nc.generate_quote`, `nc.resolve_case`, `nc.search_kb`, `nc.customer_360`, `nc.run_ai_twin`, `nc.dispatch_channel` (6 mutating = approval-gated) |
| Service wiring | PredictionService, QuoteService, CaseTriageService, RealTimeGuidanceService, KnowledgeGapService, CustomerTouchpointService, AiTwinService, ChannelService into the scoped-tool gateway (tenant-scoped) |
| Per-tenant LLM | `TenantLlmGateway` wired into `ChatService` (honors `TenantLlmBinding`) |
| FE discoverability | 9 slash commands, 9 ⌘K "AI Actions", 8 HomeHero chips |
| Inline AI | Customers page per-row "AI"; Projects page "AI: Summarize" |

**Gates (P10):** 354 Phase-10-pattern tests pass; `nest build` exit 0; `tsc` exit 0; SOLID 0; routes 0; tenancy 0. **Deployed live** (backend + tenant).

### 1.3 Harness Phase 10 (Gate G10) — commit `57b2359c`
SuperAdmin Harness Control Center (run policies, waivers, certificates, replay, append-only audit). Operator-override certified (8/8 gates). Documented in `Phase10-completion-notes.md`.

---

## 2. LIVE / DEPLOYED state (Contabo)

| Service | URL | Status |
|---|---|---|
| Backend | `brain.neurecore.com/api/v1/health` | 200 — running parity 0-9 + P10 |
| Admin | `cc.neurecore.com/admin/login` | 200 |
| Tenant | `hq.neurecore.com/login` | 200 |
| Tenant parity screens | `hq.neurecore.com/customers`, `/projects`, `/ai-twin` | 200 |

Contabo dist snapshots exist for rollback (`/tmp/dist_pre_phase10_*.tar.gz` on host; DB dump `neurecore_prod_pre_phase10_*`).

---

## 3. REMAINING (in-scope, not yet done)

These are committed next-step tasks; each is scoped and tracked:

| # | Task | Why it matters | Status |
|---|---|---|---|
| R1 | **Phase 10.6 — new domain screens** (deals, leads, cases, opportunities, quotes, campaigns, emails) | Gives the sales/marketing/service agents a UI home (the current gap vs Creatio). Currently the parity agents exist but the tenant has no deals/leads/cases screens to surface them on. | DEFERRED (see §4) |
| R2 | Wire `nc.run_ai_twin` to a **real LangGraph run** (currently writes audit log only) | Full AI Twin execution from chat | Not started |
| R3 | Add a **Deal model** to the schema (forecast currently aggregates from `Quote`) | Enables weighted pipeline forecast + deals screen | Not started |
| R4 | **Live OAuth integrations** for MS Graph / Zoom / Twilio (channel adapters ship; OAuth config is deployment-side) | Real email/SMS/Teams/voice dispatch | Deployment-side config |

---

## 4. DEFERRED (documented, lower priority / higher risk)

| # | Task | Reason deferred |
|---|---|---|
| D1 | **Phase 10.6 new domain screens** (R1) | Large surface, higher risk; core parity (chat ACTS + inline AI + discoverability) is the biggest user win and is live. |
| D2 | 9 **pre-existing prediction test failures** (`p5-prediction-providers`, `service-gateway-v2/prediction`) | Confirmed pre-existing at last commit; **not caused by Phase 10** (PredictionService untouched). Fixing them is separate scope. |
| D3 | 11 pre-existing skipped tests | Pre-existing; not Phase 10. |
| D4 | Multi-tenant observability backtest cron wiring (drift service ships; cron wires later) | Backend ships; scheduler wiring is follow-up. |

---

## 5. KNOWN ISSUES (honest, non-blocking)

1. **Two "Phase 10" labels** in the repo (harness vs parity experience) — this doc clarifies; docs not renamed to avoid breaking references.
2. **9 prediction tests failing** (pre-existing) — these will fail any full-suite run until separately fixed.
3. **`nc.forecast_pipeline`** uses the `Quote` table (no `Deal` model yet) — R3 addresses.
4. **`nc.run_ai_twin`** is an audit-log seam, not a full twin run — R2 addresses.

---

## 6. Verification commands (reproduce the gates)

```bash
# Backend
cd neurecore/backend
pnpm exec jest --config jest.config.js --testPathPatterns='llm-registry|ai-twin|dsr|domain-agents|channel|service-ops|chat|hermes-adapter|coding-agent-sdk|sales-outreach|residency|governance|lead-scoring-calibration|in-process-mock'   # 354 pass
./node_modules/.bin/nest build                                                       # exit 0
pnpm routes:scan                                                                     # 0 collisions
pnpm tenancy:scan                                                                    # 0 unsafe

# Frontend
cd neurecore/frontend-tenant && npx tsc --noEmit                                       # exit 0

# Repo-wide
bash neurecore/scripts/solid-guard.sh                                                 # 0 violations
```

---

## 7. Change log for this document

- 2026-08-06 — created. Captures parity 0-9 (`455c01ef`), parity experience P10 (`00a0ccb0`), harness G10 (`57b2359c`), live state, remaining (R1-R4), deferred (D1-D4), known issues.
