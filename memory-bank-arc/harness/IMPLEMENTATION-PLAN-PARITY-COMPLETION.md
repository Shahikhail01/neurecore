# NeureCore Creatio AI Parity — Completion Implementation Plan (P22 → P30)

**Document:** NC-PLAN-PARITY-COMPLETION
**Date:** 2026-08-07
**Baseline:** `neurecore/memory-bank-new/docs/parity-v3/creatio-parity-baseline.yaml` v1.0.0
**Sign-off audit:** `neurecore/memory-bank-arc/harness/SIGNOFF-MATRIX.md` (2026-08-07)
**Goal:** move **all 20 IN_PROGRESS** capabilities to **shipped-live CERTIFIED** (65/65), then close the depth backlog — with **100 % SOLID** architecture and an automated SOLID guard that blocks non-SOLID merges.

> Honesty principle: this plan does not "re-label" seams as done. Every
> capability moves to CERTIFIED only when a real, gate-tested, functional
> implementation exists and no documented functional gap remains. Human-owner
> sign-off is the final gate on top of engineering completion.

---

## 0. Executive summary

| Phase | Capabilities | Domain | Headline outcome |
|---|---|---|---|
| **P22** | CR-AI-0003, CR-AI-0004 | Chat | Export byte-download route + full multilingual handling |
| **P23** | CR-AI-0501..0506 | Agents | Real agent runtime execution (route / clarify / never-bypass-permissions) |
| **P24** | CR-AI-0602 | Agents | Visual skill composer (node-and-edge editor) |
| **P25** | CR-AI-0401..0404 | Meetings | Live call-graph ingestion + write-back to CRM |
| **P26** | CR-AI-0703 | Sales | Deal model + weighted pipeline forecast |
| **P27** | CR-AI-1103, 1104, 1106 | Channels | Live Outlook / Teams / HubSpot / Salesforce wiring |
| **P28** | CR-AI-1107 | Mobile | Full mobile FE integration |
| **P29** | CR-AI-1304 | Platform | WCAG 2.2 AA audit + localization |
| **P30** | CR-AI-1305 | Platform | Per-tenant cost ceiling + resilience dashboard |
| **Sign-off** | all | cross-cutting | Owner teams lock CERTIFIED in the register |

Run in dependency order (P23 and P24 are the long poles; P22/P26/P28/P29 are independent and can land in parallel after P25's schema is set).

**Definition of done for the whole program:** `SIGNOFF-MATRIX.md` shows 65 CERTIFIED (or intentionally OUT_OF_SCOPE), every phase gate runner P22..P30 APPROVED, and `nest build`, `tsc`, `routes:scan`, `tenancy:scan`, and the new SOLID guard all exit 0.

---

## 1. Current state (from the 2026-08-07 audit)

| Status | Count | Notes |
|---|---:|---|
| CERTIFIED | 44 | real impl + gate-tested + no functional gap |
| IN_PROGRESS | 20 | real impl but a documented functional gap — this plan's target |
| OUT_OF_SCOPE | 1 | Slack (Product decision) |
| **Total** | **65** | |

The 20 to complete (with the specific gap each plan closes):

| Cap | Owner | Gap to close | Phase |
|---|---|---|---|
| CR-AI-0003 | @chat-product | export byte-download admin route | P22 |
| CR-AI-0004 | @chat-product | full multilingual model handling (not just localizer) | P22 |
| CR-AI-0501..0506 | @agents | agent runtime execution, not just registry surface | P23 |
| CR-AI-0602 | @agents | visual node-and-edge composer | P24 |
| CR-AI-0401..0404 | @meetings | live call-graph ingestion + write-back | P25 |
| CR-AI-0703 | @analytics | Deal model + weighted forecast | P26 |
| CR-AI-1103/1104/1106 | @integrations | live OAuth + upstream adapters | P27 |
| CR-AI-1107 | @frontend | mobile FE wiring to the matrix | P28 |
| CR-AI-1304 | @frontend | WCAG 2.2 AA audit | P29 |
| CR-AI-1305 | @platform | per-tenant cost ceiling + dashboard | P30 |

---

## 2. SOLID engineering standard (100 % mandatory)

Every new or edited unit must satisfy all five principles. The standard is enforced by **three automated source-scan guards** (mirroring the existing `SkillRegistryImplementsFlag`, `AgentRegistryImplementsFlag`, and `platform-integrity-guard.spec.ts`).

| Principle | Rule (what the guard checks) |
|---|---|
| **SRP** | One type per file; a class has one responsibility and one reason to change. Guard: no class > 400 LOC; no file mixes two domain verbs in its name. |
| **OCP** | Behavior extended by adding types, never by editing existing method bodies. Guard: registry keyed by `enum | const` — adding a provider/skill/stage = one constant + one branch. |
| **LSP** | Every subtype is substitutable for its interface. Guard: all concrete providers/skills/adapters implement the canonical interface and compile against it (structural `satisfies`), never a super-typed fat base. |
| **ISP** | Narrow interfaces; a consumer depends on only the surface it uses. Guard: no interface > 5 methods; a service injects `I{X}`, `I{Y}` separately, not `I{XAndY}`. |
| **DIP** | Depend on abstractions, inject dependencies; no `new` of a collaborator, no direct Prisma/LLM calls inside domain code. Guard: domain files import only interfaces + a single injected `PrismaService` / `AiGatewayService` token. |

**New guard:** `parity-completion/solid-integrity-guard.spec.ts` — a jest source-scan spec that fails CI if any of the P22–P30 new files violates the rules above (reads source at test time, like the existing integrity guards). This is the enforcement that "100 % SOLID" is real, not aspirational.

**Universal seams to reuse (no redesign needed):**
- Skill dispatch: `SkillRegistry` + `SkillExecutor` + `ISkill<I,O>` + `SkillTelemetry` (P11).
- Provider brain swap: `IPredictionProvider` / `IProvider` + `LlmModelRunner` (P21) behind a feature flag.
- Tenant scope: `AgentTenantScopeGuard` + `assert(tenantId)` on every public mutating method.
- Evidence: `AuditService` append-only rows + `AuditEvidenceCorrelationService` chains.
- Error taxonomy: typed errors (`SkillAbstainedError`, `SkillAuthorizationError`, `SlackOutOfScopeError`, `LlmOptedOutError`, `MeetingConsentRequiredError`) — new code must add typed errors, never throw `new Error('...')`.

---

## 3. Phase P22 — Chat export bytes + multilingual handling (CR-AI-0003, CR-AI-0004)

### Capabilities
- **CR-AI-0003** Conversation history export/delete/audit — close the byte-download route.
- **CR-AI-0004** Multilingual input/output — full model handling.

### SOLID design
- **SRP** `ChatExportController` (HTTP only) → `ChatExportService` (orchestration) → `ChatExportFileRenderer` (CSV/MD/JSON bytes) → `ChatExportAuditSink` (append-only evidence).
- **OCP** export format = `Map<ExportFormat, IFileRenderer>`; adding PDF = one renderer + one enum member.
- **LSP** all renderers implement `IFileRenderer { render(rows): Buffer }`; controller is format-agnostic.
- **ISP** `IExportAuthorizer` (tenant/role check) ≠ `IFileRenderer` (bytes) ≠ `IAuditSink` (evidence).
- **DIP** controller injects interfaces only; bytes come from renderers, never assembled in the controller.

### Tasks
1. `ChatExportController` admin route `GET /admin/chat/:conversationId/export?format=csv|md|json` (deployment-guarded).
2. `ChatExportFileRenderer` interface + 3 concrete renderers (reuse existing typed export pipeline's row shape).
3. Wire `ChatExportAuditSink` for `chat.export.{created,deleted,downloaded}` (reuse existing service).
4. Multilingual: `IMultilingualHandler` on the chat response path — locale negotiation (existing localizer) + model instruction envelope (preserve entities/dates/currency) + fallback when the model locale is unsupported.
5. FE: enable the already-present download button to call the new route.

### Verification
- G22 gate (8 gates): renderers produce byte-correct CSV/MD/JSON; tenant-foreign conversation export → 404/Forbidden; audit rows written for create/download; multilingual handler preserves currency/date/entity verbatim across `en|es|fr`.

### Dependency / estimate
- Independent. ~1 engineer-week.

---

## 4. Phase P23 — Real agent runtime execution (CR-AI-0501..0506)

### Capabilities
- **CR-AI-0501** Universal agent (route, clarify, never bypass permissions)
- **CR-AI-0502** Productivity agent
- **CR-AI-0503** Sales agent
- **CR-AI-0504** Marketing agent
- **CR-AI-0505** Service agent
- **CR-AI-0506** Knowledge agent

### The gap
G13 certifies the **registry/template surface** (`AgentRegistry`, 6 `IAgentDefinition` entries, `GET /agents`). The **agent runtime that actually executes a request through the agent graph** is not wired. This is the largest single gap and the one that most inflates past parity claims.

### SOLID design
- **SRP** `AgentRouter` (route intent → agent) ≠ `AgentRuntime` (execute a run) ≠ `IAgentStep` (one graph step) ≠ `AgentRunStore` (persist run + telemetry). The 6 `IAgentDefinition`s remain declarative templates.
- **OCP** `AgentRegistry` gains `Map<AgentId, IAgentExecutor>`; a 7th agent = one executor + one registry key. The 6 existing templates are translated into executors, not edited.
- **LSP** every executor implements `IAgentExecutor { execute(ctx): Promise<AgentRunResult> }`; the runtime invokes executors uniformly and never special-cases an agent.
- **ISP** narrow step contracts: `IClarifyStep`, `ISearchStep`, `IDraftStep`, `IWriteStep`, `IScoringStep` — no fat `run(ctx)` on a god interface.
- **DIP** executors receive injected `AiGatewayService`, `SkillRegistry`, `AuditService`, and tenant-scope guard — no direct Prisma, no `new` collaborators.

### Runtime contract (reuses P11 skill seam)
```
AgentRequest → AgentRouter (intent + tenant scope) → AgentRuntime
   → AgentRunStore.openRun(tenantId, agentId, request)
   → [IAgentStep*] (route → clarify → search/skill → draft → write)
   → every mutating write goes through SkillRegistry/dispatch (approval-gated)
   → AgentRunStore.closeRun(evidence chain)
```
`never-bypass-permissions` is enforced by `AgentTenantScopeGuard` on every step and every write.

### Tasks
1. `IAgentExecutor` interface + executor per agent (UNIVERSAL, PRODUCTIVITY, SALES, MARKETING, SERVICE, KNOWLEDGE), delegating to existing skills (`summarize`, `rewrite`, `extract`, `segment`, `case-resolve`, `knowledge-health`, …).
2. `AgentRuntime` orchestrator + `AgentRunStore` (new `agent_run` table: id, tenantId, agentId, status, evidence chain).
3. `AgentRouter` intent resolution + clarification loop (typed, permission-safe).
4. Approval gate for mutating writes (reuse approval chains).
5. Extend `agents.controller.ts` with `POST /agents/:id/run` (tenant-scoped).
6. Update `AgentRegistryImplementsFlag` to require an executor (not just a template) for each of 0501..0506.

### Verification
- G23 gate (10 gates): each agent executes a real request end-to-end; tenant-foreign request → Forbidden; unsupported intent → typed clarification (never silent success); mutating write requires approval; run leaves an append-only evidence chain; registry guard fails if any agent lacks an executor.

### Dependency / estimate
- Depends on P21 LLM wiring + P11 skills (both done). **~6–8 engineer-weeks** — the long pole. Do not skip; this is the difference between "templates" and "shipped-live agents".

---

## 5. Phase P24 — Visual skill composer (CR-AI-0602)

### Capability
- **CR-AI-0602** Visual skill composer (workflow + chat mode)

### The gap
`marketplace/composer/page.tsx` is a ~166-line typed skeleton (typed graph save/load only). No node-and-edge visual editor.

### SOLID design
- **SRP** FE: `SkillComposer` (page) → `SkillGraphEditor` (canvas) → `SkillNodeDefs` (typed node registry) → `SkillGraphStore` (state + save/load). BE: `SkillGraphService` (persist/validate a typed `SkillGraph`) stays unchanged (it already exists).
- **OCP** adding a new node type = one `SkillNodeDef` entry in `SkillNodeDefs`; no editor switch-case edits.
- **LSP** all node defs implement `ISkillNodeDef { type, ports, render, validate }`; the editor renders any def uniformly.
- **ISP** `IDragAndDrop`, `IEdgeConnection`, `IGraphValidation` are separate narrow concerns.
- **DIP** FE talks to `SkillGraphService` via an injected client; BE is fully SOLID already — this phase is a thin FE-only addition.

### Tasks
1. `SkillGraphEditor` node-and-edge canvas (use existing graph state model; no new BE schema).
2. `SkillNodeDefs` typed registry seeded with the 7 skills' invocation shapes (from `skill-registry.controller.ts` metadata).
3. Wire save → existing `SkillGraphService`; load → hydrate editor.
4. Live LLM preview: node output preview via `POST /skills/:id/preview` (reuse `AiGatewayService`, approval-gated, never mutating).
5. Accessibility-first (reuse `frontend-tenant/src/shared/a11y`).

### Verification
- G24 gate (8 gates): create ≥3 node types; connect edges; validate graph; save persists; load restores; preview returns non-mutating output; no LLM call without tenant scope; FE `tsc` exit 0.

### Dependency / estimate
- Depends on P11 skill registry metadata (done). **~8–12 engineer-weeks** for a real editor — the second long pole (matches PENDING-BACKLOG's own estimate).

---

## 6. Phase P25 — Meetings live (CR-AI-0401..0404)

### Capabilities
- **CR-AI-0401** Transcript ingestion (live call-graph) — close live Outlook/Teams cutover
- **CR-AI-0402** Summary templates (live editor)
- **CR-AI-0403** Action items (owner auto-resolution)
- **CR-AI-0404** CRM linkage + write-back to live records

### SOLID design
- **SRP** `ITranscriptProvider` (per channel: Outlook/Teams/Zoom) ≠ `TranscriptIngestionService` (consent + idempotent upsert) ≠ `ActionExtractorService` ≠ `CrmLinkerService` (all already real).
- **OCP** a 4th live provider = one `ITranscriptProvider` + one registry entry (registry already exists).
- **LSP** each provider substitutes `ITranscriptProvider`; the ingestion service is provider-agnostic.
- **ISP** `IOutlookCallGraph` ≠ `ITeamsCallGraph` ≠ `IZoomTranscriptApi` — no fat provider interface.
- **DIP** the ingestion service injects `ITranscriptProvider` tokens + `MeetingConsentService` + `CrmLinkerService`; no direct Graph SDK calls outside providers.

### Tasks
1. `OutlookCallGraphProvider` + `TeamsCallGraphProvider` implementing `ITranscriptProvider` (consent-verified, idempotent by `(tenantId, provider, providerMeetingId)`).
2. Live `ITranscriptProvider` registry wiring (reuse the existing registry seam).
3. `ActionExtractorService` owner auto-resolution against real user records (`@owner` → user account lookup).
4. `CrmLinkerService` write-back to live CRM records (tenant-scope checked per target).
5. Summary template per-meeting-type live editor surface (BE `SummaryTemplatesService` already real; add admin FE).

### Verification
- G25 gate (10 gates): live provider ingests a fixture meeting; consent required + revoked → rejected; idempotent replay; owner auto-resolution resolves real users / flags ambiguous; write-back updates the correct tenant-scoped CRM record; all existing G16 gates stay APPROVED.

### Dependency / estimate
- Depends on P16 services (done) + P27 Graph credentials (deployment-side). **~3–4 engineer-weeks** + OAuth provisioning.

---

## 7. Phase P26 — Deal model + forecast (CR-AI-0703)

### Capability
- **CR-AI-0703** Forecast with interval + backtesting — weighted pipeline forecast on a real Deal model.

### SOLID design
- **SRP** `Deal` Prisma model + `DealRepository` (read/aggregate) ≠ `ForecastProvider` (compute) — provider already real.
- **OCP** forecast source becomes an interface `IForecastSource`; today `QuoteAggregateSource`, new `DealPipelineSource`; adding a source = one implementation, no provider edits.
- **LSP** `DealPipelineSource` and `QuoteAggregateSource` both substitute `IForecastSource`; the provider consumes `source.load(tenantId, window)`.
- **ISP** `IForecastSource` is narrow (one load method); weighted-stage metadata is a separate `IDealStage` const map.
- **DIP** `ForecastProvider` injects `IForecastSource` (DI token), not Prisma directly.

### Tasks
1. Add `Deal` model + migration (stage, amount, probability, closeDate, tenantId) — additive.
2. `IForecastSource` + `DealPipelineSource` (weighted: Σ amount × stage-probability) + keep `QuoteAggregateSource` for back-compat.
3. Wire `ForecastProvider` to the source registry; weighted pipeline forecast + interval + backtest.
4. Surface deals screen already exists (`frontend-tenant/src/app/deals/`) — wire forecast read to the Deal source.

### Verification
- G26 gate (8 gates): weighted forecast matches Σ(amount×prob); backtest harness runs; source registry returns the Deal source; tenant isolation on Deal queries; `QuoteAggregateSource` still passes old tests.

### Dependency / estimate
- Independent of P25/P27. **~1–2 engineer-weeks.**

---

## 8. Phase P27 — Live channels (CR-AI-1103, 1104, 1106)

### Capabilities
- **CR-AI-1103** Outlook email + calendar — live OAuth cutover
- **CR-AI-1104** Microsoft Teams — live graph + meeting-summary live
- **CR-AI-1106** CRM/commerce event-triggered skills — HubSpot/Salesforce upstream adapters

### SOLID design
- **SRP** each live connector = one adapter: `OutlookGraphAdapter`, `TeamsGraphAdapter`, `HubSpotAdapter`, `SalesforceAdapter` — replacing the STUB/PRODUCTION-BLOCKED markers in `connectors/adapters/`.
- **OCP** `IConnectorAdapter` registry keyed by connector type; adding a 5th CRM source = one adapter + one key.
- **LSP** every adapter substitutes `IConnectorAdapter` (auth + event push/pull); the `CrmEventTriggerService` is adapter-agnostic.
- **ISP** `IOAuthProvider` ≠ `ITokenRefresher` ≠ `IEventPublisher` ≠ `IEventIngestor` — narrow contracts (reuse P4 seams).
- **DIP** adapters depend on injected credential store (`integration-credential.store.ts`) + typed HTTP clients; credentials never in code.

### Tasks
1. Replace stub `HubSpotAdapter` / `SalesforceAdapter` with real typed HTTP clients behind `IConnectorAdapter` (tenant-scoped, idempotent `eventId`, webhook secret rotation).
2. Wire Outlook `microsoft-graph.module.ts` OAuth to live (deployment-side credential provisioning documented in runbook).
3. Wire Teams `teams-adapter.service.ts` live meeting-summary path (reuse P25 call-graph provider).
4. Register adapters in `CrmEventTriggerService`; delete STUB/PRODUCTION-BLOCKED markers.
5. Update `phase20`/`channels` certification to assert live (not stub) adapters.

### Verification
- G27 gate (10 gates): OAuth flows with real credential store; hubspot/salesforce adapters make tenant-scoped, idempotent calls; webhook signature verified; Teams meeting summary ingests; `connectors/adapters` has zero STUB/PRODUCTION-BLOCKED markers.

### Dependency / estimate
- Depends on P25 (Teams call-graph) + deployment credentials. **~3–5 engineer-weeks** engineering + OAuth/consent provisioning.

---

## 9. Phase P28 — Mobile FE (CR-AI-1107)

### Capability
- **CR-AI-1107** Mobile assistant with declared support matrix — wire the shell to `MobileSupportMatrix`.

### SOLID design
- **SRP** `MobileShell` (layout/viewport) ≠ `MobileActionGate` (consume `MobileSupportMatrix` and gate actions) ≠ `MobileNav` (navigation) — `MobileSupportMatrix` is already typed and real.
- **OCP** a new mobile action = one row in the matrix; the gate reads the matrix, no hard-coded branch per action.
- **LSP** the gate and desktop gate both implement a common `IActionGate`; the app selects by viewport.
- **ISP** `IActionGate { isAllowed(action, ctx) }` is narrow.
- **DIP** FE depends on the injected matrix client, not a hard-coded list.

### Tasks
1. `MobileActionGate` reads `MobileSupportMatrix`; gate every declared backend-only action by viewport.
2. `MobileShell` responsive layout wiring (reuse a11y primitives).
3. Declared mobile-only actions (per matrix) surfaced in the mobile nav.

### Verification
- G28 gate (8 gates): on mobile viewport, matrix-allowed actions render and matrix-blocked actions are hidden; desktop unaffected; FE `tsc` exit 0.

### Dependency / estimate
- Independent. **~2–3 engineer-weeks.**

---

## 10. Phase P29 — WCAG 2.2 AA (CR-AI-1304)

### Capability
- **CR-AI-1304** Accessibility WCAG 2.2 AA + localization — full audit-by-tooling.

### SOLID design
- **SRP** an `A11yAuditRunner` (tooling) ≠ `A11yFixPatch` per violation type; reuse existing `frontend-tenant/src/shared/a11y` primitives (`useFocusTrap`, `LiveAnnouncer`, `srOnlyStyle`).
- **OCP** violation fixes are keyed by WCAG criterion; adding a criterion check = one audit rule, no runner edits.
- **ISP** `IKeyboardTrap`, `IAnnouncer`, `IContrastRule` are narrow audit interfaces.
- **DIP** the audit runner injects rule implementations.

### Tasks
1. Add `axe-core`-based audit runner to CI on the tenant + admin apps.
2. Fix violations surfaced (focus order, contrast, aria, labels) reusing a11y primitives.
3. Localization correctness pass (time-zone/currency across locales).

### Verification
- G29 gate (8 gates): axe audit runs with 0 critical/serious violations on key screens (chat, customers, projects, command-center, skills, meetings); no regressions on existing screens.

### Dependency / estimate
- Independent. **~1–2 engineer-weeks** + fix iteration.

---

## 11. Phase P30 — Resilience + per-tenant cost ceiling (CR-AI-1305)

### Capability
- **CR-AI-1305** Resilience + rate/cost controls — per-tenant cost ceiling + dashboard.

### SOLID design
- **SRP** `CostCeilingService` (enforce per-tenant `LLM` + total spend caps) ≠ `SloCounters` (count/rate) ≠ `CostDashboard` (read). Reuse `CostCentsService` (cents-typed) + `SloCounters` + `AuditService`.
- **OCP** ceiling rules = `Map<CostDimension, ICeilingRule>`; a new dimension = one rule.
- **LSP** all ceiling rules implement `ICeilingRule { exceeds(usage): boolean }`; the enforcement point is rule-agnostic.
- **ISP** `IUsageReporter` ≠ `ICeilingRule` ≠ `IAlertSink`.
- **DIP** the enforcement interceptor injects `CostCeilingService` via a DI token, not a global.

### Tasks
1. `CostCeilingService` + per-tenant cost/rate ceiling enforcement (reuse `LlmModelRunner` spend hook + `CostCentsService`).
2. `ICeilingRule` registry (per-capability LLM opt-in already exists; add spend cap).
3. `CostDashboard` surface in Command Center (admin FE).
4. Kill-switch integration: exceeding ceiling → typed `CostCeilingExceededError` → gate the LLM call.

### Verification
- G30 gate (10 gates): ceiling hit → LLM call denied with typed error; below ceiling → proceeds; cents integer-safe; dashboard reads real cost rows; kill switch trips; all G14 CC gates stay APPROVED.

### Dependency / estimate
- Independent. **~1–2 engineer-weeks.**

---

## 12. Cross-cutting — human-owner sign-off (all)

After P30 engineering, the register still needs the **owner teams** (`@chat-product`, `@skills`, `@knowledge`, `@agents`, `@command-center`, `@meetings`, `@analytics`, `@platform`, `@marketing`, `@service`, `@integrations`, `@frontend`) to sign off `SIGNOFF-MATRIX.md` per capability. This is a **people process**, not code, and is the explicit final gate before any public parity claim.

### SOLID applies to the process too
- **SRP** the matrix is the single sign-off source; no parallel spreadsheets.
- **OCP** adding a sign-off = a row update, no new process.
- **LSP / ISP / DIP** each owner reviews only their domain caps.

---

## 13. Global acceptance gates (run per phase, all must be green)

```bash
cd backend
./node_modules/.bin/jest --config jest.config.js \
  src/test/certification/g2X-<phase> \        # phase gate runner
  src/test/certification/parity-completion/solid-integrity-guard \
  src/test/certification/skill-registry-integrity \
  src/test/certification/agent-registry-integrity \
  src/test/certification/platform-integrity-guard
./node_modules/.bin/nest build                 # exit 0
pnpm routes:scan                               # 0 collisions
pnpm tenancy:scan                              # 0 unsafe
cd ../frontend-tenant && npx tsc --noEmit       # exit 0
```

Each phase: **no regression** of the prior G11..G21 gates (the runners are cumulative).

---

## 14. Dependencies & sequencing

```
P22 (export+multilingual) ─┐
P26 (Deal/forecast)       ─┼─ independent — can land in parallel
P28 (mobile FE)           ─┤
P29 (WCAG)                ─┘
P25 (meetings live) ──────────────── depends on: P27 Graph credentials (deployment)
P27 (channels live) ───────────────── depends on: P25 Teams call-graph + OAuth creds
P23 (agent runtime) ───────────────── depends on: P21 LLM + P11 skills (done)  [LONG POLE]
P24 (visual composer) ─────────────── depends on: P11 skill metadata (done)      [LONG POLE]
P30 (cost ceiling) ────────────────── independent (uses P21 runner)
Sign-off ──────────────────────────── after all engineering
```

Suggested delivery order to de-risk: **P22 + P26 + P28 + P29 first (fast wins), then P25, then P23 and P24 in parallel (long poles), then P27 + P30, then sign-off.**

---

## 15. Estimates & risk

| Item | Estimate | Risk / note |
|---|---:|---|
| P22 export+multilingual | 1 wk | low |
| P23 agent runtime | 6–8 wk | **high** — largest gap; scope-control to the 6 agents |
| P24 visual composer | 8–12 wk | **high** — second largest; consider MVP (2 node types) first |
| P25 meetings live | 3–4 wk | med — OAuth provisioning is deployment-side |
| P26 Deal forecast | 1–2 wk | low |
| P27 channels live | 3–5 wk | med — real upstream adapters, secret rotation |
| P28 mobile FE | 2–3 wk | low |
| P29 WCAG | 1–2 wk | low-med — fix iteration |
| P30 cost ceiling | 1–2 wk | low |
| **Engineering total** | **~27–41 wk** | sequential; ~14–20 wk if P23/P24 parallel |
| Owner sign-off | process | people-time; do not assume |

**Top risks**
1. **P23 scope creep** — an agent runtime that tries to do everything. Mitigate: each agent = route → skill(s) → write, reusing existing skills; no new cognitive stack.
2. **P24 UX expectation** — "visual composer" is a big UI. Mitigate: ship a working MVP (drag node, connect, save, preview) before polish.
3. **Live-provider credentials** — Outlook/Teams/HubSpot/Salesforce cutover is blocked on OAuth/consent, not code. Mitigate: document runbook steps now; parallelize with engineering.
4. **SOLID regressions** — the guard only helps if it's real. Mitigate: `solid-integrity-guard.spec.ts` runs in CI from the first PR of P22.

---

## 16. Honest outcome after this plan

- **44 → 65 CERTIFIED** (all 20 IN_PROGRESS closed) with no seams relabeled as done.
- **0 IN_PROGRESS**, **0 NOT_STARTED**, **1 OUT_OF_SCOPE** (Slack, Product decision).
- Every capability has a real, gate-tested, functional implementation and an evidence chain.
- 100 % SOLID is enforced by an automated guard, not asserted in prose.
- Final public parity claim is gated on **human-owner sign-off** of `SIGNOFF-MATRIX.md` — the one thing code cannot do for you.

---

## 17. Document control

- 2026-08-07 — created. Author: parity completion planning after the 2026-08-07 sign-off audit (`6d204b77`).
- 2026-08-08 — **P29 and P30 delivered.** G29 APPROVED (13/13), G30 APPROVED (15/15),
  `parity-completion/solid-integrity-guard-p29-p30.spec.ts` PASS (53 new files).
  CR-AI-1304 and CR-AI-1305 moved to CERTIFIED in `SIGNOFF-MATRIX.md`.
  Evidence and the honest statement of what remains open (a 342-finding
  accessibility backlog outside the six certified screens) are in
  `P29-P30-COMPLETION-REPORT.md`.
- Owner: `@planning`, `@agents`, `@chat-product`, `@integrations`, `@platform`, `@frontend`, `@meetings`, `@analytics`, `@marketing`, `@service`, `@knowledge`, `@skills`, `@command-center`.
- Supersedes the sequential P22→P32 depth list in `PENDING-BACKLOG.md` as the canonical **completion** plan; `PENDING-BACKLOG.md` remains the capability/depth backlog reference.
