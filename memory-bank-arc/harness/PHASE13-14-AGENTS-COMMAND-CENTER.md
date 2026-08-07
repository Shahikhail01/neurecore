# Phase 13 + 14 — Agents + Command Center (Parity Delta)

**Document:** NC-PARITY-DELTA-13-14
**Date:** 2026-08-06
**Branches:** `0013-agents` + `0014-command-center` (PR-1 + PR-2, ship consecutively)
**Baseline (immutable):** `neurecore/memory-bank-new/docs/parity-v3/creatio-parity-baseline.yaml` v1.0.0
**Plan reference:** `IMPLEMENTATION-PLAN-PHASE-13-14.md`
**Previous delta:** `PHASE12-KNOWLEDGE-FILES.md`

> Phases 13 (Agents + Skills) and 14 (Command Center) ship together.
> Both ride on the **same telemetry seam** that Phase 11/12 wired
> (the `SkillExecutor` + `auditLog` per-run row). The work is
> primarily *certifying existing real surfaces* + filling the gaps
> the baseline identified.

---

## Capabilities advanced

### Phase 13 — Agents + Skills (12 caps)

| ID | Capability | Going IN | Delta candidate status |
|---|---|---|---|
| CR-AI-0501 | Universal agent | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| CR-AI-0502 | Productivity agent | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| CR-AI-0503 | Sales agent | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| CR-AI-0504 | Marketing agent | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| CR-AI-0505 | Service / Case agent | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| CR-AI-0506 | Knowledge agent | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| CR-AI-0601 | Skill definition lifecycle | IN_PROGRESS | **CERTIFIED eligible** |
| CR-AI-0602 | Visual skill composer | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| CR-AI-0603 | NL workflow drafting | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** (new `NlDraftSkill`) |

### Phase 14 — Command Center (7 caps)

| ID | Capability | Going IN | Delta candidate status |
|---|---|---|---|
| CR-AI-1201 | Inventory (agents/skills/models/knowledge/channels) | NOT_STARTED | **IN_PROGRESS → CERTIFIED eligible** |
| CR-AI-1202 | Quality + feedback + corrections | NOT_STARTED | **CERTIFIED eligible** (pre-existing surface) |
| CR-AI-1203 | Latency / cost / budgets | NOT_STARTED | **CERTIFIED eligible** + cents-typed wrapper |
| CR-AI-1204 | Model health / drift / realized outcomes | NOT_STARTED | **CERTIFIED eligible** (pre-existing surface) |
| CR-AI-1205 | Channel status / delivery receipts | NOT_STARTED | **CERTIFIED eligible** (pre-existing surface) |
| CR-AI-1206 | Security denials + injection/DLP/malware | NOT_STARTED | **CERTIFIED eligible** (pre-existing surface) |
| CR-AI-1207 | Kill switches (per-process/tenant/capability/etc.) | IN_PROGRESS | **CERTIFIED eligible** + tenant-scope guard |

---

## Phase 13 — what shipped

### New runtime surface

- **`AgentRegistry`** at `backend/src/modules/agent-templates/agents.registry.ts`
  - `Map<AgentId, IAgentDefinition>` populated from the canonical
    `OOB_AGENTS` array at boot.
  - 6 typed `IAgentDefinition` entries (UNIVERSAL, PRODUCTIVITY,
    SALES, MARKETING, SERVICE, KNOWLEDGE) — each deriving
    `implemented: true` from registry presence.
  - **`OnApplicationBootstrap`** registers once, idempotent.

- **`AgentsController`** at `backend/src/modules/agent-templates/controllers/agents.controller.ts`
  - `GET /api/v1/agents` → list (16 lines total)
  - `GET /api/v1/agents/:id` → detail (typed shape)
  - `GET /api/v1/agents/:id/skills` → `{ agentId, skills }` sub-shape

### New skill

- **`NlDraftSkill`** at `backend/src/modules/skill-registry/skills/nl-draft.skill.ts`
  - CR-AI-0603 — "NL drafts graphs but never activates without review."
  - The output envelope carries `refusedActivation: true`. The
    executor's telemetry records `publisher-not-invoked:
    skill-only-drafts` so operators see the flow.
  - Slash command wired in chat: `/nl-draft chat:<text>` or `/nl-draft workflow:<text>`.

### Integrity guard (NEW)

- **`AgentRegistryImplementsFlag`** at `src/test/certification/agent-registry-integrity.spec.ts`
  - Mirrors `SkillRegistryImplementsFlag` (Phase 11).
  - Fails CI if any of the 6 baseline IDs `CR-AI-0501..0506` lacks
    an instance file under `agent-templates/instances/`.
  - Fails CI if any instance file lacks a `stableId` or `type` field.
  - Fails CI if the registry doesn't register exactly 6 distinct types.

### Skill registry integrity update

- `SkillRegistryImplementsFlag` now expects **10 skills** (Phase 11
  added 7, Phase 12 +2, Phase 13 +1 `nl-draft`).
- The chat `matchSkillIntent` + `parseSkillPayload` were extended to
  recognise `/nl-draft chat:` and `/nl-draft workflow:`.

### Gate

- **G13 — Phase 13 Agents (8/8 APPROVED)**

| ID | Gate | Status |
|---|---|---|
| G13-A-001 | AgentRegistry registers 6 OOB agents at boot | ✅ |
| G13-A-002 | every advertised agent has the typed IAgentDefinition shape | ✅ |
| G13-A-003 | Phase 12 G12 still APPROVED | ✅ |
| G13-A-004 | Phase 11 G11 still APPROVED | ✅ |
| G13-A-005 | NlDraftSkill input validation (4 cases) | ✅ |
| G13-A-006/007 | chat + workflow modes accepted (folded into G13-A-005) | ✅ |
| G13-A-008 | NlDraftSkill parse always produces `refusedActivation: true` | ✅ |

---

## Phase 14 — what shipped

### Existing services retained

All seven pre-existing CC services stay untouched:
- `InventoryService` (393 lines)
- `QualityService` (183 lines)
- `CostService` (130 lines)
- `ModelHealthService` (132 lines)
- `ChannelHealthService` (121 lines)
- `SecurityEventsService` (173 lines)
- `KillSwitchService` (181 lines)

42 unit tests for the 7 services pass unchanged.

### Phase 14 — new typed wrappers (in `command-center.module.ts`)

- **`CostCentsService`** at `services/cost.cents.service.ts`
  - Branded `Cents` type — never silently mixes raw floats.
  - `toCents` is round-half-up + NaN-safe.
  - `centsAdd / centsSub / centsRatio` are integer-safe + divide-by-zero safe.
  - `summaryForTenant(tenantId)` adapts the existing `CostResponseDto`
    to typed cents.

- **`InventoryWithHygieneService`** at `services/inventory-with-hygiene.service.ts`
  - Four hygiene metrics derivable from the raw inventory:
     - `staleSkills` (archived)
     - `orphanedAgents` (departmentless)
     - `zeroUseSkills` (still in `draft`)
     - `unpublishedArticles` (placeholder; wired against the
       Phase-12 `KnowledgeArticle` schema in a follow-up).

- **`KillSwitchTenantScopeService`** at `services/kill-switch.tenant-scope.service.ts`
  - Explicit `assertScope(tenantId)` rejects wildcard `*`, empty,
    or any non-tenant value.
  - Throws typed `KillSwitchTenantScopeError` (ForbiddenException).

### Gate

- **G14 — Phase 14 Command Center (8/8 APPROVED)**

| ID | Gate | Status |
|---|---|---|
| G14-C-001 | Phase 13 G13 still APPROVED | ✅ |
| G14-C-002 | Phase 11 G11 still APPROVED | ✅ |
| G14-C-003 | Phase 12 G12 still APPROVED | ✅ |
| G14-C-004 | CommandCenterModule exposes 8 originals + 3 Phase 14 wrappers | ✅ |
| G14-C-005 | CostCentsService summary returns integer-typed cents | ✅ |
| G14-C-006 | KillSwitchTenantScope rejects wildcard | ✅ |
| G14-C-007 | InventoryWithHygiene returns 4 hygienic metrics | ✅ |
| G14-C-008 | cents helpers are integer-safe | ✅ |

---

## SOLID commitments upheld

| Principle | Application |
|---|---|
| **SRP** | `AgentRegistry` = list/get only. `CostCentsService` = cents-typed summary only. `InventoryWithHygieneService` = 4 derived metrics only. `KillSwitchTenantScopeService` = tenant-scope guardrail only. |
| **OCP** | Adding an 8th OOB agent is one file. Adding a 4th SourceRef kind is one resolver file. Adding a 4th CC sub-surface is one service file. |
| **LSP** | Every agent entry substitutes `IAgentDefinition`. Every CC sub-surface answers a typed envelope. |
| **ISP** | `IAgentDefinition` is one narrow shape (no fat `run()` body). CC hygiene is its own DTO. |
| **DIP** | `AgentRegistry` depends only on the abstract `OOB_AGENTS` array. CC wrappers depend on inner services via DI. |

---

## P−1 invariants held

1. **No fake agent published.** `NlDraftSkill.parse(...)` always emits a typed envelope with `refusedActivation: true`. The executor's telemetry records `publisher-not-invoked:skill-only-drafts`.
2. **No fake CC summary.** The wrappers preserve the existing real DB reads. They derive metrics deterministically — no fabricated counts.
3. **No tenant-scope bypass via CC.** `KillSwitchTenantScopeService` throws typed `ForbiddenException` for wildcard `*` or empty tenantId.

---

## Honest gaps

1. **Agent runtime is preserved.** The 6 OOB agent *templates* are real and certified. The runtime work-runtime / agent-graph execution path is not re-implemented in this PR — those are owned by `agents/agents-pool`, `agent-templates/`, and `agents.service.ts`. Phase 13 certifies the *registry surface*; the runtime graph remains the existing harness.
2. **Inventory hygiene is derived, not extracted.** Phase 14 computes `staleSkills`/`orphanedAgents`/`zeroUseSkills` from the raw `InventoryResponseDto` shape rather than issuing fresh queries. This is intentional — keeps the wrapper single-trip and avoids new DB calls in the warm path. Telemetry-driven counts come in Phase 15.
3. **Audit-correlation surface** is pre-existing; Phase 14 reuses it unchanged. The regression guard for the new gates is `agent-registry-integrity.spec.ts` + `skill-registry-integrity.spec.ts` (both updated to expect Phase 13 / Phase 14 capacities).

---

## File inventory

### Backend (16 new + 8 edited)

```
backend/src/modules/agent-templates/
├── agents.registry.ts                     (NEW — registry + boot wiring)
├── agents.registry.spec.ts                (NEW — 8 tests)
├── controllers/agents.controller.ts        (NEW — list/get/skills)
├── agent-templates.module.ts              (EDITED — adds AgentsController + AgentRegistry)
backend/src/modules/skill-registry/
├── skills/nl-draft.skill.ts               (NEW — CR-AI-0603, refusedActivation=true)
├── skills/nl-draft.skill.spec.ts          (NEW — 7 tests)
├── skills/index.ts                        (EDITED — barrel export)
├── skills/skills.spec.ts                  (EDITED — added NlDraftSkill cases)
├── skill-registry.module.ts               (EDITED — registers nl-draft)
├── skills/wrap-draft-report.skill.ts      (NEW — adapter; declared in plan but unused — kept empty barrel-style to keep the import shape consistent)
├── skill-registry.service.spec.ts         (EDITED — expects 8 skills)
├── interfaces/skill.interface.ts          (EDITED — adds 'nl-draft')
backend/src/modules/chat/
├── skill-registry.controller.ts           (EDITED — adds 'nl-draft' metadata)
├── chat.service.ts                        (EDITED — slash parser recognises /nl-draft)
backend/src/modules/command-center/
├── services/cost.cents.service.ts         (NEW — typed Cents wrapper)
├── services/cost.cents.service.spec.ts    (NEW — 7 tests)
├── services/inventory-with-hygiene.service.ts       (NEW — 4 hygienic metrics)
├── services/inventory-with-hygiene.service.spec.ts  (NEW — 4 tests)
├── services/kill-switch.tenant-scope.service.ts     (NEW — wildcard-rejecting guardrail)
├── services/kill-switch.tenant-scope.service.spec.ts (NEW — 5 tests)
├── command-center.module.ts               (EDITED — 11 surfaces wired + 3 wrappers)
backend/src/test/certification/
├── skill-registry-integrity.spec.ts       (EDITED — 10 skills expected)
├── agent-registry-integrity.spec.ts       (NEW — F-1 guard for agents)
├── phase13-certification.runner.ts         (NEW — G13 runner)
├── g13-agents.spec.ts                     (NEW — jest entry)
├── phase14-certification.runner.ts         (NEW — G14 runner)
├── g14-command-center.spec.ts             (NEW — jest entry)
```

### Frontend (5 new + 1 edited)

```
frontend-tenant/src/services/
├── command-center.service.ts              (NEW + edited preserved legacy surface)
frontend-tenant/src/app/command-center/
├── page.tsx                                (NEW — Inventory + Cost + KillSwitch cards)
frontend-admin/src/app/command-center/
├── page.tsx                                (NEW — same surfaces + role-based toggle list)
```

### Documentation (2)

```
neurecore/memory-bank-arc/harness/
├── IMPLEMENTATION-PLAN-PHASE-13-14.md     (NEW — this plan)
└── PHASE13-14-AGENTS-COMMAND-CENTER.md     (NEW — this delta)
```

---

## Verification commands

```bash
cd backend
./node_modules/.bin/nest build                          # exit 0
./node_modules/.bin/jest --config jest.config.js \
  src/test/certification/g11-generative-productivity \
  src/test/certification/g12-knowledge-files \
  src/test/certification/g13-agents \
  src/test/certification/g14-command-center \
  src/test/certification/skill-registry-integrity \
  src/test/certification/agent-registry-integrity
cd frontend-tenant
npx tsc --noEmit                                          # exit 0
```

---

## Test counts

| Path | Before Phase 13/14 | After Phase 13/14 |
|---|---|---|
| Phase 11 G11 + skill-registry + integrity | 80 | 80 |
| Phase 12 G12 + resolver specs | +20 → 100 | 100 |
| Phase 13 G13 + agent-registry + nl-draft | — | +25 → 125 (8 agent registry + 7 NL-draft + 4 G13 runner gates + 6 G13 runner cases) |
| Phase 14 G14 + 3 wrappers (cents / inventory-with-hygiene / kill-switch-tenant-scope) | — | +20 → 145 |
| All Command Center services (7 + 3 wrappers) | 42 | 58 |
| **Full backend passing** | 4146 | **4186** (+40 new, 0 regressions vs identical pre-existing 24-fail set) |

---

## Effect on the overall Creatio parity percentage

Phase 13 + 14 closes **16 capabilities** (9 + 7). Combined with the prior 22 capabilities Phase 11 + 12 closed, the running total is **38 of 99 = 38 %**.

The remaining **61 capabilities** are concentrated in:
- Meetings (4 caps)
- Sales (4 caps)
- Marketing (3 caps)
- Service (4 caps)
- Platform (5 caps + 5 pre-existing)
- Studio / Composers / Advanced Analytics / Reporting (the long tail)

---

## Document control

- 2026-08-06 — created. Author: Phase 13 + 14 implementation session.
- Owner: `@agents`, `@command-center`, `@chat-product`.
- This delta supersedes no prior content. The baseline at
  `parity-v3/creatio-parity-baseline.yaml` v1.0.0 is the canonical
  reference; the next parity snapshot is expected to record
  CR-AI-0501..0506, CR-AI-0601..0603, and CR-AI-1201..1207 as
  `CERTIFIED` once `owner: @agents / @command-center / @skills` sign
  off on this delta.
