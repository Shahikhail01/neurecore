# Hermes Rename Inventory

**Generated:** 2026-07-29 (Phase 1 preparation)
**Plan ref:** NC-AWL-IMP-2 §Phase 0 (Freeze, Rename, Baseline)
**Total matches:** ~1,500+ across main tree; ~1,130 in `neurecore-ci-check/` duplicate

This is the **inventory** for the Phase 0 rename. The actual rename is a separate
Phase 0 workstream (2–3 days) — this doc is the prerequisite so the rename is
done in one coordinated sweep, not piecemeal.

## Mapping (approved)

| Current | Rename to |
|---|---|
| `HermesRuntimeService` | `NeureCoreRuntimeService` |
| `HermesAgent` (Prisma model) | `AgentProfile` |
| `HermesMemoryEntry` (Prisma model) | `AgentMemoryEntry` |
| `HermesSession`, `HermesMessage`, `HermesAuditLog`, `HermesCapability`, `HermesToolPermission` | `AgentSession`, `AgentMessage`, `AgentAuditLog`, `AgentCapability`, `AgentToolPermission` |
| `HermesAgentType`, `HermesAgentStatus`, `HermesMemoryType` (enums) | `AgentProfileType`, `AgentProfileStatus`, `AgentMemoryType` |
| `HERMES_*` env vars | `NEURECORE_RUNTIME_*` |
| `HermesType` flags | `AgentProfileType` |
| `hermes-agent` (npm/scripts) | `agent-profile` |
| `modules/hermes/` directory | `modules/agent-runtime/` |
| `HermesModule` (NestJS module) | `AgentRuntimeModule` |
| `HermesProjectChannel` | `AgentRuntimeProjectChannel` |
| `/api/v1/hermes/*` API routes | `/api/v1/agent-runtime/*` |
| `'HERMES'` literal in `threads.service.ts` (chat role) | `'AGENT'` |
| `'hermes'` literal in `sourceModule` enum | `'agent_runtime'` |

## Categories (by source type)

### 1. SOURCE CODE — `backend/src/` (~635 matches)

| Subdirectory | Files | Rename-needed |
|---|---|---|
| `modules/hermes/` (entire module) | 30+ files | Yes (module rename) |
| `modules/hermes-adapter/` (Phase 1 +) | new | defer to Phase 1 |
| `modules/agents/` (referencing Hermes*) | 6 files | Yes |
| `modules/chat/` | 4 files | Yes |
| `modules/command-center/` | 1 file | Yes |
| `modules/context-plane/` | 2 files | Yes |
| `modules/approval-port/` | 2 files | Yes |
| `modules/information-engine/` | 2 files | Yes |
| `modules/project-events/hermes-project-channel.service.ts` | 1 file | Yes (move + rename) |
| `modules/projects/` | 3 files | Yes |
| `modules/project-shape/` | 2 files | Yes |
| `modules/enterprise-events/` | 1 test | Yes |
| `modules/work-runtime/` | 3 files | Yes (schema-rename) |
| `modules/ai-gateway/` | 1 file | Yes |
| `modules/mission-feed/` | 1 file | Yes |
| `modules/routines/` | 1 file | Yes |
| `modules/threads/`, `modules/activity/`, `modules/metrics/` | 3 files | Yes |
| `modules/enterprise-cognition/` | 1 file | Yes |
| `modules/tools/built-in/hermes-tools.ts` | 1 file | Yes |
| `modules/tools/built-in/neurecore-tools.ts` | 1 file | Yes (comments) |
| `modules/tools/structured-tool.registry.ts` | 1 file | Yes (comment) |
| `app.module.ts` | 1 file | Yes |
| `common/feature-flag/feature-flag.service.ts` | 1 file | Yes |
| `common/feature-flag/dto/feature-flag.dto.ts` | 1 file | Yes |
| `common/enterprise/architecture-rules.ts` | 1 file | Yes (regex update) |
| `simulations/` | 2 files | Yes (schema-rename) |

### 2. DATABASE — Prisma schema + migrations (~96 matches)

**`backend/prisma/schema.prisma`:**
- L153, 155: `enum HermesAgentType` → `AgentProfileType`
- L172: `enum HermesAgentStatus` → `AgentProfileStatus`
- L250: `enum HermesMemoryType` → `AgentMemoryType`
- L590-592: Tenant relations `hermesAgents`, `hermesSessions`, `hermesMemoryEntries` → `agentProfiles`, `agentSessions`, `agentMemoryEntries`
- L763: User relation `hermesSessions` → `agentSessions`
- L987-989: `Agent.hermesAgentId` → `Agent.profileId`, `hermesAgent` relation → `agentProfile`
- L1877: sourceModule enum value `'hermes'` → `'agent_runtime'`
- L3615-3799: 7 Prisma models (`HermesAgent`, `HermesCapability`, `HermesToolPermission`, `HermesSession`, `HermesMessage`, `HermesMemoryEntry`, `HermesAuditLog`) → rename all
- L5097: ChatSession/CommunicationThread `hermesAgentId` → `profileId`

**`backend/prisma/.map-allowlist`** (7 entries): all 7 model names need updating.

**Migration SQL files (~7 files):**
- `migrations/20260709_projects_phase2e_hermes_integration/migration.sql`
- `migrations/20260711_comms_01_thread_model/migration.sql`
- `migrations/20260714_work_runtime/migration.sql`
- `migrations/20260719_chat_persistence/migration.sql` (comment)
- `migrations/20260719_project_derived_shape/migration.sql` (comment)
- `migrations/20260720_array_not_null_constraints/migration.sql`
- `migrations/20260720_hermes_referential_integrity/migration.sql`
- `migrations/20260721_validate_fk_constraints/migration.sql`

**All of these are IMMUTABLE migration history** — they preserve the original schema at the time. The DB rename is achieved by a **new migration** that renames tables/columns/enums in the live DB. The historical migrations keep their references so `prisma migrate diff` and `prisma migrate status` still work.

**Required migration action:** add a new migration `20260729_hermes_rename` that:
- `ALTER TABLE "HermesAgent" RENAME TO "AgentProfile";`
- `ALTER TABLE "HermesSession" RENAME TO "AgentSession";`
- `ALTER TABLE "HermesMessage" RENAME TO "AgentMessage";`
- `ALTER TABLE "HermesMemoryEntry" RENAME TO "AgentMemoryEntry";`
- `ALTER TABLE "HermesAuditLog" RENAME TO "AgentAuditLog";`
- `ALTER TABLE "HermesCapability" RENAME TO "AgentCapability";`
- `ALTER TABLE "HermesToolPermission" RENAME TO "AgentToolPermission";`
- `ALTER INDEX ... RENAME TO ...` for all indexes
- `ALTER CONSTRAINT ... RENAME TO ...` for all FK constraints
- `ALTER TYPE "HermesAgentType" RENAME TO "AgentProfileType";`
- `ALTER TYPE "HermesAgentStatus" RENAME TO "AgentProfileStatus";`
- `ALTER TYPE "HermesMemoryType" RENAME TO "AgentMemoryType";`
- `ALTER TABLE "Agent" RENAME COLUMN "hermesAgentId" TO "profileId";`
- `UPDATE "..." SET "sourceModule" = 'agent_runtime' WHERE "sourceModule" = 'hermes';`
- `UPDATE "HermesMessage" SET "role" = 'AGENT' WHERE "role" = 'HERMES';` (chat role string)

### 3. TEST FILES — `backend/test/` (~98 matches)

| File | Action |
|---|---|
| `hermes-context.service.spec.ts` | rename to `agent-runtime-context.service.spec.ts` |
| `hermes-runtime.service.spec.ts` | rename to `agent-runtime.service.spec.ts` |
| `hermes-memory.service.spec.ts` | rename to `agent-runtime-memory.service.spec.ts` |
| `hermes-router-node.spec.ts` | rename to `agent-runtime-router-node.spec.ts` |
| `feature-flag.service.spec.ts` | update stale comments about `HERMES_ENABLED` retired |
| `approval-workflow.engine.spec.ts` | update import path |
| `work-runtime-db.spec.ts` | update `hermesAgentId` → `profileId` in 8 fixtures |
| `enterprise-events/architecture.spec.ts` | update path walks `path.join(MOD, 'hermes')` |

### 4. CONFIG — env, yaml, json, openapi (~48 matches)

**`backend/.env`** (5 entries):
- `HERMES_ENABLED=true` → `NEURECORE_RUNTIME_ENABLED=true`
- `HERMES_AUTO_LINK=true` → `NEURECORE_RUNTIME_AUTO_LINK=true`
- `HERMES_APPROVAL_REQUIRED=false` → `NEURECORE_RUNTIME_APPROVAL_REQUIRED=false`
- `HERMES_SESSION_LOGGING=true` → `NEURECORE_RUNTIME_SESSION_LOGGING=true`
- Related comments

**`backend/.env.production`** (5 entries): same as above.

**`backend/package.json:21`**: `test:legacy` script — rename 4 file paths.

**`backend/openapi/openapi.json`**: 3 entries (path, schema key, description).

### 5. FRONTEND — `frontend-tenant/src/` (~18 matches)

| File | Action |
|---|---|
| `services/threads.service.ts:25` | `'HERMES'` literal → `'AGENT'` (chat role enum) |
| `hooks/useServerFeatureFlag.ts:10-21` | flag-key type union → `NEURECORE_RUNTIME_*` |
| `components/threads/ThreadView.tsx:82,92,148` | `case 'HERMES'`, label `'Agent'`, `msg.role === 'HERMES'` |
| `components/discovery/AdaptiveNextButton.tsx:5,21` | comment + JSX label `'Ask Hermes'` |
| `components/discovery/skins/InterviewSkin.tsx:4,6,98` | comment + JSX `{isAssistant ? 'Hermes' : 'You'}` |
| `services/projectTypes.service.ts:214,230` | comments |
| `services/featureFlags.service.ts:3` | comment |

### 6. FRONTEND — `frontend-admin/src/` (~21 matches)

| File | Action |
|---|---|
| `core/services/chat/slash-commands/AdminSlashCommands.ts:59` | user-facing slash command string |
| `services/adminFeatureFlags.service.ts:9-12` | interface fields |
| `app/feature-flags/page.tsx` (16 lines) | flag keys, labels ("Hermes runtime", "Hermes auto-link", etc.), descriptions, section `renderFlagSection('Hermes Runtime', ...)` |

### 7. DOCS — `comms/` and `backend/.../README.md` (~79 matches)

- `comms/hermes-tools.md` (entire file, 409 lines) — rename in prose
- `backend/src/modules/ai-gateway/README.md:112` — table row reference
- `backend/src/modules/ai-gateway/README.md` — other prose refs

### 8. `neurecore-ci-check/` DUPLICATE (~1,130 matches, ~122 files)

The duplicate tree at `/home/najeeb/Linux-Dev/neurecore-2026/neurecore-ci-check/`
mirrors the main tree. **All renames must be applied in lockstep** to both trees.

**Decision required:** drop the duplicate (`git rm -rf neurecore-ci-check/`) or
keep it in sync. Per the recent ops history, this is a CI scaffolding artifact —
**dropping it is the safer choice** (keep one source of truth).

## Required decisions before Phase 0 rename begins

| # | Decision | Recommendation |
|---|---|---|
| 1 | Drop `neurecore-ci-check/`? | **Yes** — duplicates main tree, drifts over time |
| 2 | Public API rename `/api/v1/hermes/*` → `/api/v1/agent-runtime/*`? | **Yes** — but announce as a breaking change; keep an alias for 30 days |
| 3 | `'HERMES'` chat role literal → `'AGENT'`? | **Yes** — but coordinate with any external integrations consuming the role |
| 4 | Migration strategy: rename in place vs new migration? | **New migration** renaming tables/columns/enums; preserves migration history |
| 5 | Tombstone banners on renamed modules? | **Yes** — `// DEPRECATED: removed from chat path on Phase 1 cutover (NC-AWL-IMP-2).` |

## Sequencing recommendation

The rename is **not** a 2–3 day task as the plan originally budgeted. Realistic estimate:

| Sub-phase | Effort | Owner |
|---|---|---|
| Drop `neurecore-ci-check/` | 0.5 day | infra |
| TS rename sweep (`backend/src/`) | 2 days | backend |
| Prisma schema rename + new migration | 1 day | backend |
| Test file renames + path updates | 1 day | backend |
| Frontend rename sweep | 1 day | frontend |
| Frontend-admin rename | 0.5 day | frontend |
| Env files + openapi + package.json | 0.5 day | backend |
| Docs sweep | 0.5 day | docs |
| Chat role backfill (data migration) | 0.5 day | backend |
| CI green + smoke test | 1 day | QA |
| **Total** | **~8 days** | |

**Recommendation:** Phase 0 must be re-budgeted to 8–10 days before Phase 1.1
implementation begins. The implementation work in Phase 1.1 (the sidecar) is
**independent** of the rename, so they can proceed in parallel — but the chat
path cannot be cut over (Phase 1.4) until the rename is complete.

---

**Decision pending:** approve the 8-day Phase 0 re-budget, or proceed with Phase 1.1 sidecar implementation in parallel and accept that the rename is a separate tracked workstream.
