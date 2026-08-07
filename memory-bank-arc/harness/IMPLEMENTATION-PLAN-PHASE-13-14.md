# Phase 13 + 14 — Agents + Command Center Implementation Plan

**Document:** NC-PLAN-PHASE-13-14
**Date:** 2026-08-06
**Branches:**
- `0013-agents` — Phase 13 work
- `0014-command-center` — Phase 14 work
- These land consecutively (PR-1 ships 13, PR-2 ships 14)
**Baseline:** `neurecore/memory-bank-new/docs/parity-v3/creatio-parity-baseline.yaml` v1.0.0
**Phase 12 reference:** `neurecore/memory-bank-arc/harness/PHASE12-KNOWLEDGE-FILES.md`

> Two phases combined into a single planning session because they
> share the same architectural seam (telemetry). They land as two
> PRs (PR-1 = P13, PR-2 = P14). Both ship before any new code lands.

---

## 0. Executive summary

| Phase | Capabilities | Going IN | Going OUT |
|---|---|---|---|
| **P13** Agents | 6 caps (CR-AI-0501..0506) + 1 (CR-AI-0603 NL draft skill) | mostly NOT_STARTED | **6 → IN_PROGRESS / CERTIFIED eligible** |
| **P13** Skills | 1 cap (CR-AI-0601 skill definition lifecycle) | IN_PROGRESS | **CERTIFIED eligible** |
| **P13** Skills | 1 cap (CR-AI-0602 visual composer) | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| **P14** Command Center | 7 caps (CR-AI-1201..1207) | 6 NOT_STARTED, 1 IN_PROGRESS | **7 → IN_PROGRESS / CERTIFIED eligible** |

---

## 1. Audit before change

Both modules already ship real plumbing. Phase 13/14's job is:

| Surface | Status today | What we add |
|---|---|---|
| 6 OOB agents (UNIVERSAL, PRODUCTIVITY, SALES, MARKETING, SERVICE, KNOWLEDGE) | real, ~110-165 lines each | A typed `AgentRegistry` that lists them by id, with a single boot-time registration point + `agents:list` / `agents:get` HTTP routes (currently absent) |
| `agent-templates/services/` | 5 services (skill-graph / nl-draft / oob-agent-registration / skill-simulation / skill-version-diff) | A `AgentCatalogService` + `OobAgentRegistrationService` boot hook that registers 6 OOB agents at startup (so the registry is the runtime truth, not a static map) |
| `agent-templates/controllers/skill-composer.controller.ts` | real | No change needed; we certify it via a gate runner |
| Tenant FE `/marketplace/composer/page.tsx` | 166 lines (typed skeleton) | Add the typed graph save / load via the controller's `save / load / simulate` routes; FLIP from `implemented: false` to `implemented: true` after the cert runner passes |
| `command-center/services/` | 7 services, real, 121-393 lines each | Add `**/*.spec.ts` for the 2 that don't have tests (`command-center.service.ts`), wire a tenant filter on `kill-switches` collection if missing, ensure all 7 services are exported + reachable through one boot module |
| `command-center/controllers/command-center.controller.ts` | 331 lines, 16 routes | No route change; FLIP `implemented: false` markers → `true` after the cert runner passes |
| Admin FE `/command-center/` | already has command-center module + service | Add a `StepDownShell`-style command-center route if not present (Phase 14 surface) |

### Files that already exist (no implementation needed)

- All 6 agent instance files
- All 5 agent-templates services
- All 7 command-center services + DTOs + controller
- Composer controller + service + 5 services
- `command-center.service.ts` aggregator

### Files NEW in this PR (≤ 32)

```
P13 (≤ 18):
- backend/src/modules/agent-templates/agents.registry.ts         (NEW — the runtime truth)
- backend/src/modules/agent-templates/agents.registry.spec.ts    (NEW — ≥8 tests)
- backend/src/modules/agent-templates/controllers/agents.controller.ts (NEW — list/get HTTP)
- backend/src/modules/agent-templates/controllers/agents.controller.spec.ts (NEW)
- backend/src/modules/agent-templates/agent-templates.module.ts   (EDIT — wire registry + controller; OnApplicationBootstrap)
- backend/src/modules/agent-templates/services/oob-agent-registration.service.ts (EDIT — register into the registry, not a static map)
- backend/src/modules/skill-registry/skills/nl-draft.skill.ts     (NEW — Phase 13 NL draft skill)
- backend/src/modules/skill-registry/skills/nl-draft.skill.spec.ts (NEW)
- backend/src/modules/skill-registry/skills/index.ts              (EDIT — barrel export)
- backend/src/modules/skill-registry/skill-registry.module.ts    (EDIT — register nl-draft)
- backend/src/modules/skill-registry/skills/skills.spec.ts        (EDIT — cover nl-draft validateInput)
- backend/src/modules/skill-registry/skills/wrap-draft-report.skill.ts (NEW — adapter so FE /wrap-draft-report keeps working through the renamed path)
- backend/src/test/certification/phase13-certification.runner.ts  (NEW — 8 gates)
- backend/src/test/certification/g13-agents.spec.ts              (NEW — jest entry)
- backend/src/test/certification/agent-registry-integrity.spec.ts (NEW — F-1 guard for agents)
- backend/src/test/certification/skill-registry-integrity.spec.ts (EDIT — expect 10 skills now)

P14 (≤ 14):
- backend/src/modules/command-center/controllers/command-center.controller.spec.ts (NEW)
- backend/src/modules/command-center/services/inventory-with-hygiene.service.ts (NEW — wrapper that shapes existing inventory output for the cc UI)
- backend/src/modules/command-center/services/inventory-with-hygiene.service.spec.ts (NEW)
- backend/src/modules/command-center/services/cost.cents.service.ts             (NEW — exact cents, no floating point; CC dashboard uses cents)
- backend/src/modules/command-center/services/cost.cents.service.spec.ts        (NEW)
- backend/src/modules/command-center/services/kill-switch-with-tenant-guard.spec.ts (NEW)
- backend/src/modules/command-center/services/kill-switch.tenant-scope.service.ts (NEW — wraps existing, asserts tenant scope)
- backend/src/modules/command-center/services/inventory.repository.ts            (NEW — Prisma-only DTO layer)
- backend/src/test/certification/phase14-certification.runner.ts  (NEW — 7 gates)
- backend/src/test/certification/g14-command-center.spec.ts      (NEW)
- frontend-tenant/src/app/command-center/page.tsx (NEW — tenant surface)
- frontend-tenant/src/app/command-center/page.spec.tsx (NEW — minimal smoke; we don't add a fully covered RT in this PR to keep Phase 14 PR tight)
- frontend-admin/src/app/command-center/page.tsx  (NEW — admin surface)

Documentation (2):
- neurecore/memory-bank-arc/harness/IMPLEMENTATION-PLAN-PHASE-13-14.md (NEW — this file)
- neurecore/memory-bank-arc/harness/PHASE13-14-AGENTS-COMMAND-CENTER.md (NEW — parity delta)
```

---

## 2. SOLID commitments

| Principle | Application |
|---|---|
| **SRP** | `AgentRegistry` is a list/get surface, nothing else. `CommandCenterService` is an aggregator over the seven CC services. The KillSwitchTenantScope guard is one module separate from the core. |
| **OCP** | Adding an 8th OOB agent is one new file + one `register()` call. Adding an 8th CC sub-surface is one new Service + one new DTO + one new controller route + one new registry entry. |
| **LSP** | Every agent entry substitutes `IAgentDefinition` consistently. Every CC sub-surface answers a uniform `SummaryEnvelope<T>` (`summary + cards + counts`). |
| **ISP** | `IAgentDefinition` is `name + description + skills + allowedTools + run()`. `CCInventoryQuery` is `agentIds? skillIds? channelKinds?` — narrow shape, not a fat query object. |
| **DIP** | `AgentsController` depends on `AgentRegistry`, not on the static `OOB_AGENTS` array. CC services depend on Prisma interfaces, never on a controller. |

---

## 3. Architecture

### Phase 13

```
                ┌────────────────────────────────────┐
                │ AgentsController (Phase 13)       │  GET /agents, /agents/:id
                └────────────────┬───────────────────┘
                                 │
                ┌────────────────▼───────────────────┐
                │ AgentRegistry (NEW)                │
                │   Map<AgentId, IAgentDefinition>   │
                │   - register(def)                   │
                │   - list() / get(id)                │
                │   - boot: OobAgentRegistration       │
                └────────────────┬───────────────────┘
                                 │
                ┌────────────────▼───────────────────┐
                │ OOB Agent Instances (pre-existing) │
                │  - UNIVERSAL                       │
                │  - PRODUCTIVITY                    │
                │  - SALES                           │
                │  - MARKETING                       │
                │  - SERVICE                          │
                │  - KNOWLEDGE                        │
                └────────────────────────────────────┘
```

### Phase 14

```
                ┌──────────────────────────────────────┐
                │ CommandCenterController (pre-existing)│ GET /command-center/{summary,timeline,cost,...}
                └────────────────┬─────────────────────┘
                                 │
                ┌────────────────▼─────────────────────┐
                │ CommandCenterService (pre-existing)  │
                │  - aggregator only; one call per route│
                └────────────────┬─────────────────────┘
                                 │
        ┌────────────┬───────────┼───────────┬───────────┬─────────────┐
        │            │           │           │           │             │
    Inventory    Quality       Cost   ModelHealth ChannelHealth  SecurityEvents
   .service.ts  .service.ts    .service.ts   .service.ts    .service.ts        .service.ts
                                                   │
                                              KillSwitch
                                              .service.ts

   NEW Phase 14 wrappers:
   - inventory-with-hygiene (decorates existing inventory with typed summary cards)
   - cost.cents (cents-only money math, no floats)
   - kill-switch.tenant-scope (assertTenantContext, refuses '*')
```

---

## 4. Contracts (typed)

```ts
// Phase 13 — IAgentDefinition
interface IAgentDefinition {
  readonly id: AgentId;          // 'universal' | 'productivity' | 'sales' | ...
  readonly displayName: string;
  readonly description: string;
  readonly version: string;
  readonly certifiedAt: string;
  readonly skills: ReadonlyArray<AgentSkillRef>;
  readonly implemented: boolean;       // derived from registry presence
  readonly maxConcurrency: number;
}

// Phase 13 — NLDraftSkill (CR-AI-0603)
// inputs: { naturalLanguage: string, targetMode: 'chat' | 'workflow', refusedActivation: true }
// behavior: drafts a SkillGraph WITHOUT activating (no auto-publish)

interface NLDraftSkillInput {
  readonly naturalLanguage: string;
  readonly targetMode: 'chat' | 'workflow';
}

interface NLDraftSkillOutput extends SkillOutput<{
  readonly draftGraph: { nodes: ReadonlyArray<...>; edges: ReadonlyArray<...> };
  readonly explainedIntents: ReadonlyArray<string>;
  readonly refusedActivation: true;
}> {}

// Phase 14 — CC summary envelope
interface CCSummaryEnvelope<T> {
  readonly summary: T;                 // one-line human summary
  readonly cards: ReadonlyArray<{ title: string; value: number; status: 'green' | 'amber' | 'red' }>;
  readonly counts: ReadonlyArray<{ key: string; value: number }>;
}

// Phase 14 — Cents (no floats)
type Cents = number & { readonly __brand: 'Cents' };
function toCents(usd: number): Cents;
```

---

## 5. Data model (additive only)

### 5.1 `command-center` tables (already exist via `audit/`, `decision-evaluations/`, etc.)

No new tables. CC services already use existing `auditLog`, `aiTwin`, `driftBaseline`, `killSwitch` tables. Phase 14's new stuff is **read-only** over those tables — no schema changes.

### 5.2 Knowledge article (added in Phase 12)

No further changes. Phase 13's `NLDraftSkill` produces a JSON draft; phase 14's CC overview surfaces it.

---

## 6. Verification matrix

| Gate | Required |
|---|---|
| `nest build` exit 0 | yes |
| Frontend `tsc --noEmit` exit 0 | yes |
| Phase 11 G11 stays APPROVED | yes |
| Phase 12 G12 stays APPROVED | yes |
| Phase 13 G13 APPROVED | yes |
| Phase 14 G14 APPROVED | yes |
| `SkillRegistryImplementsFlag` integrity guard ≥ 10 skills (nl-draft added) | yes |
| `AgentRegistryImplementsFlag` integrity guard ≥ 6 OOB agents | yes |
| `CommandCenterService` aggregates all 7 surfaces | yes |
| Cents-based math has no float | yes |

---

## 7. Honest risks

1. **Demo agents vs certifiable agents.** OOB agents are typed but their permission mirrors are demo-grade. Phase 15 (Steering Gate) hardens them.
2. **Command Center scale.** All seven services aggregate by tenantId. For ≥ 100 tenants, a per-tenant cache materializes; we don't add that here.
3. **`nl-draft` skill never publishes.** Required per CR-AI-0603: "NL drafts graphs but never activates without review." Enforced via `refusedActivation: true` in the typed envelope.
4. **KillSwitch security.** Phase 14 wraps the existing service with a tenant-scope check; missing this was a previously-identified defect.

---

## 8. Run commands

```bash
cd backend
./node_modules/.bin/nest build
./node_modules/.bin/jest --config jest.config.js \
  src/modules/agent-templates \
  src/modules/command-center \
  src/test/certification/g13-agents \
  src/test/certification/g14-command-center \
  src/test/certification/agent-registry-integrity
cd frontend-tenant
npx tsc --noEmit
```

---

## 9. Document control

- 2026-08-06 — created. Owner: `@agents`, `@command-center`, `@chat-product`.
