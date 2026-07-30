# G1 Per-Reviewer Checklist

**Date:** 2026-07-26

## How to Use

Each reviewer completes the checklist for their role. Mark each item as:
- ✅ **Verified** — checked personally
- ⚠️ **Concern** — has questions or notes
- ❌ **Blocker** — must be resolved before approval

After completing, add your signature to `G1-APPROVAL.md`.

---

## 🏛️ Architecture Owner

**Focus:** Schema, layering, ADRs, dependency rules

### Schema Changes
- [ ] Migration file `prisma/migrations/20260726_autonomous_work_layer/migration.sql` reviewed
- [ ] Migration is **reversible** (can be rolled back without data loss)
- [ ] New models are properly related (foreign keys, cascade behavior)
- [ ] Enum names don't conflict with existing schema (Awl* prefix used)
- [ ] Indexes are correctly defined for query patterns

### Layer Dependency Rules
- [ ] `ARCHITECTURE_RULES` in `src/common/enterprise/architecture-rules.ts` is correct
- [ ] Domain layer has no dependencies on application/adapters
- [ ] Tools depend on application/domain but not infrastructure
- [ ] No circular module dependencies

### ADRs
- [ ] ADR-001 (Command Boundary) — captures the decision correctly
- [ ] ADR-002 (Transactional Outbox) — describes why PostgreSQL outbox was chosen
- [ ] ADR-003 (State Machines) — describes the state machine approach

### Architecture Tests
- [ ] `src/test/architecture/tool-bypass.spec.ts` — tests NEW code, not legacy
- [ ] Test verifies 0 built-in tool adapter-backed business mutations remain after G1 remediation
- [ ] Test validates domain layer purity

### SOLID Compliance
- [ ] **S**: Each service has one reason to change
- [ ] **O**: Extension via composition, not modification
- [ ] **L**: Interfaces are substitutable
- [ ] **I**: Interfaces are thin and focused
- [ ] **D**: High-level modules depend on abstractions

### Open Questions for Architecture Owner

| # | Question | Answer |
|---|----------|--------|
| 1 | Should `Awl*` enum prefix be permanent? | |
| 2 | Should the migration be split into multiple files? | |
| 3 | Is the Strangler pattern the right approach for legacy bypasses? | |

---

## 🛠️ Backend Lead

**Focus:** Commands, idempotency, state machines, business logic

### Command Catalog
- [ ] `CommandRegistry` correctly registers commands
- [ ] `CommandDefinition` interface is clear and complete
- [ ] `ApproveEnterpriseInitiationCommand` (v1.0) — registered
- [ ] `CreateProjectFromInitiationCommand` (v1.0) — registered
- [ ] Both commands have `buildIdempotencyKey` and `buildRequestHash`

### Idempotency
- [ ] `IDEMPOTENCY_MATRIX` covers all 7 golden-path operations
- [ ] `CommandIdempotencyService` correctly uses `IdempotencyRecord`
- [ ] `checkAndReserve` / `complete` / `fail` API is correct
- [ ] 24-hour TTL is appropriate
- [ ] Hash mismatch is rejected

### State Machines
- [ ] `InitiationStateMachine` — 10 states, transitions are correct
- [ ] `AutomationStateMachine` — 7 states
- [ ] `TaskStateMachine` — 16 states (matches Prisma TaskStatus)
- [ ] `AttemptStateMachine` — 12 states
- [ ] `ReviewStateMachine` — 5 states
- [ ] Each state machine has `assertTransition()` method

### Handlers
- [ ] `ApproveInitiationHandler` — atomic transaction, audit log, outbox event
- [ ] `CreateProjectFromInitiationHandler` — atomic project + outbox creation
- [ ] `ProjectAutomationHandler` — uses `ProjectAutomationLog`, idempotent per-item upsert
- [ ] `ExecutionOrchestrator` — checks `requiresHumanApproval`, creates `NEEDS_INPUT`
- [ ] `ReviewService` — atomic review + task transition, audit log
- [ ] `AssignmentService` — capacity check, optimistic via `TaskAssignment` unique

### Outbox Worker
- [ ] 1s polling interval (configurable)
- [ ] 30s lease timeout
- [ ] 1s, 4s, 16s exponential backoff
- [ ] Dead letter after 3 retries
- [ ] Circuit breaker: 5 failures → OPEN

### Open Questions for Backend Lead

| # | Question | Answer |
|---|----------|--------|
| 1 | Are there other commands needed before Phase 2? | |
| 2 | Is the lease timeout (30s) appropriate? | |
| 3 | Should the circuit breaker be per-event-type or global? | |

---

## 🔒 Security

**Focus:** Tenant isolation, cross-tenant access, audit, secrets

### Tenant Isolation
- [ ] `tenantId` is required in all commands
- [ ] `tenantId !== metadata.tenantId` throws `CROSS_TENANT_ACCESS_DENIED`
- [ ] No global mutable tenant state
- [ ] `AsyncLocalStorage` used only for logging, not authorization
- [ ] Repository methods all include `tenantId` in WHERE clauses

### Cross-Tenant Tests
- [ ] `src/test/certification/tenant-isolation.spec.ts` passes
- [ ] `src/test/certification/certification.spec.ts` cross-tenant tests pass (5)
- [ ] All repositories tested for cross-tenant rejection

### Audit Trail
- [ ] `AuditLog` includes `correlationId` and `causationId`
- [ ] Every command creates an audit log entry
- [ ] Audit log fields match existing schema (`actor`, `action`, `resource`, `resourceId`)

### Feature Flags
- [ ] `TenantFlagsService` is per-tenant
- [ ] `TenantFeatureFlagOverride` has unique constraint on `(tenantId, flagKey)`
- [ ] `FeatureFlagAuditLog` records all changes
- [ ] Emergency kill switch is documented (`killSwitch` flag)

### Open Questions for Security

| # | Question | Answer |
|---|----------|--------|
| 1 | Are there any PII concerns in audit logs? | |
| 2 | Should correlationId be indexed? | |
| 3 | Are there any authorization gaps in feature flag checks? | |

---

## 🧪 QA Lead

**Focus:** Test infrastructure, certification harness, determinism

### Test Harness
- [ ] `TestHarnessModule` can provision reconstruction tenant
- [ ] `reset()` function safely cleans up
- [ ] Synthetic data is deterministic
- [ ] No external dependencies in tests

### Test Coverage
- [ ] 8 test suites, 27 tests pass
- [ ] Architecture tests: 5 tests
- [ ] Circuit breaker tests: 6 tests
- [ ] Golden path E2E: 5 tests
- [ ] Idempotency tests: 2 tests
- [ ] Failure recovery tests: 2 tests
- [ ] Tenant isolation tests: 1 test
- [ ] Certification tests: 4 tests
- [ ] Golden path smoke: 2 tests

### Certification Runner
- [ ] `CertificationRunner` supports 8 scenario types
- [ ] `runCertification` returns `CertificationRun` with results
- [ ] Failure injection points are present

### Determinism
- [ ] All tests produce same output on repeated runs
- [ ] No flaky tests
- [ ] Mocks are reset between tests

### Open Questions for QA Lead

| # | Question | Answer |
|---|----------|--------|
| 1 | Are integration tests with real DB needed for G1? | |
| 2 | Should we add a stress test (1000+ runs)? | |
| 3 | What's the plan for testing Phase 2 with real Hermes? | |

---

## 📦 Product Owner

**Focus:** Feature freeze compliance, feature flag strategy, user experience

### Frozen Scope Compliance
- [ ] No new industries added
- [ ] No new AI employee templates
- [ ] No new dashboards or workspaces
- [ ] No new autonomy modes
- [ ] No new orchestration frameworks
- [ ] All changes are within Phase 1-10 scope

### Feature Flag Strategy
- [ ] All 7 flags defined with clear semantics
- [ ] Default values are `false` (conservative)
- [ ] Kill switch is documented
- [ ] Per-tenant override is supported
- [ ] Audit trail exists

### User Experience
- [ ] No new UX surfaces added in Phase 1
- [ ] Changes are transparent to end users
- [ ] Health endpoint is public (`/awl-health`)

### Open Questions for Product Owner

| # | Question | Answer |
|---|----------|--------|
| 1 | When should `CANONICAL_INITIATION` flag be flipped for early-access tenants? | |
| 2 | What is the rollout strategy for Phase 2? | |
| 3 | Should we add a feature for tenant self-service flag toggling? | |

---

## Sign-Off Instructions

After completing your checklist:

1. Add your name, role, and date to `G1-APPROVAL.md`
2. Mark your decision: ✅ Approved | ⚠️ Conditional | ❌ Blocked
3. List any conditions (if conditional)
4. Cite specific G1 criteria (if blocked)

---

**G1 Checklist Complete — Proceed to Approval**
