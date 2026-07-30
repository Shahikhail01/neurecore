# Phase 0 — Test Infrastructure Design

**Date:** 2026-07-26
**Document:** NC-AWL-IMP-1 Phase 0
**Phase:** Certification Workstream Design

---

## 1. Overview

Phase 0 designs (not implements) the parallel certification workstream that will grow with each phase and execute fully at Phase 9.

**Certification Goal:** Demonstrate that the autonomous work layer operates correctly under both success and failure conditions, with full observability and evidence capture.

---

## 2. Design Principles

### 2.1 Deterministic Reconstruction Tenant

A dedicated tenant for certification testing with:
- Stable identifier (`RECONSTRUCTION_TEST_TENANT_ID`)
- Isolated data (no overlap with production or other test tenants)
- Reset capability between test runs
- Safe cleanup without affecting unrelated tenant data

```typescript
export interface TestTenant {
  id: string;           // Stable, env-configurable
  name: string;        // 'Reconstruction Test Tenant'
  industry: string;     // 'accounting' (golden path industry)
  tier: string;         // 'professional'
  reset(): Promise<void>; // Clean slate for each test run
}
```

### 2.2 Synthetic Data Fixtures

**Golden Scenario Data:**
```typescript
export interface GoldenScenarioData {
  customer: {
    name: string;      // 'Acme Accounting LLC'
    industry: string;  // 'accounting'
  };
  project: {
    name: string;      // 'Monthly Close Q3 2026'
    goal: string;      // 'Complete monthly accounting close'
    task: string;      // 'Reconcile bank statements'
  };
  aiEmployee: {
    role: string;      // 'Staff Accountant'
    capabilities: string[]; // ['data_entry', 'reconciliation', 'reporting']
  };
}
```

### 2.3 Failure Injection

**Identified Failure Seams:**

| Failure Type | Injection Method | Expected Behavior |
|-------------|-------------------|-------------------|
| Duplicate submission | Replay command with same idempotency key | Return cached result |
| Worker termination | Kill worker process mid-execution | Lease recovery, retry |
| Provider failure | Mock AI gateway timeout | Retry with backoff |
| Session expiry | Expire session token mid-execution | Graceful degradation |
| Realtime loss | Disable WebSocket/socket.io | Fallback to polling |

---

## 3. Correlation ID Infrastructure

### 3.1 Required Correlation Points

```
Frontend Request
    ↓
HTTP Headers (X-Correlation-ID, X-Causation-ID)
    ↓
Application Command
    ↓
Domain Service
    ↓
Outbox Event
    ↓
Worker Processing
    ↓
Graph Execution
    ↓
Tool Calls
    ↓
Evidence Artifact
```

### 3.2 Correlation Contract

```typescript
export interface CommandMetadata {
  tenantId: string;
  actorId: string;
  actorType: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  occurredAt: string;
  schemaVersion: number;
}
```

### 3.3 Correlation ID Propagation

**AsyncLocalStorage for HTTP context:**
```typescript
// Ambient context for HTTP requests
const correlationContext = new AsyncLocalStorage<CommandMetadata>();
```

**Explicit propagation for:**
- Queue jobs (event payload)
- Graph runs (state context)
- Tool calls (tool context)

**No static/global mutable tenant state.**

---

## 4. Test Categories

### 4.1 Unit Tests

**Scope:** Individual services, state machines, commands

**Harness Requirements:**
- Mock Prisma client
- Mock event transport
- Deterministic timestamps (controlled `Date.now()`)
- Isolated module imports

### 4.2 Integration Tests

**Scope:** Database transactions, outbox behavior, event flow

**Harness Requirements:**
- Real Prisma client with test database
- Transaction rollback after each test
- Clean schema between test suites
- Event capture and assertion

### 4.3 Architecture Tests

**Scope:** Dependency rules, import boundaries

**Harness Requirements:**
- AST-based import analysis
- No runtime execution required
- CI-friendly (fast)

**Current Architecture Tests:**
- `enterprise-events/architecture.spec.ts` - Hermes doesn't import concrete transport
- `work-runtime/architecture.spec.ts` - Planner cannot execute tools

### 4.4 End-to-End Certification Tests

**Scope:** Full golden path execution

**Harness Requirements:**
- Reconstruction tenant provisioning
- Real HTTP requests
- Real event processing
- Real AI gateway (mocked)
- Full evidence capture

---

## 5. Evidence Capture

### 5.1 Evidence Types

| Evidence Type | Purpose | Storage |
|--------------|---------|---------|
| Command trace | Show command execution path | Logs |
| Event sequence | Show event emission and processing | Event store |
| Tool call ledger | Show tool invocations with inputs/outputs | Evidence DB |
| State transitions | Show aggregate state changes | Audit DB |
| Error traces | Show failure classification and handling | Error tracking |

### 5.2 Evidence Index

```typescript
export interface CertificationEvidence {
  runId: string;                    // Unique per test run
  timestamp: string;
  tenantId: string;
  scenario: string;
  passed: boolean;
  artifacts: {
    correlationId: string;
    eventCount: number;
    toolCallCount: number;
    stateTransitions: StateTransition[];
    errors: ErrorRecord[];
  };
  machineReadablePath: string;      // Path to JSON evidence
}
```

### 5.3 Failure Classification Evidence

```typescript
export enum FailureClassification {
  TRANSIENT_INFRASTRUCTURE = 'TRANSIENT_INFRASTRUCTURE',
  INVALID_INPUT = 'INVALID_INPUT',
  POLICY_DENIAL = 'POLICY_DENIAL',
  TOOL_FUNCTIONAL_FAILURE = 'TOOL_FUNCTIONAL_FAILURE',
  MODEL_QUALITY_FAILURE = 'MODEL_QUALITY_FAILURE',
  CANCELLATION = 'CANCELLATION',
  BUDGET_EXHAUSTION = 'BUDGET_EXHAUSTION',
}
```

---

## 6. Test Tenant Provisioning

### 6.1 Tenant Lifecycle

```
provision() → seed() → test() → reset() → destroy()
```

### 6.2 Provisioning Steps

```typescript
async function provisionReconstructionTenant(): Promise<TestTenant> {
  const tenant = await prisma.tenant.create({
    data: {
      id: RECONSTRUCTION_TEST_TENANT_ID,
      name: 'Reconstruction Test Tenant',
      industry: 'accounting',
      tier: 'professional',
      // ... required fields
    }
  });

  await seedGoldenScenario(tenant.id);
  return tenant;
}
```

### 6.3 Reset Strategy

**Between test runs:**
```typescript
async function resetTestTenant(tenantId: string): Promise<void> {
  // Delete in dependency order
  await prisma.task.deleteMany({ where: { project: { tenantId } } });
  await prisma.goal.deleteMany({ where: { project: { tenantId } } });
  await prisma.project.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  // Note: Agent and Department may be shared, so we don't delete them

  await seedGoldenScenario(tenantId);
}
```

---

## 7. Certification Test Scenarios

### 7.1 Golden Path Scenario

**Test:** `certification/golden-path.spec.ts`

**Steps:**
1. Create customer via initiation flow
2. Approve initiation
3. Verify project created
4. Verify automation started
5. Verify goals/tasks created
6. Verify assignment made
7. Verify task execution completed
8. Verify review submitted
9. Verify approval given

**Assertions:**
- Exactly one project created
- No duplicate goals/tasks
- Correct state transitions
- Complete event sequence
- Evidence artifacts created

### 7.2 Idempotency Scenario

**Test:** `certification/idempotency.spec.ts`

**Steps:**
1. Submit command with idempotency key K
2. Record result R1
3. Submit same command with same idempotency key K
4. Assert result R2 === R1
5. Assert no duplicate side effects

**Assertions:**
- Same result returned
- No duplicate events emitted
- Database state unchanged after second call

### 7.3 Failure Recovery Scenario

**Test:** `certification/failure-recovery.spec.ts`

**Steps:**
1. Start long-running automation
2. Kill worker process
3. Wait for stale detection
4. Verify lease recovery
5. Verify automation completes

**Assertions:**
- Event reprocessed after lease expiry
- No duplicate effects
- Automation eventually completes

### 7.4 Tenant Isolation Scenario

**Test:** `certification/tenant-isolation.spec.ts`

**Steps:**
1. Create resources in tenant A
2. Attempt to access from tenant B
3. Assert access denied

**Assertions:**
- Cross-tenant access rejected
- Tenant data not visible to other tenants

---

## 8. Implementation Backlog

### Phase 1 Tasks
- [ ] Create `src/test/test-harness.module.ts`
- [ ] Implement `TestTenant` provisioning
- [ ] Implement `GoldenScenarioData` fixtures
- [ ] Add correlation ID capture utilities

### Phase 2 Tasks
- [ ] Add `reset()` capability
- [ ] Implement evidence capture for initiation flow
- [ ] Add idempotency test helpers

### Phase 3 Tasks
- [ ] Add event sequence capture
- [ ] Implement failure injection helpers
- [ ] Add dead letter scenario tests

### Phase 4-5 Tasks
- [ ] Add assignment test helpers
- [ ] Add execution evidence capture
- [ ] Implement circuit breaker test helpers

### Phase 9 Tasks
- [ ] Full certification harness execution
- [ ] Machine-readable evidence index generation
- [ ] Certification report generation

---

## 9. File Structure

```
src/test/
  test-harness.module.ts        # Deterministic test tenant provisioning
  golden-scenario.fixture.ts     # Synthetic accounting data
  correlation.helpers.ts         # Correlation ID utilities
  evidence.helpers.ts           # Evidence capture helpers
  failure-injection.ts          # Failure injection utilities

src/test/certification/
  golden-path.spec.ts           # Full golden path certification
  idempotency.spec.ts           # Idempotency verification
  failure-recovery.spec.ts      # Failure recovery certification
  tenant-isolation.spec.ts      # Tenant isolation certification

src/test/architecture/
  dependency-rules.spec.ts      # Import boundary tests
  tool-bypass.spec.ts          # Tool bypass detection
```

---

## 10. Metrics and Observability

### 10.1 Certification Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Test coverage | % of golden path exercised | >95% |
| Failure detection | Failures caught in cert vs production | 100% |
| Evidence completeness | Required artifacts captured | 100% |
| Determinism | Same result on repeat runs | 100% |

### 10.2 Evidence Index Format

```json
{
  "runId": "cert-2026-07-26-001",
  "timestamp": "2026-07-26T10:00:00Z",
  "tenantId": "reconstruction-test",
  "scenario": "golden-path",
  "passed": true,
  "correlationId": "abc-123",
  "events": [...],
  "toolCalls": [...],
  "stateTransitions": [...],
  "evidenceArtifacts": [...]
}
```

---

**End of Test Infrastructure Design**
