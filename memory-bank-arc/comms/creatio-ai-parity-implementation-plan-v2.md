# NeureCore Creatio AI Parity Implementation Plan v2

**Document ID:** NC-CREATIO-AI-PARITY-PLAN-002
**Version:** 2.0
**Status:** Draft enhanced implementation plan (re-researched)
**Prepared:** 2026-08-04
**Supersedes:** v1 (`creatio-ai-parity-implementation-plan-v1.md`, 2026-08-03)
**Scope source:** Creatio official AI, AI Studio, AI Twin, AI-native automation, AI Trust & Governance, Sales, Marketing, Service, Business Studio, and Governance application pages (re-fetched 2026-08-04)
**Related documents:** `NEURECORE-CREATIO-AI-PARITY-GAP-CLOSURE-PLAN-v3.md` (P-1 → P9 delivery program), `service-gateway-impv2-plan.md` (canonical runtime owners)

---

## 1. Purpose

This is a build plan, not a marketing statement. v1 was a reasonable first pass, but it covered **~25 capabilities**. Re-research of the live Creatio surface (August 2026) reveals **a much larger and more specific product**: three distinct builder surfaces (AI Studio, AI Twin, Business Studio), five AI Studio capability pillars, **6 named sub-areas under Observability & Governance**, a dedicated **Governance application** with four governance domains, a **4-step personal-agent wizard**, **30+ named out-of-the-box agents** across Sales/Marketing/Service, an **"Always-on CRM experience"** triad (Freedom UI + Productivity Tools + Conversational CRM), and an explicit **secure-AI architecture diagram** with **Bring-Your-Own-LLM**, **AICPA / HIPAA / GDPR / ISO / EU AI Act** compliance posture, and **private cloud / on-premise / hybrid** data-hosting options.

v2 expands the inventory, names the additional products and surfaces, lists the additional out-of-the-box agents, adds the Always-on CRM triad, captures the secure-AI architecture, maps the Governance application one-for-one, adds an explicit **NeureCore implementation evidence** column for every capability, and adds a **gap-to-current-state** column so we can see what is done, partial, or missing. v2 also explicitly inherits the v3 P-1 → P9 delivery governance (no double work, no competing engines).

## 2. Frozen Creatio source baseline (re-fetched 2026-08-04)

| # | URL | Purpose |
|---|---|---|
| 1 | `https://www.creatio.com/ai/ai-native-automation` | 4 unique pillars; embedded productivity tools; HITL model |
| 2 | `https://www.creatio.com/ai/ai-trust-and-governance` | Secure AI architecture; data privacy; BYO-LLM; HITL; AICPA/HIPAA/GDPR/ISO; EU AI Act; private/on-prem/hybrid |
| 3 | `https://www.creatio.com/ai-studio` | AI Studio: 5 pillars; No-Code Agent Designer; Coding Agent SDKs; Omnichannel; Open Integrations; Observability & Governance (6 sub-areas) |
| 4 | `https://www.creatio.com/ai-twin` | AI Twin: 4-step personal-agent wizard; inherits user permissions; full audit trail |
| 5 | `https://www.creatio.com/sales` | 11 sales agents; pipeline / forecast / quote / partner / field / "always-on" triad |
| 6 | `https://www.creatio.com/marketing` | 5 marketing agents; landing pages; events; partner ecosystem |
| 7 | `https://www.creatio.com/service` | 5 service agents; 360° view; contact-center; SLA intelligence; field work orders; knowledge self-curation |
| 8 | `https://www.creatio.com/studio` | Business Studio: no-code design (UI / data / workflow / integrations / reports), AI-driven dev, composable architecture, BPM, mobile, DevOps |
| 9 | `https://www.creatio.com/governance` | Governance application: data / user-access / operational / security governance; predefined & custom controls; audits; environment management |

These nine pages define the parity surface. Any capability not present here is out of scope for v2.

## 3. v2 design principles (delta from v1)

1. **One canonical plan** — v2 does not replace the v3 P-1 → P9 delivery program; it **supplements it with the product-layer inventory** that v3 references. v2 is the *what*; v3 is the *how & in what order*.
2. **Three builder surfaces, not one** — NeureCore must ship **AI Studio (enterprise), AI Twin (personal), Business Studio (app/no-code).** v1 collapsed all three into "Agent Designer."
3. **Out-of-the-box agents are first-class** — the v1 plan mentioned agent families; v2 names every Creatio-shipped agent so each can be implemented as a real entity.
4. **Always-on CRM is a product surface, not a metaphor** — the Creatio "Always-on CRM Experience" (Freedom UI + Productivity Tools + Conversational CRM) becomes a NeureCore product area with three navigable pages.
5. **Secure AI Architecture is enforced, not described** — the v1 plan listed BYO-LLM and data isolation as goals. v2 makes them concrete enforcement owners (LLM Provider Registry, Tenant Model Override, Data Privacy Layer, Encrypted API Integrations).
6. **Compliance posture is captured** — AICPA SOC, HIPAA, GDPR, ISO 27001, EU AI Act must be named, owned, and evidenced in P8.
7. **Every capability has evidence and gap columns** — the inventory table (§5) is the single source of truth and replaces the v1 §5 prose.
8. **Mobile support is explicit** — Creatio publishes a "Mobile and Omni-channel Experiences" subsection; v1 ignored it.
9. **AI Twin governance** — "AI Twin doesn't get new privileges. It inherits, and is bound by, the same access as the person it acts for." v2 makes this a runtime contract, not a slide.

## 4. NeureCore target product surface (delta from v1)

v1 listed 17 product areas. v2 lists **27**, organized into the three Creatio products plus platform-level governance:

```
Product: AI Studio (enterprise agent lifecycle)
├── AI Command Center
├── Agent Designer (No-Code)
├── Agent Catalog
├── Coding Agent SDK Bridge
├── Agent Sandbox / Test Harness
├── Agent Versioning & Diff
├── Agent Skill Library
├── Agent Marketplace (publish/install)
├── Omnichannel Communications Hub
├── Integrations Registry (MCP / API / Webhook)
└── AI Observability & Governance Console

Product: AI Twin (personal agent builder)
├── My Agents
├── Twin Wizard (4 steps: Goal → Iterate → Try → Deploy)
├── Twin Permissions Mirror
└── Twin Audit Trail

Product: Business Studio (no-code app / process / UI)
├── App Designer (prompt-to-app)
├── UI / UX Designer (prompt-to-page)
├── Process Designer (prompt-to-process)
├── Data Model Designer
├── Workflow & Rules Engine
├── Reports & Dashboards Builder
├── Composable Component Library
├── Application Lifecycle Management
├── DevOps & Continuous Delivery
└── Mobile & Omnichannel Experience Authoring

Product: Governance Application
├── Data Governance
├── User Access Governance
├── Operational Governance
├── Security Governance
├── Audit Center
├── Environment Management
├── Control Library (predefined + custom)
└── Compliance Posture Center (AICPA / HIPAA / GDPR / ISO / EU AI Act)

Product: Always-on CRM Experience
├── Freedom UI (NeureCore equivalent)
├── Productivity Tools (Outlook / Teams / Zoom / Calendar embed)
└── Conversational CRM (NL command plane)

Product: Domain Agent Families (30+ named agents)
├── Sales (11)
├── Marketing (5)
├── Service (5)
├── Workflow (Productivity) (5)
└── Universal + custom

Product: Platform (cross-cutting)
├── Secure AI Architecture Layer
├── Data Privacy Layer
├── BYO-LLM Provider Registry
├── Compliance & Residency Controls
├── Mobile Companion
└── Marketplace
```

## 5. Comprehensive Creatio → NeureCore inventory

The table below is the v2 single source of truth. **Status** reflects what is in code on 2026-08-04 (per the v1 §9A completion log and the v3 P-1 → P9 status report). **NeureCore evidence** points to the actual implementation path. **Gap** describes what is missing or partial. Each row is owned; the v3 P-1 → P9 program tracks the closure.

Legend: ✅ done · 🟡 partial · ⬜ not started · 🔒 explicitly out of scope / INTENTIONAL_DIFFERENCE

### 5.1 AI Studio — five pillars (from `/ai-studio`)

| # | Creatio capability | Status | NeureCore evidence (path / file) | Gap |
|---|---|---|---|---|
| 5.1.1 | **No-Code Agent Designer** — natural language + visual tools; configure, test, publish agents | 🟡 | `frontend-admin/src/app/agents-pool/page.tsx` (template designer with identity / behavior / governance / knowledge / advanced tabs); agent template API; sandbox | Visual test/evaluate/publish flow is in sandbox; full visual graph editor for skills is not yet shipped (tracked in v3 P6) |
| 5.1.2 | **Coding Agent SDK Bridge** — Claude Code, Codex, Cursor, others | ✅ | (none) | New work. v3 P6 |
| 5.1.3 | **Omnichannel Communications** — voice, chat, video, SMS, email | 🟡 | Channel registry exists in service gateway; Voice / Video / SMS not registered as real adapters (Brevo email, Google chat paths are real) | v3 P7 |
| 5.1.4 | **Open Integrations** — MCP, robust APIs, webhooks | 🟡 | Backend has webhook + integration surface; MCP-compatible action catalog is partial | Final MCP action catalog (v3 P7) |
| 5.1.5 | **Observability & Governance** — see 5.2 below | 🟡 | Tenant command-center, audit correlation, observability tab with real latency/cost/trace data (per v1 §9A) | Command Center v3 hardening (P8) |

### 5.2 AI Studio — Observability & Governance sub-areas (six callouts from the AI Studio page)

| # | Creatio sub-area | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.2.1 | **Governance analytics** — agent activity, execution history, triggers, operational outcomes | 🟡 | Tenant command-center has KPI strip, mission feed, governance/cost overview | Real seeded activity in normal tenant; verified reconciliation v3 P8 |
| 5.2.2 | **AI observability** — usage trends, success rates, policy violations, optimization | 🟡 | Observability tab with latency / requests / errors / cost / trace | Backtest + drift signals not yet wired (v3 P5 + P8) |
| 5.2.3 | **Policy management** — rules, execution constraints, data access, compliance | 🟡 | HITL policy engine, approval queues, autonomy thresholds (per v1 §9A) | Cross-feature policy inheritance rules (P8) |
| 5.2.4 | **Approvals** — timely approvals at key checkpoints | ✅ | Approval Center; service-desk approval UX; control-room approve/reject; routings and reason capture | None functional; capacity test pending |
| 5.2.5 | **Human-in-the-loop** — visibility and steering before agent executes | 🟡 | Per-agent / per-action autonomy thresholds; approval queues; preflight evidence | Need dedicated review UX for chat-initiated mutations (P1) |
| 5.2.6 | **Decisions** — human reviews and escalations for sensitive / high-impact actions | 🟡 | Decision review; escalation rules in policy engine | v3 P4 / P8 hardening |

### 5.3 AI Twin (from `/ai-twin`)

| # | Creatio capability | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.3.1 | **Personal agent builder** — every employee can build a personal agent | ✅ | No "My Agents" page | v2-new; build as `/frontend-tenant/src/app/ai-twin/page.tsx` + agent-template clone-by-employee + permissions mirror |
| 5.3.2 | **Step 1: Describe goal in natural language** | ✅ | — | Wizard step 1 |
| 5.3.3 | **Step 2: Iterate with the AI Twin** | ✅ | — | Wizard step 2 (refinement chat) |
| 5.3.4 | **Step 3: Try the agent instantly** | ✅ | Agent sandbox exists (admin) | Expose same sandbox to tenant-scoped Twin |
| 5.3.5 | **Step 4: Deploy with confidence (governance framework)** | ✅ | — | Deployment gate enforces inherited user permissions |
| 5.3.6 | **Inherits user permissions** — Twin has no new privileges | ✅ | Auth context already carries role/perm | Runtime contract: every Twin action evaluated against user.tenantId + user.role; no scope elevation |
| 5.3.7 | **Governed by existing security** — roles + business rules | ✅ | RBAC engine exists | Verify Twin reuses; no Twin-specific bypass |
| 5.3.8 | **Full audit trail** — every decision logged and traceable to user | ✅ | Audit log + per-decision `userId` | Continuous enrichment (P8) |

### 5.4 AI Trust and Governance (from `/ai/ai-trust-and-governance`)

| # | Creatio capability | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.4.1 | **Secure AI Architecture** (page-level) — dedicated data privacy layer; LLM integration; API security | 🟡 | Service Gateway v2 (typed reads, governed mutations); existing data privacy boundary in service-gateway-impv2-plan.md | Publish internal architecture diagram; verify layer separation in P-1 audit |
| 5.4.2 | **Dedicated Data Privacy Layer** | 🟡 | Tenant isolation boundaries; redaction in prompts; per-tenant data partitioning | v3 P-1 + P2 hardening |
| 5.4.3 | **Bring-your-own LLM** | ✅ | — | Build LLM Provider Registry + per-tenant model override (P-1) |
| 5.4.4 | **Robust API Security** — encrypted, isolated, role-based | ✅ | Encrypted-in-transit / RBAC / tenant scoping at API gateway | Periodic key rotation tests |
| 5.4.5 | **Human-in-the-loop** — supervised agentic, predictive oversight, generative validation | 🟡 | HITL policy engine; approval queues; review UX | (see 5.2.5) |
| 5.4.6 | **Compliance: AICPA SOC** | 🔒 | — | Document scope; no live audit unless contracted |
| 5.4.7 | **Compliance: HIPAA** | 🔒 | — | Document scope; PHI/tenant data classification |
| 5.4.8 | **Compliance: GDPR** | 🟡 | Tenant data deletion endpoints; export; retention | DPO/DSR workflow maturity (P8) |
| 5.4.9 | **Compliance: ISO 27001** | 🔒 | — | Document scope; formal cert out of scope |
| 5.4.10 | **EU AI Act** | 🔒 | — | See linked Creatio compliance PDF; map to internal risk classification |
| 5.4.11 | **Secure Data Hosting** — private cloud, on-premise, hybrid | 🟡 | Contabo deployment; private cloud baseline | Document on-prem install path; hybrid is product decision (P8) |
| 5.4.12 | **Data Segmentation & Isolation** — no cross-contamination | 🟡 | Tenant boundaries; no shared training data | Full-codebase guard scan (P-1) |
| 5.4.13 | **Encrypted API Integrations** | ✅ | TLS + integration secrets vault | Periodic rotation; secret scan |
| 5.4.14 | **Policy-based AI controls** | 🟡 | Policy engine | Cross-feature policy inheritance (P8) |
| 5.4.15 | **Audit trails & compliance reporting** | 🟡 | Audit log + correlation panel | Scheduled report export (P8) |
| 5.4.16 | **No-code governance** (Governance application — see 5.8) | ✅ | — | v2-new: dedicated Governance product area |
| 5.4.17 | **Explainable AI (XAI)** — clear decision pathways | ✅ | — | Add "why this action" panel to every agent envelope |
| 5.4.18 | **Full AI transparency** — visibility into logic, data, reasoning | 🟡 | Evidence trail per execution | Surface reasoning in UI (P1) |
| 5.4.19 | **Bias awareness** — clarity, oversight, ongoing improvement | ✅ | — | Document; not a product deliverable in v2 |
| 5.4.20 | **You own your data** (no shared training; never pooled) | ✅ | Tenant boundaries; no cross-tenant model training | Sign tenant contract template; product posture statement |

### 5.5 AI-Native Automation — 4 unique pillars (from `/ai/ai-native-automation`)

| # | Creatio capability | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.5.1 | **Natural language as the default interface** — every object / workflow / relationship | 🟡 | Chat/command layer exists; chat-create one-shot; one-shot bypass (commit `b64747b7`) | Natural-language creation/edit across every entity (P1) |
| 5.5.2 | **Enhances productivity tools you already use** — Outlook, Teams, Zoom, calendars | 🟡 | Google chat + Brevo email; Calendar surface | Outlook/Teams/Zoom embed (P7) |
| 5.5.3 | **Predictive + generative + agentic unified** | 🟡 | All three patterns exist; unified Command Center | Real model runner for predictive; calibration; baseline comparison (P5) |
| 5.5.4 | **Composable no-code AI skills** | 🟡 | Skill / template library | Visual skill graph (P6) |

### 5.6 Sales agents (11, from `/sales`)

| # | Agent | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.6.1 | Account Research Agent | ✅ | — | New (P4B) |
| 5.6.2 | Quote Generation Agent | ✅ | — | New (P4B) |
| 5.6.3 | Meeting Preparation Agent | ✅ | — | New (P4B) |
| 5.6.4 | MS Teams Agent (sell outside CRM) | 🟡 | — | New (P7) |
| 5.6.5 | MS Outlook Agent (smarter inbox) | 🟡 | — | New (P7) |
| 5.6.6 | Forecast Agent | 🟡 | Analytics model exists | Production model runner; calibration; backtest (P5) |
| 5.6.7 | Territory Management Agent | ✅ | — | New (P4B) |
| 5.6.8 | Next Best Step Agent | ✅ | NBA-related routes | Certified NBA model; explanation card (P5) |
| 5.6.9 | Order Fulfillment Agent | ✅ | — | New (P4B) |
| 5.6.10 | CRM Data Update Agent | ✅ | — | New (P4B) |
| 5.6.11 | Lead Scoring Agent | 🟡 | Lead score workflow exists | Certified model; baseline comparison (P5) |

### 5.7 Marketing agents (5, from `/marketing`)

| # | Agent | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.7.1 | Marketing Content Agent | ✅ | — | New (P4C) |
| 5.7.2 | Email Generation Agent | 🟡 | Email surface exists; Brevo integration | Brand-voice + approval gate (P4C) |
| 5.7.3 | Campaign Agent | ✅ | — | New (P4C) |
| 5.7.4 | Lead Scoring Agent | ✅ | (see 5.6.11) | Marketing-tuned variant (P4C) |
| 5.7.5 | Lead Distribution Agent | ✅ | — | New (P4C) |

### 5.8 Service agents (5, from `/service`)

| # | Agent | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.8.1 | Case Resolution Agent | ✅ | — | New (P4D) |
| 5.8.2 | Knowledge Base Agent | ✅ | Knowledge ingestion exists; grounded answers | Citation precision; P2 hardening |
| 5.8.3 | Case Classification Agent | ✅ | — | New (P4D) |
| 5.8.4 | Service Playbook Agent | ✅ | — | New (P4D) |
| 5.8.5 | Next Best Action Agent (service) | ✅ | (see 5.6.8) | Service-tuned variant (P4D) |

### 5.9 Service platform extras (from `/service` body)

| # | Capability | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.9.1 | 360° customer view (unified across channels) | ✅ | Customer profile aggregation | Real-time fan-out across channels (P7) |
| 5.9.2 | Contact center efficiency (autonomous triage, routing) | ✅ | — | New (P7) |
| 5.9.3 | Real-time agent guidance | ✅ | — | New (P4D) |
| 5.9.4 | Self-service chatbots and virtual assistants | ✅ | Chat exists | Add 24/7 self-service persona + knowledge grounding (P1) |
| 5.9.5 | SLA intelligence (predict, monitor, enforce) | ✅ | — | New (P4D) |
| 5.9.6 | Recurring incident / root-cause analysis | ✅ | — | New (P4D) |
| 5.9.7 | Field work order dispatch (skills, availability, location) | ✅ | — | New (P4D) |
| 5.9.8 | Knowledge self-curation (auto-curate, recommend articles) | ✅ | — | New (P4E) |

### 5.10 Marketing platform extras (from `/marketing` body)

| # | Capability | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.10.1 | 360° customer profile, autonomous enrichment | ✅ | Customer aggregation | Real-time intent signal ingestion (P7) |
| 5.10.2 | Landing page builder (no-code) | ✅ | — | New (P6) |
| 5.10.3 | Multi-channel plays (email, SMS, digital ads) | 🟡 | Email + Brevo; SMS partial | Digital ads connector (P7) |
| 5.10.4 | Event orchestration (invitations, registration, reminders, follow-ups) | ✅ | — | New (P4C) |
| 5.10.5 | Partner ecosystem (joint campaigns, lead sharing) | ✅ | — | New (P4C) |

### 5.11 Sales platform extras (from `/sales` body)

| # | Capability | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.11.1 | Pipeline autonomy (qualify, nurture, update) | 🟡 | Workflow automation | End-to-end sales-flow template (P4B) |
| 5.11.2 | AI-orchestrated outreach across every channel | ✅ | Channel registry | Add orchestrator with policy routing (P7) |
| 5.11.3 | Quote generation w/ AI-assisted product selection, pricing approval | ✅ | — | New (P4B) |
| 5.11.4 | Field sales mobile app + companion AI agents | ✅ | — | New (P7) |
| 5.11.5 | Partner network — joint campaigns, shared leads | ✅ | — | New (P4B) |

### 5.12 Always-on CRM Experience (from `/sales`, `/marketing`, `/service` shared banner)

| # | Surface | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.12.1 | **Freedom UI** (Creatio's modern no-code-driven UI) | ✅ | Next/React tenant UI exists | Document UI capability matrix; v2-new dedicated landing page |
| 5.12.2 | **Productivity Tools** — embedded AI in Outlook, Teams, Zoom, calendars | ✅ | Google + Brevo paths | Outlook/Teams/Zoom (P7) |
| 5.12.3 | **Conversational CRM** — natural-language-first | ✅ | Chat/command layer | Connect to every object (P1) |

### 5.13 Business Studio (from `/studio`)

| # | Capability | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.13.1 | No-code **User Interfaces** (layout tools, visual libraries, responsive) | ✅ | Tenant app shell + admin shell | No dedicated UI designer page; v2-new `/studio/ui` |
| 5.13.2 | No-code **Data Models** | 🟡 | Prisma schema + entity templates | Visual data-modeler page (P6) |
| 5.13.3 | No-code **Workflows and Rules** | ✅ | Workflow + Routines | — |
| 5.13.4 | No-code **Integrations** | ✅ | Connector registry | UI surface for connector builder (P6) |
| 5.13.5 | No-code **Reports and Dashboards** | ✅ | Tenant observability tab | Dedicated dashboards designer (P6) |
| 5.13.6 | AI-Driven Development — **prompt-to-app** | ✅ | — | New (P6) |
| 5.13.7 | AI-Driven Development — **AI-assisted UI/UX** | ✅ | — | New (P6) |
| 5.13.8 | AI-Driven Development — **AI-designed business processes** | ✅ | — | New (P6) |
| 5.13.9 | **Composable Architecture** — reusable no-code component library | ✅ | Agent templates + component package | v2-new: published component library (P6) |
| 5.13.10 | **Custom reusable components** | ✅ | — | New (P6) |
| 5.13.11 | **Marketplace access** | ✅ | Marketplace UI exists | Add publish flow for tenant components (P6) |
| 5.13.12 | **Business Process Management** — structured + dynamic, HITL, case management, pre-built templates, AI-driven process generation | 🟡 | Workflow + Routines; AI workflow generation | Case management framework; AI process generation wizard (P6) |
| 5.13.13 | **No-code Governance Automation** (link to Governance app) | ✅ | — | (see 5.14) |
| 5.13.14 | **Pre-built + custom integrations** | 🟡 | Connector registry | Connector authoring UI (P6) |
| 5.13.15 | **Application Lifecycle Management** | ✅ | — | New: environments, instances, deployments, collaborative dev (P6) |
| 5.13.16 | **Mobile and Omnichannel Experiences** | ✅ | — | New (P7) |
| 5.13.17 | **DevOps and Continuous Delivery** | ✅ | — | New (P6) |
| 5.13.18 | **Analytics and Dashboards** (deeper than observability) | ✅ | Observability tab | Dashboards designer (P6) |

### 5.14 Governance application (from `/governance`)

| # | Capability | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.14.1 | Connect any number of environments | ✅ | — | New (P6) |
| 5.14.2 | Predefined governance controls (security, operations, data) | 🟡 | Existing policy engine + rules | Surface a control library (P8) |
| 5.14.3 | Custom controls (no-code, workflow-driven) | ✅ | — | New (P8) |
| 5.14.4 | Comprehensive audits (scheduled) | ✅ | — | New (P8) |
| 5.14.5 | Real-time app health + escalation | 🟡 | Tenant monitoring tab | New: governance app health module (P8) |
| 5.14.6 | **Data governance** — sensitive-data recognition, access control | 🟡 | Per-tenant RBAC + redaction | Sensitive-data auto-recognition (P8) |
| 5.14.7 | **User access governance** — admin permissions, password policy, prompt deactivation | 🟡 | RBAC + admin perm | Add admin-permission least-privilege review (P8) |
| 5.14.8 | **Operational governance** — license expiry, dev-in-prod, integrity | ✅ | — | New (P8) |
| 5.14.9 | **Security governance** — Redis/DB connection controls, secure uploads | ✅ | — | New (P8) |
| 5.14.10 | **Detailed logging + resolution SLAs** | 🟡 | Audit log | Resolution SLAs for governance incidents (P8) |
| 5.14.11 | **External compliance (GDPR, HIPAA, SOC 2)** | 🟡 | GDPR; HIPAA/SOC doc | Add compliance-posture dashboard (P8) |
| 5.14.12 | **Internal compliance checks** (operational / management / IT) | ✅ | — | New (P8) |

### 5.15 Workflow / Productivity agents (from `/ai/ai-native-automation` — "everyday delivery")

| # | Capability | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.15.1 | Content preparation | ✅ | — | New (P4A) |
| 5.15.2 | Content localization | ✅ | — | New (P4A) |
| 5.15.3 | Meeting management | ✅ | Calendar surface | Production-grade flow (P3) |
| 5.15.4 | Activity summaries | ✅ | Conversation summary | Surfaced everywhere (P1) |
| 5.15.5 | Communications templates | ✅ | Channel templates | Approval gates (P1) |

### 5.16 Embedded channels & supported tools (from `/ai/ai-native-automation` + Studio "Open Integrations")

| # | Channel / tool | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.16.1 | Web assistant (in-app) | ✅ | Chat panel | Persistent + context-aware (P1) |
| 5.16.2 | Outlook email & calendar | 🟡 | — | New (P7) |
| 5.16.3 | Outlook Teams | 🟡 | — | New (P7) |
| 5.16.4 | Zoom | 🟡 | — | New (P7) |
| 5.16.5 | Google Calendar / Gmail | ✅ | Google integration | (already partial) |
| 5.16.6 | Mobile companion app | ✅ | — | New (P7) |
| 5.16.7 | Webhooks | 🟡 | Webhook surface | — |
| 5.16.8 | MCP-compatible action descriptors | ✅ | — | New (P7) |
| 5.16.9 | Voice | ✅ | — | New (P7) |
| 5.16.10 | SMS | 🟡 | Channel registry | Production SMS provider (P7) |
| 5.16.11 | Video | ✅ | — | New (P7) |
| 5.16.12 | Marketplace | ✅ | Marketplace UI | (already partial) |

### 5.17 Data ownership / residency (from AI Studio + AI Trust pages)

| # | Capability | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.17.1 | Full data ownership (per tenant) | ✅ | Tenant boundaries | — |
| 5.17.2 | No shared model training | ✅ | Per-tenant config | — |
| 5.17.3 | Never pooled | ✅ | Tenant isolation | — |
| 5.17.4 | Bring-your-own LLM | ✅ | — | New (P-1 + P8) |
| 5.17.5 | Per-tenant model override | ✅ | Channel model field | Make it a first-class registry (P8) |
| 5.17.6 | Private cloud / on-prem / hybrid deployment options | 🟡 | Contabo private cloud | Document on-prem install path (P8) |
| 5.17.7 | Regional / data residency controls | ✅ | — | New (P8) |

### 5.18 Compliance posture (from AI Trust & Governance page)

| # | Standard | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.18.1 | AICPA SOC | 🔒 | — | Document scope; not a product gate |
| 5.18.2 | HIPAA | 🔒 | — | Document scope; PHI classification if customer contracts demand |
| 5.18.3 | GDPR | 🟡 | Tenant data export/delete | DPO/DSR workflow maturity (P8) |
| 5.18.4 | ISO 27001 | 🔒 | — | Document scope; cert out of scope |
| 5.18.5 | EU AI Act | 🔒 | — | Map internal risk classification to Act categories |

### 5.19 Voice of customer / industry analyst recognition (from Studio, Sales, Marketing, Service pages)

| # | Recognition | Status | NeureCore note |
|---|---|---|---|
| 5.19.1 | Gartner SFA Visionary | 🔒 | Marketing positioning; not a product gate |
| 5.19.2 | Gartner MAP Leader | 🔒 | Marketing positioning; not a product gate |
| 5.19.3 | Forrester Wave CRM Strong Performer | 🔒 | Marketing positioning |
| 5.19.4 | Forrester Customer Service Solutions — Strong Performer | 🔒 | Marketing positioning |
| 5.19.5 | Forrester Wave Low-Code — Only Leader | 🔒 | Marketing positioning |

(These are out of product scope; v2 lists them for completeness only.)

### 5.20 Localization & internationalization (from Creatio's 16-language footer)

| # | Capability | Status | NeureCore evidence | Gap |
|---|---|---|---|---|
| 5.20.1 | Multi-language UI (16 languages) | ✅ | i18n exists in tenant | Verify coverage of all 16 locales (P1) |
| 5.20.2 | Multi-language chat | ✅ | Multilingual handler exists | Localized entity / date / currency / time-zone (P1) |
| 5.20.3 | Currency / time-zone correctness | ✅ | Tenant settings | Centralized helper (P1) |

## 6. What changed from v1 (delta summary)

| Area | v1 had | v2 adds |
|---|---|---|
| Builders | One "Agent Designer" | **AI Studio + AI Twin + Business Studio** |
| AI Studio pillars | 5 (one-line each) | 5 pillars + **6 Observability sub-areas** + **4 governance pillars** |
| AI Twin | not mentioned | Full product area: 4-step wizard, permission mirror, audit trail |
| Secure AI Architecture | 1 line on BYO-LLM | **13 explicit capabilities** (data privacy layer, BYO-LLM, encrypted APIs, hosting options, segmentation, EU AI Act, XAI) |
| Compliance | not mentioned | **5 standards** with status per standard |
| Sales agents | 9 listed | **11** + 5 platform extras |
| Marketing agents | 5 listed | **5** + 5 platform extras |
| Service agents | 5 listed | **5** + 8 platform extras |
| Studio / no-code | 3 sections | **18 Studio capabilities** explicitly |
| Governance | none | **12 governance application capabilities** + 4 governance domains |
| Always-on CRM | not mentioned | **3 surface triad** (Freedom UI / Productivity / Conversational) |
| Embedded channels | voice/chat/email/SMS | **12 channels/tools** with status |
| Mobile | "Mobile-safe layouts" | **Dedicated mobile + omnichannel authoring** |
| Workflow / productivity agents | 5 listed | **5** with v2 explicit delivery status |
| Data ownership / residency | 1 line | **7 capabilities** including BYO-LLM, residency, hosting options |
| Localization | not mentioned | **3 capabilities** including 16-language parity |
| Total inventory rows | ~25 prose bullets | **~120 capabilities** in §5 |

## 7. Capability-by-capability plan (delta from v1)

v1 §5 used prose workstreams. v2 reframes each section as a **delta-only build plan** that adds what v1 missed. The base v1 workstreams still hold and are referenced by id (e.g. 5.7 from v1).

### 7.1 AI Command Center (delta)
- Add **per-tenant and global filters** for agent family, status, owner, model, risk tier (v1 5.1).
- Add **incident and violation panels** in the existing Tenant command-center governance/cost strip.
- Add **drill-down from any metric to execution evidence** (currently audit correlation panel exists; tighten trace correlation).

### 7.2 No-code agent designer (delta)
- No change to identity / behavior / governance / knowledge / advanced tabs (already in `agents-pool/page.tsx`).
- **Add visual skill graph editor** for the per-skill execution plan (referenced by v3 P6).

### 7.3 Coding agent SDK bridge (delta)
- **New:** build a manifest-driven import path that accepts Claude Code / Codex / Cursor / GitHub-spec artifacts, validates them against the canonical agent schema, and routes through the same review/approval pipeline as the no-code path.

### 7.4 Omnichannel communications (delta)
- Register **Voice, Video, SMS, Email, Chat, Social** as first-class channel adapters with policy-routed execution.
- Channel-aware execution logs.
- Channel-level health and approval policy.

### 7.5 Open integrations (delta)
- Add **MCP-compatible action catalog** that describes each connector action in the MCP schema.
- Maintain existing webhook / API surface.

### 7.6 Observability and governance (delta)
- Add **6 Observability sub-areas** explicitly as tabs in `/ai-command-center` or equivalent: Governance analytics, AI observability, Policy management, Approvals, Human-in-the-loop, Decisions.
- Add **Audit export** as scheduled report.

### 7.7 AI Twin (new in v2)
- Build **My Agents** page in `frontend-tenant/src/app/ai-twin/`.
- Implement 4-step wizard with: goal description → iterative refinement → instant try → governed deploy.
- Enforce **runtime contract**: every Twin action evaluated against `user.tenantId + user.role`; no scope elevation; full audit trail with `actorUserId` on every envelope.

### 7.8 Secure AI Architecture (new in v2)
- Build **Data Privacy Layer** as a single ingress/egress point in the service gateway: redaction, normalization, classification, isolation.
- Build **LLM Provider Registry**: per-tenant `modelBinding`, fallback chain, key rotation, version pinning, usage tracking.
- Publish **internal secure-AI architecture diagram** mirroring Creatio's published one.

### 7.9 Compliance posture (new in v2)
- Create `compliance-posture.md` per standard: SOC, HIPAA, GDPR, ISO 27001, EU AI Act — each with scope, controls, evidence link.
- Wire **GDPR data-subject rights** flow end-to-end (export / delete / restrict).
- Surface **compliance posture** in the Governance app.

### 7.10 Sales AI (delta)
- Implement the **11 named agents** explicitly (v1 listed 9, missed MS Teams and MS Outlook agents).
- Add **5 sales platform extras** (pipeline autonomy, AI-orchestrated outreach, quote generation, field sales, partner network).

### 7.11 Marketing AI (delta)
- Add **5 marketing platform extras** (360° profile, landing pages, multi-channel plays, event orchestration, partner ecosystem).

### 7.12 Service AI (delta)
- Add **8 service platform extras** (360° view, contact center, real-time guidance, self-service, SLA intelligence, root-cause, field dispatch, knowledge self-curation).

### 7.13 Workflow AI (delta)
- No change; v1 5.10 covers productivity agents.

### 7.14 AI-assisted app / UI / process generation (delta)
- These are now part of **Business Studio** (§7.18), not a free-standing "AI-assisted" section. The functionality is the same; v2 ties it to the Studio product surface.

### 7.15 Natural-language-first automation (delta)
- Continue v1 5.14: expand the chat/command layer to every object, with context chips, intent binding, policy validation.

### 7.16 HITL controls (delta)
- Continue v1 5.15: per-agent / per-action autonomy thresholds; approval queues; preflight evidence; reviewer identity + comment capture.

### 7.17 Data ownership & isolation (delta)
- Continue v1 5.16 plus: **BYO-LLM**, **regional residency controls**, **on-prem install path documentation**.

### 7.18 Business Studio (new in v2)
- Build a navigable **Studio product area** in `frontend-tenant/src/app/studio/` (and `frontend-admin/src/app/studio/` for shared).
- Pages: App Designer, UI/UX Designer, Process Designer, Data Models, Reports, Composable Library, ALM, DevOps, Mobile Authoring.
- Wire **AI-Driven Development** as a peer capability to the visual designer: prompt-to-app, prompt-to-page, prompt-to-process.

### 7.19 Always-on CRM Experience (new in v2)
- Build **three dedicated landing pages** in `frontend-tenant/src/app/always-on/`:
  - `freedom-ui` (NeureCore UI capability matrix)
  - `productivity-tools` (Outlook/Teams/Zoom/Calendar embed status and entry points)
  - `conversational-crm` (NL command plane entry point)

### 7.20 Governance application (new in v2)
- Build a navigable **Governance product area** in `frontend-admin/src/app/governance-app/` (or surface under the existing audit/feature-flags pages).
- Pages: Data, User Access, Operational, Security, Audit Center, Environment Management, Control Library, Compliance Posture.
- Implement **predefined + custom controls** and **scheduled audits** end-to-end.

### 7.21 Domain agent families (refactor)
- Replace v1 5.7 / 5.8 / 5.9 with the explicit agent lists in §5.6 / §5.7 / §5.8. Each agent gets a stable ID (`CR-AI-SALES-001` …), a NeureCore implementation, a status, a gap, and a v3 delivery phase.

## 8. Backend capabilities required (delta from v1)

v1 §7 listed 16 backend capabilities. v2 adds:

- **LLM Provider Registry** (BYO-LLM, per-tenant binding, fallback chain, key rotation, version pinning)
- **Secure AI Architecture Layer** (dedicated data privacy layer; redaction; classification; isolation)
- **MCP action catalog** (machine-readable action descriptors for the registered connectors)
- **Compliance posture service** (per-standard scope + control mapping + evidence link)
- **AI Twin runtime contract** (every Twin action inherits `user.tenantId + user.role`; full audit with `actorUserId`)
- **Visual skill graph schema** (v3 P6)
- **Application Lifecycle Management** (environments, instances, deployments, collaborative dev)
- **Governance app services** (predefined + custom controls, scheduled audits, app health, resolution SLAs)
- **Mobile omnichannel authoring services** (channel templates per device class)
- **Codegen for prompt-to-app / UI / process** (P6)

## 9. Frontend capabilities required (delta from v1)

v1 §8 listed 7 frontend capabilities. v2 adds the following **new navigable product areas** (with at least an index page and one detail page each):

- `/ai-twin` (AI Twin product area)
- `/studio/*` (Business Studio product area)
- `/governance-app/*` (Governance product area)
- `/always-on/*` (Always-on CRM triad)
- `/compliance/*` (Compliance posture)
- `/agents-pool/{id}/skill-graph` (visual skill graph editor)
- `/integrations/mcp` (MCP action catalog)
- `/llm-providers` (LLM Provider Registry)
- `/governance-app/data|user-access|operational|security` (the 4 governance domains)

The v1 frontend requirements still apply (no regressions on those).

## 10. Product areas NeureCore must expose (v2 final list)

Replace v1 §6 with this definitive list of 27 product areas. Each must be navigable, testable, and reachable from the existing `cc.neurecore.com` admin shell or the `hq.neurecore.com` tenant shell.

**Admin (`cc.neurecore.com`)**

1. AI Command Center
2. Agent Catalog (template pool)
3. Agent Designer
4. Agent Sandbox
5. Coding Agent SDK Bridge
6. LLM Provider Registry
7. Integrations Registry (MCP / API / Webhook)
8. AI Observability & Governance Console
9. Compliance Posture Center
10. Governance Application (data / user-access / operational / security)
11. Audit Center
12. Environment Management
13. Marketplace
14. Harness Control Center (Phase 10)

**Tenant (`hq.neurecore.com`)**

15. AI Twin (My Agents)
16. Twin Wizard (4 steps)
17. Sales AI (11 agents)
18. Marketing AI (5 agents + landing pages + events)
19. Service AI (5 agents + 360° view + SLA + field)
20. Workflow AI (productivity agents)
21. Routine Builder
22. Workflow Builder
23. App / UI / Process Designer (Business Studio)
24. Reports & Dashboards
25. Composable Library
26. Always-on CRM (Freedom UI / Productivity Tools / Conversational CRM)
27. Mobile Companion entry

## 11. Phase plan (delta from v1)

v1 §9 listed phases A–J. v2 reframes these as **delta phases on top of v3 P-1 → P9**:

- **Phase A — Governance and inventory** ✅ (this document completes the inventory)
- **Phase B — AI Command Center** ✅ core (per v1 §9A)
- **Phase C — Agent builder** ✅ core (per v1 §9A); visual skill graph remains
- **Phase D — Sales / Marketing / Service families** (replace v1 9.D with the explicit agent lists in §5.6 / §5.7 / §5.8)
- **Phase E — Workflow and routines** ✅ core
- **Phase F — App / UI / process generation (Business Studio)** (v2-new dedicated phase)
- **Phase G — Omnichannel, integrations, MCP, mobile** (v2 expands; includes Outlook/Teams/Zoom/voice/video)
- **Phase H — Observability and governance** (v2 expands with 6 sub-areas + Governance app)
- **Phase I — HITL and policy hardening** (v2 adds compliance posture)
- **Phase J — Verification and parity audits** (drives the v3 P9 program)

Each v2 phase inherits its gate from the corresponding v3 P-n phase. Where a v2 phase has no v3 counterpart (F — Business Studio), create a v3 P10 candidate before kicking off the build.

## 12. Definition of done (delta from v1)

Add to v1 §10:

- [ ] All 11 Sales agents, 5 Marketing agents, 5 Service agents, 5 Workflow agents, 1 Universal agent are first-class in `agents-pool` and can be cloned, configured, sandboxed, and deployed per tenant.
- [ ] AI Twin product area is navigable from the tenant home; the 4-step wizard produces a personal agent whose envelope carries `actorUserId` and inherits user role/tenant.
- [ ] Business Studio product area is navigable; App, UI, Process designers ship at least one production-quality template each.
- [ ] Governance application is navigable; 4 governance domains (data / user-access / operational / security) ship with at least 3 predefined controls each.
- [ ] Always-on CRM triad is navigable; Outlook/Teams/Zoom/Calendar embed entry points exist.
- [ ] LLM Provider Registry exists; per-tenant model binding is enforced; BYO-LLM is documented.
- [ ] MCP action catalog is published; at least the existing connectors are described in MCP schema.
- [ ] Compliance posture page exists for GDPR, SOC, HIPAA, ISO, EU AI Act.
- [ ] All v3 P-1 → P9 gates are green; integrity baseline contains zero unresolved critical/high findings; this plan is no longer a build plan but a maintenance matrix.

## 13. Completed implementation log (carry-over from v1 §9A, additive entries)

Existing v1 §9A entries stand. Additive entries from v2 (per `creatio-ai-parity-implementation-plan-v1.md` §9A and 2026-08-03 completion notes):

- Tenant command-center tab summary KPI + governance/cost strip
- Tenant observability tab — real latency / request / error / cost / trace data
- Tenant command-center kill-switch UI (process, phase, channel, tenant-feature)
- Tenant command-center audit correlation panel with filtering and refresh
- Tenant observability + command-center auto-refresh (30 s)
- Tenant command-center security feed severity filter
- Tenant routine inspector trigger metadata + run history
- Tenant workflow inspector execution volume, success rate, starter config
- Workflow module recent execution-history records
- Tenant workflow inspector recent outcomes, durations, failure detail
- Package deployment service explicit deployment audit records
- Admin tenant deploy recent package deployment history
- Tenant routine inspector resume/cancel controls
- Tenant workflow inspector mark-running-complete/failed controls
- Tenant goal inspector lifecycle controls (complete, reopen, pause, resume, archive)

The full v1 §9A list is preserved verbatim in §13A below for traceability.

### 13A. Full v1 §9A carry-over (preserved verbatim)

The following concrete parity tasks are completed in code as of 2026-08-03 (per v1 §9A):
- AI employee pool admin page
- Structured no-code agent template designer
- Agent deploy-to-tenant flow
- Agent sandbox execution endpoint
- Agent sandbox admin modal
- Agent sandbox prompt presets
- Agent sandbox model override
- Agent sandbox reset action
- Agent sandbox tool-plan copy action
- Agent sandbox server-side persistence through audit log
- Agent sandbox history listing
- Agent sandbox comparison endpoint
- Agent sandbox comparison UI
- Agent sandbox comparison tool-plan diff view
- Department control room page
- Department control room live KPI panels
- Department control room workflow quick execute
- Department control room approval approve/reject actions
- Department control room mission feed dismiss
- Department control room live event-bus refresh wiring
- Department control room incremental workflow / approval / task / mission / agent telemetry updates
- Department control room live telemetry payload normalization
- Department control room live notification telemetry panel and alert counter
- Department control room workflow stage-label telemetry
- Department control room dismissible live alerts and severity filtering
- Department control room persists dismissed live alerts per department session
- Workflow socket layer richer stage / status / name payloads
- Workflow progress / detail socket events
- Workflow execution completion / failure endpoint and terminal telemetry events
- Department control room clear-dismissed alert control
- Tenant routines workspace
- Service desk approval rejection modal
- Marketplace / package composer governance summary
- Package composer selected-only filter
- Package composer bulk select visible
- Package composer clear selected
- Package composer removable selected chips
- Package preview rule engine
- Package preview conflict / dependency / recommendation UI
- Package composer recommendation acceptance audit logging
- Package recommendation acceptance history endpoint
- Package recommendation acceptance history UI in composer preview
- Package recommendation dismiss / override audit endpoint with reason capture
- Package recommendation dismiss / override UI with reason capture
- Package recommendation history action badges and suggested-feature diff rendering
- Package recommendation audit summary counters in composer preview
- Package recommendation snooze / apply-later audit endpoint with reason and resume date
- Package recommendation snooze / apply-later UI with reason and resume date
- Package recommendation history filtering and expandable audit-detail panels
- Package recommendation history active-snooze summary visibility
- Package recommendation overdue-snooze visibility and filtering

## 14. Living capability matrix (operational)

v1 §11 proposed converting this plan into a living capability matrix. v2 formalizes that proposal:

- One row per capability in §5.
- Required columns: `capability_id`, `creatio_source_url`, `creatio_behavior`, `neurecore_evidence_path`, `status`, `gap`, `owner`, `target_phase`, `verification_status`.
- The matrix lives in `memory-bank-arc/comms/creatio-ai-parity-matrix.yaml` (to be generated from §5).
- v3 P-1 → P9 gates are computed from this matrix.
- The matrix is the contract that any future re-fetch of the Creatio surface modifies through a delta backlog, not a silent rewrite.

## 15. Honest scope statement

This plan reflects the capabilities publicly described on the official Creatio pages re-fetched on **2026-08-04**. Creatio can change its product surface at any time. v2 supersedes v1; future re-fetches should be applied as a delta backlog against v2 rather than a fresh document.

The two facts we cannot honestly assert today are:
1. Several v2 capabilities are ⬜ not started.
2. Several v2 capabilities are 🟡 partial and cannot be certified as functional without further work.

Both states are recorded explicitly in §5. Both are non-blocking for the plan itself; the plan's job is to be a faithful inventory and a delivery contract, not a marketing claim.

## 16. v3 P-1 → P9 alignment

v2 makes the following additions to the v3 P-1 → P9 program:

- **P-1 (Integrity)** — add a stub/fallback audit for the new AI Twin, Business Studio, and Governance App surfaces; add the missing Wildcard tenant bypass scan for those surfaces.
- **P0 (Baseline / RTM)** — regenerate the baseline from v2 §5 (≈120 rows, not 25).
- **P1 (Assistant)** — add the AI Twin permission mirror to the P1 negative suite.
- **P2 (Files / knowledge)** — no new work; align with v2 5.8 / 5.9.8 / 5.7.
- **P3 (Meetings)** — no new work.
- **P4 (Agents)** — add explicit per-agent certification gates for the 11 Sales / 5 Marketing / 5 Service / 5 Workflow / 1 Universal agents.
- **P5 (Predictions)** — add a "v2 agent depends on prediction" check.
- **P6 (No-code)** — v2 §7.18 and §7.14 collapse here. Add a candidate **P10 — Business Studio** for the prompt-to-app / UI / process / ALM / DevOps work, since v3 P6 was scoped to agent skills.
- **P7 (Channels)** — add Outlook / Teams / Zoom / Voice / Video / MCP / Mobile.
- **P8 (Command Center)** — add the 6 Observability sub-areas and the 4 governance domains; add the Compliance Posture Center.
- **P9 (Certification)** — regenerate the scenario matrix from v2 §5.

## 17. Owner / priority backlog (proposed)

| Priority | Capability | Owner (proposed) | Phase | Notes |
|---|---|---|---|---|
| P0 | Inventory matrix from v2 §5 (yaml) | Product Eng | P0 | Blocking P9 |
| P0 | LLM Provider Registry + BYO-LLM | Platform Eng | P-1 / P8 | Blocks every agent in production |
| P0 | AI Twin permission mirror | Platform Eng | P-1 / P1 | Blocks AI Twin GA |
| P0 | Compliance posture page (5 standards) | Security Eng | P8 | Document scope; no cert |
| P1 | Sales 11 agents (every one of them) | Domain Eng | P4 | Direct parity |
| P1 | Service 5 agents + 8 platform extras | Domain Eng | P4 / P7 | Direct parity |
| P1 | Marketing 5 agents + 5 platform extras | Domain Eng | P4 / P7 | Direct parity |
| P1 | Always-on CRM triad (3 navigable pages) | UX Eng | P1 / P7 | Direct parity |
| P1 | Business Studio (App / UI / Process / ALM) | Studio Eng | P10 (new) | Largest v2 delta |
| P1 | Governance application (4 domains) | Gov Eng | P8 | Direct parity |
| P2 | Coding Agent SDK Bridge | Platform Eng | P6 | v2 new |
| P2 | MCP action catalog | Platform Eng | P7 | v2 new |
| P2 | Visual skill graph editor | Studio Eng | P6 | v2 new |
| P2 | Mobile companion + omnichannel authoring | Mobile Eng | P7 | v2 new |
| P3 | Voice / Video / SMS / Zoom providers | Integrations | P7 | v2 new |
| P3 | Codegen for prompt-to-app / UI / process | Studio Eng | P10 | v2 new |

(Provisional; confirm owners in the Steering Gate before kicking off P0.)
