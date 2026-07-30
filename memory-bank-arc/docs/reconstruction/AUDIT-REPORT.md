# Phase 1-10 Implementation Audit Report

**Date:** 2026-07-26
**Auditor:** Architecture
**Status:** CRITICAL ISSUES FOUND — Fixes Required Before G1

---

## Executive Summary

The Phase 1-10 implementation has **20+ critical issues** that must be fixed:

| Category | Count | Severity |
|----------|-------|----------|
| Schema mismatches (Prisma fields don't exist) | 12 | CRITICAL |
| Missing Prisma models | 6 | CRITICAL |
| Module wiring (not in app.module.ts) | 8 | HIGH |
| Command pattern broken | 3 | CRITICAL |
| Type safety violations | 5 | MEDIUM |
| Logic errors in handlers | 4 | HIGH |

The implementation **will not compile or run** without these fixes. This audit documents every issue and the fix.

---

## A. Schema Mismatches (Fields Referenced That Don't Exist)

### A.1 `OutboxService` — Wrong field names on `EnterpriseEventOutbox`

**Issue:** Uses `schemaVersion`, `availableAt`, `aggregateType`, `aggregateId` which don't exist.

**Actual schema fields:**
- `version` (not `schemaVersion`)
- `status`, `retryCount`, `lastError`
- `createdAt`, `dispatchedAt`
- No `availableAt`, no `aggregateType`, no `aggregateId`, no `lockedAt`, no `lockedBy`

**Fix:** Use the actual schema fields. The outbox status enum is `EnterpriseEventOutboxStatus` with values like `PENDING`, `DISPATCHED`.

### A.2 `IdempotencyService` — Wrong field names on `IdempotencyRecord`

**Issue:** Uses `idempotencyKey`, `scope`, `resultId`, `resultData`, `completedAt` as a different model.

**Actual schema fields:**
- `key` (not `idempotencyKey`)
- `requestPath`, `requestHash`, `status` (string: 'IN_FLIGHT' | 'COMPLETED' | 'FAILED')
- `startedAt`, `expiresAt`, `attemptCount`
- `responseStatus`, `responseBody`, `responseReference`
- `resultEntityType`, `resultEntityId`
- `lastErrorCode`, `lastErrorMessage`

**Fix:** Use the actual schema fields. Compound unique key is `@@unique([tenantId, key])`.

### A.3 `TimelineService` — Wrong field names on `TimelineEvent`

**Issue:** Uses `entityType`, `entityId`, `actorType`, `actorId`, `actorName`, `eventType`, `payload`.

**Actual schema fields:**
- `category` (TimelineCategory enum)
- `severity` (EventSeverity enum)
- `sourceType` (TimelineSourceType enum)
- `title`, `description`
- `relatedEntityType`, `relatedEntityId`
- `correlationId`, `causationId`, `parentEventId`
- `createdByUserId`, `createdByAgentId`, `createdByServiceIdentityId`

**Fix:** Use the actual schema fields. The TimelineEvent has a richer structure than I implemented.

### A.4 `TenantFlagsService` — Models don't exist

**Issue:** Uses `tenantFeatureFlagOverride` and `featureFlagAuditLog`.

**Actual:** These models do NOT exist in the schema.

**Fix:** Either add these models via migration, or use the existing `Tenant.settings` JSON column with version field, or store flags in Redis.

### A.5 `ProjectAutomationHandler` — Wrong field names on `Project`

**Issue:** Uses `automationStatus`, `automationCompletedAt`, `automationError`, `executionEngineVersion`, `initiationId` on Project.

**Actual:** Project has `status` (ProjectStatus enum) and no automation fields. There IS a `ProjectAutomationLog` model.

**Fix:** Use `ProjectAutomationLog` to track automation state; don't store automation status on Project.

### A.6 `ProjectAutomationHandler.materializeGoals` — Wrong fields

**Issue:** Uses `automationVersion` and `templateKey` on Goal, and compound unique key.

**Actual:** Goal has no such fields. The compound unique key doesn't exist.

**Fix:** Add these fields to Goal via migration, OR use existing fields differently.

### A.7 `ProjectAutomationHandler.materializeTasks` — Wrong fields

**Issue:** Uses `automationVersion`, `templateKey`, `requiredRole`, `requiredCapabilities` on Task.

**Actual:** Task has `capabilityTags` (string[]) but no `requiredRole` or `requiredCapabilities` or `templateKey` or `automationVersion`.

**Fix:** Add these fields via migration, OR use `capabilityTags` and derive role from `agent.type`.

### A.8 `AssignmentService` — Wrong fields on Agent

**Issue:** Uses `agent.role`, `agent.capabilities`, `agent.archived`, `agent.availability`, `agent.maxConcurrency`.

**Actual:** Agent has `type` (AgentType enum), `permissions` (Json), `config` (Json), `isActive` (bool), `isSelected` (bool). No `role`, `archived`, `availability`, `maxConcurrency` as direct fields.

**Fix:** Use `type` instead of `role`, use `permissions` Json for capabilities, use `isActive` instead of `archived`/`availability`, use `config.maxConcurrency` for max concurrency.

### A.9 `ExecutionOrchestrator.requestExecution` — Model doesn't exist

**Issue:** Uses `prisma.executionAttempt.create` and `prisma.executionAttempt.findFirst`.

**Actual:** `model ExecutionAttempt` does NOT exist.

**Fix:** Add `ExecutionAttempt` model via migration. Fields needed: `id`, `tenantId`, `taskId`, `agentId`, `executionRequestId`, `attemptNumber`, `status`, `policy`, `version`, `outputSummary`, `submittedAt`, `lastError`, `lastErrorClassification`, `createdAt`, `updatedAt`.

### A.10 `ExecutionOrchestrator.submitForReview` — Model doesn't exist

**Issue:** Uses `prisma.evidenceArtifact.create`, `prisma.review.create`.

**Actual:** Neither model exists.

**Fix:** Add `EvidenceArtifact` and `Review` models via migration.

### A.11 `ReviewService` — Model doesn't exist

**Issue:** Uses `prisma.review` extensively.

**Actual:** Model doesn't exist.

**Fix:** Add `Review` model via migration. Fields: `id`, `tenantId`, `taskId`, `attemptId`, `status`, `decision`, `reviewerId`, `comment`, `revisionInstructions`, `decidedAt`, `version`, `createdAt`, `updatedAt`.

### A.12 `AssignmentService.assignTask` — Model doesn't exist

**Issue:** Uses `prisma.taskAssignment.create`.

**Actual:** Model doesn't exist.

**Fix:** Add `TaskAssignment` model via migration.

---

## B. Missing Prisma Models

### B.1 `EnterpriseInitiation` — New model needed

**Required fields:**
- `id`, `tenantId`, `customerId?`
- `status` (InitiationStatus enum)
- `description`, `projectName`, `projectDescription`, `targetDate`
- `discoveredData` (Json)
- `approvedByActorId`, `approvedAt`, `approvalComment`
- `projectId?`, `version`
- `createdAt`, `updatedAt`

### B.2 `ExecutionAttempt` — New model needed

**Required fields:**
- `id`, `tenantId`, `taskId`, `agentId`
- `executionRequestId`, `attemptNumber`
- `status` (ExecutionAttemptStatus enum)
- `policy` (Json)
- `outputSummary?`, `submittedAt?`
- `lastError?`, `lastErrorClassification?`
- `version`, `createdAt`, `updatedAt`

### B.3 `Review` — New model needed

**Required fields:**
- `id`, `tenantId`, `taskId`, `attemptId`
- `status`, `decision`
- `reviewerId?`, `comment?`, `revisionInstructions?`
- `decidedAt?`
- `version`, `createdAt`, `updatedAt`

### B.4 `EvidenceArtifact` — New model needed

**Required fields:**
- `id`, `tenantId`, `taskId`, `executionAttemptId`
- `artifactType`, `storageRef`, `mimeType`, `checksum`
- `source`, `createdByActorId`
- `metadata` (Json)
- `createdAt`

### B.5 `TaskAssignment` — New model needed

**Required fields:**
- `id`, `tenantId`, `taskId`, `agentId`
- `generation`, `rationale`
- `status`, `version`
- `createdAt`, `updatedAt`

### B.6 `TenantFeatureFlagOverride` and `FeatureFlagAuditLog` — New models needed

**Required for tenant-scoped feature flags.**

---

## C. Module Wiring Issues

### C.1 New modules not imported in app.module.ts

**Issue:** `EnterpriseInitiationModule`, `ProjectAutomationModule`, `ExecutionModule`, `ReviewsModule`, `AssignmentsModule`, `TenantFlagsModule`, `TimelineModule`, `ObservabilityModule` are not in the root app module.

**Fix:** Add all to `app.module.ts` imports.

### C.2 Command and Correlation modules may not be Global

**Issue:** If not marked `@Global()`, the providers won't be injectable in all modules.

**Fix:** Both are already marked `@Global()` in the code I wrote, but verify imports work.

### C.3 OutboxModule and IdempotencyModule not imported

**Issue:** `OutboxModule` (which provides `OutboxService` and `OutboxWorker`) and `IdempotencyModule` (which provides `IdempotencyService`) need to be in the app module.

**Fix:** Import them in `app.module.ts`.

---

## D. Command Pattern Issues

### D.1 `EnterpriseInitiationModule.onApplicationBootstrap` registers broken commands

**Issue:** Registers commands with empty `initiationId: ''` and `projectName: ''` — these will always fail.

**Fix:** The CommandRegistry should store handlers, not command instances. Pass the input at execution time, not registration time.

### D.2 `CommandRegistry.register` vs `execute` — Type mismatch

**Issue:** `register` takes `ICommand<T,E>` (a command instance) but the module passes ad-hoc objects. The pattern is inconsistent.

**Fix:** Use a cleaner handler registration pattern: `registerHandler(commandType, version, handler)` where handler accepts `(input, metadata)`.

### D.3 `CommandRegistry.execute` uses `JSON.stringify(command)` for hash

**Issue:** This includes class names, methods, circular refs. Should hash the input only.

**Fix:** Hash the serialized input, not the command object.

---

## E. Type Safety Issues

### E.1 Handlers use `command['input']` bracket notation

**Issue:** `ApproveInitiationHandler` uses `command['input']` to access private fields. This defeats TypeScript type checking.

**Fix:** Use proper getters or pass input as a parameter to `execute()`.

### E.2 `OutboxEventRecord` interface doesn't match schema

**Issue:** Custom interface with wrong field names. Should extend or use Prisma types directly.

**Fix:** Use `Prisma.EnterpriseEventOutboxGetPayload` or just use the schema types.

### E.3 `ReviewService` uses `prisma.review` typed incorrectly

**Issue:** The prisma client type doesn't know about `Review` model (it doesn't exist yet).

**Fix:** Add the model via migration, then regenerate Prisma client.

### E.4 `ExecutionOrchestrator` types `attempt.projectId` which doesn't exist

**Issue:** `ExecutionAttempt` doesn't have a `projectId` field in my design.

**Fix:** Add `projectId` to the new model, or look up via task.

### E.5 Module `onApplicationBootstrap` is on the class, not via NestJS lifecycle

**Issue:** `onApplicationBootstrap` is a NestJS lifecycle hook but only fires if the module is the root, OR if the module implements `OnApplicationBootstrap` interface.

**Fix:** Implement `OnApplicationBootstrap` interface.

---

## F. Logic Errors

### F.1 `ApproveInitiationHandler` — Uses prisma for `enterpriseInitiation` which doesn't exist

**Fix:** Add the model via migration.

### F.2 `ProjectAutomationHandler` uses `tx.goal.upsert` with wrong compound key

**Issue:** Uses `tenantId_projectId_automationVersion_templateKey` but `Goal` model has no such compound unique.

**Fix:** Add the unique constraint via migration.

### F.3 `ExecutionOrchestrator.requestExecution` — Missing `requiresHumanApproval` validation

**Issue:** The plan requires checking policy requiresHumanApproval, but the orchestrator just creates the attempt.

**Fix:** Check `policy.requiresHumanApproval` and create as `NEEDS_INPUT` instead of `QUEUED` if needed.

### F.4 `ReviewService.submitReview` — Missing `correlationId` field

**Issue:** The plan requires emitting audit/projection events with correlation IDs, but the audit log creation may not include correlationId properly.

**Fix:** Ensure all audit events include the correlationId.

---

## G. Module Lifecycle Issues

### G.1 `EnterpriseInitiationModule.onApplicationBootstrap` is not a NestJS hook

**Issue:** The method is defined but the class doesn't implement `OnApplicationBootstrap`.

**Fix:** Add `implements OnApplicationBootstrap` and import the interface.

### G.2 `ProjectAutomationModule.onApplicationBootstrap` same issue

**Fix:** Same.

### G.3 `ExecutionModule.onApplicationBootstrap` same issue

**Fix:** Same.

---

## H. Architecture Test Issues

### H.1 Architecture tests won't work as written

**Issue:** Tests scan for `prisma.create/update/delete` but the new code uses Prisma transaction objects (`tx`), not `this.prisma`. Tests may miss these.

**Fix:** Update tests to scan for `prisma\.\w+\.create|update|delete` patterns and also `tx\.\w+\.create|update|delete` patterns.

### H.2 No negative test for Hermes importing Prisma

**Fix:** The existing test is correct but should also scan for `@prisma/client` imports.

---

## Fix Plan

### Step 1: Add Missing Prisma Models
Create a migration that adds:
- `EnterpriseInitiation`
- `ExecutionAttempt`
- `Review`
- `EvidenceArtifact`
- `TaskAssignment`
- `TenantFeatureFlagOverride`
- `FeatureFlagAuditLog`

And adds new fields to existing models:
- `Goal`: `automationVersion`, `templateKey`, unique `[tenantId, projectId, automationVersion, templateKey]`
- `Task`: `automationVersion`, `templateKey`, `requiredRole`, `requiredCapabilities`, unique `[tenantId, projectId, automationVersion, templateKey]`
- `Agent`: `role`, `capabilities`, `maxConcurrency`, `availability`, `archived`
- `Project`: `initiationId?`, `executionEngineVersion?`, relation to `EnterpriseInitiation`

### Step 2: Fix All Field References
Update every file to use correct field names matching the actual schema.

### Step 3: Fix Command Pattern
Refactor `CommandRegistry` to use handler-based registration, not instance registration.

### Step 4: Wire All Modules
Import all new modules in `app.module.ts`.

### Step 5: Fix Lifecycle Hooks
Implement `OnApplicationBootstrap` interface in modules that use it.

### Step 6: Run Architecture Tests
Fix all test failures.

---

**Audit complete. Proceeding with fixes.**
