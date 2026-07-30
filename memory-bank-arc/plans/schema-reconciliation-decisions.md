# Schema Reconciliation Decisions (audit-remediation / Block A)

**Purpose:** Reconcile `backend/prisma/schema.prisma` with raw-SQL migrations for the Phase 2-14 tables that currently have no Prisma representation. Stop here for review. No schema.prisma edits have been made.

**Process used:**
1. Mechanically parsed every `20260714_*.sql` with a custom SQL parser (`/tmp/sqlparse2.py`). Output: `/tmp/sqlparse2/*.json`. Each `CREATE TABLE` is reproduced as `(column_name, sql_type, nullable, default, is_pk, fks)` plus enum values for `CREATE TYPE`.
2. Enumerated every `prisma.<X>.<method>` reference in Phase 2-14 service code (39 distinct properties).
3. Mapped each prisma property → required Prisma model name (PascalCase, lower-first for property) → SQL table name.
4. Identified three decision points where the model name in `schema.prisma` controls how source must read. Documented in §B.

**Status:** Decisions required before Block A insertion.

---

## Section A — Pass-through tables (no naming decision needed)

For 33 of 39 properties, the PascalCase model name is unambiguous and matches the SQL table with a `@@map` directive. These models will be added verbatim. No source changes required.

**List (model name → `@@map` target table, from /tmp/sqlparse2/*.json):**

| Schema model | `@@map` SQL table | Migration file |
|---|---|---|
| `EnterpriseEventOutbox` | `enterprise_event_outbox` | 20260714_enterprise_event_fabric |
| `EnterpriseEventInbox` | `enterprise_event_inbox` | 20260714_enterprise_event_fabric |
| `EnterpriseEventDeadLetter` | `enterprise_event_dead_letter` | 20260714_enterprise_event_fabric |
| `EnterpriseEventIdempotency` | `enterprise_event_idempotency` | 20260714_enterprise_event_fabric |
| `WorkRun` | `work_runs` | 20260714_work_runtime |
| `WorkRunStep` | `work_run_steps` | 20260714_work_runtime |
| `PlanningMemory` | `planning_memory` | 20260714_planning_memory |
| `AiDepartment` | `ai_departments` | 20260714_enterprise_autonomy |
| `AiEmployee` | `ai_employees` | 20260714_enterprise_autonomy |
| `Mission` | `missions` | 20260714_enterprise_autonomy |
| `MissionObservation` | `mission_observations` | 20260714_enterprise_autonomy |
| `SimulationRecord` | `simulation_records` | 20260714_enterprise_os |
| `OntologyVersion` | `ontology_versions` | 20260714_enterprise_intelligence |
| `KnowledgeNode` | `knowledge_nodes` | 20260714_enterprise_intelligence |
| `KnowledgeEdge` | `knowledge_edges` | 20260714_enterprise_intelligence |
| `Plugin` | `plugins` | 20260714_platform_sdk |
| `ExtensionPermission` | `extension_permissions` | 20260714_platform_sdk |
| `CloudRegion` | `cloud_regions` | 20260714_cloud_platform |
| `CloudCluster` | `cloud_clusters` | 20260714_cloud_platform |
| `TenantPlacement` | `tenant_placements` | 20260714_cloud_platform |
| `Application` | `applications` | 20260714_application_framework |
| `DomainPackage` | `domain_packages` | 20260714_application_framework |
| `IndustrySolution` | `industry_solutions` | 20260714_application_framework |
| `Workspace` | `workspaces` | 20260714_application_framework |
| `BenchmarkRecord` | `benchmark_records` | 20260714_platform_evolution |
| `CapabilityVersion` | `capability_versions` | 20260714_platform_evolution |
| `Experiment` | `experiments` | 20260714_platform_evolution |
| `FeatureLifecycle` | `feature_lifecycle` | 20260714_platform_evolution |
| `MigrationPlan` | `migration_plans` | 20260714_platform_evolution |
| `TenantPlacement` | `tenant_placements` | (listed above) |
| `TechnologyRadarEntry` | `tech_radar` ⚠ see §B | 20260714_platform_evolution |
| `TrustEvaluation` | `trust_evaluations` | 20260714_ai_governance |
| `AIBiasFinding` | `ai_bias_findings` ⚠ see §B | 20260714_ai_governance |
| `AIHallucinationFlag` | `ai_hallucination_flags` ⚠ see §B | 20260714_ai_governance |
| `AIPolicy` | `ai_policies` ⚠ see §B | 20260714_ai_governance |
| `AIHumanReview` | `ai_human_reviews` ⚠ see §B | 20260714_ai_governance |

---

## Section B — Naming decisions (require explicit approval)

### B.1 — `prisma.aIBiasFinding` from `ai-governance.service.ts`

Source line: `ai-governance.service.ts:58` (and similar uses inside the file) reads `prisma.aIBiasFinding`. Prisma's automated model-to-property camelCase rule always lowercases the **first character**, regardless of casing elsewhere. Therefore:

| Candidate model name | Generated property | Matches source? |
|---|---|---|
| `AIBiasFinding` | `aIBiasFinding` ✅ | **YES** |
| `AiBiasFinding` | `aiBiasFinding` (lowercase `i`) | NO |

**Decision: use `AIBiasFinding` model name.** No source changes required.

`@@map("ai_bias_findings")` for the SQL table.

---

### B.2 — `prisma.aIHallucinationFlag`, `prisma.aIPolicy`, `prisma.humanReviewRecord`

Same logic as B.1.

| Source property | Required model name | SQL table |
|---|---|---|
| `aIHallucinationFlag` | `AIHallucinationFlag` | `ai_hallucination_flags` |
| `aIPolicy` | `AIPolicy` | `ai_policies` |
| `humanReviewRecord` | `HumanReviewRecord` | `ai_human_reviews` |

The previous mapping doc named the A.I. table `AIHallucinationFlag` and the human-review one `AIHumanReview`. **Correction:** the source file uses **separate** `prisma.humanReviewRecord` (not `prisma.aIHumanReview`). Verify by reading source before insertion. The model name is `HumanReviewRecord`.

---

### B.3 — `prisma.modelRegistration` from `ai-governance.service.ts`

Source uses `prisma.modelRegistration`. Source code's intent is unambiguous: a model record.

| Source property | Required model name | SQL table |
|---|---|---|
| `modelRegistration` | `ModelRegistration` | `ai_model_registry` |

This one diverges from default Prisma naming (where `ModelRegistration` would generate `modelRegistrations` mapped to `model_registrations`). The SQL migration creates `ai_model_registry`. Use:

```prisma
model ModelRegistration {
  ...
  @@map("ai_model_registry")
}
```

---

### B.4 — `prisma.technologyRadarEntry` from `platform-evolution.service.ts`

Source uses `prisma.technologyRadarEntry`. The SQL migration creates table `tech_radar`.

| Source property | Required model name | SQL table |
|---|---|---|
| `technologyRadarEntry` | `TechnologyRadarEntry` | `tech_radar` |

The previous mapping doc named this model `TechRadar`. **Correction:** name it `TechnologyRadarEntry` so source reads `prisma.technologyRadarEntry` directly, plus `@@map("tech_radar")`.

---

### B.5 — `prisma.application` from `application-framework.service.ts`

Source uses `prisma.application` (singular). The SQL migration creates `applications` (plural). Prisma's auto-pluralization would generate `application` for a model named `Application` and map it to `applications` (Prisma's plural rule).

| Source property | Required model name | SQL table |
|---|---|---|
| `application` | `Application` | `applications` |

**Decision: use `Application`** with optional `@@map("applications")` (Prisma would default to `applications` from `Application`, so `@@map` may be elided; add for explicitness).

---

### B.6 — `prisma.projectMemory` (already in schema.prisma)

`ProjectMemory` exists in current `schema.prisma` (lines 2295-2319). Verified it maps to `project_memories` table. No migration creates `project_memories` table currently. **This is reverse drift (Section B in the prior mapping doc) and is OUT OF SCOPE for this turn** but the source code reads it and currently compiles because the model exists in `schema.prisma`. Leave as-is.

---

## Section C — Tables that exist in source but NOT in any 20260714 migration (out of scope but documented)

Source references one prisma property for which there is no migration at all:

| Source property | Status |
|---|---|
| `prisma.projectMemory` | Schema already has `ProjectMemory` model. No migration row. **REVERSE DRIFT — do not touch in Block A.** |

All other 38 source references DO have a corresponding 20260714 migration; they only lack a schema.prisma model.

---

## Section D — Column-level fidelity (mechanical translation, awaiting block A)

The parser at `/tmp/sqlparse2/*.json` produces the exact ground-truth column list for every table. After the Section B decisions are approved, the Prisma `model` blocks will be generated by translating each row of the JSON dump into Prisma field syntax. Translation rules:

| SQL ground truth | Prisma field |
|---|---|
| `TEXT NOT NULL` | `String` |
| `TEXT NULL` | `String?` |
| `TEXT[] NOT NULL DEFAULT '{}'` | `String[] @default([])` |
| `TEXT[]` (nullable, default ARRAY[]::TEXT[]) | `String[]? @default([])` |
| `INTEGER NOT NULL DEFAULT 0` | `Int @default(0)` |
| `INTEGER` (no default) | `Int?` (nullable) |
| `BOOLEAN NOT NULL DEFAULT true` | `Boolean @default(true)` |
| `BOOLEAN` (nullable) | `Boolean?` |
| `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` | `DateTime @default(now())` |
| `TIMESTAMP(3)` (nullable, no default) | `DateTime?` |
| `JSONB NOT NULL DEFAULT '{}'` | `Json @default("{}")` |
| `JSONB NOT NULL DEFAULT '[]'` | `Json @default("[]")` |
| `JSONB` (nullable, no default) | `Json?` |
| `DOUBLE PRECISION NOT NULL DEFAULT 0` | `Float @default(0)` |
| `"EnumName"` (custom enum) | `EnumName` |
| `PRIMARY KEY` on column | `@id @default(cuid())` (consistent with existing schema) |

**Three non-trivial translations** that need a coding decision (will be flagged if pattern is unclear):

1. **`ARRAY[]::TEXT[]` default** — Prisma emits `[]` for empty arrays. Translation: `@default([])`.
2. **JSONB `default '{}'\|'[]'`** — Prisma expects a string. Translation: `@default("{}")` (Prisma parses on its side).
3. **`TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` on `updatedAt` columns** — Prisma's `@updatedAt` would conflict if applied here because the SQL also has an explicit `NOT NULL` and is sometimes nullable. **Decision:** use `@default(now())` for createdAt; leave `updatedAt` as `DateTime?` if nullable in SQL, or as `DateTime @updatedAt` if NOT NULL — to be matched row by row.

---

## Section E — Outstanding items requiring approval before insertion

1. **Approve Section B naming decisions.** Without approval, schema.prisma would either fail to compile (source expects `aIBiasFinding`, not `aiBiasFinding`) or fail to map to the SQL table (model `AiModelRegistry` would generate `aiModelRegistries`, not match `ai_model_registry`).
2. **Approve Section D column translation table.** Without approval, I cannot guarantee field-level match between SQL and Prisma.
3. **Confirm I should NOT add reverse-drift models** (Section C, Section B of the prior doc). Default plan: leave them. This means 124-error count drops to ~7 (Block B surgical fixes), gates 4-5 still expected green.

If you approve all three, the next turn will:

1. Read the parsed JSON for every 20260714 migration.
2. Generate a `schema-addendum.prisma` block for all 39 properties + 14 enums.
3. Append to `schema.prisma` and re-run gates 1-3.
4. If green, apply Block B surgical fixes (7 leftover errors).
5. Re-run all 5 gates to fully green.
6. Add CI workflow.
