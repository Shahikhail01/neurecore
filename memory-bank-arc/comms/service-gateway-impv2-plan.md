# NeureCore AI Service Gateway v2 — Creatio-Parity Implementation Plan

**Document ID:** NC-AI-SG-V2  
**Version:** 2.0  
**Date:** 2026-08-01  
**Status:** DESIGN / IMPLEMENTATION GATE  
**Scope:** Broader object coverage, governed conversational mutations,
deterministic routing, no-code agent and skill management, next-best-action and
predictive intelligence, omnichannel integration, and formal live tenant
isolation certification.

## 1. Executive outcome

This plan evolves the proven read-only `service-gateway` and response-envelope
foundation into a governed enterprise AI operating layer comparable in purpose
to Creatio AI. It does **not** create another AI stack. Every phase extends an
existing NeureCore service, port, registry, governance engine, connector, or
certification harness.

The target experience is:

1. A user asks for information or work in natural language from chat or a
   supported external channel.
2. A deterministic router classifies the request and selects a typed capability;
   an LLM may extract parameters but never invent the execution path.
3. Reads call existing tenant-scoped query services through registered adapters.
4. Mutations create a governed `WorkRun`; policy decides allow, deny, or require
   approval. The service gateway never writes directly.
5. Results return a channel-neutral response envelope containing text, tables,
   metrics, status, approval prompts, evidence links, and suggested next actions.
6. Recommendations and predictions include provenance, confidence, expiry, and
   an explanation. They never silently perform a business mutation.
7. Every request, decision, approval, execution, and response remains tenant
   scoped, auditable, idempotent, and replayable.

## 2. Non-negotiable architecture rules

These rules are release blockers, not preferences.

### 2.1 One owner for every responsibility

| Responsibility | Canonical owner | Forbidden duplicate |
|---|---|---|
| Read capability registration | `chat/responses` capability catalogue | New per-entity chat tools |
| Business queries | Existing domain services/repositories | Prisma access inside gateway/router/channel adapters |
| Mutation planning and execution | `work-runtime` | Direct mutation adapter in `CAPABILITY_MAP` |
| Runtime tool discovery | `work-runtime/registry/ToolRegistry` | Second mutation-tool registry |
| Policy decision | `RuntimeGovernanceEvaluator` plus enterprise governance | Channel-specific approval rules |
| Human approval lifecycle | Existing approvals/approval-port/approval-chains | Chat-only approval records |
| AI action definition | `ai-actions/AiActionRegistry` | Hard-coded action lists in UI |
| Agent templates and instances | `agent-templates`, `agents`, `agents-pool` | Separate chat-agent tables |
| Predictions | `analytics` provider and feature-store ports | Model calls inside gateway adapters |
| CRM/commerce connectors | `connectors` registry/adapters | Provider logic in chat or Work Runtime |
| Google/email integrations | `integrations` services | Channel-specific OAuth/token stores |
| Audit and evidence | Existing audit, execution-log, evidence and WorkRun records | Unstructured console-only evidence |
| Tenant flags | `TenantFeatureFlagOverride` and tenant flag service | Environment-only tenant rollout |
| Certification | Phase 8/9 certification harness | Untracked manual-only acceptance |

### 2.2 Gateway safety boundary

- `service-gateway` remains read-only.
- Every active gateway capability must declare `readOnly: true`.
- `ServiceGatewayTool` must reject `readOnly: false` at runtime even if a bad
  catalogue edit passes review.
- All conversational mutations enter `IWorkRuntime.createRun()`.
- No LLM-supplied `tenantId`, `actorId`, authority, approval result, policy, tool
  effect, or connector credential is trusted.
- Identity and scope come only from authenticated execution context.
- No capability may expose secrets, internal tenant identifiers, raw provider
  payloads, hidden metadata, or unrestricted object projections.

### 2.3 Definition of “no duplication”

Before adding any class, table, controller, tool, DTO, or renderer, the
implementer must search the repository and complete an ownership record:

```text
Requested responsibility:
Existing candidates inspected:
Canonical owner selected:
Why extension is insufficient (required only for a new abstraction):
Removed/replaced duplicate, if any:
Tests proving one active owner:
```

CI must reject:

- direct `PrismaService` imports under the gateway, router, and channel adapter
  directories;
- more than one active registry for the same capability name;
- duplicate route/capability/action identifiers;
- write-capable entries in the read catalogue;
- provider SDK imports outside the canonical connector/integration adapter;
- UI components that reproduce an existing envelope renderer;
- new `any`, `console.log`, `debugger`, unbounded schemas, or untyped provider
  payloads in v2 files.

## 3. 100% SOLID design contract

All new and modified v2 components must satisfy every item below.

### Single Responsibility Principle

- Router classifies; it does not query or execute.
- Parameter extractor extracts typed arguments; it does not select policy.
- Capability adapter translates one public service contract; it contains no
  business rules.
- Work Runtime plans and executes; it does not render UI.
- Governance evaluates policy; it does not execute tools.
- Envelope builders present results; they do not fetch data.
- Channel adapters translate inbound/outbound transport; they do not contain
  business logic.
- Prediction providers score; recommendation policy decides whether and how a
  score may be shown.

### Open/Closed Principle

- Add a read capability by registering a descriptor implementing the canonical
  read-capability interface.
- Add a mutation by registering a `RuntimeTool`, never editing the runtime
  executor.
- Add an intent family by registering an intent rule/handler.
- Add an envelope component through a renderer registry.
- Add a channel through `IChannelAdapter` registration.
- Add a model through `IAnalyticsProvider`/model runner configuration.
- Existing router, executor, gateway, renderer, and channel orchestrator code
  remains closed to entity/provider-specific changes.

### Liskov Substitution Principle

- All read adapters return the declared canonical result contract.
- All runtime tools obey identical validation, effect, idempotency, timeout,
  retry, and result semantics.
- All channel adapters preserve correlation, identity, ordering, consent, and
  delivery semantics.
- All analytics providers return the same versioned prediction contract.
- Contract tests run unchanged against every implementation.

### Interface Segregation Principle

Use narrow ports rather than a universal “AI service” interface:

```typescript
interface IReadCapability<P, R> { validate(input: unknown): P; execute(ctx: ReadContext, input: P): Promise<R>; }
interface IIntentClassifier { classify(input: IntentInput): Promise<IntentDecision>; }
interface IParameterExtractor<P> { extract(input: ExtractionInput): Promise<P>; }
interface IMutationDispatcher { createGovernedRun(input: MutationRequest): Promise<WorkRunView>; }
interface IRecommendationProvider { recommend(input: RecommendationInput): Promise<Recommendation[]>; }
interface IPredictionProvider { predict(input: PredictionInput): Promise<Prediction>; }
interface IChannelReceiver { receive(input: unknown): Promise<InboundMessage>; }
interface IChannelSender { send(message: OutboundMessage): Promise<DeliveryReceipt>; }
interface ITenantIsolationProbe { execute(caseDefinition: IsolationCase): Promise<IsolationResult>; }
```

No consumer may depend on methods it does not use.

### Dependency Inversion Principle

- High-level chat orchestration depends on router, read gateway, Work Runtime,
  recommendation, envelope, and channel ports.
- Infrastructure implements those ports using existing NeureCore modules.
- Provider selection, connector SDKs, Prisma, HTTP, queues, and transport clients
  remain outside the domain/application layer.
- Nest injection tokens are symbols or class references, never class-name
  strings.

### Required SOLID verification

Each phase must add architecture tests that fail on forbidden dependency edges,
direct database access, provider leakage, duplicate registrations, and read/write
boundary violations. A checklist without executable tests is insufficient.

## 4. Current assets to extend

| Need | Existing asset to reuse |
|---|---|
| Read gateway and envelopes | `backend/src/modules/chat/responses/` |
| Chat orchestration | `backend/src/modules/chat/chat.service.ts` |
| Agent graph | `backend/src/modules/agents/langgraph/langgraph-official.ts` |
| Governed mutation execution | `backend/src/modules/work-runtime/` |
| Tool effects and authorization | `RuntimeTool`, `ToolRegistry`, `RuntimeGovernanceEvaluator` |
| Approval pause/resume | Work Runtime approval consumer plus approval modules |
| Action catalogue and kill switch | `backend/src/modules/ai-actions/` |
| Agent templates | `backend/src/modules/agent-templates/` |
| Agent pool/instances | `backend/src/modules/agents-pool/`, `agents/` |
| Organizational context | `context-plane` and enterprise context modules |
| Predictions/features | `backend/src/modules/analytics/` |
| Decision evidence | `decision-evaluations`, audit, execution-log |
| Command monitoring | `backend/src/modules/command-center/` |
| CRM/commerce | `backend/src/modules/connectors/` |
| Google and Brevo/email | `backend/src/modules/integrations/` |
| UI integration settings | `frontend-tenant/src/app/settings/integrations/` |
| Tenant feature flags | tenant flag service and `TenantFeatureFlagOverride` |
| Isolation/golden-path certification | `backend/src/test/certification/` |

## 5. Target request architecture

```text
Web chat / email / calendar / CRM / future Teams-Slack channel
                         |
                  Channel ingress adapter
                         |
            authenticated canonical message context
                         |
               Deterministic Intent Router
                  /          |          \
             READ        MUTATION      ADVICE
              |              |            |
      Read Capability     Work Runtime   Recommendation
         Gateway        plan/govern/HITL    Service
              \              |            /
               \------ Response Envelope-/
                         |
                 Channel egress adapter
                         |
              audit, evidence, correlation
```

The LLM is permitted to:

- normalize natural language;
- extract typed parameters when deterministic parsing is insufficient;
- propose a WorkPlan using only authorized runtime tools;
- explain results and recommendations.

The LLM is not permitted to:

- choose tenant or authority;
- bypass deterministic intent selection;
- call a write service directly;
- approve its own action;
- invent an unregistered capability;
- alter tool effects, approval sensitivity, or policy;
- treat prediction as fact;
- send an external message without channel and governance authorization.

## 6. Phased delivery plan

Every phase ends in a hard gate. A later phase must not begin until its required
gate passes in CI and the relevant tenant flag defaults off.

### Phase 0 — Baseline, ownership, and error elimination

**Objective:** establish a reproducible clean baseline and prevent v2 work from
amplifying existing drift.

Deliverables:

1. Generate a machine-readable inventory of all registered structured tools,
   runtime tools, AI actions, read capabilities, controllers, connector names,
   envelope renderers, and tenant flags.
2. Detect duplicate identifiers and multiple implementations claiming the same
   responsibility.
3. Record current build/test failures as pre-existing with owner and disposition.
4. Add architecture tests for the rules in §2 and §3.
5. Add a capability ownership manifest containing identifier, owner module,
   effect, schema version, tenant scope, response projection, and deprecation
   state.
6. Reconcile source/dist/deployed hashes before any rollout.

Gate G0:

- backend and tenant production builds pass;
- existing focused gateway tests pass;
- Phase 9 certification passes unchanged;
- zero duplicate active identifiers;
- zero write entries in the read gateway;
- zero undocumented baseline errors;
- deployed hash report is reproducible.

### Phase 1 — Broader read-only object coverage

**Objective:** allow AI to safely answer across core enterprise objects without
adding business logic or direct database access.

Coverage waves:

| Wave | Objects | Required result form |
|---|---|---|
| 1A | tasks, goals, departments, agents, approvals | list/detail/summary |
| 1B | workflows, deliverables, assignments, inbox/activity | list/detail/status |
| 1C | costs, finance summaries, compliance, knowledge | summary/search/evidence |
| 1D | connectors, integration status, WorkRuns, command center | status/health/history |

Implementation requirements:

- Build descriptors from existing public service methods only.
- Use namespaced stable identifiers such as `tasks.list` and `tasks.get` in the
  v2 catalogue while retaining aliases only at the compatibility boundary.
- Give every capability a strict input schema, explicit safe-output projector,
  maximum page size, authorization scope, sensitivity class, timeout, and
  envelope strategy.
- Use IDs from validated context or deterministic entity resolution; never let
  the model fabricate an ID and silently fall back to another operation.
- Add pagination, search, sorting, date ranges, and documented enums
  consistently through shared query-value objects—not repeated DTO fragments.
- Return typed not-found, forbidden, validation, timeout, and dependency errors.
- Add `timeline`, `status`, `approval`, and `evidence` envelope components only
  where existing table/metrics/text cannot express the result.

Gate G1:

- 100% registered read capabilities have contract, adapter, projection,
  authorization, and tenant-isolation tests;
- no adapter imports Prisma or owns business rules;
- malformed and unknown parameters never reach a service;
- pagination and response-size limits verified;
- old five production read scenarios remain green;
- at least two tenants prove disjoint results for every object family.

### Phase 2 — Deterministic capability routing

**Objective:** remove model-dependent capability selection while preserving
natural-language flexibility.

Components:

1. `IntentRuleRegistry`: ordered, versioned rules for READ, MUTATION, ADVICE,
   NAVIGATION, HELP, and UNSUPPORTED.
2. `EntityIntentRegistry`: maps entity synonyms and operations to canonical
   capability identifiers.
3. `DeterministicIntentClassifier`: produces intent, entity, operation,
   confidence, rule ID, and ambiguity candidates.
4. `TypedParameterExtractor`: deterministic parsing first; constrained LLM
   structured extraction second; strict schema validation last.
5. `AmbiguityResolver`: asks a clarification question when candidates are not
   safely distinguishable.
6. `RoutingDecisionLog`: stores rule version and decision evidence without raw
   secrets.

Routing precedence:

```text
explicit UI action/context
  > exact command grammar
  > registered entity-operation rule
  > constrained structured classifier
  > clarification
  > unsupported response
```

There is no “best effort” call to an arbitrary capability.

Required tests:

- table-driven paraphrases and adversarial prompts;
- singular/plural and domain synonyms;
- read versus mutation minimal pairs;
- multi-entity ambiguity;
- prompt-injection attempts;
- unsupported and low-confidence cases;
- rule-version replay;
- property tests proving every decision is registered and effect-compatible.

Gate G2:

- ≥99.5% deterministic routing accuracy on the approved benchmark corpus;
- 100% mutation/read boundary accuracy;
- 100% unknown requests clarify or reject rather than execute;
- identical input/context/rule version produces identical routing;
- no LLM-selected tool name reaches either registry.

### Phase 3 — Governed conversational mutations

**Objective:** enable useful conversational work without weakening approvals,
idempotency, authority, or evidence.

Architecture:

- The router emits a `MutationRequest`, never a direct service call.
- `IMutationDispatcher` calls `IWorkRuntime.createRun()` with authenticated
  tenant/actor context.
- Work Runtime exposes only tools returned by `ToolRegistry.listForAuthority()`.
- The planner may order authorized steps, but schemas, effects, dependencies,
  authority and approval sensitivity remain registry-owned.
- `RuntimeGovernanceEvaluator` returns ALLOW, DENY, or REQUIRE_APPROVAL per step.
- Approval resume revalidates tenant, actor authority, current entity version,
  policy version, tool registration, and idempotency state.
- Final envelopes show plan, current status, approvals, completed effects,
  evidence, failures, and safe recovery actions.

Mutation rollout waves:

1. Internal reversible writes: draft task, update non-sensitive metadata,
   assignment proposal.
2. Business-state transitions: project/task transitions and approval submission.
3. External effects: email, calendar event, CRM sync, outbound connector action.
4. Multi-step work: cross-object workflows with explicit dependencies and
   compensating actions where supported.

Required invariants:

- same idempotency key cannot create duplicate effects;
- AI cannot approve its own task;
- denied/expired approval cannot execute;
- approved input cannot be substituted after approval;
- retries cannot overwrite approved evidence;
- every committed mutation has audit/outbox evidence;
- failed transaction creates neither aggregate nor outbox event;
- cancellation stops pending effects;
- external effects require explicit policy and delivery receipt;
- no cross-tenant ID is accepted at any layer.

Gate G3:

- all 10 mandatory Phase 9 invariants plus mutation-specific invariants pass;
- 100% external/irreversible effects pause for approval under configured policy;
- duplicate effects = 0 across retry/restart tests;
- approval resume/reject/expire/revalidate cases pass against real PostgreSQL;
- browser test proves request → approval → resume → evidence;
- read gateway continues to reject every write descriptor.

### Phase 4 — No-code agent and skill management

**Objective:** let authorized tenant administrators compose governed AI workers
without code deployment or arbitrary code execution.

Reuse model:

- `AgentTemplate` remains the template owner.
- existing agent and agent-pool services remain instance owners.
- `AiActionRegistry` and `ToolRegistry` are the only selectable action sources.
- governance computes effective permissions; the UI cannot grant authority by
  merely storing a selected action.

No-code agent definition:

- identity, purpose, instructions and version;
- allowed organizational scopes;
- selected registered skills/actions;
- model capability profile, not raw provider credentials;
- authority ceiling and escalation owner;
- budget, rate, schedule and concurrency limits;
- channel bindings;
- approval policy references;
- evaluation dataset and minimum score;
- draft, certified, active, suspended, retired lifecycle.

Skill definition:

- stable ID and semantic version;
- input/output JSON schemas;
- composition of registered reads/actions/runtime tools;
- declared maximum effect derived from its children;
- required authority and approval sensitivity derived—not user-overridden;
- deterministic preconditions and postconditions;
- timeout, retry, idempotency and compensation metadata;
- response-envelope mapping;
- test examples and certification record.

The builder must not support arbitrary JavaScript, shell, SQL, provider keys, or
unregistered HTTP URLs. Extensibility uses certified registries and connector
definitions only.

UI deliverables:

- agent catalogue and lifecycle editor;
- visual skill composer with typed ports;
- permission/effect preview;
- test console using synthetic tenant fixtures;
- approval/budget/channel configuration;
- version diff, certification result, rollback, suspend and audit history.

Gate G4:

- saved definitions are schema-versioned and immutable after certification;
- activation requires certification and authorized human action;
- derived effect/authority cannot be lowered by UI payload manipulation;
- invalid/cyclic skill graphs are rejected;
- cross-tenant template, skill and secret access is denied;
- rollback restores prior certified version without losing evidence;
- no arbitrary-code execution path exists.

### Phase 5 — Next-best-action and predictive intelligence

**Objective:** provide explainable recommendations and predictions that help
users decide, while keeping actions governed and humans accountable.

Reuse `AnalyticsService`, `IAnalyticsProvider`, feature stores,
`decision-evaluations`, context plane, audit and Work Runtime.

Canonical prediction contract:

```typescript
interface Prediction {
  id: string;
  tenantId: string;
  subject: { type: string; id: string };
  predictionType: string;
  value: unknown;
  confidence: number;
  model: { id: string; version: string };
  featureSnapshotId: string;
  generatedAt: string;
  expiresAt: string;
  explanation: string[];
  limitations: string[];
}
```

Canonical recommendation adds goal, ranked action, expected benefit, risk,
supporting evidence, policy requirements, expiry, and the registered mutation
capability that would implement it. Selecting a recommendation starts a
governed WorkRun; it never writes directly.

Initial use cases:

- overdue-work and delivery-risk prioritization;
- approval bottleneck detection;
- workload/capacity balancing;
- project delay and budget-risk forecast;
- customer lifecycle or follow-up recommendation;
- anomaly detection for operational and financial metrics.

Quality and safety:

- replace dummy/stub model paths before production claims;
- time-aware training/evaluation split with tenant-safe aggregation;
- calibration, precision/recall, false-positive cost and baseline comparison;
- drift, staleness and feature-availability monitoring;
- model/version/feature provenance and reproducible evaluation;
- protected-attribute review and tenant-configurable suppression;
- abstain when confidence, freshness, or evidence is insufficient;
- predictions never appear as verified facts.

Gate G5:

- every production model beats its declared non-AI baseline;
- metric thresholds are use-case-specific and approved before rollout;
- 100% recommendations show reason, confidence, evidence and expiry;
- stale/low-confidence predictions abstain;
- model/feature data is tenant isolated;
- recommendation acceptance still traverses Work Runtime governance;
- drift and rollback drills pass.

### Phase 6 — Omnichannel AI

**Objective:** deliver the same governed capability through supported channels
without copying business logic into integrations.

Initial channels:

1. Web chat and in-product contextual actions.
2. Gmail/email and Google Calendar using existing integration services.
3. CRM/commerce events and actions through the connector registry.
4. Brevo outbound notifications.
5. Microsoft Teams/Outlook and Slack only after certified adapters and identity
   mappings are implemented.

Canonical channel contracts must cover:

- external tenant/user identity mapping;
- consent and channel authorization;
- inbound message normalization;
- attachment scanning and safe extraction;
- thread/correlation mapping;
- deduplication and ordering;
- delivery receipt and retry policy;
- rate/budget limits;
- redaction and retention;
- interactive approval rendering where the provider supports it;
- fallback link to NeureCore for sensitive actions.

All channels call the same intent router, read gateway, Work Runtime,
recommendation service, and envelope builder. Channel egress transforms the
canonical envelope; it does not reinterpret business results.

External sender identity must never be treated as a NeureCore actor until a
tenant-scoped verified mapping succeeds. Unmapped senders receive no tenant
data and cannot initiate work.

Gate G6:

- cross-channel contract suite passes unchanged for every adapter;
- replayed webhook/message produces no duplicate effect;
- forged tenant, sender, callback and signature cases are rejected;
- channel outage queues or fails safely according to declared semantics;
- external writes retain the same approval requirements as web chat;
- secrets are encrypted and never returned in API/envelope/log output;
- correlation from inbound event to audit/evidence/delivery receipt is complete.

### Phase 7 — Formal live cross-tenant certification

**Objective:** replace architectural confidence and manual probes with automated
live proof across every new boundary.

Minimum certification topology:

- two normal tenants with deliberately colliding names and distinct IDs;
- one privileged/admin actor per allowed scope;
- one low-authority actor;
- one suspended/revoked actor;
- separate connector credentials, agents, skills, models and channels;
- forged IDs/tokens/callbacks and mixed-tenant relationship attempts.

Coverage matrix:

| Boundary | Required negative proof |
|---|---|
| Router/context | tenant cannot be supplied or changed by prompt |
| Read gateway | every object family denies foreign IDs and filters lists |
| Entity resolution | same-name entity resolves only inside tenant |
| Work Runtime | create/get/execute/resume/cancel reject foreign run IDs |
| Approvals | foreign approval cannot inspect or resume a step |
| Agents/skills | definitions, versions and bindings are isolated |
| Analytics | features, models, predictions and explanations are isolated |
| Connectors | credentials, webhooks and sync cursors are isolated |
| Channels | external identity cannot cross tenant mapping |
| Envelopes/history | persisted response never leaks foreign row/evidence |
| Realtime | room, event and socket authorization is tenant scoped |
| Artifacts | paths, signed URLs and evidence access reject foreign tenant |

Tests must exercise controller, application service, command/runtime,
repository, worker/consumer, session, socket, channel webhook, and artifact
layers. A controller-only test does not certify isolation.

Gate G7:

- 100% cross-tenant denial across the complete matrix;
- zero cross-tenant rows, events, artifacts, predictions or delivery receipts;
- all forbidden cases generate safe audit evidence;
- forged JWT, revoked session, replayed webhook and stale approval cases pass;
- certification is runnable in CI and against a production-like environment;
- machine-readable report and signed operator verdict are produced.

### Phase 8 — Progressive production rollout and parity validation

**Objective:** ship safely and measure functioning, not merely code presence.

Feature flags:

- process kill switch;
- tenant enablement;
- phase/domain capability enablement;
- write-runtime enablement;
- agent-builder enablement;
- recommendation/model enablement;
- per-channel enablement.

Rollout order:

1. internal synthetic tenant;
2. existing benchmark tenant;
3. staff pilot tenants;
4. opt-in customer tenants;
5. tier/industry cohorts;
6. general availability only after all gates and operational SLOs pass.

Required operational controls:

- command-center views for routing, runs, approvals, model decisions and channel
  deliveries;
- latency, availability, routing accuracy, clarification, denial, approval,
  duplicate-effect, recovery, cost and user-correction metrics;
- per-capability and per-channel circuit breakers;
- one-command flag rollback and documented artifact rollback;
- schema backward compatibility and mixed-version envelope tests;
- alerting without prompt, PII, token or secret leakage.

Gate G8 / release verdict:

- G0–G7 remain green;
- critical-path pass rate = 100%;
- duplicate effects = 0;
- cross-tenant exposure = 0;
- approval bypass = 0;
- evidence trail completeness = 100%;
- clean-run rate ≥98%;
- route accuracy ≥99.5% and mutation boundary = 100%;
- published SLOs and rollback drill pass;
- Creatio-parity scenarios pass through the real frontend/channel surfaces,
  never by substituting direct APIs for a required UI interaction.

## 7. Data and contract evolution

Before adding database models, inspect `AgentTemplate`, `Agent`,
`ToolIntegration`, `ApprovalRequest`, `ApprovalWorkflow`, `WorkRun`,
`WorkRunStep`, `DecisionEvaluation`, `IntegrationCredential`, analytics models,
and tenant flags. Extend an existing owner when semantics match.

Any new persistence requires:

- clear aggregate owner;
- tenant ID in every tenant-owned unique/index/access path;
- immutable version/evidence fields where decisions are certified;
- explicit retention and deletion semantics;
- migration, rollback and backfill plan;
- repository port and tenant-scoped implementation;
- real PostgreSQL isolation and idempotency tests;
- no JSON dumping ground for fields that require querying, constraints or
  authorization.

All public contracts are versioned. Additive envelope changes are preferred;
breaking changes require dual-read/dual-write compatibility and removal gates.

## 8. Security and governance requirements

- Default deny for capabilities, tools, skills, channels and connectors.
- Effective authority is computed server-side at execution time.
- Tool effects and approval sensitivity are registry-owned.
- Secrets use the existing credential/token stores and encryption services.
- Prompt and attachment content is untrusted input.
- Output projections and redaction occur before LLM explanation and envelope
  persistence.
- Rate, cost, token, concurrency and external-send budgets are tenant scoped.
- Every model/provider call has purpose, tenant, correlation and cost metadata.
- Audit logs store decisions and hashes/provenance, not unnecessary raw secrets.
- AI cannot approve its own work, alter policy, or certify its own agent/skill.
- Emergency kill switches stop new work while preserving investigation evidence.

## 9. Testing strategy

### Test pyramid

1. Pure contract/schema/router tests.
2. Adapter contract tests against service doubles.
3. Module integration tests with real Nest DI.
4. Repository tests with real PostgreSQL.
5. Work Runtime/governance/approval integration tests.
6. Connector sandbox and webhook signature tests.
7. Browser-first and channel-first end-to-end scenarios.
8. Failure injection, restart, retry, idempotency and isolation certification.
9. Production smoke tests on enabled benchmark tenants.

### Mandatory failure cases

- unknown/ambiguous intent;
- wrong parameter type and unknown field;
- nonexistent and foreign entity ID;
- service timeout/unavailable dependency;
- planner hallucinated tool;
- authorization and policy denial;
- approval reject/expire/revoke/change-after-approval;
- worker death before/after effect commit;
- duplicate message/webhook/idempotency key;
- connector token expiry and provider throttling;
- model unavailable/stale/drifted/low confidence;
- socket disabled and channel outage;
- envelope persistence and replay;
- tenant switch and revoked session during an active flow.

### Evidence artifacts

Each certification run emits JSON summary, scenario details, invariant results,
route decisions, WorkRun/approval/evidence correlation IDs, screenshots for UI
requirements, channel delivery receipts, sanitized logs, deployment hashes, and
an APPROVED/BLOCKED verdict.

## 10. CI quality gates

Every v2 pull request must run:

- formatting, lint and TypeScript checks;
- dependency/architecture boundary tests;
- duplicate registry/route/schema identifier audit;
- forbidden direct database/provider import audit;
- unit and integration suites for affected owners;
- read-only gateway invariant suite;
- Phase 8 isolation and Phase 9 certification regression;
- frontend parser/renderer/useChat tests;
- production builds;
- migration validation when schema changes;
- secret scanning and dependency/security scanning;
- generated manifest diff reviewed as a first-class artifact.

No test may be weakened, skipped, changed to accept an error, or replaced by a
mock-only assertion merely to obtain a green build.

## 11. Deployment and rollback

For every phase:

1. Preserve the dirty workspace and identify only scoped files.
2. Build and test locally.
3. Create a timestamped Contabo rollback snapshot.
4. Sync only reviewed source, migration and configuration files.
5. Generate Prisma client when required.
6. Build on Contabo; never rely on stale `dist` or `.next` output.
7. Apply backward-compatible migrations before code that requires them.
8. Restart/reload PM2 and save the process list.
9. Verify boot registration, health, public routes and logs.
10. Run enabled-tenant smoke and isolation probes.
11. Compare deployed hashes to the release manifest.
12. Roll back code/config/flags immediately if a gate fails; preserve evidence.

Database rollbacks favor forward fixes unless a tested reversible migration is
available. Feature flags are the first rollback mechanism for behavioral risk.

## 12. Work packages and sequencing

| Work package | Depends on | Primary output |
|---|---|---|
| WP0 ownership and architecture guards | none | clean baseline/manifest |
| WP1 read catalogue expansion | WP0 | broad safe object coverage |
| WP2 deterministic router | WP0, WP1 contracts | stable intent selection |
| WP3 governed mutations | WP0, WP2, existing Work Runtime | safe conversational work |
| WP4 agent/skill builder | WP0, WP3 registries | certified no-code composition |
| WP5 predictions/NBA | WP0, context/analytics quality | explainable recommendations |
| WP6 omnichannel | WP2, WP3, connector security | channel-neutral AI operations |
| WP7 live isolation certification | WP1–WP6 incrementally | formal tenant proof |
| WP8 rollout/parity | all required gates | controlled production release |

WP4 and WP5 may proceed in parallel after their dependencies, but neither may
invent its own execution or governance path. WP7 expands after every work
package, rather than being postponed until the end.

## 13. Done definition

The v2 program is complete only when all statements are true:

- [ ] Object coverage meets the approved enterprise object inventory.
- [ ] Every read uses an existing service/public query port and safe projector.
- [ ] Gateway has no active write capability and rejects one at runtime.
- [ ] Deterministic routing meets G2 accuracy and boundary requirements.
- [ ] Every mutation runs through Work Runtime and governance.
- [ ] Approval, idempotency, recovery and evidence invariants pass.
- [ ] Tenant admins can compose, test, certify, activate, suspend and roll back
      agents/skills without arbitrary code or authority escalation.
- [ ] Recommendations/predictions are explainable, versioned, measured and
      governed before action.
- [ ] Every enabled channel passes the same contracts and policy behavior.
- [ ] Formal live cross-tenant matrix passes with zero exposure.
- [ ] Phase 8/9 regression and v2 certification are green.
- [ ] Backend/frontend builds, lint, types and security scans are green.
- [ ] No duplicate capability, registry, business rule, renderer, connector,
      credential store, execution engine or approval path exists.
- [ ] No new `any`, debug statement, hidden error, stale build or secret leak.
- [ ] Production rollout, observability, SLOs and rollback drills pass.
- [ ] Real UI/channel parity scenarios pass without API substitution.
- [ ] Documentation, manifests, runbooks and implementation status are current.

## 14. Honest parity boundary

“Similar to Creatio AI” means NeureCore provides a coherent natural-language
interface, embedded insights, governed actions, configurable agents/skills,
predictive next-best actions, cross-channel operation, enterprise governance,
and verifiable tenant isolation. It does not mean copying Creatio internals or
claiming parity from the presence of endpoints alone.

Every capability must be demonstrably functional through its intended user
surface, secure under adversarial conditions, recoverable under failures, and
auditable from request through final effect. Until all applicable gates pass,
the accurate status is **partial parity / implementation in progress**.

