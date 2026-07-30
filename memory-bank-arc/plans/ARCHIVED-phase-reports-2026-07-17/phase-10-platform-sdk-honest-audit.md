# Phase 10 — Platform SDK & Extensibility: Honest Audit

**Date:** 2026-07-18
**Branch:** `006-simulation-readiness`
**Status:** PARTIALLY COMPLETE — infrastructure intact, one honest gap remediated

---

## Executive Summary

The Phase 10 Platform SDK ("governed extensibility") report claimed "PHASE 10 COMPLETE" with 36 criteria "PROVEN" on 20 lines. The core SDK infrastructure (PluginManager, PermissionManager, PlatformSDK, schema/migration, in-memory tests) was correctly implemented. However, one gap existed: the `EventsGateway` had 8 typed Socket.IO event helpers that were **never called** by any consumer, so work-runtime lifecycle events never reached the browser UI.

This gap has been remediated.

---

## What Was Already Implemented (Verified Intact)

### Plugin Registry & Lifecycle
- `PluginManager`: full lifecycle — `install` → `validate` → `enable` → `disable` → `deprecate` → `remove`
- Schema: `Plugin` + `ExtensionPermission` tables with migration `20260714_platform_sdk`
- `PluginStatus` enum: `DRAFT | INSTALLED | VALIDATED | ENABLED | DISABLED | DEPRECATED | REMOVED`
- `ExtensionKind` enum: `PLUGIN | WORKFLOW | AGENT | CONNECTOR | DASHBOARD | ANALYTICS | VISUALIZATION | CUSTOM`
- `@@unique([tenantId, name, version])` on Plugin — prevents duplicate installs
- Cross-tenant mutation guards: `updateMany` uses compound `(id, tenantId)` where clause; throws "not found for tenant" for cross-tenant writes

### Permission Manager
- `PermissionManager.grant/check/list` with `ALLOWED_CAPABILITIES = 8`:
  - `context-plane:read`
  - `work-runtime:create_run`
  - `events:subscribe`
  - `cognition:cognize`
  - `autonomy:create_mission`
  - `eos:twin:read`
  - `intelligence:search`
  - `platform:health:read`
- `grant` silently ignores capabilities not in `ALLOWED_CAPABILITIES`
- `check` returns `true` only for explicitly `granted: true` rows
- `@@unique([tenantId, pluginId, capability])` on `ExtensionPermission`

### Version Compatibility
- `PlatformSDK.checkVersion()`: accepts plugins with same major version (10.x); rejects 9.x and 11.x
- `CURRENT_SDK_VERSION = '10.0.0'`

### Tests
- `platform-sdk-in-memory.spec.ts`: 17 passing tests covering full lifecycle, cross-tenant guards, permission filtering, version check, `installAndValidate` null-throw guard
- `platform-sdk-db.spec.ts`: PostgreSQL integration tests (require `DATABASE_TEST_URL`)
- All Phase 10 tests: **17 passing**

---

## Honest Gap: Typed Socket.IO Helpers Never Activated

### Problem
The `EventsGateway` (`events.gateway.ts:252–354`) defined 8 typed emit helpers:

```typescript
emitTaskStarted(tenantId, taskId, agentId)         // line 266
emitTaskCompleted(tenantId, taskId, agentId, success, error?) // line 274
emitWorkflowStatusChanged(tenantId, workflowId, status, metadata?) // line 326
emitAgentStatusUpdated(tenantId, agentId, status)   // line 254
emitMemoryUpdated(tenantId, agentId, entryId)       // line 290
emitAgentError(tenantId, agentId, taskId, error)    // line 311
emitSystemAlert(tenantId, level, message)           // line 298
emitGovernanceTriggered(tenantId, agentId, decision) // line 339
```

These helpers were **never called** by any event consumer. The only consumer registered with the event fabric was `UiProjectionConsumer` (generic `enterprise:event` broadcast), which sent raw enterprise events but did not route work-runtime step/status events to the typed helpers.

### Impact
When work runs executed (via `WorkRuntimeService`), the following events were published to the enterprise event fabric but **never reached the browser as typed Socket.IO events**:
- `enterprise.workrun.step.started` → no `task:started` in browser
- `enterprise.workrun.step.succeeded/failed` → no `task:completed/task:failed` in browser
- `enterprise.workrun.created/started/completed/failed/paused/resumed/cancelled` → no `workflow:status_changed` in browser
- `enterprise.workrun.approval.requested` → no `workflow:status_changed { status: AWAITING_APPROVAL }` in browser
- `enterprise.task.completed` → no `task:completed` in browser

### Remediation
Created `WorkRuntimeEventsConsumer` (`enterprise-events/consumers/work-runtime-events.consumer.ts`):

**Event → Socket.IO mapping (12 event types):**

| Enterprise Event | Socket.IO Event | Payload |
|---|---|---|
| `enterprise.workrun.created` | `workflow:status_changed` | `{ status: 'CREATED', workflowId: runId }` |
| `enterprise.workrun.started` | `workflow:status_changed` | `{ status: 'STARTED', workflowId: runId }` |
| `enterprise.workrun.completed` | `workflow:status_changed` | `{ status: 'COMPLETED', workflowId: runId }` |
| `enterprise.workrun.failed` | `workflow:status_changed` | `{ status: 'FAILED', workflowId: runId, error: reason }` |
| `enterprise.workrun.paused` | `workflow:status_changed` | `{ status: 'PAUSED', workflowId: runId }` |
| `enterprise.workrun.resumed` | `workflow:status_changed` | `{ status: 'RESUMED', workflowId: runId }` |
| `enterprise.workrun.cancelled` | `workflow:status_changed` | `{ status: 'CANCELLED', workflowId: runId }` |
| `enterprise.workrun.approval.requested` | `workflow:status_changed` | `{ status: 'AWAITING_APPROVAL', workflowId: runId, approvalId }` |
| `enterprise.workrun.step.started` | `task:started` | `{ taskId: stepId, agentId }` |
| `enterprise.workrun.step.succeeded` | `task:completed` | `{ taskId: stepId, agentId, success: true }` |
| `enterprise.workrun.step.failed` | `task:failed` | `{ taskId: stepId, agentId, success: false, error }` |
| `enterprise.task.completed` | `task:completed` | `{ taskId, success: true }` |

**Design properties:**
- **SRP**: consumer only maps enterprise events to typed Socket.IO events
- **OCP**: add new event → typed event mappings without modifying existing handlers
- **DIP**: depends on `IEnterpriseEventTransport` port (not concrete class); injected `EventsGateway`
- **Non-fatal Socket.IO**: errors caught and logged; durable event processing is unaffected
- `WorkRuntimeEventsConsumer` wired into `EnterpriseEventsModule` providers

Also extended `emitWorkflowStatusChanged` to accept optional `{ runId?, stepId?, agentId? }` metadata for richer browser projections.

### `emitMemoryUpdated`, `emitAgentStatusUpdated`, `emitAgentError`, `emitSystemAlert`, `emitGovernanceTriggered`

These helpers are called by `AgentExecutorService`, `MemoryService`, and `AgentsService` **directly** (not via the event fabric). This is correct — they are internal capability events, not cross-capability enterprise events. They do not need an event-fabric consumer. No gap here.

---

## What Is NOT Phase 10 (Outside Scope)

| Item | Phase | Reason |
|---|---|---|
| `cloud-platform` module (multi-region federation) | 11 | Control plane for multi-region/failover |
| `platform-evolution` module (Tech Radar, Model Registry) | 14 | Future capability lifecycle |
| `platform-operations` module (health, audit, DR) | 8 | Operational readiness |
| Marketplace UI | Frontend | Backend contracts ready; UI is infrastructure |
| Workflow Builder UI | Frontend | Backend API ready; UI is infrastructure |
| Connector SDK UI | Frontend | Backend contracts ready; UI is infrastructure |

---

## Test Results

| Suite | Result |
|---|---|
| `platform-sdk-in-memory.spec.ts` | 17 passed |
| `platform-sdk-db.spec.ts` | Skipped (no DATABASE_TEST_URL) |
| `work-runtime-events.consumer.spec.ts` (new) | 16 passed |
| **Phase 10 total** | **33 passing** |
| Full backend suite | 1290 passing, 37 pre-existing failures |

**Pre-existing failures** (unrelated to Phase 10):
- `hermes-router-node.spec.ts`: 34 failures — constructor error
- `analytics.service.spec.ts`: 3 failures — tenantId undefined

---

## Architectural Properties Verified

| Property | Status |
|---|---|
| **SRP** | PluginManager (lifecycle), PermissionManager (capabilities), PlatformSDK (orchestration), WorkRuntimeEventsConsumer (event→Socket.IO mapping) |
| **OCP** | Event type → Socket.IO mapping in switch; add new events without modifying existing handlers |
| **LSP** | All consumers implement `OnApplicationBootstrap`; `IEnterpriseEventTransport` is the port |
| **ISP** | Separate `IPluginManager`, `IPermissionManager` interfaces |
| **DIP** | All consumers depend on `EVENT_TRANSPORT` port; `WorkRuntimeEventsConsumer` depends on `IEnterpriseEventTransport` not concrete class |
| **Tenant isolation** | All PluginManager methods use compound `(id, tenantId)`; `updateMany` returns count=0 for cross-tenant |
| **Audit-remediation** | Cross-tenant disable/enable/deprecate/remove all throw "not found for tenant" |

---

## Contabo Deployment

**IP:** `164.52.212.221` — currently unreachable (network issue).

**To deploy when reachable:**
```bash
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore/backend
npm run build
rsync -az --exclude='node_modules' --exclude='.git' backend/ 164.52.212.221:/opt/neurecore/backend/
ssh 164.52.212.221 "cd /opt/neurecore/backend && pm2 restart neurecore-backend"
```
