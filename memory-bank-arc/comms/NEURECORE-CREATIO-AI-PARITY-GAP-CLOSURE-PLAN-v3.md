# NeureCore — Creatio AI Feature-Parity Gap-Closure Implementation Plan v3.1

**Document ID:** NC-AI-CREATIO-PARITY-V3  
**Version:** 3.1  
**Date:** 2026-08-02  
**Status:** CORRECTIVE IMPLEMENTATION GATE  
**Depends on:** `service-gateway-impv2-plan.md` and completion evidence for its Gates G0–G8  
**Purpose:** Close every presently identified gap between NeureCore AI and the officially documented Creatio.ai feature set, then establish repeatable proof of functional—not nominal—parity.

**v3.1 corrective basis:** Repository audit supplied on 2026-08-02. This revision preserves the v3 product strategy and makes the audit's integrity findings, actual starting statuses, and missing runtime ownership binding release requirements.

## 1. Executive decision

The Service Gateway v2 plan establishes the correct secure architecture for conversational reads, governed mutations, agents, skills, recommendations, predictions, channels, and tenant isolation. It does not enumerate or certify every user-visible Creatio.ai scenario. This plan supplies that missing product layer.

Completion requires all three conditions:

1. **Capability parity:** NeureCore provides an equivalent outcome for every in-scope Creatio capability.
2. **Experience parity:** The capability works through its intended real UI or channel, not only through an API or test double.
3. **Evidence parity:** Automated tests, browser evidence, audit correlation, tenant-isolation proof, performance results, and a signed verdict exist.

No percentage-based marketing claim is permitted. A capability is `CERTIFIED`, `INTENTIONAL_DIFFERENCE`, or `BLOCKED`; anything else is incomplete.

## 2. Frozen comparison baseline and change control

### 2.1 Baseline

The initial comparison baseline is the official Creatio website and Academy documentation publicly available on **2026-08-02**, including:

- unified predictive, generative, and agentic AI;
- Creatio.ai conversational experience and contextual system actions;
- AI Agents and AI Skills;
- AI Command Center;
- no-code skill composition and workflow execution;
- out-of-the-box Sales, Marketing, Service, Productivity, Email Generation, Case Resolution, Knowledge, and universal-agent scenarios;
- file processing and text-file context;
- knowledge-grounded assistance;
- Outlook and Teams embedded experiences;
- meeting summaries;
- predictive models and next-best-action scenarios;
- permissions, privacy, model configuration, monitoring, and mobile limitations.

### 2.2 Baseline register

Create `creatio-parity-baseline.yaml` with one immutable record per capability:

```yaml
id: CR-AI-0001
domain: sales
official_name: Opportunity next best action
source_url: https://...
source_version: "10.0 or page version"
captured_at: "2026-08-02T00:00:00Z"
source_hash: sha256
creatio_behavior: "Observable user outcome"
neurecore_equivalent: "Capability/agent/skill identifier"
surface: [web, contextual_action]
status: NOT_STARTED
acceptance_scenarios: [PAR-SALES-001]
intentional_difference: null
owner: null
```

The baseline is reviewed and signed before implementation. Later Creatio releases create a delta backlog; they do not silently alter this program's release gate.

### 2.3 Status rules

- `NOT_STARTED`: no implementation evidence.
- `IN_PROGRESS`: implementation exists but certification is incomplete.
- `BLOCKED`: a dependency, defect, data-quality issue, or security failure prevents certification.
- `CERTIFIED`: all mapped automated and real-surface scenarios pass.
- `INTENTIONAL_DIFFERENCE`: Product, Architecture, and Security approve a documented alternative that provides an equal or better business outcome.
- `OUT_OF_SCOPE`: prohibited unless the Steering Gate approves a justified product-scope exclusion. It cannot be counted as parity.

### 2.4 Audited implementation starting state

The following is the authoritative starting state for v3.1 until superseded by committed evidence. Existing code, schemas, framework services, or green legacy tests do not raise a phase status by themselves.

| Phase | Audited status | Binding reason |
|---|---|---|
| P0 Baseline / RTM | `NOT_STARTED` | No baseline YAML, RTM, or parity register |
| P1 Assistant / generative | `IN_PROGRESS` | Real chat panel; untyped URL-only page context; missing context chips, skills, provenance, and WCAG evidence |
| P2 Files / knowledge | `IN_PROGRESS` | Real hybrid retrieval and citations; missing production parsers, security pipeline, and upload-to-ingest UI |
| P3 Meetings | `NOT_STARTED` | No meeting-intelligence module or certified flow |
| P4 OOTB agents | `BLOCKED` | Agent framework exists; mandatory role agents and executable skill runtime are absent |
| P5 Predictions / NBA | `BLOCKED` | Model runner has no deployed service; neutral `0.5` fallback violates production rules |
| P6 No-code builder | `IN_PROGRESS` | Server lifecycle/certification exists; executable skill engine and visual composer are absent |
| P7 Channels | `IN_PROGRESS` | Google/Brevo paths exist; several connectors/channels are stubbed, coming soon, or return fake success |
| P8 Command Center | `BLOCKED` | Stub service and empty intelligence data cannot provide an operational control plane |
| P9 Certification | `NOT_STARTED` | Existing G9 runner is not the v3 RTM-driven, cross-tenant, real-surface certification layer |

Audited strengths to preserve are the typed Service Gateway v2, its architecture guards and read catalogue, the Work Runtime/Tool Registry/Governance/Agent Template foundation, AI Action Registry, routing logs, SLO counters, kill switches, real Google/Brevo integrations, and capability ownership manifest.

## 3. Non-negotiable implementation rules

1. Extend the canonical owners defined in Service Gateway v2; create no second router, agent engine, skill engine, prediction stack, approval path, knowledge store, connector registry, renderer, or credential store.
2. All reads use registered read capabilities and safe tenant-scoped projections.
3. All mutations—including emails, meetings, CRM updates, campaigns, knowledge publication, and workflow activation—use Work Runtime, governance, idempotency, approval, outbox, and evidence.
4. LLM output is untrusted. It cannot supply identity, tenant, permissions, tool effects, approval results, connector credentials, or executable code.
5. Generative output is always labeled as generated until a governed publication/send action succeeds.
6. Retrieval answers cite authorized sources; unsupported claims abstain.
7. Uploaded content is hostile input until scanned, parsed, authorized, classified, and isolated.
8. No phase passes with mocks alone. Every release scenario runs through a real application surface and production-equivalent infrastructure.
9. No feature is marked complete from UI presence, endpoint presence, code compilation, or a successful happy-path call alone.
10. Every capability has an owner, threat model, data contract, accessibility requirements, SLO, cost budget, rollback path, and evidence package.
11. Wildcard tenant execution or filtering bypasses—including `tenantId === '*'`—are forbidden in all tenant-owned application, repository, worker, cache, vector, artifact, channel, and realtime paths. Cross-tenant platform administration must use an explicit, separately authorized aggregate/query port that never reuses tenant-scoped execution semantics.
12. Architecture, tenant-isolation, duplicate-owner, provider-import, and stub scans cover the entire active codebase, including legacy directories. A test limited to v2 directories is insufficient.
13. A stub, mock, placeholder, fake-success adapter, unavailable dependency, empty service, or heuristic fallback cannot register as production-capable, appear enabled, satisfy health, or return success. It must fail closed with a typed `NOT_IMPLEMENTED`, `UNAVAILABLE`, or `PRODUCTION_BLOCKED` result and visible operational status.
14. Predictions cannot substitute a constant, neutral score, random value, or undocumented heuristic when the production runner is unavailable. The request must abstain/fail safely and emit operational evidence.
15. `ISkillEngine` is the single canonical runtime owner that compiles and executes certified `AgentSkillDefinition`/`AgentTemplateVersion` graphs through registered reads, Work Runtime tools, governance, and envelopes. Persistence and builder services are not execution engines.
16. A capability is advertisable only when its declared backend, dependencies, real UI/channel surface, authorization, observability, failure behavior, and acceptance evidence are all active. Capability manifests and navigation must derive availability from this certification state.

## 4. Target parity catalogue

The baseline register must contain every row below and any additional officially documented item discovered during Phase P0.

| Domain | Mandatory NeureCore capability families |
|---|---|
| Core assistant | persistent assistant panel, contextual page awareness, conversation history, clarification, multilingual input/output, safe navigation, read answers, system actions, feedback |
| Generative productivity | summarize, rewrite, translate, tone change, structured extraction, report drafting, email drafting, response drafting, description generation |
| Files | upload, drag/drop, validate, malware scan, parse, OCR where approved, summarize, extract, compare, cite, retain, delete |
| Knowledge | tenant knowledge ingestion, indexing, permission-aware retrieval, citations, answer grounding, article drafting, duplicate detection, update suggestions, publication governance |
| Agents | universal, productivity, sales, marketing/email, service/case-resolution, knowledge, custom tenant agents |
| Skills | prompt, typed inputs/outputs, registered actions, workflow mode, chat mode, versions, certification, permissions, templates, import/export |
| Sales | lead qualification/scoring, account research, opportunity summary, engagement summary, pipeline analysis, forecast, risk, next best action, follow-up drafting/scheduling, CRM updates |
| Marketing | audience segmentation, campaign brief, campaign/email content, brand controls, campaign analysis, response prediction, bounce analysis, recommendations |
| Service | case summarization, classification, routing, sentiment/urgency, related cases, knowledge retrieval, resolution recommendation, response draft, SLA/escalation prediction, governed updates |
| Meetings | transcript ingestion, participants, decisions, questions, action items, follow-up, CRM linkage, approval before writes, configurable summary templates |
| Predictive | lead/opportunity/campaign/case scoring, forecasting, recommendation, explanation, calibration, drift, abstention, model lifecycle |
| No-code | visual agent builder, typed skill composer, workflow-bound skills, natural-language workflow draft, validation, simulation, diff, certification, activation, rollback |
| Embedded channels | web, record-page contextual actions, Gmail/Google Calendar, Outlook/Teams, supported CRM events; Slack only if declared supported |
| Command Center | inventory, versions, permissions, usage, cost, quality, routing, runs, approvals, models, knowledge, channels, failures, audit, kill switches |
| Platform | RBAC/ABAC, tenant isolation, privacy, retention, redaction, secrets, audit, observability, accessibility, localization, resilience, rate/cost controls |

## 5. Delivery phases

### P−1 — Integrity, tenant safety, and false-capability elimination

**Objective:** restore truthful system behavior before parity expansion. P0–P9 implementation may be analysed and planned, but no new parity feature may be activated until Gate P−1 passes.

Mandatory corrective work:

1. Remove every wildcard tenant bypass from tenant-owned services, beginning with the audited `agents.service.ts` path. Replace legitimate platform-wide administration with a distinct authorized administrative query contract, explicit scope, audit evidence, bounded pagination, and tests.
2. Expand architecture and tenant-isolation guards from v2 folders to every active/legacy backend, frontend, worker, connector, analytics, channel, cache, vector, artifact and realtime path.
3. Create a machine-readable stub/fallback inventory by scanning source, registries, manifests, routes and UI configuration for `STUB`, mocks, placeholders, `Coming Soon`, hard-coded success, empty datasets, localhost-only production dependencies, constants/random predictions, TODO production paths, and unsupported adapters.
4. Correct the known audited locations: connector adapters, Command Center service, v2 channel adapters, HTTP model runner configuration/dependency, and calibrated prediction fallback. The inventory—not this initial list—defines the final scope.
5. Deregister or disable every incomplete capability across backend registries, tenant feature flags, navigation, agent/skill selectors and Command Center. Return typed fail-closed errors; never synthetic success.
6. Add startup validation that blocks production readiness when an enabled capability resolves to a stub, missing provider, unreachable mandatory runner, empty owner, uncertified skill, or incompatible schema/version.
7. Add contract tests proving unavailable providers produce no mutation, delivery receipt, prediction, recommendation, audit success, or misleading user confirmation.
8. Define and implement the canonical `ISkillEngine` interface, ownership boundary, compiler/executor contracts, certification handshake, and error model. P−1 requires the owner and fail-closed skeleton; full graph execution is delivered in P6.
9. Update `capability-ownership-manifest` to include implementation state, dependency health, certification state, surfaces, effect, tenant scope, stub evidence, and activation eligibility.
10. Emit `integrity-baseline.json` containing every finding, exact disposition, owner, regression test and closure evidence.

**Gate P−1:** zero wildcard tenant bypasses in active tenant-owned paths; full-codebase guards pass; zero enabled/advertised stubs, fake successes, neutral prediction fallbacks, localhost-only undeclared production dependencies or empty control-plane services; unavailable paths fail closed; canonical `ISkillEngine` ownership is registered with no competing executor; integrity baseline contains zero unresolved critical/high findings; real production builds and focused browser/API negative tests pass.

### P0 — Official inventory, traceability, and baseline certification

**Objective:** eliminate undefined parity.

Deliverables:

1. Review the official Creatio AI overview, agent list, skill list, system actions, predictive models, file/text features, meeting summaries, privacy, Outlook/Teams integration, product cookbooks, release notes, and relevant CRM pages.
2. Populate the immutable baseline register with stable IDs and exact observable outcomes.
3. Create a bidirectional requirements traceability matrix (RTM): Creatio capability → NeureCore requirement → design owner → code owner → tests → UI/channel surface → evidence → status.
4. Inventory existing NeureCore implementations and classify each as reusable, incomplete, duplicate, unsafe, obsolete, or missing.
5. Produce a deletion/consolidation plan for duplicates before new development.
6. Establish benchmark tenants, personas, datasets, branded content, cases, campaigns, meetings, files, leads, opportunities, knowledge, and intentional cross-tenant collisions.
7. Define per-scenario functional, security, quality, latency, accessibility, localization, and cost thresholds.
8. Import `integrity-baseline.json` and the audited statuses in §2.4 into the RTM; no item may be upgraded without linked code, test, surface and evidence.
9. Generate the initial parity register from the capability ownership manifest, then reconcile it manually against official Creatio sources. Framework presence must remain distinct from executable feature status.

**Gate P0:** Gate P−1 remains green; `creatio-parity-baseline.yaml`, bidirectional RTM and machine-readable parity register exist and validate in CI; 100% official baseline items have source evidence, NeureCore disposition, owner, acceptance scenario, real surface, dependency and evidence requirement; zero `TBD` items; full-codebase architecture ownership audit passes.

### P1 — Unified assistant and contextual generative productivity

**Objective:** deliver the always-available, context-aware assistant experience.

Implement:

- persistent assistant panel with new/resume conversation, history, agent identity, current context, attachments, streaming, cancel, retry, feedback, and accessible keyboard operation;
- authenticated `PageContext` containing entity type, authorized record ID, selected fields, user locale/time zone, and allowed actions—never arbitrary client authority;
- explicit context chips so users can see and remove records/files used;
- multilingual request/response handling with preserved entities, dates, currency, and proper nouns;
- generic certified skills: summarize record/thread/document, generate description, rewrite, shorten, expand, translate, change tone, extract structured fields, compare records/files, draft report;
- provenance display distinguishing record data, retrieved knowledge, uploaded files, prediction, and generated narrative;
- safe navigation suggestions that never disclose unauthorized object existence;
- conversation retention, export, deletion, redaction, feedback, and audit policies.

Failure coverage includes prompt injection, context switching, stale/deleted records, revoked access mid-conversation, hallucinated IDs, oversized context, LLM outage, partial streaming failure, and multilingual ambiguity.

**Gate P1:** all core and productivity scenarios pass through the real tenant UI; 100% record access is reauthorized server-side; generated claims expose provenance; accessibility meets WCAG 2.2 AA for delivered surfaces.

### P2 — Secure file intelligence and knowledge grounding

**Objective:** equal the documented file/knowledge experience without creating a data-exfiltration path.

Build a canonical ingestion pipeline:

```text
upload -> quarantine -> MIME/signature validation -> malware scan -> policy/DLP
       -> parse/OCR -> normalization -> classification -> tenant ACL binding
       -> chunk/index -> retrieval -> citation -> retention/deletion
```

Requirements:

- approved formats, real file-signature checks, size/page/token limits, archive-bomb protection, encrypted storage, checksums, deduplication, status and failure UI;
- parsers for PDF, DOCX, TXT, CSV/XLSX, PPTX, email and images where approved; OCR is isolated and confidence-aware;
- attachment-level permissions inherited by chunks and enforced before retrieval;
- version-aware re-indexing, tombstones, hard deletion, retention/legal-hold support, index reconciliation, and orphan cleanup;
- hybrid lexical/vector retrieval, tenant and ACL filters before ranking, reranking, freshness, duplicate collapse, and bounded context;
- citations resolving to authorized source, version, page/section/record, with access rechecked at click time;
- grounded-answer contract containing answer, claims, citations, retrieval evidence, confidence/coverage, limitations, and abstention reason;
- adversarial-content isolation: retrieved text cannot change system policy, call tools, impersonate instructions, or override governance;
- knowledge-agent skills for answer, article draft from resolved case, gap detection, duplicate detection, update recommendation, archive proposal, and governed publish/update.

**Gate P2:** citation precision and retrieval thresholds pass the approved gold set; unsupported-answer abstention passes; deleted/revoked content becomes unretrievable within the defined SLO; malware, DLP, injection, foreign-tenant and citation-ID attacks all fail closed.

### P3 — Meeting intelligence and productivity actions

**Objective:** provide end-to-end meeting assistance.

Implement:

- transcript and recording-provider ingestion only with tenant consent and jurisdiction-aware policy;
- participant identity resolution without guessing; unmapped participants remain explicitly unresolved;
- configurable summary templates for overview, decisions, risks, questions, commitments, action items, customer sentiment and follow-up;
- timestamp/source references for extracted claims;
- action-item extraction with owner, due date, confidence and ambiguity handling;
- meeting-to-account/contact/lead/opportunity/case linkage with tenant-scoped resolution;
- follow-up email and calendar-event drafts;
- governed creation of tasks, notes, CRM updates, emails and calendar events, with preview and approval according to effect policy;
- correction workflow, regeneration, version history and audit.

**Gate P3:** benchmark transcripts meet extraction thresholds; no ambiguous person is silently assigned; every external send or business mutation follows Work Runtime; consent, deletion and cross-tenant tests pass.

### P4 — Role-based out-of-the-box agents

**Objective:** ship concrete business agents, not only an agent-building framework.

All agents use the existing agent/template owners, Skill Registry, Work Runtime, governance, knowledge service, predictions, and shared envelope system.

#### P4A Universal and Productivity agents

- route supported requests and safely clarify unsupported ones;
- summarize, rewrite, translate, draft, schedule, create governed tasks and navigate;
- never become a fallback permission bypass.

#### P4B Sales agent

- account/contact/lead/opportunity research from authorized internal and configured external sources;
- lead qualification and predictive scoring;
- opportunity and engagement summaries;
- pipeline health, forecast, inactivity, churn and close-risk insights;
- explainable next-best actions;
- personalized follow-up drafts, meeting preparation and scheduling;
- governed CRM field updates, tasks, notes, stage proposals and communications.

#### P4C Marketing and Email Generation agent

- audience definition and permission-aware segmentation;
- campaign brief, themes, subject lines, preview text and email/body variants;
- tenant brand voice, approved claims, forbidden phrases, locale and channel constraints;
- campaign and segment analysis, response prediction and recommended optimization;
- bounce categorization, reason explanation and remediation;
- governed campaign/draft creation; no automatic audience send without policy and approval.

#### P4D Service and Case Resolution agent

- case summary, classification, category, priority, urgency and sentiment;
- duplicate/related-case discovery and customer/history context;
- cited knowledge answers and resolution options;
- response draft and escalation recommendation;
- SLA breach and recurrence prediction;
- governed assignment, status, notes, escalation and customer communication.

#### P4E Knowledge agent

- grounded answers;
- knowledge gap and stale-content detection;
- article drafting from prompts/resolved cases;
- duplicate and conflict detection;
- update/retirement recommendations;
- governed review and publication workflow.

For every agent define purpose, supported/unsupported intents, skills, data sources, tool ceiling, approval policy, escalation owner, evaluation set, quality threshold, budget, channels, lifecycle, SLO and kill switch.

**Gate P4:** each agent passes its gold task set, adversarial set, authority tests, cross-agent routing tests, tool-boundary tests, cost limits and real-browser journeys. The universal agent cannot execute any skill unavailable to the actor or specialist agent.

### P5 — Predictive, prescriptive and next-best-action parity

**Objective:** turn the v2 prediction foundation into certified CRM models.

Mandatory initial models:

- lead qualification/conversion score;
- opportunity win probability and close/date risk;
- sales forecast with interval and backtesting;
- customer churn/inactivity or follow-up priority where data supports it;
- campaign response/success and audience propensity;
- case escalation, SLA-breach and recurrence risk;
- ranked next-best-action for sales and service.

Model lifecycle:

1. problem and actionability definition;
2. tenant-safe feature contract and leakage review;
3. data sufficiency assessment;
4. temporal train/validation/test split;
5. non-AI baseline and challenger models;
6. calibration, subgroup/fairness and cost-sensitive evaluation;
7. explanation validation with domain owner;
8. shadow deployment;
9. gated production activation;
10. drift, staleness, performance and outcome monitoring;
11. rollback, retirement and reproducibility.

Production runner requirements:

- replace the audited implicit `localhost:8080` dependency with a registered, environment-validated `IModelRunner` implementation and explicit health/readiness contract;
- define authentication, TLS, timeout, retry, circuit breaker, concurrency, tenant/correlation/cost metadata, schema/version compatibility and deployment ownership;
- startup/readiness must fail for an enabled model whose runner is missing or incompatible;
- runner outage, malformed response, timeout, drift, insufficient features or calibration failure returns an abstention/unavailable result—never the audited neutral `0.5` value;
- deterministic baselines are separate named/versioned providers, evaluated and visibly labeled; they are not hidden fallbacks for an AI model;
- shadow and production results are persisted with runner/model/feature versions and reproducible evidence.

Recommendations must include subject, goal, ranked action, expected benefit, risk, confidence, supporting facts, model/rule version, expiry, limitations, policy, and registered action. Acceptance always starts a governed WorkRun.

If a tenant lacks sufficient data, the model abstains and may use a certified deterministic rule baseline clearly labeled as such. Synthetic accuracy cannot justify production activation.

**Gate P5:** a production model runner is deployed, authenticated, observable and exercised outside mocks; zero constant/neutral/random fallback paths exist; every model beats its approved baseline on holdout/backtest data, is calibrated to its risk, passes leakage/isolation/fairness review, abstains correctly, monitors realized outcomes, and passes outage/rollback/drift drills through the real UI.

### P6 — No-code agents, skills and AI-assisted workflow design

**Objective:** close the remaining creator-experience gap.

Extend Phase 4 of v2 with:

- the canonical `ISkillEngine`, which validates a certified immutable version, resolves only registry-owned nodes, derives effective authority/effect, compiles a versioned executable plan, dispatches reads or governed WorkRuns, pauses/resumes approvals, maps results to canonical envelopes, and records complete execution evidence;
- an explicit separation between `AgentSkillBuilderService` (definition/validation), the certification service (approval of an immutable version), `ISkillEngine` (runtime orchestration), and Work Runtime (mutation execution); none may absorb another's responsibility;
- agent catalogue, clone-from-template, lifecycle, permissions, channels, budgets and evaluations;
- typed visual skill graph with prompt nodes, registered read/action nodes, conditions, transformations, approvals and envelope outputs;
- chat-mode and workflow-mode skills with explicit typed input/output contracts;
- reusable certified templates for all P1–P5 capabilities;
- natural-language **drafting** of workflow/skill graphs, never direct activation;
- deterministic validation of ports, schemas, cycles, effects, authority, unreachable nodes, missing failure paths, timeout/retry/idempotency and compensation;
- synthetic-data simulation and step trace;
- version diff, review, certification, promotion, activation, suspension, rollback, import/export and dependency impact analysis;
- environment promotion with stable IDs and explicit secret rebinding;
- per-agent/skill execution permissions and default-deny inheritance.

Generated designs cannot include arbitrary code, SQL, shell, raw secrets, unregistered HTTP calls or self-modifying policy. Any future custom-code extension lives outside the no-code trust boundary and requires a separately certified plugin contract.

**Gate P6:** `ISkillEngine` contract, integration, recovery, idempotency, approval and cross-tenant suites pass against real dependencies; a tenant admin can create, visually compose, test, certify, deploy, execute and roll back representative Sales, Marketing and Service skills without code; payload tampering cannot lower derived effect or authority; invalid/uncertified graphs and dependency regressions fail closed; zero alternate skill executor exists.

### P7 — Embedded channels, Outlook/Teams equivalence and mobile decision

**Objective:** make capabilities available where work occurs.

Mandatory surfaces:

1. NeureCore web assistant and contextual record actions.
2. Gmail and Google Calendar using existing integrations.
3. Outlook email and calendar equivalent.
4. Microsoft Teams conversational and meeting-summary experience.
5. CRM/commerce event-triggered workflow skills.
6. Mobile-responsive assistant and supported backend-only actions; unsupported interactive behavior must be declared and safely blocked.

Slack is certified only if NeureCore markets it as supported; otherwise document it as roadmap, not parity.

Existing `Coming Soon`, `STUB`, `PRODUCTION-BLOCKED`, or hard-coded-success adapters are not partial channel implementations. They remain deregistered and invisible as available integrations until their real provider sandbox, identity, effect, receipt, failure and certification suites pass. The audited CRM connector set must either be implemented and certified or explicitly removed from the supported parity scope with Steering Gate approval.

Channel requirements include verified tenant/user mapping, consent, signature validation, thread/correlation mapping, attachment safety, deduplication, ordering, retries, delivery receipts, rate/cost limits, interactive approvals or secure fallback links, retention/redaction and revocation.

No external email address, meeting participant, webhook field or channel tenant hint is trusted as NeureCore identity.

**Gate P7:** zero declared channel/connector uses hard-coded success, stub transport or fabricated receipt; the same canonical scenario suite passes against real provider sandboxes on every declared channel; provider outages, replay, spoofing, revoked mappings, token expiry, duplicate delivery and approval fallback pass; mobile support matrix is published and tested.

### P8 — AI Command Center, governance, privacy and operations

**Objective:** provide one operational control plane for all AI behavior.

Command Center views:

- agent/skill/model/knowledge/channel inventory and lifecycle;
- versions, dependencies, permissions, owners and tenant rollout;
- conversations, route decisions, WorkRuns, approvals and evidence correlation;
- quality, feedback, corrections, abstentions and unsupported intents;
- latency, availability, tokens/actions, cost, budgets and rate limits;
- predictions, recommendations, drift, realized outcomes and model health;
- knowledge ingestion/index health, retrieval/citation quality and deletion reconciliation;
- channel status, identity mappings, queues, retries and delivery receipts;
- security denials, injection/DLP/malware events and safe audit evidence;
- per-process, tenant, capability, agent, skill, model and channel kill switches.

The Command Center service must query canonical runtime/audit/analytics/channel owners and return reconciled typed data. Empty hard-coded datasets, placeholder metrics, fabricated health and UI-only intelligence are forbidden. Each displayed count or status must trace to its source, freshness, tenant scope and evidence link; unavailable sources render an explicit degraded state.

Privacy/governance requirements:

- purpose and data-flow register for every model/provider call;
- configurable retention and deletion for prompts, responses, files, embeddings, transcripts and evidence;
- encryption, secrets rotation, least privilege, export/delete support and legal holds;
- provider contract and configuration proving tenant content is not used for model training where required;
- sensitive-data redaction before prompts and logs;
- regional/residency controls where contracted;
- complete RBAC/ABAC and agent/skill execution permissions;
- accessibility, localization and time-zone/currency correctness.

**Gate P8:** the audited Command Center stub is removed; real seeded activity appears correctly and empty-state behavior is distinguished from unavailable dependencies; operators can detect, investigate, disable and roll back every AI execution path; retention/deletion and privacy tests pass end-to-end; dashboards reconcile with audit, runtime, delivery and billing/cost records; chaos and incident drills pass.

### P9 — Full parity certification and production rollout

**Objective:** produce an auditable final verdict.

Certification layers:

1. schema and contract tests;
2. architecture/dependency and duplicate-owner tests;
3. unit and property tests;
4. real database/queue/object-store/vector-index integration tests;
5. model/retrieval evaluation;
6. governance, approval, idempotency and recovery tests;
7. adversarial security and tenant-isolation tests;
8. browser and channel end-to-end tests;
9. accessibility and localization tests;
10. load, soak, chaos, cost and rollback tests;
11. production-like and enabled-tenant smoke tests.
12. static and runtime false-capability certification proving no enabled/advertised feature resolves to a stub, mock, placeholder, fake success, empty owner, missing runner or uncertified skill.

Run the full RTM against at least two normal tenants with colliding names/data, privileged and restricted actors, revoked actors, distinct credentials/models/knowledge/channels, forged IDs/tokens/webhooks, and adversarial documents.

Rollout: synthetic tenant → benchmark tenant → staff pilot → opt-in pilot tenants → controlled cohorts → general availability. Every stage has automated rollback triggers and preserves evidence.

The existing legacy/Phase-9 G9 runner may be reused only for requirements it demonstrably covers. It is not the v3.1 certification owner and cannot substitute for the RTM-driven, full-codebase, cross-tenant, real-surface suite.

**Final Gate P9:** Gates P−1–P8 remain green; 100% in-scope baseline rows are `CERTIFIED` or approved `INTENTIONAL_DIFFERENCE`; zero enabled or advertised false capabilities; zero critical/high security defects; zero cross-tenant exposure; zero approval bypass; zero duplicate external effects; critical journeys 100% pass; clean-run rate ≥98%; accessibility, SLO, cost, resilience and rollback thresholds pass; signed Product, Engineering, Security, QA and Operations verdict is `APPROVED`.

## 6. Mandatory scenario inventory

Create stable scenario IDs at minimum for:

- CORE: contextual questions, navigation, unsupported intent, clarification, multilingual interaction, feedback and history deletion;
- GEN: summarize/rewrite/translate/tone/extract/compare/report/email;
- FILE: upload, scan, parse, OCR, summarize, compare, cite, revoke and delete;
- KNOW: grounded answer, no-answer abstention, article draft, conflict, duplicate, update and publish;
- MEET: summary, decisions, actions, owner ambiguity, CRM linkage, follow-up and governed writes;
- SALES: lead score, opportunity summary, forecast, risk, NBA, meeting prep, follow-up and CRM update;
- MKT: segment, brief, email, brand compliance, campaign prediction/analysis, bounce and governed campaign draft;
- SVC: classify, summarize, sentiment, related cases, cited resolution, response, SLA risk, escalation and update;
- BUILD: create/clone/simulate/certify/activate/promote/rollback agent and skill; natural-language workflow draft;
- PRED: baseline, calibration, explanation, abstention, drift and rollback;
- CHAN: web, Gmail, Calendar, Outlook, Teams, mobile and CRM event;
- GOV: permissions, approval, idempotency, retry, kill switch, retention, export/delete, audit and tenant isolation.

Every scenario must specify preconditions, persona, tenant, input, UI/channel steps, expected envelope, expected data/effect, forbidden effects, audit/evidence, performance budget, cleanup and screenshots/receipts.

## 7. Quality thresholds

Thresholds are approved during P0 and cannot be weakened to pass a release. Minimum global invariants:

- mutation/read boundary accuracy: 100%;
- unauthorized and cross-tenant disclosure/effect: 0;
- approval bypass and duplicate irreversible effect: 0;
- citation links to an authorized supporting source: 100%;
- unsupported grounded claims above approved tolerance: release blocker;
- stale/revoked/deleted source retrieval beyond deletion SLO: 0;
- critical-path browser/channel pass rate: 100%;
- evidence correlation completeness: 100%;
- clean-run rate: ≥98%;
- WCAG 2.2 AA automated and manual critical-flow checks: pass;
- production model activation without approved evaluation/model card: 0.

Use-case thresholds for routing, extraction, retrieval, summarization, scoring and forecasting must be based on gold datasets and business error costs—not one universal accuracy number.

## 8. Required artifacts

- P−1 `integrity-baseline.json`, full-codebase architecture report, stub/fallback inventory and closure evidence;
- official-source baseline register and archived hashes;
- RTM and machine-readable status dashboard;
- ownership manifest and duplicate-removal record;
- canonical `ISkillEngine` contract, ownership decision, executable graph schema and runtime certification evidence;
- provider/runner deployment and health manifest proving no enabled capability depends on an undeclared localhost or missing service;
- capability availability report reconciling backend registration, feature flags, UI/navigation, dependency health and certification;
- capability, agent, skill, model, knowledge and channel catalogues;
- OpenAPI/JSON Schema and envelope versions;
- threat models and data-flow/privacy register;
- gold datasets, adversarial sets and evaluation reports;
- model cards, retrieval cards and prompt/skill version records;
- browser screenshots, channel receipts and accessibility reports;
- audit/evidence correlation report;
- deployment hashes, migration report, SLO/load/chaos results and rollback evidence;
- per-phase signed gate report and final parity certificate.

## 9. Delivery sequencing

```text
P−1 integrity and false-capability closure
  ↓
P0 baseline / RTM
  ├─ P1 assistant ─ P2 files/knowledge ─ P3 meetings
  ├─ P4 agents (uses P1/P2; meeting skills use P3)
  ├─ P5 predictions
  └─ P6 no-code builder (uses canonical registries from P1–P5)
              ↓
          P7 channels
              ↓
          P8 command center
              ↓
          P9 certification and rollout
```

P−1 is a hard predecessor for activation of all other work. P2 and P5 may run in parallel after P0. Domain agent work may start after its required canonical skills and `ISkillEngine` execution path exist. P8 observability is implemented incrementally in every phase even though its final certification occurs after P7. Any recurrence of a P−1 violation immediately blocks rollout and reopens the integrity gate.

## 10. Definition of done

The program is complete only when:

- [ ] P−1 remains green with zero tenant wildcard bypass, registered stub, fake success, neutral prediction fallback, missing enabled dependency or empty advertised control-plane service.
- [ ] The dated official Creatio baseline is complete, immutable and source-backed.
- [ ] Every baseline feature has an equivalent outcome or approved intentional difference.
- [ ] Core assistant, files, knowledge, meetings, role agents, predictions, no-code design, channels and Command Center are certified.
- [ ] All out-of-the-box NeureCore agents and skills have gold/adversarial evaluations.
- [ ] The canonical `ISkillEngine` executes certified skill versions through registered reads and governed WorkRuns; no second skill executor exists.
- [ ] All reads and actions reuse the v2 canonical gateway/runtime/governance boundaries.
- [ ] No duplicate engine, registry, policy, connector, credential store or renderer exists.
- [ ] Generated and predictive outputs expose provenance, confidence/limitations and safe abstention.
- [ ] Knowledge answers are permission-aware and cited; document injection cannot execute or change policy.
- [ ] External effects are governed, idempotent, auditable and recoverable.
- [ ] Every declared channel passes common contract and end-to-end suites.
- [ ] Every enabled/advertised capability reconciles to a real backend, healthy dependency, real UI/channel surface, observable failure behavior and certification evidence.
- [ ] Tenant isolation passes across database, cache, queue, files, vectors, artifacts, realtime, channels and audit.
- [ ] Full-codebase architecture and isolation guards cover both current and legacy active paths.
- [ ] Privacy, retention, deletion, accessibility, localization, resilience, cost and SLO gates pass.
- [ ] The RTM contains no `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `TBD`, missing owner or missing evidence.
- [ ] Production deployment matches reviewed source and rollback drills pass.
- [ ] Final cross-functional verdict is signed `APPROVED`.

Until then, the only permitted statement is: **“NeureCore Creatio AI parity implementation and certification are in progress.”**

## 11. v3.1 corrective change record

This revision adds no competing architecture. It converts the 2026-08-02 repository audit into enforceable work by:

1. recording the audited P0–P9 starting statuses;
2. adding hard Gate P−1 for tenant safety, full-codebase architecture coverage, stub/fallback removal and truthful capability availability;
3. prohibiting wildcard tenant bypasses, hard-coded success and production-neutral prediction fallbacks;
4. establishing `ISkillEngine` as the single missing runtime owner for certified skill execution;
5. strengthening P0, P5, P6, P7, P8 and P9 gates around the exact audited blockers;
6. preventing the existing G9 runner from being misrepresented as v3.1 certification;
7. making recurrence of any integrity violation an automatic rollout blocker.
