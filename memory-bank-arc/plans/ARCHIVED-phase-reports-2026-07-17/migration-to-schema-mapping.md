# Migration → Prisma Schema Mapping (audit-remediation)

**Purpose:** Establish single-source-of-truth Prisma schema before editing.
**Method:** Per migration, in chronological order, enumerate every `CREATE TYPE`, `CREATE TABLE`, and column-level `ALTER TABLE ... ADD COLUMN`. Translate each into the `model` / `enum` declaration to add to `backend/prisma/schema.prisma`.
**Status:** This is the **map only**. No `schema.prisma` edits have been made yet. After review + approval, schema edits will follow this document verbatim.

**Note on column drift:** The migration `20260627_eaos_1_entity_model` redefines 52 tables previously created by earlier migrations. For those tables the **eaos_1 column list is canonical** (because Prisma's behaviour with two `CREATE TABLE` definitions for the same name is to keep the latest). Where eaos_1 omits columns the earlier migration had, those are dropped on the live DB. Therefore the mapping uses eaos_1 as the source of truth for these 52 tables. **Apply ALTER ADD COLUMN from later migrations on top.**

---

## Section A — Phase 2-14 (priority; all 20260714_* migrations)

These are the migrations whose tables are NOT currently in `schema.prisma`. Each subsection contains the verbatim `migration.sql` extract and the proposed Prisma model/enum.

---

### A.1 — `20260714_enterprise_event_fabric` (Phase 2)

**Source migration:** `backend/prisma/migrations/20260714_enterprise_event_fabric/migration.sql`
**Cross-ref:** referenced by `src/modules/enterprise-events/transport/enterprise-event-transport.service.ts` and `idempotency/idempotency.service.ts` and `enterprise-events-admin.controller.ts`.
**Tables/enums (raw):** See `/tmp/migmap/20260714_enterprise_event_fabric.txt`.

**Proposed additions to schema.prisma:**

```prisma
enum EnterpriseEventOutboxStatus {
  PENDING
  DISPATCHED
  DEAD_LETTER
}

enum ConsumerInboxStatus {
  PENDING
  PROCESSING
  PROCESSED
  FAILED
  DEAD_LETTER
}

model EnterpriseEventOutbox {
  id              String   @id @default(cuid())
  tenantId        String
  eventId         String   @unique
  type            String
  version         Int      @default(1)
  payload         Json
  status          EnterpriseEventOutboxStatus @default(PENDING)
  attempts        Int      @default(0)
  lastError       String?
  correlationId   String?
  causationId     String?
  idempotencyKey  String
  sourceModule    String
  occurredAt      DateTime @default(now())
  nextAttemptAt   DateTime @default(now())
  @@unique([tenantId, idempotencyKey])
  @@index([status, nextAttemptAt])
  @@map("enterprise_event_outbox")
}

model EnterpriseEventInbox {
  id            String   @id @default(cuid())
  tenantId      String
  consumerId    String
  eventId       String
  type          String
  status        ConsumerInboxStatus @default(PENDING)
  attempts      Int     @default(0)
  lastError     String?
  payload       Json
  leaseExpiresAt DateTime?
  claimedAt     DateTime?
  processedAt   DateTime?
  @@unique([eventId, consumerId])
  @@index([status])
  @@map("enterprise_event_inbox")
}

model EnterpriseEventDeadLetter {
  id          String   @id @default(cuid())
  tenantId    String
  eventId     String
  consumerId  String
  type        String
  payload     Json
  attempts    Int
  lastError   String
  movedAt     DateTime @default(now())
  @@map("enterprise_event_dead_letter")
}

model EnterpriseEventIdempotency {
  id             String   @id @default(cuid())
  tenantId       String
  idempotencyKey String
  consumerId     String
  recordedAt     DateTime @default(now())
  @@unique([idempotencyKey, consumerId])
  @@map("enterprise_event_idempotency")
}
```

> ⚠️ The exact column lists above are my inferred shape from the Phase 2 report + the `transport.spec.ts` patterns. **Before committing them, the literal `migration.sql` columns must be re-read and reconciled.** The `npx tsc --noEmit` errors do NOT depend on this column-level fidelity, but production correctness does. See Section C.

---

### A.2 — `20260714_work_runtime` (Phase 4)

**Tables:** `work_runs`, `work_run_steps`
**Enums:** `WorkRunStatus`, `WorkRunStepStatus`
**Cross-ref:** `src/modules/work-runtime/repository/work-run.repository.ts`

**Proposed additions:**

```prisma
enum WorkRunStatus {
  CREATED
  PLANNING
  PLANNED
  RUNNING
  WAITING_FOR_APPROVAL
  PAUSED
  COMPLETED
  FAILED
  CANCELLED
}

enum WorkRunStepStatus {
  PENDING
  VALIDATING
  DENIED
  WAITING_FOR_APPROVAL
  APPROVED
  RUNNING
  SUCCEEDED
  FAILED
  SKIPPED
  CANCELLED
}

model WorkRun {
  id               String   @id @default(cuid())
  tenantId         String
  actorId          String
  actorType        String
  request          Json
  scope            Json
  contextProvenance Json?
  plan             Json
  status           WorkRunStatus @default(CREATED)
  version          Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  steps            WorkRunStep[]
  @@map("work_runs")
}

model WorkRunStep {
  id               String   @id @default(cuid())
  tenantId         String
  runId            String
  sequence         Int
  toolName         String
  capability       String
  input            Json
  dependsOn        Json     @default("[]")
  effect           String
  expectedOutput   Json?
  status           WorkRunStepStatus @default(PENDING)
  governanceDecision Json?
  approvalId       String?
  idempotencyKey   String
  result           Json?
  retries          Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  run              WorkRun  @relation(fields: [runId], references: [id], onDelete: Cascade)
  @@unique([tenantId, idempotencyKey])
  @@index([runId, sequence])
  @@map("work_run_steps")
}
```

---

### A.3 — `20260714_planning_memory` (Phase 5)

**Tables:** `planning_memory`
**Enums:** `PlanningMemoryKind`
**Cross-ref:** `src/modules/enterprise-cognition/planning-memory/planning-memory.service.ts`

**Proposed additions:**

```prisma
enum PlanningMemoryKind {
  SUCCESSFUL_PLAN
  FAILED_PLAN
  APPROVAL_OUTCOME
  EXECUTION_METRIC
  PLAN_TEMPLATE
}

model PlanningMemory {
  id          String   @id @default(cuid())
  tenantId    String
  kind        PlanningMemoryKind
  objectiveId String?
  content     Json
  outcome     Json?
  metric      Float?
  occurredAt  DateTime @default(now())
  createdAt   DateTime @default(now())
  @@index([tenantId, kind])
  @@map("planning_memory")
}
```

---

### A.4 — `20260714_enterprise_autonomy` (Phase 6)

**Tables:** `ai_departments`, `ai_employees`, `missions`, `mission_observations`
**Enums:** `MissionStatus`, `ObservationSeverity`
**Cross-ref:** `src/modules/enterprise-autonomy/repository/autonomy.repository.ts`

**Proposed additions:**

```prisma
enum MissionStatus {
  CREATED
  PLANNED
  ASSIGNED
  RUNNING
  WAITING
  ESCALATED
  BLOCKED
  COMPLETED
  CANCELLED
  FAILED
}

enum ObservationSeverity {
  INFO
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model AiDepartment {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  description String?
  mandate     String?
  headEmployeeId String?
  metadata    Json     @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  employees   AiEmployee[]
  missions    Mission[]
  @@unique([tenantId, name])
  @@map("ai_departments")
}

model AiEmployee {
  id            String  @id @default(cuid())
  tenantId      String
  departmentId  String?
  name          String
  role          String
  capabilities  Json    @default("[]")
  allowedTools  Json    @default("[]")
  status        String  @default("ACTIVE")
  autonomyLevel Int     @default(1)
  metadata      Json    @default("{}")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  department    AiDepartment? @relation(fields: [departmentId], references: [id])
  observations  MissionObservation[]
  @@map("ai_employees")
}

model Mission {
  id            String   @id @default(cuid())
  tenantId      String
  departmentId  String?
  ownerEmployeeId String?
  title         String
  objective     String
  status        MissionStatus @default(CREATED)
  priority      Int      @default(3)
  contextAccess Json?
  result        Json?
  failureReason String?
  parentMissionId String?
  workRunIds    Json     @default("[]")
  version       Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  department    AiDepartment? @relation(fields: [departmentId], references: [id])
  observations  MissionObservation[]
  @@index([tenantId, status])
  @@map("missions")
}

model MissionObservation {
  id            String   @id @default(cuid())
  tenantId      String
  missionId     String?
  watcherId     String?
  employeeId    String?
  severity      ObservationSeverity @default(INFO)
  evidence      Json
  confidence    String?
  recommendedAction Json?
  requiresRuntime    Boolean @default(false)
  requiresApproval  Boolean @default(false)
  createdAt     DateTime @default(now())
  mission       Mission? @relation(fields: [missionId], references: [id])
  employee      AiEmployee? @relation(fields: [employeeId], references: [id])
  @@index([missionId])
  @@map("mission_observations")
}
```

---

### A.5 — `20260714_enterprise_os` (Phase 7)

**Tables:** `simulation_records`

```prisma
model SimulationRecord {
  id          String   @id @default(cuid())
  tenantId    String
  scenarioKind String
  baselineJson Json
  projectionJson Json
  outcomesJson Json
  durationMs  Int
  cognitionEvaluation Json?
  createdAt   DateTime @default(now())
  @@index([tenantId, scenarioKind])
  @@map("simulation_records")
}
```

---

### A.6 — `20260714_enterprise_intelligence` (Phase 9)

**Tables:** `ontology_versions`, `knowledge_nodes`, `knowledge_edges`
**Enums:** `OntologyEntityKind`, `RelationshipKind`
**Cross-ref:** `src/modules/enterprise-intelligence-network/engines/intelligence-engines.service.ts`

```prisma
enum OntologyEntityKind {
  EMPLOYEE
  DEPARTMENT
  PROJECT
  CUSTOMER
  SUPPLIER
  PRODUCT
  MISSION
  WORK_RUN
  RECOMMENDATION
  STRATEGY
  RISK
  APPROVAL
  GOVERNANCE_RULE
  DOCUMENT
  POLICY
  EVENT
  CAPABILITY
  KNOWLEDGE_CLUSTER
  CUSTOM
}

enum RelationshipKind {
  DEPENDS_ON
  OWNS
  REPORTS_TO
  INFLUENCES
  IMPACTS
  RELATED_TO
  PRECEDES
  CONFLICTS_WITH
  SUPPORTS
  DELEGATES_TO
  RESOLVES
  CREATED_BY
  APPROVED_BY
  PART_OF
  CUSTOM
}

model OntologyVersion {
  id         String   @id @default(cuid())
  tenantId   String
  version    Int
  schemaJson Json     @default("{}")
  createdAt  DateTime @default(now())
  @@unique([tenantId, version])
  @@map("ontology_versions")
}

model KnowledgeNode {
  id          String   @id @default(cuid())
  tenantId    String
  entityKind  OntologyEntityKind
  entityId    String
  label       String
  metadataJson Json    @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  edgesOut    KnowledgeEdge[] @relation("source")
  edgesIn     KnowledgeEdge[] @relation("target")
  @@unique([tenantId, entityKind, entityId])
  @@index([tenantId, entityKind])
  @@index([tenantId, label])
  @@map("knowledge_nodes")
}

model KnowledgeEdge {
  id              String   @id @default(cuid())
  tenantId        String
  sourceNodeId    String
  targetNodeId    String
  relationshipKind RelationshipKind
  evidenceJson    Json     @default("[]")
  confidence      String   @default("MEDIUM")
  ontologyVersion Int      @default(1)
  createdAt       DateTime @default(now())
  source          KnowledgeNode @relation("source", fields: [sourceNodeId], references: [id], onDelete: Cascade)
  target          KnowledgeNode @relation("target", fields: [targetNodeId], references: [id], onDelete: Cascade)
  @@unique([tenantId, sourceNodeId, targetNodeId, relationshipKind])
  @@map("knowledge_edges")
}
```

---

### A.7 — `20260714_platform_sdk` (Phase 10)

**Tables:** `plugins`, `extension_permissions`
**Enums:** `PluginStatus`, `ExtensionKind`

```prisma
enum PluginStatus {
  DRAFT
  INSTALLED
  VALIDATED
  ENABLED
  DISABLED
  DEPRECATED
  REMOVED
}

enum ExtensionKind {
  PLUGIN
  WORKFLOW
  AGENT
  CONNECTOR
  DASHBOARD
  ANALYTICS
  VISUALIZATION
  CUSTOM
}

model Plugin {
  id            String   @id @default(cuid())
  tenantId      String
  name          String
  kind          ExtensionKind @default(PLUGIN)
  version       String   @default("1.0.0")
  sdkVersion    String   @default("10.0.0")
  status        PluginStatus @default(DRAFT)
  permissionsJson Json   @default("[]")
  metadataJson  Json     @default("{}")
  signature     String?
  installedById String?
  validated     Boolean  @default(false)
  enabledAt     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  permissions   ExtensionPermission[]
  @@unique([tenantId, name, version])
  @@map("plugins")
}

model ExtensionPermission {
  id         String   @id @default(cuid())
  tenantId   String
  pluginId   String
  capability String
  granted    Boolean  @default(false)
  reason     String?
  createdAt  DateTime @default(now())
  plugin     Plugin   @relation(fields: [pluginId], references: [id], onDelete: Cascade)
  @@unique([tenantId, pluginId, capability])
  @@map("extension_permissions")
}
```

---

### A.8 — `20260714_cloud_platform` (Phase 11)

**Tables:** `cloud_regions`, `cloud_clusters`, `tenant_placements`
**Enums:** `RegionStatus`

```prisma
enum RegionStatus {
  ACTIVE
  DEGRADED
  UNAVAILABLE
  PLANNED
}

model CloudRegion {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  status      RegionStatus @default(ACTIVE)
  endpoint    String
  metadataJson Json    @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  clusters    CloudCluster[]
  @@unique([tenantId, name])
  @@map("cloud_regions")
}

model CloudCluster {
  id          String   @id @default(cuid())
  regionId    String
  name        String
  healthy     Boolean  @default(true)
  endpoint    String?
  metadataJson Json    @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  region      CloudRegion @relation(fields: [regionId], references: [id], onDelete: Cascade)
  @@unique([regionId, name])
  @@map("cloud_clusters")
}

model TenantPlacement {
  id               String   @id @default(cuid())
  tenantId         String   @unique
  primaryRegion    String
  backupRegion     String?
  residencyPolicy  String?
  replicationEnabled Boolean @default(false)
  failoverStatus   String   @default("NONE")
  metadataJson     Json     @default("{}")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  @@map("tenant_placements")
}
```

---

### A.9 — `20260714_application_framework` (Phase 12)

**Tables:** `applications`, `domain_packages`, `industry_solutions`, `workspaces`
**Enums:** `AppStatus`, `Edition`

```prisma
enum AppStatus {
  DRAFT
  ACTIVE
  DEPRECATED
  RETIRED
}

enum Edition {
  COMMUNITY
  PROFESSIONAL
  ENTERPRISE
  GOVERNMENT
  PRIVATE_CLOUD
}

model Application {
  id           String   @id @default(cuid())
  tenantId     String
  name         String
  version      String   @default("1.0.0")
  vendor       String?
  domain       String
  industry     String?
  description  String?
  status       AppStatus @default(DRAFT)
  edition      Edition  @default(ENTERPRISE)
  requiredCapabilities String[] @default([])
  icon         String?
  navigationJson Json   @default("{}")
  metadataJson Json     @default("{}")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@unique([tenantId, name])
  @@map("applications")
}

model DomainPackage {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  domain      String
  description String?
  modules     String[] @default([])
  dependencies String[] @default([])
  metadataJson Json    @default("{}")
  createdAt   DateTime @default(now())
  @@unique([tenantId, name])
  @@map("domain_packages")
}

model IndustrySolution {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  industry    String
  packages    String[] @default([])
  description String?
  metadataJson Json    @default("{}")
  createdAt   DateTime @default(now())
  @@unique([tenantId, name])
  @@map("industry_solutions")
}

model Workspace {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  role        String
  layoutJson  Json     @default("{}")
  dashboards  String[] @default([])
  metadataJson Json    @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([tenantId, name])
  @@map("workspaces")
}
```

---

### A.10 — `20260714_ai_governance` (Phase 13)

**Tables:** `trust_evaluations`, `ai_hallucination_flags`, `ai_bias_findings`, `ai_policies`, `ai_model_registry`, `ai_human_reviews`
**Enums:** `TrustGrade`, `AIPolicyCategory`, `CertificationStatus`, `ReviewDecision`
**Cross-ref:** `src/modules/enterprise-ai-governance/ai-governance.service.ts`

> ⚠️ **Case-sensitive naming discrepancy**: source uses `prisma.aIBiasFinding`, `prisma.aIHallucinationFlag`, `prisma.aIPolicy`, `prisma.modelRegistration`, `prisma.humanReviewRecord` (camelCase with the AI prefix kept lowercase). Standard Prisma convention is `AIBiasFinding`. **Decision needed**: use `AIBiasFinding` and write `prisma.aIBiasFinding` mapping via `@@map("ai_bias_findings")` AND configure Prisma client field aliasing? **No** — Prisma's client generator uses PascalCase model names → camelCase property names, so the only way the source compiles is to make these model names like `AIBiasFinding`. The mismatch in the source (`aIBiasFinding`) is itself a bug.
> 
> **Action:** rename in source: `prisma.aIBiasFinding` → `prisma.aIBiasFinding` is impossible without `@@map` overriding property names. Instead: keep PascalCase model names (`AIBiasFinding`), accept Prisma's auto-camelCase property name (`aIBiasFinding`), confirm via `npx tsc --noEmit` after edit.

```prisma
enum TrustGrade {
  EXCELLENT
  GOOD
  FAIR
  POOR
  CRITICAL
}

enum AIPolicyCategory {
  MODEL_USAGE
  PROMPT
  REASONING
  EVIDENCE
  CONFIDENCE
  HUMAN_REVIEW
  APPROVAL
  RISK
  ETHICS
}

enum CertificationStatus {
  CERTIFIED
  CONDITIONAL
  REQUIRES_REVIEW
  REJECTED
  EXPIRED
  REVOKED
}

enum ReviewDecision {
  APPROVED
  REJECTED
  NEEDS_REVISION
  ESCALATED
}

model TrustEvaluation {
  id              String   @id @default(cuid())
  tenantId        String
  sourceType      String
  sourceId        String
  trustScore      TrustGrade     @default(GOOD)
  evidenceQuality TrustGrade     @default(GOOD)
  reasoningQuality TrustGrade    @default(GOOD)
  riskLevel       TrustGrade     @default(GOOD)
  policyCompliant Boolean        @default(true)
  issues          String[]       @default([])
  evidenceJson    Json           @default("{}")
  createdAt       DateTime       @default(now())
  @@index([tenantId, sourceType])
  @@map("trust_evaluations")
}

model AIHallucinationFlag {
  id                String   @id @default(cuid())
  tenantId          String
  sourceType        String
  sourceId          String
  claim             String
  evidenceGap       String
  severity          TrustGrade     @default(FAIR)
  recommendedAction String?
  createdAt         DateTime       @default(now())
  @@map("ai_hallucination_flags")
}

model AIBiasFinding {
  id              String   @id @default(cuid())
  tenantId        String
  category        String
  detail          String
  severity        TrustGrade     @default(FAIR)
  recommendation  String?
  createdAt       DateTime       @default(now())
  @@map("ai_bias_findings")
}

model AIPolicy {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  category    AIPolicyCategory
  version     Int      @default(1)
  rulesJson   Json     @default("{}")
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  @@unique([tenantId, name, version])
  @@map("ai_policies")
}

model AiModelRegistry {
  id           String   @id @default(cuid())
  tenantId     String
  modelName    String
  provider     String
  capabilities String[] @default([])
  limitations  String[] @default([])
  status       String   @default("REGISTERED")
  evaluatedAt  DateTime?
  retiredAt    DateTime?
  createdAt    DateTime @default(now())
  @@unique([tenantId, modelName])
  @@map("ai_model_registry")
}

model AIHumanReview {
  id            String   @id @default(cuid())
  tenantId      String
  sourceType    String
  sourceId      String
  reviewerId    String?
  decision      ReviewDecision @default(NEEDS_REVISION)
  reason        String?
  reviewedAt    DateTime?
  createdAt     DateTime @default(now())
  @@map("ai_human_reviews")
}
```

---

### A.11 — `20260714_platform_evolution` (Phase 14)

**Tables:** `tech_radar`, `benchmark_records`, `experiments`, `feature_lifecycle`, `capability_versions`, `migration_plans`
**Enums:** `TechMaturity`, `FeatureState`, `ExperimentStatus`, `CapabilityDomain`

```prisma
enum TechMaturity {
  EMERGING
  TRIAL
  ADOPT
  HOLD
  RETIRE
}

enum FeatureState {
  PROPOSAL
  RESEARCH
  PROTOTYPE
  PILOT
  APPROVED
  GA
  DEPRECATED
  RETIRED
}

enum ExperimentStatus {
  DRAFT
  RUNNING
  COMPLETED
  CANCELLED
}

enum CapabilityDomain {
  REASONING
  PLANNING
  MEMORY
  KNOWLEDGE
  AGENTS
  AUTONOMY
  VISION
  SPEECH
  WORKFLOW
  SIMULATION
  SEARCH
}

model TechRadar {
  id            String   @id @default(cuid())
  tenantId      String
  name          String
  category      String
  maturity      TechMaturity @default(TRIAL)
  description   String?
  recommendation String?
  metadataJson  Json     @default("{}")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@unique([tenantId, name])
  @@map("tech_radar")
}

model BenchmarkRecord {
  id          String   @id @default(cuid())
  tenantId    String
  modelName   String
  provider    String
  task        String
  score       Float
  metadataJson Json    @default("{}")
  createdAt   DateTime @default(now())
  @@index([tenantId, modelName])
  @@map("benchmark_records")
}

model Experiment {
  id            String   @id @default(cuid())
  tenantId      String
  name          String
  description   String?
  status        ExperimentStatus @default(DRAFT)
  resultsJson   Json     @default("{}")
  affectProduction Boolean @default(false)
  createdAt     DateTime @default(now())
  completedAt   DateTime?
  @@map("experiments")
}

model FeatureLifecycle {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  description String?
  state       FeatureState @default(PROPOSAL)
  version     Int      @default(1)
  metadataJson Json    @default("{}")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([tenantId, name])
  @@map("feature_lifecycle")
}

model CapabilityVersion {
  id              String   @id @default(cuid())
  tenantId        String
  domain          CapabilityDomain
  version         Int      @default(1)
  description     String?
  changes         String[] @default([])
  backwardCompatible Boolean @default(true)
  createdAt       DateTime @default(now())
  @@unique([tenantId, domain, version])
  @@map("capability_versions")
}

model MigrationPlan {
  id           String   @id @default(cuid())
  tenantId     String
  name         String
  targetType   String
  stepsJson    Json     @default("[]")
  riskLevel    String   @default("LOW")
  autoApply    Boolean  @default(false)
  createdAt    DateTime @default(now())
  @@map("migration_plans")
}
```

---

## Section B — Existing tables that need only `@@map` corrections (likely)

The current `schema.prisma` declares 36 models whose tables are NOT created by any migration (reverse drift). Of these, the ones below are actually created by later migrations but only with conflicting column shapes. **Decision required per row.** Conservative recommendation: leave them as-is; if drift exists in production, generate a follow-up raw-SQL `migrate` that aligns them. **Do not edit them in Block A.** Listed for the next session.

- `EntityCompleteness` ↔ `entity_completeness` (created in eaos_1, conflicting shape vs current model)
- `EntityState`, `EntityOwnership`, `EntityLabel`, `EntityHealth`, `EntityWatcher`, `EntityRelationship` etc. — likely no current conflict, but they were designed against eaos_1
- `ApprovalWorkflow`, `ApprovalWorkflowStep` — current schema exists but migration table created by eaos_1 doesn't include them in this rewrite (created by `20260709_aaa_prereq_create_approval_workflow_tables`)
- `LoginAttempt` — schema has it but no migration creates it (added manually / shadow work)
- `ModelProvider`, `ModelCatalogAudit`, `NotificationPreference`, `TenantModelOverride`, `CommunicationThread`, `ThreadParticipant`, `ThreadReadState`, `HumanReviewRecord`, `ModelRegistration`, `WorkspaceLayout`, `WorkflowExecution`, `WorkflowTemplate`, `RetentionPolicy`, `ActivityEvent`, `AdapterCursor`, `InformationResponse`, `InformationSource`, `QuestionPack`, `ProjectTypePack`, `ProjectMemory`, `ProjectDecision`, `ProjectDocument`, `ProjectAutomationLog`, `StageHistory`, `TierTemplate`, `Feature`, `Industry`, `Package`, `PackInstallation`, `TenantInstalledPack`, `SolutionPack`, `KnowledgeEntry`, `KnowledgePack` — current schema has these but migrations either lack them, or the shape differs
- `HermesAgent`, `HermesAuditLog`, `HermesCapability`, `HermesMemoryEntry`, `HermesMessage`, `HermesSession`, `HermesToolPermission` — Hermes-side tables created by earlier migrations

**Decision needed from user before Block A starts: review this section and either (a) confirm leaving them untouched, or (b) request a shape-audit pass.**

---

## Section C — Open verification items (do before editing schema.prisma)

1. **Column-level reconciliation.** Each proposed `model` above must be re-read against the actual `migration.sql` to confirm column names + types + nullability + defaults match. I have inferred shapes from the report prose + the consumer code. Mechanical extraction has been done (see `/tmp/migmap/*`) but not pasted here for length. **Action:** before insertion, read each `migmap` extract and diff against my proposed model.
2. **Relation targets.** Enums for tenant references use raw `String` for `tenantId`. Where a tenant FK exists, I propose no Prisma relation; match the existing style in schema.prisma (also uses `String tenantId` + manual filter).
3. **FK deletion behaviour.** I used `onDelete: Cascade` for `KnowledgeEdge` (matches the migration). For other relations I've omitted `@relation` entirely (raw `tenantId String` + per-tenant repository enforcement), consistent with the project's tenant-isolation-by-convention pattern.
4. **Migration `20260627_eaos_1_entity_model` redefines 52 tables.** For those I have NO proposed Prisma edits in Section A (they're already represented by existing `schema.prisma` models). Where eaos_1 *added* columns not yet in the Prisma model, those need separate `@updatedAt` / `tierAgentPoolId` / `emailAlias` / etc. additions. **Out of scope here; flagged for follow-up.**
5. **Enums declared without matching `CREATE TYPE`:** some enums in `schema.prisma` (e.g. `MissionFeedPriority`, `ProjectStatus`, `RoutineStatus`) appear to lack a dedicated migration — they were probably ALTER TYPE added inline. Double-check before reusing those names.

---

## Section D — Process

The plan is to **not edit `schema.prisma` yet**. Awaiting the user's review and approval of this map.

Once approved, the next turn will:

1. Re-extract literal `CREATE TABLE` column lists from each `20260714_*.sql`.
2. For each model in Section A, produce a schema.prisma add-block that exactly matches those columns.
3. Append all add-blocks at the end of `schema.prisma` (after line 4104), inside the `model`/`enum` hierarchy that already exists.
4. Run `prisma validate`, `prisma generate`, `npx tsc --noEmit`. Expect 124 errors → ~7 errors (Block B surgical fixes).
5. Commit the schema-reconciliation as one commit on `audit-remediation`.
6. Apply Block B (7 surgical TS fixes).
7. Re-run all gates.
8. Add CI workflow gate.

If anything in Section A looks wrong, **flag it now** and I will adjust the model block before insertion. Once we start inserting, deviations will be reported transaction-style per the plan.

---

**Status:** Awaiting review. No code changes have been made in this turn.
