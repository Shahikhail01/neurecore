# Architecture Decisions (ADRs)

> Canonical index + summary for every Architecture Decision Record referenced in the codebase. Last refreshed: 2026-07-31.

The ADRs themselves live in `neurecore/memory-bank-arc/NeuroCore Architectural Constitution/`
(`EAOS-architectural-constitution.md` and per-ADR `ADR-NNN-*.md` files).
This doc is the index + one-paragraph summary that lets a new dev find the
right ADR without searching for "ADR-007" across 40 files.

> **Note:** Some ADRs referenced in code (notably **ADR-0001**, **ADR-001**
> through **ADR-014**) are summarised below to the extent the codebase
> makes them explicit. For the full prose, read the canonical ADR documents
> in `memory-bank-arc/`. If a future ADR is added, append a row to the
> table in §1 **and** a paragraph summary in §2.

---

## 1. ADR index

| ID | Title | Phase | Status |
|---|---|---|---|
| ADR-0001 | Delete the legacy in-process Hermes runtime | Phase 1 (AWL) | ✅ Implemented |
| ADR-001 | Enterprise Event Fabric (durable outbox + consumers) | Phase 2 | ✅ Implemented |
| ADR-002 | Organizational Context Plane | Phase 3 | ✅ Implemented |
| ADR-003 | Governed Work Runtime — execution model | Phase 4 | ✅ Implemented |
| ADR-004 | Governed Work Runtime — tool contracts | Phase 4 | ✅ Implemented |
| ADR-006 | Unified Capability Approval Port | Phase 7 | ✅ Implemented |
| ADR-007 | Project ↔ Finance Integration | Phase 8 | ✅ Implemented |
| ADR-009 | Governance evaluation as a port | Phase 4+ | ✅ Implemented |
| ADR-011 | Enterprise Input contract | Phase 5 | ✅ Contract frozen |
| ADR-012 | Authorization decision + business-effect idempotency | Phase 5 | ✅ Contract frozen |
| ADR-013 | Recommendations + action decisions | Phase 5 | ✅ Contract frozen |
| ADR-014 | Decision plan + plan decision | Phase 5 | ✅ Contract frozen |

> Conventions:
> - **Phase** row references the Phase (1–14) the ADR belongs to.
> - **Contract frozen** = the event contract is registered (not the producer
>   yet). See `enterprise-event-registry.ts`.

---

## 2. Per-ADR summary

### ADR-0001 — Delete the legacy in-process Hermes runtime
**Files:** `backend/src/modules/hermes/services/agent-messaging.service.ts:128, 132`.

The original Hermes ran in-process in the Nest backend. ADR-0001 removes
that runtime and replaces it with the upstream `NousResearch/hermes-agent`
running in a Python sidecar (`infra/hermes-sidecar/`) reached through a
scoped-token gateway. Concretely:
- `AgentMessagingService` returns
  `blocked: "Legacy in-process runtime responses are disabled by ADR-0001."`
  if asked to do a runtime response.
- The migration target is `HermesAdapterModule` → sidecar → upstream.

**Implication for new code:** never write to the old Hermes module;
extend the adapter or add a new tool in `backend/src/modules/tools/`.

### ADR-001 — Enterprise Event Fabric
**Files:** `enterprise-events/` (transport, contracts, consumers, idempotency).

Replaces the in-memory `ProjectEventBus` (still present at
`backend/src/modules/project-events/project-event-bus.service.ts` but
marked `@deprecated`). The Fabric is:
1. **Durable** — events written transactionally in the same DB tx as the
   aggregate via `OutboxWorker` (transactional outbox, ADR-001 §8).
2. **At-least-once** — `IEnterpriseEventTransport` interface contract.
3. **Idempotent on the consumer side** — `IdempotencyService`
   (`enterprise-events/idempotency/idempotency.service.ts`, ADR-001 §6 +
   ADR-012).
4. **Contract-validated** — `EventContractValidator` (ADR-001 §14).
5. **Multi-transport** — see §C below.
6. **Dead-lettered** — `EnterpriseEventDeadLetter` table for poison
   messages.

Key facts:
- Every aggregate mutation MUST go through the Command pattern so the
  outbox row is in the same tx. See `backend/src/common/outbox/` and
  `backend/src/common/commands/`.
- Architecture test (`enterprise-events/architecture.spec.ts`) enforces
  no module reaches DB directly for cross-cutting events.

### ADR-002 — Organizational Context Plane
**Files:** `context-plane/` (plane, providers, cache, consumers, resolvers).

A read-side aggregation layer that answers "what does my organisation
look like right now from this user's vantage point?". Providers per
domain (`projects-context.provider.ts`, `tasks-context.provider.ts`,
`finance-context.provider.ts`, `customers-context.provider.ts`, etc.)
contribute scoped, authorisation-bounded slices. A bounded in-memory
cache (`ContextCache`, ADR-002 §11) backs the answers; invalidation
consumers (`ContextCacheInvalidationConsumer`, ADR-002 §12) keep it
fresh off the event fabric.

`ContextIdentityResolver` (ADR-002 §6) resolves effective authority +
autonomy for the caller. Used by Hermes to scope its tool graph.

Architecture tests at `context-plane/architecture.spec.ts` enforce ADR-002
boundary rules (no direct DB from consumers, etc.).

### ADR-003 — Governed Work Runtime — execution model
**Files:** `work-runtime/` (service, planner, executor, registry,
repository, consumers).

The runtime takes a `WorkPlan` (ADR-003 §6) produced by `WorkPlanner`
(validated by `PlanSchemaValidator`) and executes it as a `WorkRun`
consisting of `WorkRunStep`s. It is the **governed** runtime — every
step passes through `RuntimeGovernanceEvaluator` (ADR-003 §2.3) which
delegates to the governance port (ADR-009) and to approval port
(ADR-006).

Implications:
- Failure classification (`ToolExecutorService`, ADR-003 §13) decides
  whether a failure is retryable.
- Architecture tests (`work-runtime/architecture.spec.ts`) enforce
  ADR-003/004 boundaries.

### ADR-004 — Work Runtime — tool contracts
**Files:** `work-runtime/contracts/work-runtime.interface.ts` (the
Tool contract section), `work-runtime/registry/tool-registry.service.ts`,
`work-runtime/tools/runtime-tools.provider.ts`.

The Work Runtime exposes its own `Tool` contract (separate from the
broader StructuredTool registry in `backend/src/modules/tools/`). Tools
registered with the runtime are ADR-004-typed and have a Zod schema for
input + output.

### ADR-006 — Unified Capability Approval Port
**Files:** `approval-port/` (controller, service, module, interface,
architecture spec, unit tests).

Every "capability" (tool, action, side-effect) that requires human
approval goes through `ApprovalPort`. Approved by at least one
super-admin tenant role per RBAC §4.11. Architecture
(`approval-port.module.ts:12-22`):
- Public interface (`approval-port.interface.ts`) is a port.
- Adapters can be role-based, multi-party, or external (e.g. Brevo
  vendor payment).
- Consumers (`work-run-approval.consumer.ts`) read approved status off
  the event fabric.
- Architecture tests (`approval-port/architecture.spec.ts`).

### ADR-007 — Project ↔ Finance Integration
**Files:** `costs/consumers/finance-project.consumer.ts` (+ `.spec.ts`),
`costs/services/costs.service.spec.ts`.

Project events flow into the Finance module to compute cost records
(`CostRecord`), budget incidents (`BudgetIncident`), and the spec test
for `FinanceProjectConsumer` (Phase 8).

### ADR-009 — Governance evaluation as a port
**Files:** `governance/interfaces/governance-evaluator.interface.ts`,
`governance/governance.module.ts:26`.

`IGovernanceEvaluator` is the port other modules depend on. Concrete
`GovernanceRulesService` evaluates rule sets like `APPROVAL_REQUIRED`
thresholds, timeouts, etc. This isolation lets us plug in ML-based or
external rule engines later without touching runtime / approval code.

### ADR-011 — Enterprise Input
**Files:** `enterprise-events/contracts/enterprise-event-registry.ts:338`.

"Enterprise input" = any structured input that enters the platform
(email, customer message, form submission, etc.). Contracts are
frozen in the event registry.

### ADR-012 — Authorization + Business-effect idempotency
**Files:** `enterprise-events/idempotency/idempotency.service.ts`,
`context-plane/contracts/context-plane.interface.ts:10`.

Two halves:
1. **Authorization decision** is the result the Context Plane returns for
   "may this caller do X?" — exposed as a typed interface so the
   runtime can ASK before each step.
2. **Business-effect idempotency** lives in `IdempotencyService`
   (ADR-001 §6) — keyed on `(tenantId, idempotencyKey, businessEffect)`
   tuple. Effect-side, not transport-side.

### ADR-013 — Recommendations + action decisions
**Files:** `enterprise-events/contracts/enterprise-event-registry.ts:350, 368`.

Frozen contracts for "the platform proposes a recommendation" and "a
decision to act on a recommendation was recorded". Producers land in
Phase 5.

### ADR-014 — Decision plan + plan decision
**Files:** `enterprise-events/contracts/enterprise-event-registry.ts:356, 362`.

Frozen contracts for "a decision plan was formed" and "a plan decision
was recorded". The Work Runtime (ADR-003) is one producer (via planner
output as plan → step events as plan decisions).

---

## 3. Cross-cutting rules derived from these ADRs

1. **Every aggregate mutation MUST be transactional with its outbox
   event** (ADR-001 §8). Use the Command pattern (`common/commands/`).
2. **Never bypass the Context Plane** (ADR-002). When a tool needs
   "what can this user see/do?", call into the plane — don't query
   Prisma directly.
3. **Approval-gated capabilities MUST route through ApprovalPort**
   (ADR-006), not their own ad-hoc approval flow.
4. **Tools exposed to the agent graph MUST declare a Zod schema and a
   permission** (ADR-004 / ADR-001 §C governance rule).
5. **The enterprise events contract is frozen** (ADR-011–014). Don't
   change a published event shape; add a new one + version it.
6. **Legacy in-process runtime responses are disabled** (ADR-0001).
   New agent integrations go through the `hermes-adapter`.

---

## 4. How to reference ADRs in commits / PRs

When a commit enforces an ADR boundary:
```
feat(approval-port): wire Work-Runtime approval to ApprovalPort (ADR-006)
test(context-plane): add architecture test for ADR-002 boundary
fix(events): include outbox row in same tx (ADR-001 §8)
```

---

## 5. Source pointers

- `neurecore/memory-bank-arc/NeuroCore Architectural Constitution/` (canonical ADR prose).
- `neurecore/memory-bank-arc/EAOS-architectural-constitution.md`.
- `backend/src/modules/enterprise-events/` (ADR-001 implementation).
- `backend/src/modules/context-plane/` (ADR-002 implementation).
- `backend/src/modules/work-runtime/` (ADR-003/004 implementation).
- `backend/src/modules/approval-port/` (ADR-006 implementation).
- `backend/src/modules/costs/` (ADR-007 implementation).
- `backend/src/modules/governance/` (ADR-009 implementation).
- `backend/src/app.module.ts:187, 197, 201-202` (global registration).
- `backend/src/modules/hermes/services/agent-messaging.service.ts:128, 132` (ADR-0001).