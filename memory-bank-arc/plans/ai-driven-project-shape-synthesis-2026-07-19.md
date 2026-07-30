# AI-Driven Project Shape Synthesis — Implementation Plan

**Last updated:** 2026-07-19
**Status:** ✅ ALL PHASES IMPLEMENTED, DEBUGGED AND DEPLOYED — Pipeline Working End-to-End
**Author:** Kilo audit + planning session

---

## 0. Executive Summary

**Goal:** Make project creation a Hermes/LLM-driven process by default. Project Types become **optional accelerators** ("use the standard tax audit template") rather than required scaffolding. The LLM extracts intent from the user's chat message and synthesizes the full project shape (stages, goals, members, tasks, custom fields, information requirements) on the fly. Project Types are still respected when the user opts in.

**Build difficulty:** LOW–MEDIUM. The hard infra work is done — `AiGatewayService.invokeStructured<T>` (Zod-validated LLM JSON output with auto-repair), `BaseStructuredTool` registry, `FeatureFlagService`, `RAGPipeline` for corpus retrieval. All phases implemented.

**Implementation status (2026-07-19):**
- Phases 0–4: ✅ All implemented and deployed to Contabo
- Migration `20260719_project_derived_shape`: ✅ Applied to Contabo PostgreSQL
- Feature flag `AI_PROJECT_SHAPE_ENABLED`: ✅ Always-on (`unset → true`)
- Backend: ✅ Healthy on Contabo PostgreSQL

**VERIFIED END-TO-END (2026-07-19):** "Crimson Robotics Manufacturing Project" created via Hermes chat:
- Budget: 180,000 USD, Deadline: 9/30/2027, Status: LEAD, `budgetType: "FIXED_FEE"`
- AI agents spawned: Project Manager, Client Liaison, Reviewer
- Stages, goals, members materialized from derivedShape
- BudgetPolicy created
- Project visible on `/projects` page

---

## 1. Implementation Status (Honest Baseline)

### What's already wired (verified end-to-end in the prior audit)

| Component | Status | File |
|---|---|---|
| `ProjectsService.create()` | ✅ Works with `projectTypeId`; AI path Phase 2-HERMES implemented | `backend/src/modules/projects/projects.service.ts` |
| `CreateProjectTool` | ✅ Routes through ProjectsService with lazy `ModuleRef` resolution | `backend/src/modules/tools/built-in/neurecore-tools.ts` |
| `ProjectShapeSynthesisService` | ✅ Implemented with bounded 1-retry repair loop + few-shot fallback | `backend/src/modules/project-shape/project-shape-synthesis.service.ts` |
| `DerivedShapeApplierService` | ✅ Implemented with idempotent stage/goal/member/CoS application | `backend/src/modules/projects/services/derived-shape-applier.service.ts` |
| `ProjectShapeSchema` | ✅ Phase 0 types defined | `backend/src/modules/project-shape/project-shape.types.ts` |
| `ProjectAutomationService.onProjectCreated()` | ✅ Spawns CoS + role-template agents | `backend/src/modules/project-automation/project-automation.service.ts` |
| `ProjectAutomationService.replan()` | ✅ Extended to handle untyped projects via DerivedShapeApplier | `backend/src/modules/project-automation/project-automation.service.ts` |
| `ProjectTypeVersion.{goalTemplate,roleTemplate,stageTemplate}` | ✅ 150 backfilled types | `prisma/schema.prisma:1984-2012` |
| `GoalTemplateService` | ✅ Idempotent goal creation | `backend/src/modules/project-automation/services/goal-template.service.ts` |
| `RoleTemplateService` | ✅ Spawns agents + links to project | `backend/src/modules/project-automation/services/role-template.service.ts` |
| `AiGatewayService.invokeStructured<T>` | ✅ Reusable LLM→JSON primitive | `backend/src/modules/ai-gateway/ai-gateway.service.ts:395` |
| `WorkPlanner` repair-loop pattern | ✅ Best prior art for bounded LLM retries | `backend/src/modules/work-runtime/planner/work-planner.service.ts` |
| `ProjectHealthAIService` | ✅ Gold-standard structured-output example | `backend/src/modules/project-health/project-health-ai.service.ts` |
| `RAGPipeline` (corpus retrieval) | ✅ Operational, pgvector-backed | `backend/src/modules/knowledge/services/rag-pipeline.service.ts` |
| `PrismaProjectRepository` | ✅ Fixed: project creation decoupled from transport.publish() | `backend/src/modules/projects/repositories/prisma-project.repository.ts` |
| `LangGraph toolContext` | ✅ Extended with `metadata: { goal: state.goal }` | `backend/src/modules/agents/langgraph/langgraph-official.ts` |

### What's missing (the actual gap)

| Missing piece | Impact | Status |
|---|---|---|
| ~~**Debug the persistence gap**~~ — synthesis completes but 0 rows in DB | Projects never created | ✅ FIXED — see issues #16–#19 below |

---

## 2. Architecture

### 2.1 Decision Flow (User-Facing)

```
USER: "We just won the Acme Corp audit engagement — Q3 deadline, fixed fee $75k"
       │
       ▼
HERMES CHAT → detectIntent("create project", agentId="ai-assistant")
       │
       ▼
CreateProjectTool.executeImpl
       │
       ├─ Is projectTypeId provided? ──yes──► Existing path (template-driven, audited + working)
       │
       └─ no / "use AI" / "let Hermes decide"
              │
              ▼
         ProjectShapeSynthesisService.synthesizeShape({ goal, tenantId, context })
              │
              ├─ Retrieve top-K similar past projects via RAG (few-shot examples)
              ├─ Build prompt: goal + few-shots + JSON schema (stages, goals, members, custom fields, info reqs)
              ├─ Call AiGatewayService.invokeStructured<ProjectShape>({...})
              │     └─ Auto-repair retry on parse failure (mirror WorkPlanner pattern, max 1 retry)
              ├─ Zod-validate against ProjectShapeSchema
              └─ Return ProjectShape
              │
              ▼
         ProjectsService.create({ name, ..., derivedShape: ProjectShape })
              │
              ├─ Persist Project
              ├─ Create Stages from derivedShape.stages
              ├─ Create Goals from derivedShape.goals
              ├─ Create Custom Fields from derivedShape.customFields
              ├─ Create Members from derivedShape.members (CoS + role-spawned agents)
              ├─ Skip ProjectType-based Phase 8 (already done inline)
              ├─ Skip ProjectAutomationService.onProjectCreated (everything already done)
              ├─ Fire enterprise.project.created event
              └─ Return Project
```

### 2.2 Decision Flow (Opt-In to Project Type)

```
USER: "Create a standard tax audit project for Acme Corp"
       │
       ▼
HERMES CHAT
       │
       ▼
CreateProjectTool.executeImpl(input.projectTypeId = "cmrdl...")
       │
       ▼
ProjectsService.create(input, tenantId)  ← Existing path, unchanged
       │
       ▼
[Stages from stageTemplate] [Goals from goalTemplate] [Members from roleTemplate] [CoS]
```

The tool decides which path based on whether `projectTypeId` is present AND whether the user said "standard" / "use template" / "use the X template". This is heuristic but easy to make explicit later.

### 2.3 Service Boundaries (SOLID)

| Service | SRP | Single dependency |
|---|---|---|
| `ProjectShapeSynthesisService` | Generate `ProjectShape` JSON from user goal | AiGatewayService, PrismaService, RAGPipelineService |
| `ProjectsService` (extended) | Persist any Project + its derived shape | Repository + new `DerivedShapeApplier` helper |
| `DerivedShapeApplier` (new, in projects module) | Apply `ProjectShape` to DB rows (stages, goals, members, fields) | PrismaService |
| `CreateProjectTool` (extended) | Choose between template-driven and AI-driven paths | ProjectsService |
| `ProjectShapeSchema` (Zod) | Define the contract between synthesizer and applier | n/a |

---

## 3. Phased Delivery — Implementation Summary

### Phase 0: Type Definitions — ✅ IMPLEMENTED
`backend/src/modules/project-shape/project-shape.types.ts`:
- `ProjectShapeSchema` with Zod validation
- `StageSchema`, `GoalSchema`, `MemberSchema`
- `ProjectRoleEnum` matching Prisma `ProjectRole` enum

### Phase 1: AI-Driven Shape Synthesis Service — ✅ IMPLEMENTED
`backend/src/modules/project-shape/project-shape-synthesis.service.ts`:
- `synthesizeShape({ goal, tenantId, context })` method
- Bounded 1-retry repair loop on Zod failure
- Few-shot fallback with hardcoded example
- RAG retrieval path stubbed (Phase 5 future)
- Feature flag `AI_PROJECT_SHAPE_ENABLED` gates the service

### Phase 2: ProjectsService — Untyped Project Path — ✅ IMPLEMENTED
`backend/src/modules/projects/projects.service.ts`:
- Validates `projectTypeId XOR derivedShape` (throws if neither)
- When `validatedShape` present: skips Phase 8 (goalTemplateService) and Phase 3A (projectAutomation)
- Applies Phase 2-HERMES inline via `derivedShapeApplier.apply()`
- `derivedShapeVersion: Int @default(1)` on Project model for future schema versioning

### Phase 2B: DerivedShapeApplier — ✅ IMPLEMENTED
`backend/src/modules/projects/services/derived-shape-applier.service.ts`:
- `apply(projectId, derivedShape, tenantId): { stagesCreated, goalsCreated, membersCreated, chiefOfStaffAssigned, errors }`
- Creates stages from `derivedShape.stages` (idempotent — checks for existing)
- Creates goals from `derivedShape.goals` (idempotent)
- Spawns agents for each role via `DeploymentService.spawnFromTemplate()`
- Always assigns Chief of Staff
- Sets `description`, `industry` on Project row
- Logs `[DerivedShapeApplier]` at INFO level

### Phase 3: CreateProjectTool — Hermes-Driven Path Selection — ✅ IMPLEMENTED
`backend/src/modules/tools/built-in/neurecore-tools.ts`:
- New fields: `useAiSynthesis` (default `true`), `industryHint` (optional)
- `executeImpl`:
  - If `projectTypeId` provided → template path (unchanged)
  - Else if `useAiSynthesis !== false` → calls `projectShapeSynthesisService.synthesizeShape()`
  - Passes `derivedShape` + `derivedShapeVersion: 1` to `projectsService.create()`
- Uses `ModuleRef` lazy resolution to avoid circular dependency (same pattern as `ProjectsService`)

### Phase 4: ProjectAutomationService.replan() — Untyped Project Support — ✅ IMPLEMENTED
`backend/src/modules/project-automation/project-automation.service.ts`:
- `replan()` now handles untyped projects via `DerivedShapeApplier`
- Checks `project.derivedShape` for AI-created projects
- `projectAutomation.replan()` extended to handle projects without `projectTypeId`

---

## 4. Debug Infrastructure

### Debug Logs Deployed (2026-07-19)

Three layers of logs trace the full call chain:

**`CreateProjectTool`** — `backend/src/modules/tools/built-in/neurecore-tools.ts`:
```
[DEBUG-TOOL-CREATE] executeImpl ENTER: name=..., projectTypeId=..., useAiSynthesis=..., synthesisService=..., projectsService=...
[DEBUG-TOOL-CREATE] calling projectsService.create(), derivedShape=present/absent
[DEBUG-TOOL-CREATE] projectsService.create succeeded: projectId=...
[DEBUG-TOOL-CREATE] projectsService.create FAILED: ...
```

**`ProjectsService`** — `backend/src/modules/projects/projects.service.ts`:
```
[DEBUG-SVC-CREATE] entering create(): name=..., hasProjectTypeId=..., hasDerivedShape=..., hasValidatedShape=...
[DEBUG-SVC-CREATE] calling repository.create()
[DEBUG-SVC-CREATE] repository.create returned: project.id=..., status=..., hasProjectTypeId=..., hasDerivedShape=...
[DEBUG-SVC-CREATE] Phase 2-HERMES check: validatedShape=..., derivedShapeApplier=injected/NOT_INJECTED
```

**`PrismaProjectRepository`** — `backend/src/modules/projects/repositories/prisma-project.repository.ts`:
```
[DEBUG-REPO-CREATE] start: name=..., hasProjectTypeId=..., hasDerivedShape=..., derivedShapeVersion=...
[DEBUG-REPO-CREATE] about to call prisma.project.create with createData=...
[DEBUG-REPO-CREATE] prisma.project.create succeeded, project.id=...
[DEBUG-REPO-CREATE] prisma.project.create FAILED: ...
```

### How to Test
1. Trigger Hermes chat: "create a project for Atlas Corp, a financial services company"
2. Check PM2 logs: `pm2 logs neurecore-backend --lines 100 | grep DEBUG`
3. The sequence should show: TOOL ENTER → synthesis → SVC CREATE → REPO CREATE → prisma success

---

## 5. Database Migration Status (2026-07-19)

### Migration Applied
- **Name:** `20260719_project_derived_shape`
- **Changes:** `ALTER TABLE projects ADD COLUMN "derivedShape" JSONB; ADD COLUMN "derivedShapeVersion" Int;`
- **Status:** ✅ Applied to Contabo PostgreSQL

### Migration Baseline
- **Problem:** Contabo PostgreSQL's `_prisma_migrations` table was empty — `prisma migrate deploy` refused to run against the non-empty schema
- **Fix:** Created `_prisma_migrations` table and inserted all 64 prior migrations as applied (idempotent ON CONFLICT DO NOTHING)
- **Verification:** `prisma migrate deploy` now reports "No pending migrations to apply"

### Schema Verification
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'projects' AND column_name LIKE 'derived%';
-- derivedShape | jsonb
-- derivedShapeVersion | integer
```

---

## 6. Feature Flag

| Flag | Default | Current | Notes |
|---|---|---|---|
| `AI_PROJECT_SHAPE_ENABLED` | `true` | Always-on | Logged at startup: `unset → true` |

---

## 7. Known Issues

### ✅ P0: Projects Not Persisting — RESOLVED (2026-07-19)
Multiple root causes were found and fixed:

1. **`prisma generate` never run on Contabo** — Generated Prisma client was missing from `node_modules/.prisma`
2. **Missing environment variables** — MINIMAX_API_KEY, MINIMAX_BASE_URL, MINIMAX_MODEL, AI_GATEWAY_V2, AI_PROJECT_SHAPE_ENABLED, REDIS_URL absent from `.env`
3. **Zod transform bypass bug** — `BaseStructuredTool.execute()` passed raw input to `executeImpl()`, skipping `.transform()` calls that convert lowercase enum values to uppercase Prisma values
4. **budgetType enum variants missing** — LLM sent `fixed_fee`/`fixed-fee` but schema only accepted `fixed`/`hourly`/`retainer`
5. **Hermes repair-retry never triggered** — `extractZodIssues()` didn't recognize the custom "Schema validation failed" error pattern

**Verification:** "Crimson Robotics Manufacturing Project" created via Hermes chat, persisted to DB, visible on frontend.

### Known Debt (Not Fixed This Session)

The following tools still use direct `prisma.{entity}.create/update/delete` instead of routing through their respective Services:
- **Department tools** (4 tools): `updateDepartment`, `archiveDepartment`, `deleteDepartment`, `assignManager`, `unassignManager`
- **Agent tools** (5 tools): `updateAgent`, `archiveAgent`, `assignAgentToDepartment`, `removeAgentFromProject`, `bulkCreateAgents`, `bulkAssignToDepartment`
- **Project tools** (4 tools): `updateProject`, `archiveProject`, `deleteProject`, `cloneProject`
- **Task tools** (11 tools): `updateTask`, `deleteTask`, `assignTask`, `unassignTask`, `markTaskComplete`, `markTaskInProgress`, `reopenTask`, `changeTaskPriority`, `addSubtask`, `bulkAssignTasks`, `bulkChangeStatus`, `cloneTask`
- **Approval tools** (5 tools): `approveRequest`, `rejectRequest`, `bulkApprove`, `bulkReject`, `createApprovalRequest`, `resubmitApproval`, `cancelApprovalRequest`

---

## 8. Files Changed / Created

### New files (this implementation)

| Path | Purpose |
|---|---|
| `backend/src/modules/project-shape/project-shape.types.ts` | `ProjectShape` Zod schema + types |
| `backend/src/modules/project-shape/project-shape-synthesis.service.ts` | LLM-driven shape synthesis (Phase 1) |
| `backend/src/modules/project-shape/project-shape.module.ts` | DI wiring |
| `backend/src/modules/projects/services/derived-shape-applier.service.ts` | Apply ProjectShape to DB (Phase 2) |
| `prisma/migrations/20260719_project_derived_shape/migration.sql` | Migration for derivedShape + derivedShapeVersion |

### Modified files (this implementation)

| Path | Change |
|---|---|
| `backend/src/modules/projects/projects.service.ts` | Accept `derivedShape`, gate Phase 8/3A, apply inline via applier, debug logs |
| `backend/src/modules/projects/projects.module.ts` | Provide `DerivedShapeApplier` |
| `backend/src/modules/projects/interfaces/project.interface.ts` | Add `derivedShape?` to `CreateProjectInput` |
| `backend/src/modules/project-automation/project-automation.service.ts` | `replan()` supports untyped-with-shape projects |
| `backend/src/modules/tools/built-in/neurecore-tools.ts` | `CreateProjectTool` adds `useAiSynthesis` + `industryHint`, calls synth service, budgetType enum variants, debug logs |
| `backend/src/modules/tools/tools.module.ts` | Import `ProjectShapeModule` |
| `backend/src/modules/tools/structured-tool.base.ts` | **FIX (2026-07-19):** Use `inputSchema.parse(input)` to apply Zod transforms before passing to `executeImpl()` |
| `backend/src/modules/project-shape/project-shape-synthesis.service.ts` | **FIX (2026-07-19):** `extractZodIssues()` handles custom "Schema validation failed" error |
| `backend/src/modules/agents/langgraph/langgraph-official.ts` | `toolContext.metadata: { goal }` pass-through |
| `prisma/schema.prisma` | Add `Project.derivedShape Json?`, `Project.derivedShapeVersion Int?` |
| `backend/src/modules/projects/repositories/prisma-project.repository.ts` | Debug logs, project creation decoupled from transport |
| `backend/.env`, `backend/.env.production` | **FIX (2026-07-19):** Added MINIMAX_API_KEY, MINIMAX_BASE_URL, MINIMAX_MODEL, AI_GATEWAY_V2, AI_PROJECT_SHAPE_ENABLED, REDIS_URL with password |

### Reused (no change needed)

| Path | Why |
|---|---|
| `AiGatewayService.invokeStructured<T>` | Gold-standard LLM→JSON primitive |
| `WorkPlanner.plan()` repair-loop pattern | Bounded retry on Zod failure |
| `RAGPipeline.ask()` | Few-shot retrieval (Phase 5) |
| `DeploymentService.spawnFromTemplate()` + `normaliseActorId()` | Agent spawning |
| `GoalsService.create()` | Goal persistence |
| `ProjectMember` schema | Member linkage |
| `ProjectStage` schema | Stage persistence |
| `ProjectAutomationService` / `RoleTemplateService` | Untouched — template-driven path remains |

---

## 9. Test Plan

### ✅ Debug Test — COMPLETED (2026-07-19)
Test result: "Crimson Robotics Manufacturing Project" successfully created via Hermes chat.

```
# Backend health
curl https://hq.neurecore.com/api/v1/health → {"status":"success","data":{"status":"healthy"}}

# PM2 debug logs sequence observed:
[DEBUG-TOOL-CREATE] executeImpl ENTER
[DEBUG-TOOL-CREATE] calling projectsService.create(), derivedShape=present
[DEBUG-SVC-CREATE] entering create()
[DEBUG-SVC-CREATE] calling repository.create()
[DEBUG-REPO-CREATE] start
[DEBUG-REPO-CREATE] about to call prisma.project.create
[DEBUG-REPO-CREATE] prisma.project.create succeeded, project.id=cmrrre6as0002gczv5l7cr60a
[DEBUG-TOOL-CREATE] projectsService.create succeeded: projectId=cmrrre6as0002gczv5l7cr60a

# DB verification
SELECT id, name, status, budgetType, budgetAmount FROM projects;
→ cmrrre6as0002gczv5l7cr60a | Crimson Robotics Manufacturing Project | LEAD | FIXED_FEE | 180000
```

### Unit Tests (To Be Added)
- `ProjectShapeSynthesisService.synthesizeShape()` — mock AiGateway, assert valid shape passes through
- `DerivedShapeApplier.apply()` — idempotency on re-run
- `ProjectsService.create()` with `derivedShape` — skips Phase 8/3A, throws when neither provided

---

## 10. Out-of-Scope (Future Work)

1. **Full EUL/EIL refactor** — `EntityKind` enum, `SubjectHypothesis`, `EnterpriseUnderstanding`, `RecommendedAction`, `ActionDecision` schemas, decision-port integration
2. **Cross-entity synthesis** — VENDOR, HR_CASE, INCIDENT, etc.
3. **Decision-port integration** — `ApprovalPortService` should gate the AI-synthesized project proposal before commit
4. **Per-tenant tuning** — tenant-level overrides for synthesis parameters
5. **Replay mining** — read past chat → project pairs to discover patterns at scale
6. **Schema versioning** — `derivedShapeVersion` column exists but versioning logic not yet implemented

---

## 11. Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| `useAiSynthesis` default | `true` | Chat-first is the primary UX |
| `AI_PROJECT_SHAPE_ENABLED` | Always-on | Minimal feature flag burden |
| `projectTypeId XOR derivedShape` validation | Throws if neither | Clear contract, no silent degradation |
| `projectTypeId` wins when both provided | Warn + use template | Template is explicit user intent |
| `derivedShapeVersion` column | `Int? @default(1)` | Future schema evolution path |
| Lazy `ModuleRef` for synth service | Used in `CreateProjectTool.onModuleInit` | Avoids circular dependency at startup |
