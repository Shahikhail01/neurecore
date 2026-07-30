# Phase 0 Runtime Forensics — Hermes Tool Registration Assessment

**Date:** 2026-07-26
**Document:** NC-AWL-IMP-1 Phase 0

---

## 1. Tool Registration Architecture

### 1.1 Current Tool Registry Structure

**Hermes Tool Sets Definition:**
- Location: `src/modules/tools/built-in/hermes-tools.ts`
- Contains `HERMES_TOOL_SETS` - maps `HermesAgentType` → `HermesToolDescriptor[]`
- Types: HR, FINANCE, SALES, MARKETING, OPERATIONS, IT, LEGAL, CUSTOM

**Tool Descriptor Shape:**
```typescript
interface HermesToolDescriptor {
  name: string;
  description: string;
  permission: ToolPermissionLevel; // ALLOW | READ_ONLY | APPROVAL_REQUIRED | DENY
  conditions?: Record<string, unknown>;
}
```

### 1.2 Tool Validation Flow

**Current Flow:**
```
HermesNode.execute()
  → ToolGatewayService.validate(toolName, hermesType)
  → getHermesToolSet(hermesType) → finds descriptor
  → Returns ToolValidationResult { allowed, requiresApproval, reason }
```

**Validation Points:**
1. Tool must exist in `HERMES_TOOL_SETS[hermesType]`
2. Permission level must not be `DENY`
3. If `APPROVAL_REQUIRED`, marks for approval workflow

### 1.3 Tool Permission Levels

| Level | Behavior |
|-------|----------|
| ALLOW | Tool executes without approval |
| READ_ONLY | Tool can only read, not mutate |
| APPROVAL_REQUIRED | Tool suspends, waits for human approval |
| DENY | Tool rejected, not executed |

---

## 2. Hermes Tool Execution Flow

### 2.1 Hermes LangGraph Node

**Location:** `src/modules/hermes/langgraph/hermes-node.ts`

```typescript
async execute(state: HermesNodeState): Promise<{
  hermesResult: unknown;
  messages: Array<{ role: string; content: string; timestamp: number }>;
}>
```

**State:**
```typescript
interface HermesNodeState {
  goal: string;
  hermesAgentId: string;
  sessionId: string;
  context: {
    tenantId: string;
    workspaceId?: string;
    userId?: string;
    threadId: string;
    agentId?: string;
  };
}
```

### 2.2 Hermes Runtime Service

**Location:** `src/modules/hermes/services/hermes-runtime.service.ts`

**Key Methods:**
- `execute(execCtx: HermesExecutionContext)` - Main execution entry
- `buildSessionContext()` - Constructs context with allowed tools
- `emitSessionEvent()` - Emits session events

**Dependencies:**
- `HermesRegistryService` - Agent profile lookup
- `ToolGatewayService` - Tool validation
- `HermesSessionService` - Session management
- `HermesMemoryService` - Memory context
- `HermesContextService` - Context building
- `OfficialAgentGraph` - LangGraph execution

### 2.3 Tool Execution Path

**Tool Gateway → Structured Tool Registry:**
```typescript
// Tool validation happens at Hermes level
ToolGatewayService.validate(toolName, hermesType, context)

// Actual tool execution via StructuredToolRegistry
StructuredToolRegistry.execute(toolName, input, context)
```

---

## 3. Runtime Type Investigation

### 3.1 Hermes Agent Types

From `prisma/schema.prisma`:
```prisma
enum HermesAgentType {
  HR
  FINANCE
  SALES
  MARKETING
  OPERATIONS
  IT
  LEGAL
  CUSTOM
}
```

### 3.2 Current HERMES_TOOL_SETS Coverage

| Type | Tool Count | Status |
|------|------------|--------|
| HR | 6 | Implemented |
| FINANCE | 9 | Implemented |
| SALES | 7+ | Implemented |
| MARKETING | Partial | Needs Review |
| OPERATIONS | Partial | Needs Review |
| IT | Partial | Needs Review |
| LEGAL | Partial | Needs Review |
| CUSTOM | Fallback to CUSTOM | Implemented |

---

## 4. Tool Implementations

### 4.1 Structured Tool Registry

**Location:** `src/modules/tools/structured-tool.registry.ts`

### 4.2 Built-in Tools

| Tool | Location | Mutation | Status |
|------|----------|----------|--------|
| calculator-enhanced | built-in/calculator-enhanced.tool.ts | Read-only | OK |
| calendar | built-in/calendar.tool.ts | External | OK |
| chat | built-in/chat.tool.ts | Read-only | OK |
| context | built-in/context.tool.ts | Read-only | OK |
| csv.util | built-in/csv.util.ts | Read-only | OK |
| documents | built-in/documents.tool.ts | External | OK |
| email | built-in/email.tool.ts | External | OK |
| explain | built-in/explain.tool.ts | Read-only | OK |
| http-request-enhanced | built-in/http-request-enhanced.tool.ts | External | OK |
| http-request | built-in/http-request.tool.ts | External | OK |
| neurecore-tools | built-in/neurecore-tools.ts | **DIRECT_PRISMA** | **BLOCKER** |
| query | built-in/query.tool.ts | Read-only | OK |
| reports | built-in/reports.tool.ts | Read-only | OK |
| sheets | built-in/sheets.tool.ts | External | OK |

### 4.3 neurecore-tools.ts Critical Findings

**File:** `src/modules/tools/built-in/neurecore-tools.ts`

**CRITICAL:** This file contains 47 direct Prisma mutations bypassing the command pattern:

| Category | Count | Aggregates Affected |
|----------|-------|---------------------|
| Task mutations | 14 | Task, ApprovalRequest |
| Project mutations | 5 | Project, ProjectMember, ProjectStage |
| Agent mutations | 8 | Agent, Department |
| Customer mutations | 4 | Customer |
| Department mutations | 6 | Department |
| Goal mutations | 1 | Goal |
| Governance mutations | 1 | GovernanceRule |
| Tenant mutations | 1 | Tenant |
| Notification mutations | 1 | Notification |

---

## 5. Tool Registration Verification

### 5.1 Registration Flow

```typescript
// Tool registration at module bootstrap
StructuredToolRegistry.register(toolDescriptor, toolImplementation)

// Hermes tools are pre-registered via HERMES_TOOL_SETS
// Tool access controlled by ToolGatewayService.validate()
```

### 5.2 Runtime Type Selection

**Issue Identified:** The `hermesType` is derived from:
1. `agent.category` (preferred)
2. `agent.type` column (fallback)

**Problem:** `getDefaultModelForType(agent.name)` was passing human name (e.g., "Sarah the SDR") instead of HermesAgentType enum.

**Fix Applied:** F4 fix resolves model via `agent.category` or `agent.type` column, then queries gateway for model selection.

---

## 6. Missing Canonical Components

### 6.1 Enterprise Initiation Module

**Status:** NOT PRESENT
- No `EnterpriseInitiation` module in `src/modules/`
- No initiation command handlers
- No initiation state machine

### 6.2 Project Automation Module

**Status:** PRESENT but needs review
- Location: `src/modules/project-automation/`
- Contains: `ProjectAutomationService`, `RoleTemplateService`, `GoalTemplateService`, `TaskPlannerService`
- Uses direct Prisma in `RoleTemplateService.spawnAgentsFromTemplate()`
- No outbox integration for automation events

### 6.3 Work Runtime Module

**Status:** PRESENT but incomplete
- Location: `src/modules/work-runtime/`
- Contains: `WorkRuntimeService`, `ToolExecutor`, `WorkPlanner`, `RuntimeGovernanceEvaluator`
- Architecture test exists: `work-runtime/architecture.spec.ts`
- No canonical command integration

---

## 7. Queue Durability Assessment

### 7.1 Current Event Transport

**EnterpriseEventTransport:**
- Location: `src/modules/enterprise-events/transport/enterprise-event-transport.service.ts`
- Type: PostgreSQL-backed outbox with inbox pattern
- Lease: 30 seconds
- Max retries: 3
- Backoff: 1s, 4s, 16s (exponential)

### 7.2 Durability Features

| Feature | Status | Implementation |
|---------|--------|----------------|
| Transactional outbox | ✅ | `publish()` atomically creates outbox row |
| Idempotency | ✅ | `tenantId + idempotencyKey` uniqueness |
| Consumer inbox | ✅ | Fan-out to per-consumer inbox rows |
| Lease mechanism | ✅ | Row-level locking with `leaseExpiresAt` |
| Stale recovery | ✅ | `recoverStale()` marks expired PROCESSING as FAILED |
| Dead letter | ✅ | `EnterpriseEventDeadLetter` model after 3 failures |
| Multi-replica | ✅ | Atomic conditional update for lease claim |

### 7.3 Assessment Decision

**Recommendation:** PostgreSQL-backed outbox is **SUFFICIENT** for Phase 1-3 requirements.

**Rationale:**
- Current `EnterpriseEventTransport` already implements durable outbox pattern
- Throughput adequate for autonomous work layer (not high-volume)
- Reduces infrastructure complexity
- Simpler operational model

**PostgreSQL Workers Selected:**
- Event dispatch: 1s polling interval
- Event processing: 1s polling interval
- Recovery: 10s polling interval

---

## 8. Gap Analysis

### 8.1 Tool Bypass Blockers

| Gap | Severity | Remediation |
|-----|----------|-------------|
| 47 direct Prisma mutations in neurecore-tools.ts | CRITICAL | Phase 1: Command catalog + tool rewrite |
| No tenant validation in some tool mutations | HIGH | Phase 1: Add tenant guards |
| Idempotency not enforced in tool mutations | HIGH | Phase 1: Add idempotency keys |

### 8.2 Hermes Integration Gaps

| Gap | Severity | Remediation |
|-----|----------|-------------|
| Tool permissions not enforced at execution | HIGH | Phase 1: Add execution-time check |
| No correlation ID propagation to tools | MEDIUM | Phase 1: Add AsyncLocalStorage |
| No execution evidence from tool calls | MEDIUM | Phase 1: Add evidence tracking |

### 8.3 Missing Architectural Components

| Component | Status | Phase |
|-----------|--------|-------|
| EnterpriseInitiation module | ABSENT | Phase 2 |
| Command pattern enforcement | PARTIAL | Phase 1 |
| Outbox integration in automation | PARTIAL | Phase 3 |
| Assignment service | ABSENT | Phase 4 |
| Execution orchestrator | PARTIAL | Phase 5 |

---

## 9. Recommendations

### 9.1 Immediate Actions (Before Phase 1)

1. **Freeze neurecore-tools.ts mutations**
   - Add ESLint rule to prevent `prisma.create/update/delete` in tool files
   - Add architectural test to fail on bypass

2. **Verify Hermes runtime type resolution**
   - Ensure F4 fix is deployed and working
   - Add regression test for model selection

3. **Document tool permission enforcement**
   - Confirm `ToolGatewayService.validate()` is called before every tool execution
   - Add integration test for DENY and APPROVAL_REQUIRED

### 9.2 Phase 1 Prerequisites

1. Create command interface and catalog
2. Implement architectural rules (ESLint + tests)
3. Design tenant-scoped feature flags
4. Create test infrastructure

---

**End of Assessment**
