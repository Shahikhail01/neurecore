# Phase 0 — Build Baseline Remediation Report (audit-remediation branch)

**Date:** 2026-07-14
**Branch:** `audit-remediation` (cut from baseline snapshot commit `716f870` on `main`)
**Author:** Audit Remediation
**Mode:** Conservative — prove the gate sequence, stop at first failure, report precisely.

---

## What was actually done

1. `git init -b main` in `/home/najeeb/Linux-Dev/neurecore-2026/neurecore` (not previously a repo).
2. Added `*.bak` to `.gitignore`; verified `node_modules`, `dist`, `.next`, `.env*`, `Temp/`, `memory-bank-new/pass/`, `coverage/`, `*.tsbuildinfo`, `*.local` are all properly ignored.
3. Confirmed no secrets/keys/tokens staged.
4. `git add -A && git commit` — single baseline snapshot, 196 staged files. Commit message enumerates the known carry-over issues for traceability.
5. `git checkout -b audit-remediation` — branch switched; working tree clean.
6. Inventoried every Phase 1-14 migration and extracted `CREATE TYPE / CREATE TABLE` shapes. Compared 118 Prisma models against 143 raw-SQL tables.
7. Ran each required gate in order. Results below.

---

## Gate results

| # | Gate | Result | Notes |
|---|------|--------|-------|
| 1 | `prisma validate --schema=prisma/schema.prisma` | **PASS** | `The schema at prisma/schema.prisma is valid`. Note: this only checks internal Prisma consistency, not drift vs migrations. |
| 2 | `prisma generate` | **PASS** | Generated Prisma Client (v5.22.0). Client model set is exactly the 118 in `schema.prisma` — it does not know about raw-SQL-only tables. |
| 3 | `npx tsc --noEmit` | **FAIL** | 124 errors. Stopped here per agreed plan. |
| 4 | `npm run build` | not run | (blocked by gate 3) |
| 5 | `npm test` | not run | (blocked by gate 3) |

**First-failing gate:** `npx tsc --noEmit`. Full output saved at `/tmp/tsc.out` (124 lines).

---

## Concrete error inventory (gate 3)

Total: **124 errors**. Breakdown by TS code:

| TS code | Count | Meaning |
|---------|-------|---------|
| TS2339 | 106 | "Property '...' does not exist on type 'PrismaService'" |
| TS2322 | 4 | Type assignment mismatch (JSON / test fixtures) |
| TS2724 | 3 | "Prisma.<ModelName>UpdateManyMutationInput" missing |
| TS2551 | 2 | Suggestion: "Did you mean ...?" |
| TS2307 | 2 | Module path not found (`google-drive-*.spec.ts`) |
| TS2554 | 1 | Constructor arity (`information-engine.di.spec.ts:49`) |

### Where the errors are (concentrated sites)

| File | Errors |
|------|-------|
| `src/modules/enterprise-events/transport/enterprise-event-transport.service.ts` | 25 |
| `src/modules/platform-sdk/engines/platform-sdk-engines.service.ts` | 13 |
| `src/modules/enterprise-autonomy/repository/autonomy.repository.ts` | 13 |
| `src/modules/cloud-platform/engines/cloud-control-plane.service.ts` | 13 |
| `src/modules/enterprise-intelligence-network/engines/intelligence-engines.service.ts` | 12 |
| `src/modules/work-runtime/repository/work-run.repository.ts` | 11 |
| `src/modules/enterprise-events/enterprise-events-admin.controller.ts` | 10 |
| `src/modules/application-framework/application-framework.service.ts` | 9 |
| `src/modules/enterprise-events/idempotency/idempotency.service.ts` | 2 |
| `src/modules/enterprise-cognition/planning-memory/planning-memory.service.ts` | 2 |
| `src/modules/enterprise-ai-governance/ai-governance.service.ts` | 2 |
| `src/modules/platform-evolution/platform-evolution.service.ts` | 1 |
| `src/modules/enterprise-operating-system/twin/digital-twin.service.ts` | 1 |
| `src/modules/work-runtime/work-runtime-unit.spec.ts` | 1 |
| `src/modules/information-engine/__tests__/information-engine.di.spec.ts` | 1 |
| `src/modules/integrations/google/__tests__/google-drive-sharing.spec.ts` | 1 |
| `src/modules/integrations/google/__tests__/google-drive.service.spec.ts` | 1 |

### Missing Prisma properties (top 20, captures all 24 affected models)

| Times missing | Property → Model |
|---|---|
| 22 | `enterpriseEventInbox` → `enterprise_event_inbox` (P2 fabric) |
| 10 | `plugin` → `plugins` (P10 SDK) |
| 6 | `workRunStep` → `work_run_steps` (P4 runtime) |
| 6 | `enterpriseEventOutbox` → `enterprise_event_outbox` (P2 fabric) |
| 6 | `cloudRegion` → `cloud_regions` (P11 cloud) |
| 5 | `tenantPlacement` → `tenant_placements` (P11) |
| 5 | `mission` → `missions` (P6 autonomy) |
| 5 | `knowledgeNode` → `knowledge_nodes` (P9 intelligence) |
| 4 | `knowledgeEdge` → `knowledge_edges` (P9) |
| 4 | `enterpriseEventDeadLetter` → `enterprise_event_dead_letter` (P2) |
| 4 | `aiEmployee` → `ai_employees` (P6) |
| 3 | `workRun` → `work_runs` (P4) |
| 3 | `ontologyVersion` → `ontology_versions` (P9) |
| 3 | `extensionPermission` → `extension_permissions` (P10) |
| 3 | `application` → `applications` (P12) |
| 2 | `workspace` → `workspaces` (P12) |
| 2 | `planningMemory` → `planning_memory` (P5 cognition) |
| 2 | `industrySolution` → `industry_solutions` (P12) |
| 2 | `enterpriseEventIdempotency` (P2) |
| 2 | `domainPackage` → `domain_packages` (P12) |

Remaining (1 each): `aiDepartment` (P6), `missionObservation` (P6), `simulationRecord` (P7), `enterpriseEventOutbox` / `Inbox` etc additional occurrences already counted, `cloudCluster` (P11), `technologyRadarEntry` (P14 — appears in source as `prisma.technologyRadarEntry.upsert`), `trustEvaluation` (P13), `aIHallucinationFlag`, `aIBiasFinding`, `aIPolicy`, `modelRegistration`, `humanReviewRecord` (P13 — appear in source as `prisma.aIHallucinationFlag` etc with PascalCase property names).

---

## Root cause

The 11 `20260714_*` migrations (Event Fabric, Work Runtime, Planning Memory, Enterprise Autonomy, Enterprise OS, Enterprise Intelligence, Platform SDK, Cloud Platform, Application Framework, AI Governance, Platform Evolution) create **24 additional tables and 22+ enums** via raw `CREATE TABLE / CREATE TYPE` statements, but **none** of the corresponding models/enums were added to `backend/prisma/schema.prisma`. Therefore:

- `prisma validate` passes (only checks single-file internal consistency).
- `prisma generate` succeeds (generates 118 models — doesn't see migrations).
- Generated Prisma Client only knows the 118 models — every Phase 2-14 service that calls `prisma.<newModel>...` is type-undefined.
- `npx tsc --noEmit` therefore fails with TS2339 in every Phase 2-14 service that touches its own Prisma models.

This is the same structural defect identified in the prior zero-trust audit (item G1). It has not yet been remediated.

---

## Required remediation (precise, not started)

### Block A — Schema reconciliation (`schema.prisma` ↔ all migrations)

Goal: every table/enum created in `prisma/migrations/*/migration.sql` has a corresponding `model` / `enum` in `backend/prisma/schema.prisma` (single source of truth).

**Concrete missing models** (from drift analysis):

| Phase | Model | Source migration |
|---|---|---|
| P2 | `enterprise_event_outbox`, `enterprise_event_inbox`, `enterprise_event_dead_letter`, `enterprise_event_idempotency` | `20260714_enterprise_event_fabric` |
| P2 | enums `EnterpriseEventOutboxStatus`, `ConsumerInboxStatus` | same |
| P4 | `work_runs`, `work_run_steps` | `20260714_work_runtime` |
| P4 | enums `WorkRunStatus`, `WorkRunStepStatus` | same |
| P5 | `planning_memory` | `20260714_planning_memory` |
| P5 | enum `PlanningMemoryKind` | same |
| P6 | `ai_departments`, `ai_employees`, `missions`, `mission_observations` | `20260714_enterprise_autonomy` |
| P6 | enums `MissionStatus`, `ObservationSeverity` | same |
| P7 | `simulation_records` | `20260714_enterprise_os` |
| P9 | `ontology_versions`, `knowledge_nodes`, `knowledge_edges` | `20260714_enterprise_intelligence` |
| P9 | enums `OntologyEntityKind`, `RelationshipKind` | same |
| P10 | `plugins`, `extension_permissions` | `20260714_platform_sdk` |
| P10 | enums `PluginStatus`, `ExtensionKind` | same |
| P11 | `cloud_regions`, `cloud_clusters`, `tenant_placements` | `20260714_cloud_platform` |
| P11 | enum `RegionStatus` | same |
| P12 | `applications`, `domain_packages`, `industry_solutions`, `workspaces` | `20260714_application_framework` |
| P12 | enums `AppStatus`, `Edition` | same |
| P13 | `trust_evaluations`, `ai_hallucination_flags`, `ai_bias_findings`, `ai_policies`, `ai_model_registry`, `ai_human_reviews` | `20260714_ai_governance` |
| P13 | enums `TrustGrade`, `AIPolicyCategory`, `CertificationStatus`, `ReviewDecision` | same |
| P14 | `tech_radar`, `benchmark_records`, `experiments`, `feature_lifecycle`, `capability_versions`, `migration_plans` | `20260714_platform_evolution` |
| P14 | enums `TechMaturity`, `FeatureState`, `ExperimentStatus`, `CapabilityDomain` | same |

**Reverse drift to verify:** the diff also revealed models in `schema.prisma` whose tables are not present in any migration (e.g. `ActivityEvent`, `ApprovalRequest`, `BudgetPolicy`, `CommunicationThread`, `HumanReviewRecord`, `ModelRegistration`, `NotificationPreference`, `QuotaUsage`, etc.). These need individual decisions: drop from schema, generate missing CREATE TABLE migrations, or document as forward-only. A precise list is in `/tmp/only_in_schema.txt`.

**Caveat:** mechanically inserting models from migration column lists risks subtle drift (column nullability, default expressions, JSONB ↔ Json mapping, array ↔ string relation). Each model addition must match exactly what the migration declares. The schema.prisma edits must therefore also be paired with `prisma db pull` or hand-written model declarations per Prisma 5 semantics, with each tenant-isolation column reflected.

### Block B — TypeScript-specific fixes (7 errors remaining after Block A)

These are *not* resolvable by reconciling schema:

1. `ai-governance.service.ts:59,82` — `evidenceJson` / `policiesJson` passed as `Record<string, unknown>` — needs `Prisma.JsonObject` cast or `as any`.
2. `platform-evolution.service.ts:69` — same JSON input type.
3. `enterprise-event-transport.service.ts` / `autonomy.repository.ts` / `work-run.repository.ts` (5 sites) — `MissionUpdateManyMutationInput`, `WorkRunUpdateManyMutationInput`, `WorkRunStepUpdateManyMutationInput` — these input type names are *not* exported by Prisma; replace with `Prisma.MissionUpdateInput` / `WorkRunUpdateInput` / `WorkRunStepUpdateInput` once the corresponding models exist (Block A).
4. `integrations/google/__tests__/google-drive-sharing.spec.ts:8` and `google-drive.service.spec.ts:12` — `'../../../infrastructure/database/prisma.service'` not found; needs path correction (verify actual file location).
5. `information-engine/__tests__/information-engine.di.spec.ts:49` — constructor arity 6 vs 7; verify which dependency changed.
6. `work-runtime/work-runtime-unit.spec.ts:50` — test fixture `input: {}` should be `input: { projectId: 'p1' }`.

### Block C — Database drift reconciliation (out of scope for "build baseline")

Migrations were applied to the prod DB but `prisma migrate diff` against the live DB will likely surface unrelated drift (per DEPLOY-001 / "carried forward" findings). That's a separate cross-cutting task that needs a real DB.

### Block D — CI gates

Add to `.github/workflows/backend-ci.yml` (currently the only workflow):

```yaml
- name: Gate 1 — prisma validate
  run: cd backend && ./node_modules/.bin/prisma validate
- name: Gate 2 — prisma generate
  run: cd backend && ./node_modules/.bin/prisma generate
- name: Gate 3 — typecheck (non-bypassable)
  run: cd backend && npx tsc --noEmit
- name: Gate 4 — build
  run: cd backend && npm run build
- name: Gate 5 — tests
  run: cd backend && npm test
```

Important: ensure `ts-jest` is NOT configured with `isolatedModules: true` for the typecheck gate — only for the test step, otherwise the typecheck bypasses errors. Specifically: the `"globals":{"ts-jest":{"isolatedModules":true}}` block in `backend/package.json` should be removed or only applied per-test, since it currently allows TypeScript to compile even when `npx tsc --noEmit` rejects the same source.

---

## Honest scope notes

- **`prisma validate` passes on a broken schema.** This proves the gate is necessary but not sufficient; gate 3 is the only one that catches the structural drift.
- **`prisma generate` does not import from migrations.** It is a local-only operation against `schema.prisma`. Any future Prisma migration that depends on app code matching the live DB must include `prisma db pull`-derived verification.
- **The baseline commit intentionally contains the entire broken state** so that the remediation branch can be diffed cleanly.
- **P0 has produced no functional change yet.** All changes are diagnostic + workflow: a baseline, a branch, a typed inventory, and the first failing-gate diagnosis.
- **No follow-up edits were made.** Phase 1+ work begins only after the gate chain is green.

---

## What is needed next (a single follow-up turn can do this)

1. Apply Block A: add 24 models + 22 enums to `schema.prisma`, table-by-table copied from migrations (no inference). Re-run gates 1-3 — should drop errors from 124 to ~7.
2. Apply Block B: 7 surgical TypeScript fixes.
3. Re-run `npx tsc --noEmit` (expect green), then `npm run build` (gate 4), then `npm test` (gate 5 — already passes 842/842 per prior audit).
4. Land Block D: commit the CI workflow with the gates named above.
5. Then proceed to Phase-by-Phase honest remediation, starting with the real defects uncovered in the zero-trust audit (P4 `approval-chains.resolveChain` argument, P8 stub-marked-PROVEN criteria, P9-P14 missing tests).

That next turn is a bigger scope than this one — I deliberately stopped here so the user can confirm direction before I touch schema.prisma.
