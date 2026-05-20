# Admin New Plan

## Objective

Implement a secure, tier-driven platform model where:

- Super Admin manages platform-owned tier definitions.
- Tiers own reusable agent and department definitions.
- Tenants receive isolated deployed instances from those definitions.
- Tenant Admins can edit only their own deployed instances.
- No tenant can access another tenant's agents, departments, templates, runtime state, logs, or assignments.
- Existing features are preserved during rollout.

This plan favors platform-managed definitions assigned to tiers and deployed into tenants because it is the cleanest balance of security, performance, operability, and long-term maintainability.

## Architectural Position

The preferred model is:

- Platform-owned definitions/templates are assigned to tiers.
- Tiers define what a tenant is allowed to deploy or receive by default.
- Tenants own only live runtime instances.
- Tenant instances may diverge from the original template after deployment without mutating the platform definition.

### Why this model is preferred

- More secure: tenant data remains isolated because only tenant-owned instances are mutable at runtime.
- Lower coupling: platform definitions do not carry tenant runtime state.
- More efficient: many tenants can share one definition while running separate instances.
- Easier lifecycle management: platform updates affect future deployments without silently mutating live tenant instances.
- Easier auditing: template lineage, deployment source, and tenant-specific overrides can be tracked separately.
- Better SOLID alignment: platform definition management, tier policy management, deployment, and tenant instance editing remain separate responsibilities.

## Core Principles

### Security

- All live agents and departments remain tenant-scoped.
- Every read and write path must enforce tenant ownership in the backend.
- Super Admin can operate across tenants only through explicit platform endpoints.
- Tenant Admin can edit only deployed instances belonging to the authenticated tenant.
- No cross-tenant joins should return foreign tenant data without explicit platform authorization.

### SOLID Enforcement

- Single Responsibility: separate modules for tier policy, platform definitions, deployment orchestration, and tenant instance management.
- Open/Closed: extend tier allocation using dedicated pool entities rather than overloading existing tables with mixed semantics.
- Liskov Substitution: controllers depend on service contracts, not special-case branches in UI or persistence.
- Interface Segregation: separate DTOs and service interfaces for platform definition CRUD, deployment, and tenant instance mutation.
- Dependency Inversion: orchestration services depend on repository/service interfaces rather than direct controller coupling.

### Data Integrity

- No destructive migration without pre-checks and rollback.
- Additive migrations first, cleanup later.
- Referential integrity enforced by Prisma relations and database constraints.
- Idempotent deployment operations where possible.
- Explicit unique constraints to prevent duplicated pool assignments and duplicate tenant deployments from the same source when not allowed.

### No Feature Loss

- Legacy flows remain available until equivalent new flows are validated.
- Old endpoints are marked deprecated, then internally delegated, then removed in a later phase.
- Existing tenant data remains valid throughout the migration.

## Target Domain Model

### Platform-Owned Entities

- `Tier`
- `AgentTemplate`
- `DepartmentTemplate`
- `TierAgentPool`
- `TierDepartmentPool` (new)

### Tenant-Owned Entities

- `Tenant`
- `Agent`
- `Department`

### New Required Relations

#### TierDepartmentPool

Add a new entity to mirror tier-to-agent allocation:

- `id`
- `tierId`
- `departmentTemplateId`
- `slot`
- `slotType` (`FIXED` or `CHOICE`)
- `isRequired`
- `isDefaultSelected`
- `defaultHeadcount` or optional department-level runtime defaults if needed
- `createdAt`

Constraints:

- unique `(tierId, departmentTemplateId)`
- index on `tierId`
- optional sort uniqueness if slot ordering must be enforced

#### Department lineage fields

Extend tenant `Department` with lineage metadata:

- `templateId?`
- `tierDepartmentPoolId?`
- `deployedFromTierId?`
- `isFixed`
- `isSelected`

#### Agent lineage fields

Keep and normalize current lineage behavior:

- `templateId?`
- `tierAgentPoolId?`
- `deployedFromTierId?`
- `departmentId?`
- `isFixed`
- `isSelected`

## Required Module Boundaries

### Platform Definition Modules

- `agent-templates`
- `department-templates`
- `tiers`

Responsibilities:

- manage reusable definitions
- manage tier composition
- manage limits and feature policy

### Deployment Module

Responsibilities:

- deploy definitions from tier pools into a tenant
- rehydrate fixed resources during tier change if needed
- prevent duplicate deployment conflicts
- maintain lineage metadata

### Tenant Instance Modules

- `agents`
- `departments`

Responsibilities:

- manage live tenant-owned instances
- allow tenant-level edits within policy constraints
- expose assignment APIs for live department and agent relationships

### Access Policy Module

Responsibilities:

- centralize role and tenant authorization rules
- prevent duplicated authorization logic across controllers

## Phased Implementation Plan

## Phase 0: Foundation and Freeze

### Goals

- establish architecture contracts before changing schema
- freeze legacy duplication points
- prevent parallel incompatible work

### Tasks

- inventory all current endpoints touching tiers, agents, departments, tenants, deployment, and settings tiers
- mark legacy `settings/tiers` endpoints as deprecated in code comments and documentation
- define service interfaces for:
  - tier composition management
  - tenant deployment orchestration
  - tenant instance mutation
  - access policy enforcement
- add architecture decision record documenting:
  - tiers own platform definitions
  - tenants own live instances
  - tenant admins edit only local instances

### Deliverables

- architecture decision note
- endpoint inventory
- deprecation map for legacy tier settings routes

### Exit Criteria

- no new code is added to legacy settings tier path
- all implementation work references the new domain model

## Phase 1: Schema Expansion

### Goals

- add missing structural support without breaking runtime

### Tasks

- [x] add `TierDepartmentPool` to Prisma schema
- [x] extend `Department` with deployment lineage fields
- [x] normalize `Agent` lineage fields if any are inconsistent
- [x] add indexes and uniqueness constraints
- [x] add nullable fields first to keep migration safe
- [x] write migration validation scripts to confirm:
  - [x] no orphaned foreign keys
  - [x] existing tenants remain valid
  - [x] existing departments and agents are unaffected

### Migration Rules

- additive only
- no column removals
- no rename-only migrations without backfill
- all defaults explicit

### Exit Criteria

- schema compiles
- migration runs on local snapshot
- backfill checks pass

## Phase 2: Backend Service Refactor

### Goals

- isolate responsibilities and remove cross-module duplication

### Tasks

- [x] create `TierCompositionService`
  - [x] manages `TierAgentPool`
  - [x] manages `TierDepartmentPool`
  - [x] validates ordering, uniqueness, slot policy
- [x] create `TenantDeploymentService`
  - [x] deploys tier-owned definitions into tenant instances
  - [x] records lineage
  - [x] handles idempotency and duplicate checks
- [x] create `TenantResourcePolicyService`
  - [x] decides what Tenant Admin can edit
  - [x] blocks edits to forbidden fields for fixed instances when applicable
- [x] create `AssignmentService` for live relations
  - [x] assign agent to department
  - [x] unassign agent from department
  - [x] assign/unassign selected live instances when policy allows

### Exit Criteria

- controllers no longer embed composition or deployment logic
- business rules are testable at service level

## Phase 3: Tier API Consolidation

### Goals

- retire split tier management behavior
- establish one source of truth for tier data

### Tasks

- [x] rewrite or delegate legacy `settings/tiers` endpoints to the Prisma-backed `tiers` module
- migrate admin UI tier data consumption to the real tier backend contract
- remove in-memory tier persistence behavior from `settings.service`
- normalize tier DTOs so admin UI submits the same shape the backend persists
- ensure tier CRUD, reorder, set-default, toggle, usage, and composition all resolve to one backend module

### Exit Criteria

- there is exactly one authoritative tier persistence path
- admin tier UI reads and writes real Prisma-backed tiers

## Phase 4: Department Tier Pool Backend

### Goals

- deliver missing capability for departments in tiers

### Tasks

- add endpoints for `TierDepartmentPool`
  - [x] list by tier
  - [x] create slot
  - [x] update slot
  - [x] delete slot
  - [x] reorder slots
- support slot types similar to agent pools:
  - `FIXED`
  - `CHOICE`
- add tenant-facing pool status endpoint if tenant admins can provision optional departments
- [x] add validation to prevent duplicate deployment of required fixed departments

### Exit Criteria

- departments are first-class tier resources
- tiers can fully define both department and agent composition

## Phase 5: Live Assignment APIs

### Goals

- support controlled mutation of deployed tenant instances

### Agent APIs

- extend create/update DTOs or add dedicated assignment endpoints for:
  - `departmentId`
  - `tierAgentPoolId`
  - `isSelected`
  - optional deployment lineage metadata for admin-only operations
- add explicit endpoints where cleaner than overloading generic patch:
  - [x] `POST /agents/:id/assign-department`
  - [x] `POST /agents/:id/unassign-department`
  - [x] `POST /agents/:id/assign-tier-slot`

### Department APIs

- extend live department APIs for:
  - [x] parent assignment
  - [x] optional `tierDepartmentPoolId`
  - [x] `isSelected`
- add endpoints for live assignment operations if needed
  - [x] `POST /departments/:id/assign-parent`
  - [x] `POST /departments/:id/unassign-parent`
  - [x] `POST /departments/:id/assign-tier-slot`

### Security Rules

- Super Admin can create, edit, deploy, reassign, and repair across tenants through platform routes
- Tenant Admin can edit only their tenant-owned instances
- Tenant Admin cannot mutate platform definitions
- fixed resources can be partially editable for operational fields only if policy allows

### Exit Criteria

- live resource assignment no longer depends on hidden manual DB changes
- all assignment operations are explicit and audited

## Phase 6: Deployment and Tier Change Workflows

### Goals

- make deployment deterministic and safe

### Tasks

- [x] support full tenant bootstrap from tier
  - [x] required departments first
  - [x] required agents next
  - [x] optional choices afterward
- [x] support tenant tier change workflow
  - pre-flight compatibility check
  - detect fixed resources to add/remove
  - preserve tenant-local overrides on surviving resources
  - block downgrade if incompatible and no safe transformation exists
- [x] add dry-run endpoints for tier change and deployment preview

### Audit Follow-up Tasks

- [x] add a dedicated deployment-preview backend contract instead of reusing tenant tier-change preview for tier editor dry runs
- [x] add a super-admin department bootstrap path that mirrors default agent pool provisioning
- [x] route the admin tenant deployment surface through tier bootstrap orchestration instead of direct template deploy flows

### Exit Criteria

- tier change is explicit, auditable, and reversible
- deployment reports exactly what will be created, reused, skipped, or blocked

## Phase 7: Frontend-Admin Rebuild

### Goals

- shift admin UI from template-only and read-only surfaces to real operational management

### Admin Workstreams

#### 7.1 Tier Editor

- [x] show core tier properties
- [x] show limits and features
- [x] show agent pool slots
- [x] show department pool slots
- [x] support reorder, add, edit, remove for both slot types
- [x] support dry-run preview of tenant deployment impact

#### 7.2 Live Agents Admin

- [x] create/edit/delete live agents for any tenant
- [x] assign tenant
- [x] assign department
- [x] assign tier slot lineage when deployed from tier
- [x] filter by tenant, tier, department, status, template lineage

#### 7.3 Live Departments Admin

- [x] create/edit/delete live departments for any tenant
- [x] assign tenant
- [x] assign parent department
- [x] assign tier slot lineage when deployed from tier
- [x] show department membership and head agents

#### 7.4 Tenants Page

- [x] replace deprecated `plan` and `agentLimit` rendering with real tier information
- [x] support change-tier entry from the tenants list
- [x] show deployment status summaries for departments and agents on the tenants list
- [x] show drift summaries from tier definition on the tenants list

### Audit Follow-up Tasks

- [ ] add inline tenant-list tier preview/apply controls instead of linking to the tenant detail flow
- [ ] add paging-safe aggregation or a dedicated summary endpoint for tenant deployment/drift counts

#### 7.5 Definition Libraries

- [x] keep platform template pages
- [x] integrate directly with tier composition actions
- [x] allow “add to tier” from template detail views

### Exit Criteria

- admin can fully manage tiers, definitions, deployments, and live tenant resources from one coherent surface

## Phase 8: Frontend-Tenant Alignment

### Goals

- align tenant UX with the secure permission model

### Tasks

- [x] replace arbitrary tenant `create agent` flow with policy-based provisioning when tier-owned provisioning is required
- [x] show only tenant-owned instances
- [x] allow Tenant Admin edits only on allowed fields
- [x] add tenant deployment/provisioning wizard for optional tier-owned resources if applicable
- [x] add clear badges for:
  - deployed from template
  - fixed resource
  - tenant customized

### Exit Criteria

- tenant UI cannot bypass tier policy or backend authorization
- tenant admins can safely operate on their own instances only

## Phase 9: Comprehensive Creation Wizards

### Goals

- provide complete guided setup for Super Admin and Tenant Admin workflows

### Progress

- [x] convert tenant live agent provisioning into a multi-step wizard
- [x] convert tenant live department provisioning into a multi-step wizard
- [x] build Tier Wizard for Super Admin workflows
- [x] build Agent Template Wizard for Super Admin workflows
- [x] build Department Template Wizard for Super Admin workflows
- [x] build cross-tenant Live Agent Wizard for admin workflows
- [x] build cross-tenant Live Department Wizard for admin workflows

### Required Wizards

#### Tier Wizard

Steps:

- identity and description
- commercial limits and pricing
- feature flags
- security and access policy
- agent pool composition
- department pool composition
- tenant deployment preview
- validation summary

#### Agent Template Wizard

Steps:

- identity and purpose
- role type and capability class
- model and runtime defaults
- system prompt and instructions
- permissions and tool access
- budget and rate limits
- observability and audit settings
- deployment compatibility by tier
- validation summary

#### Department Template Wizard

Steps:

- identity and purpose
- hierarchy placement
- default head agent type
- required/optional child resources
- policy metadata
- default staffing pattern
- deployment compatibility by tier
- validation summary

#### Live Agent Wizard

Steps:

- tenant target
- deployment source or manual creation
- department assignment
- runtime config
- budget and quotas
- approval and validation summary

#### Live Department Wizard

Steps:

- tenant target
- deployment source or manual creation
- parent and structure assignment
- head agent assignment
- operational defaults
- validation summary

### Wizard Design Rules

- each step owns one concern
- draft state persisted locally until submit
- backend validation endpoint available before final commit
- no hidden defaults without user visibility

## Phase 10: Authorization and Audit Hardening

### Goals

- guarantee secure multi-tenant isolation

### Progress

- [x] add audit logging coverage for tier composition changes, deployment flows, tier changes, live assignment operations, and live admin resource mutations
- [x] standardize active tier and live-resource controllers on the primary auth role guard to avoid role-enum drift across authorization paths
- [x] require explicit platform scope for cross-tenant live agent and department list queries while preserving tenant-scoped reads
- [x] add explicit platform-scoped single-resource reads for live agents and departments instead of relying on client-supplied tenant context
- [x] resolve tenant ownership for existing live agent and department mutations from the target record instead of trusting a client-provided tenantId
- [x] centralize the remaining legacy phase2 role-permission matrix so the old authorization service and common role guard share one permission source
- [x] enforce tenant-aware access on agent evaluation runs and derive evaluation tenant scope from the target agent or run record
- [x] secure agent streaming sessions by deriving user and tenant context from authenticated state, enforcing session ownership, and requiring explicit tenant targeting for platform-scoped execution
- [x] harden user management so tenant-scoped creators cannot target other tenants or assign platform roles, and non-admin self-service updates cannot escalate role or activation state
- [x] remove analytics natural-language report tenant bypass so tenant-scoped callers cannot inject foreign tenant context into generated reports
- [x] require explicit platform scope for cross-tenant task reads and update admin task dashboards and inspectors to opt into that scope instead of relying on implicit unfiltered queries
- [x] require explicit platform scope for cross-tenant invoice listing and wire admin billing reads and actions to carry either platform scope or tenant context explicitly
- [x] require explicit platform intent for aggregate analytics and admin proxy routes instead of treating a missing tenantId as implicit platform-wide access
- [x] replace remaining string-based role decorators and platform-role checks in active admin-facing controllers with the shared Prisma role enum to reduce role drift
- [x] centralize active platform and tenant role groups in a shared backend helper and align live admin controllers, guards, and user-management tenant resolution to that single source
- [x] require explicit platform scope for cross-tenant approval reads, update the admin approvals dashboard to opt into that scope, and derive tenant ownership for platform approval review/cancel from the stored approval record
- [x] require explicit tenant-admin roles on tenant pool status, provisioning, replacement, and release endpoints and add controller regression coverage

### Tasks

- [x] centralize role matrix for:
  - Super Admin
  - Platform Admin if retained
  - Tenant Admin
  - Tenant User
- [x] ensure every live resource query includes tenant constraint unless platform route explicitly bypasses it
- [x] add audit logs for:
  - tier composition changes
  - deployment events
  - tier changes
  - agent assignments
  - department assignments
  - tenant admin edits to deployed instances

### Exit Criteria

- no controller directly trusts client-provided tenantId without policy enforcement
- all cross-tenant operations are auditable

## Phase 11: Data Migration and Backfill

### Goals

- move safely from mixed legacy behavior to the new model

### Progress

- [x] verify legacy tenant tier mapping is already materialized in live data with no tenants missing or pointing at invalid tiers
- [x] verify legacy department lineage remains safely nullable and does not require destructive backfill for existing live departments
- [x] verify template-backed agent and department records with tier-pool ancestry already carry deployed-from tier lineage where expected
- [x] generate a live migration report at `PHASE_11_MIGRATION_REPORT.json`
- [x] create a dedicated `Starter Ops` tier model for legacy operational planning templates, reassign the 6 affected starter tenants to it, and relink 18 template-backed agents to explicit tier pool entries

### Tasks

- [x] map old tier settings data to real `Tier` records if any legacy data must be preserved
- [x] backfill department lineage fields as null for existing live departments
- [x] backfill agent lineage fields where pool/template ancestry already exists
- [x] create migration report listing:
  - tenants without valid tier
  - agents without valid tenant linkage
  - departments with inconsistent parent relations
  - resources that cannot be mapped automatically

### Exit Criteria

- migration report is clean or all exceptions are manually resolved

## Phase 12: Test and Verification Matrix

### Progress

- [x] add unit coverage for tenant tier-change preview and change execution
- [x] add security regression coverage for tenant-scoped user creation and role-management restrictions
- [x] add unit coverage for tier composition validation, deployment orchestration, and live assignment policy
- [x] add controller regression coverage for platform scope enforcement and platform-definition protection
- [x] add admin UI smoke coverage for agent template, department template, and tier wizard entry points plus tenant tier-change controls
- [x] add controller regression coverage for tenant pool tenant-admin role enforcement
- [x] add admin UI smoke coverage for live agent and live department wizard entry points
- [x] fix frontend-admin auth hydration race on settings routes discovered during Phase 12 verification
- [x] add end-to-end coverage for tier wizard completion, live agent and live department admin wizard submission flows, and tenant tier-change preview/apply flow
- [ ] complete the Phase 12 verification matrix with passing backend service/controller suites and full UI workflow coverage

### Audit Follow-up Tasks

- [x] add end-to-end coverage for tier wizard completion, not just modal open/smoke coverage
- [x] add end-to-end coverage for live agent and live department admin wizard submission flows
- [x] add end-to-end coverage for tenant tier-change preview plus apply flow

### Unit Tests

- tier composition validation
- deployment orchestration
- live assignment policy
- tenant authorization enforcement

### Integration Tests

- create tier with agent and department pools
- deploy tier to tenant
- tenant admin edits deployed resources
- tenant change-tier dry run and execution
- blocking of cross-tenant access attempts

### Regression Tests

- existing agent template management
- existing department template management
- existing tenant CRUD
- existing agent and department listing

### Security Tests

- tenant A cannot read tenant B resources
- tenant admin cannot edit platform definitions
- invalid assignment endpoints reject foreign tenant IDs

### UI Tests

- [x] tier wizard end-to-end
- [x] agent wizard end-to-end
- [x] department wizard end-to-end
- [x] tenant tier change flow

## Phase 13: Rollout Strategy

### Release Pattern

- release schema first
- release backend services behind feature flags
- release admin UI to staging
- run backfill and verification
- enable tenant provisioning flows
- retire legacy settings tier path last

### Feature Flags

- `tier_composition_v2`
- `department_pool_enabled`
- `tenant_instance_edit_policy_v2`
- `admin_live_resource_manager`
- `tenant_provision_from_tier`

### Rollback Strategy

- additive schema allows app rollback without immediate data loss
- legacy settings tier path remains read-only until new path is stable
- deployment jobs record compensating actions for manual recovery

## Implementation Order Summary

1. Freeze design and deprecate legacy tier path.
2. Add schema support for department-tier composition and lineage.
3. Refactor backend services around composition, deployment, assignment, and policy.
4. Consolidate tier APIs onto the Prisma-backed path.
5. Add live assignment APIs.
6. Implement deterministic deployment and tier-change workflows.
7. Rebuild admin pages around real resources and real tiers.
8. Align tenant UI with policy-based provisioning.
9. Add comprehensive creation wizards.
10. Complete migration, regression, and security validation.

## Non-Negotiable Acceptance Criteria

- One source of truth for tiers.
- Tiers own both allowed agent definitions and allowed department definitions.
- Tenants own only live deployed instances.
- Tenant Admins can edit only their own tenant instances.
- No cross-tenant visibility leaks in API or UI.
- All assignment and deployment operations are explicit and audited.
- No reliance on in-memory tier persistence for production flows.
- No removal of existing features before validated replacement exists.

## Recommended Initial Execution Slice

The smallest high-value first slice is:

- Phase 1 schema expansion
- Phase 3 tier API consolidation
- Phase 4 department tier pool backend

That sequence removes the current architectural blockers before building new UI.
