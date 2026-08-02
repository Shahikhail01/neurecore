# Data Model Tour

> Walk-through of the **174 Prisma models** in `backend/prisma/schema.prisma`, organised by domain cluster. Last refreshed: 2026-07-31.

This is the single most useful doc for a new backend dev. If you know the
cluster a feature belongs to, you know roughly where the data lives and
which other clusters it touches. Cluster boundaries also line up with the
Nest module boundaries — see `backend.md §3`.

> **Always verify** against `backend/prisma/schema.prisma` (it changes
> often). Counts below are stable; field names are not exhaustive.

---

## 1. Cluster map

| # | Cluster | Approx. models | Live in `modules/...` |
|---|---|---:|---|
| 1 | Identity & Access | 8 | `auth`, `users`, `tenants`, `service-identities` |
| 2 | Tenant config & limits | 9 | `tenants`, `tenant-templates`, `tenant-flags`, `tiers` |
| 3 | Work core (Project / Task / Stage / Member) | 8 | `projects`, `tasks`, `project-stages`, `project-members`, `project-types` |
| 4 | Execution, evidence & review | 6 | `execution`, `reviews`, `deliverables`, `execution-log` |
| 5 | Phase 8 / Phase 5 Work Memory | 6 | `project-memory`, `project-decisions`, `phase8` |
| 6 | Enterprise Event Fabric (AWL ADR-001) | 5 | `enterprise-events`, `common/outbox`, `common/idempotency` |
| 7 | Timeline, decisions, simulations | 5 | `timeline-events`, `decision-evaluations`, `simulations` |
| 8 | Departments, pools, templates | 6 | `departments`, `departments-pool`, `department-templates` |
| 9 | Agents, AI workforce | 14 | `agents`, `agents-pool`, `agent-templates`, `memory`, `tools`, `models`, `ai-gateway` |
| 10 | Hermes runtime | 8 | `hermes`, `hermes-adapter` |
| 11 | CRM, finance, integrations | 12 | `customers`, `finance`, `connectors`, `integrations` |
| 12 | Accounting capability (new 2026-07-30) | 10 | `accounting` |
| 13 | Onboarding, industries, tiers, packages | 8 | `onboarding`, `industry`, `tiers`, `packages`, `departments-pool`, `agents-pool`, `features` |
| 14 | Marketplace & solution packs | 6 | `solution-packs`, `marketplace` |
| 15 | Routines / workflows / goals / inbox / costs | 8 | `routines`, `workflows`, `goals`, `inbox`, `costs` |
| 16 | Compliance & reliability | 6 | `compliance`, `reliability`, `audit` |
| 17 | Portal & client-facing | 4 | `portal` |
| 18 | Knowledge & entity plane | 9 | `knowledge`, `context-plane`, `enterprise-events`, `entities` |
| 19 | Activity, threads, missions, notifications | 9 | `activity`, `threads`, `mission-feed`, `notifications` |
| 20 | Observability, metrics, decisions | 6 | `observability`, `metrics`, `feature-flag` |
| 21 | Chat & session | 3 | `chat` |
| 22 | Approvals (cross-cutting) | 4 | `approvals`, `approval-chains` |
| 23 | Uploads | 2 | `uploads` |
| 24 | Cloud / Platform / SDK / EAOS layers | many | `cloud-platform`, `platform-sdk`, `platform-evolution`, `enterprise-intelligence-network`, `enterprise-cognition`, `enterprise-autonomy`, `enterprise-operating-system`, `application-framework`, `enterprise-ai-governance` |
| 25 | Information engine, knowledge graph, planning | many | `information-engine`, `project-decisions`, `entities` |
| 26 | Settings, tiers, billing, Brevo | many | `settings`, `tiers`, `integrations` |

---

## 2. Identity & Access

- **`User`** — `email` unique, `passwordHash`, `isActive`,
  `failedLoginAttempts`, `lockedUntil`, role enum, optional `tenantId`.
- **`Tenant`** — `slug`, `name`, `status` (`ACTIVE | SUSPENDED |
  CANCELLED | ONBOARDING`), `tierId` FK, billing fields.
- **`Session`** — historic (SSO/session continuity).
- **`RefreshToken`** — refresh JWT handle, `revokedAt`, `lastUsedAt`.
- **`PasswordResetToken`** — single-use tokens for forgot-password.
- **`TenantMetric` / `TenantLimit`** — usage counter snapshots.
- **`ServiceIdentity`** / **`ServiceToken`** — service-to-service
  identity (Hermes adapter uses these).

Source: `backend/src/modules/auth/`, `backend/src/modules/users/`,
`backend/src/modules/tenants/`, `backend/src/modules/service-identities/`.

## 3. Tenant config & limits

- **`TenantTemplate`** — copyable template per industry.
- **`TenantFeatureFlagOverride`** — per-tenant override (kill switch).
- **`TenantInstalledPack`** — links to installed `SolutionPack`.
- **`TenantModelOverride`** — model catalog override per tenant.
- **`TenantPlacement`** — geographic deployment placement.
- **`Tier`** / **`TierAgentPool`** / **`TierTemplate`** — tier definitions
  + agent pool mappings.
- **`TierAuditLog`** / **`TierChangeRequest`** — change-control log.

## 4. Work core

- **`Project`** — `tenantId`, `name`, `status` (`ProjectStatus` enum
  starts in `LEAD`), `customerId?` (FK `Customer`), `initiation?` (FK
  `EnterpriseInitiation`), `stageVersion` (optimistic concurrency for
  stage transitions — see Phase 6 §8.2), `executionEngineVersion` enum
  (`AwlExecutionEngine`: `legacy | reconstructed`, Phase 1–10
  migration tracking).
- **`Task`** — `tenantId`, `projectId`, `title`, `status`, `dueDate`,
  `dueOverride`, optional `goalId`, optional `agentId`.
- **`ProjectStage`** / **`ProjectMember`** / **`ProjectType`** /
  **`ProjectTypeVersion`** — supporting tables for project shape.
- **`ProjectDocument`** — attached documents.

Source: `projects/`, `tasks/`, `project-stages/`, `project-members/`,
`project-types/`, `deliverables/`.

## 5. Execution, evidence & review

- **`ExecutionAttempt`** — single attempt at an execution; **never**
  mutated in place after approval (Invariant #9).
- **`ExecutionToolCall`** — individual tool invocations within an attempt.
- **`ExecutionLog`** / **`TaskExecutionLogEntry`** — append-only audit.
- **`ExecutionBudgetLedgerEntry`** — cost ledger (ADR-007 cross-link).
- **`ExecutionConcurrencyReservation`** — concurrency control.
- **`EvidenceArtifact`** — produced by executions; reviewed
  (Invariant #10 — revision doesn't mutate prior evidence).
- **`Review`** / **`HumanReviewRecord`** — human-in-the-loop signoff.
- **`Deliverable`** / **`DeliverableVersion`** — output artifacts.

## 6. Phase 5 / 8 — Project Memory + Decisions + Compliance

- **`ProjectMemory`** — long-term memory scoped to project.
- **`ProjectDecision`** — captured decisions (ADR — plan decisions).
- **`ProjectAutomationLog`** — automation attempt history.
- **`EntityCompleteness` / `EntityHealth` / `EntityState` /
  `EntityLabel` / `EntityOwnership` / `EntityRelationship`** — entity
  workspace (EAOS-1).
- **`EntityWatcher`** — domain event watcher config.
- **`MigrationPlan`** — migration plan record.
- **`StateHistory`** — entity state snapshots.

## 7. Enterprise Event Fabric (AWL / ADR-001)

- **`EnterpriseEventOutbox`** — outbox row written in same tx.
- **`EnterpriseEventInbox`** — consumer side dedup (idempotency).
- **`EnterpriseEventIdempotency`** — business-effect idempotency
  (ADR-012).
- **`EnterpriseEventDeadLetter`** — poison messages.
- **`OutboxMerkleRoot`** — Merkle root per day (Phase 1l / accounting).

Plus generic:
- **`OutboxEvent`** / **`OutboxDeadLetter`** (single-row outbox +
  transaction table) under `common/outbox/`.

## 8. Timeline, decisions, simulations

- **`TimelineEvent`** — projection of enterprise events for the UI
  timeline view.
- **`DecisionEvaluation`** — immutable score snapshot.
- **`SimulationRecord`** — simulation run record.
- **`SimulationRecord` + harness** — driver used by `simulations.module`.

## 9. Departments, pools, templates

- **`Department`** — tenant department.
- **`DepartmentTemplate`** — copyable template.
- **`DepartmentTemplate`** mirrors `Department` shape.
- **Pool tables** (`DepartmentPool` etc.) — for Pool #2 admin.
- **`AiDepartment` / `AiEmployee`** — AI workforce org shape.

## 10. Agents, AI workforce, tools

- **`Agent` / `HermesAgent`** — agent instance; `HermesAgent` is the
  scoped sidecar-aware agent.
- **`AgentTemplate`** — template library.
- **`AgentPool` / `AgentPoolMember`** — Pool #1 admin shape.
- **`AiModel` / `ModelProvider` / `ModelRegistration` /
  `ModelCatalogAudit`** — model registry (`models/`).
- **`MemoryEntry` / `PlanningMemory` / `HermesMemoryEntry`** — memory
  stores.
- **`Tool` / `ToolIntegration`** — runtime tool catalogue.
- **`AIActionInvocation` / `AIActionInvocation`** — invocations log.
- **`AIPolicy` / `AIBiasFinding` / `AIHallucinationFlag`** — governance.

## 11. Hermes runtime

- **`HermesSession`** — scoped-agent session.
- **`HermesMessage`** — chat messages for Hermes.
- **`HermesAuditLog`** — production audit trail (Postgres). The
  dev-only SQLite `hermes_events.db` is a parallel store.
- **`HermesCapability`** / **`HermesToolPermission`** — tool permission
  per Hermes session.
- **`HermesMessage`** + **`CommunicationThread`** + **`ThreadParticipant`**
  + **`ThreadReadState`** — conversation threading.

## 12. CRM, finance, integrations

- **`Customer`** — `tenantId`, `name`, `financialSubType` (enum),
  `lifecycleStage` (enum), `createdById`.
- **`CustomerContact`** — 1:N contacts.
- **`CrmConnector`** — connector config.
- **`Invoice` / `Expense` / `Budget` / `BillingEvent`** — finance.
- **`IntegrationCredential` / `OAuthToken`** — Google Workspace,
  Brevo (see `integrations/`).
- **`BrevoSuppression` / `BrevoUsageCounter` / `BrevoWebhookEvent`** —
  Brevo-specific.

## 13. Accounting capability (new — `20260730_acct_capability_init`)

- **`ChartOfAccount`** / **`ChartOfAccountVersion`** — versioned COA.
- **`JournalEntry`** — header; carries `postingUserId`, `approvedById`.
  **SoD CHECK:** `posting_user_id <> approved_by_user_id`.
- **`JournalLine`** — debit/credit lines.
- **`AccountingPeriod`** — `OPEN | CLOSED | ARCHIVED`.
- **`AccountingRecord` / `AccountingDataset` / `AccountingReport`** —
  dataset + report rows.
- **`UserAccountingRole`** — per-user SoD role tracking.
- **`BeancountSnapshot`** — snapshot metadata + path.

Source: `backend/src/modules/accounting/`. See `accounting-sidecar.md` for
end-to-end.

## 14. Onboarding, industries, tiers, packages, features

- **`OnboardingChecklistEntry`** / **`OnboardingInvitation`** — wizard
  state per tenant.
- **`Industry` / `IndustrySolution`** — leaf industry + bundled solutions.
- **`Tier` / `TierTemplate` / `TierAgentPool` / **`TierAuditLog`** —
  tier catalogue.
- **`Package` / **`PackInstallation`** / **`DomainPackage`** /
  **`ProjectTypePack`** — composite packages.
- **`Feature` / `FeatureLifecycle` / `FeatureFlagAuditLog`** — feature
  catalogue + lifecycle.
- **`KnowledgePack`** — knowledge bundles.
- **`AnalyticsFeature` / `AnalyticsModel`** — analytics layer.

Source: `onboarding/`, `industry/`, `tiers/`, `packages/`,
`departments-pool/`, `agents-pool/`, `features/`.

## 15. Marketplace & solution packs

- **`SolutionPack`** — top-level pack.
- **`PackInstallation`** — per-tenant install record.
- **`TenantInstalledPack`** — denormalised for quick listing.
- **`MarketplaceListing`** — public marketplace catalog row.
- **`Plugin`** — third-party plugin metadata (Phase 8 stub).
- **`ExtensionPermission`** — extension permission row.

Source: `solution-packs/`, `marketplace/`. See `solutions-and-marketplace.md`.

## 16. Routines / workflows / goals / inbox / costs

- **`Routine` / `RoutineRun` / `RoutineTrigger`** — Paperclip-style
  routines.
- **`Workflow` / `WorkflowTemplate` / `WorkflowExecution`** — workflows.
- **`Goal`** — OKR / goal tree.
- **`CommunicationThread`** — inbox thread shape.
- **`CostRecord` / `BudgetPolicy` / `BudgetIncident` / `QuotaUsage`** —
  cost ledger + budgets.
- **`PlanningMemory`** — separate from per-project memory.

## 17. Compliance & reliability

- **`ComplianceChecklist` / `ComplianceItem`** — checklist engine.
- **`AuditLog` / `AuditFinding`** — audit trail + findings.
- **`ReliabilityEvent` / `Incident`** — reliability tracking.
- **`TrustEvaluation`** — trust scoring (Phase 1g+).
- **`RetentionPolicy`** — per-entity retention rules.

## 18. Portal & client-facing

- **`PortalAccess` / **`PortalInvitation`** — external client portal.
- **`Workspace` / `WorkspaceLayout`** — workspace per tenant.
- **`Application`** — application-level config (Cloud Platform).

## 19. Knowledge & entity plane

- **`KnowledgeEntry` / `KnowledgeNode` / `KnowledgeEdge`** — knowledge
  graph.
- **`OntologyVersion`** — ontology versioning.
- **`EntityLabel` / `EntityOwnership` / `EntityRelationship`** — entity
  graph edges.
- **`InformationSource` / `InformationResponse`** — information engine.
- **`CloudCluster` / `CloudRegion`** — cloud deployment primitives.

## 20. Activity, threads, missions, notifications

- **`ActivityEvent`** — activity feed row.
- **`CommunicationThread` / `ThreadParticipant` / `ThreadReadState`** —
  thread per user/tenant.
- **`Mission` / `MissionFeedItem` / `MissionObservation`** — mission
  feed.
- **`Notification` / `NotificationPreference`** — notification store.

## 21. Observability, metrics, feature flags

- **`ApiKey`** — API key registration.
- **`CapabilityConfig` / `CapabilityVersion`** — capability gating.
- **`LoginAttempt`** — login attempt log.
- **`AdapterCursor`** — connector adapter cursor.
- **`FeatureFlagAuditLog`** — flag change log.
- **`OutboxMerkleRoot`** — daily Merkle root.
- **`LifecycleWaiver`** — lifecycle-stage waivers.

## 22. Chat (FE mirrors)

- **`ChatSession`** / **`ChatMessage`** — chat persistence (matches FE
  `chat-history.service.ts`).

## 23. Approvals

- **`Approval` / `ApprovalWorkflow` / **`ApprovalWorkflowStep`** /
  **`ApprovalRequest`** — approval pipelines.
- **`LifecycleWaiver`** — waivers on stage lifecycle.

## 24. New EAOS layers (Cloud / Platform / SDK)

These are mostly **Phase 7+** placeholders that wrap platform primitives:
- **`Plugin`**, **`KnowledgePack`**, **`ExtensionPermission`** (already
  appear above but are also EAOS layer inputs).
- **`TenantPlacement`**, **`CloudCluster`**, **`CloudRegion`** — cloud
  federation.
- **`CapabilityConfig`**, **`CapabilityVersion`** — capability registry.

## 25. Cross-cutting notes

- **Tenant scoping:** most domain models carry `tenantId`. Repository
  helpers in `common/persistence/` enforce this at the Prisma level.
- **Audit trail:** `AuditLog` is global; timeline events are
  user-visible.
- **Idempotency:** `IdempotencyRecord` is the lightweight dedup table;
  `EnterpriseEventIdempotency` is the effect-side business dedup.
- **Outbox:** every write that publishes an enterprise event must use the
  Command pattern (`common/commands/`) so the outbox row is in the same
  tx.

---

## 26. How to find a model for a feature

1. Grep for the obvious word: `grep -E "^model *Word" backend/prisma/schema.prisma`.
2. Look at the cluster map (§1).
3. Look at the controller for the feature and follow the `Prisma.user.*`
   calls into `backend/src/modules/<feature>/`.
4. Use `backend/prisma/migrations/` to learn what changed recently
   (most recent first).

---

## 27. Source pointers

- `backend/prisma/schema.prisma` (canonical, 174 models).
- `backend/prisma/migrations/` (newest first).
- `backend/src/modules/*/` (Nest module per cluster).
- `backend/src/common/persistence/` (port adapters).
- `memory-bank/databases.md §1.4` (table of cluster → live models).