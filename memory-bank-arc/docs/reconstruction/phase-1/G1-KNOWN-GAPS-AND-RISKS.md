# G1 Known Gaps and Risk Register

**Date:** 2026-07-26
**Status:** REQUIRED READING FOR REVIEWERS

---

## Executive Summary

The Phase 1 implementation is **functionally complete**. The legacy built-in tool mutation bypasses identified during the audit have been remediated. There are now **2 external gates** remaining before Phase 2 begins: GitHub branch protection/first green CI run and formal reviewer signatures.

---

## Known Gaps (Not Blockers)

### GAP-001: Legacy Built-In Tool Prisma Bypasses

**Severity:** RESOLVED
**Location:** `src/modules/tools/built-in/neurecore-tools.ts`
**Description:** Phase 0 identified 47 legacy tool-layer direct business mutations.
**Impact:** Previously bypassed service/application boundaries.
**Mitigation:** Completed in G1 remediation. Mutations now route through domain/application services or fail closed when a service is unavailable.
**Owner:** Architecture Owner + Backend Lead
**Resolution:** COMPLETE — see `G1-LEGACY-TOOL-MUTATION-REMEDIATION.md`

**Verification:** `tool-bypass.spec.ts` passes; built-in tool mutation scan returns 0 matches.

### GAP-002: CI/CD Workflow Added, Branch Protection Pending

**Severity:** MEDIUM
**Location:** `.github/workflows/awl-architecture.yml`
**Description:** Root GitHub Actions workflow exists locally, but it has not been pushed/run and branch protection has not been applied because the local `gh` token is invalid.
**Impact:** New code can introduce bypasses and merge to main.
**Mitigation:** Re-authenticate `gh`, push branch, confirm first green workflow run, then apply branch protection with `scripts/apply-awl-branch-protection.sh`.
**Owner:** Platform/Operations
**Resolution:** Follow-up ticket **OPS-001**

### GAP-003: Live Database Migration Applied

**Severity:** RESOLVED
**Location:** `prisma/migrations/20260726_autonomous_work_layer/migration.sql`
**Description:** AWL schema objects exist on Contabo and Prisma migration metadata is aligned.
**Impact:** None current.
**Mitigation:** Fresh backup created before metadata repair.
**Owner:** Backend Lead
**Resolution:** COMPLETE — see `G1.1.2-OPERATIONAL-GATES-EVIDENCE.md`

### GAP-004: Integration Tests Need Continuous CI Database

**Severity:** LOW
**Location:** `.github/workflows/awl-architecture.yml`
**Description:** Real DB invariant tests exist and have prior Contabo evidence. The new workflow adds a GitHub Actions PostgreSQL service, but the workflow must be pushed and observed green before the gate is fully closed.
**Impact:** Until first CI run, continuous DB verification is not proven.
**Mitigation:** Push workflow and capture first green `postgres-integration` run.
**Owner:** QA Lead
**Resolution:** Follow-up ticket **OPS-001**

### GAP-005: Live Feature Flag Overrides Seeded

**Severity:** RESOLVED
**Location:** Database — `tenant_feature_flag_overrides`
**Description:** Reconstruction tenant has `CANONICAL_INITIATION=true`.
**Impact:** Reconstruction tenant can use canonical initiation when Phase 2 begins.
**Mitigation:** Added idempotent seed script and verified Contabo row.
**Owner:** QA Lead + Backend Lead
**Resolution:** COMPLETE — see `G1.1.2-OPERATIONAL-GATES-EVIDENCE.md`

---

## Risk Register

### RISK-001: Prisma Enum Name Collision

**Severity:** LOW
**Status:** MITIGATED
**Description:** Initial implementation used `ExecutionEngine` and `ReviewDecision` enum names that conflicted with existing schema.
**Mitigation:** Renamed to `AwlExecutionEngine`, `AwlReviewDecision`, etc. to avoid collision.
**Verification:** `npx prisma generate` succeeds; 0 TypeScript errors.

### RISK-002: Outbox Worker Backpressure

**Severity:** MEDIUM
**Status:** MITIGATED
**Description:** If handler is slow, outbox backlog grows unbounded.
**Mitigation:** Circuit breaker (5 failures → OPEN), exponential backoff, multi-instance scaling via row locks.
**Verification:** `circuit-breaker.spec.ts` validates state transitions.

### RISK-003: Command Versioning Strategy

**Severity:** LOW
**Status:** DOCUMENTED
**Description:** Once commands are versioned, how do we migrate v1 → v2?
**Mitigation:** CommandRegistry uses `commandType + version` as key. Multiple versions can coexist. Old clients continue using v1 until migrated.
**Owner:** Backend Lead
**Resolution:** TBD when first v2 command is needed

### RISK-004: AsyncLocalStorage Context Loss

**Severity:** MEDIUM
**Status:** DOCUMENTED
**Description:** AsyncLocalStorage context may be lost across certain async boundaries (e.g., setTimeout, worker threads).
**Mitigation:** 
- Commands and repositories receive explicit `tenantId` parameter
- `metadata` is passed as parameter, not read from ambient context
- Workers reconstruct context from event payload
**Verification:** Code review — no implicit tenant state outside AsyncLocalStorage

### RISK-005: Dual-write Inconsistency

**Severity:** LOW
**Status:** MITIGATED
**Description:** What if outbox event write fails but business mutation succeeds?
**Mitigation:** Both writes are in the same `executeInTransaction()` — atomic. If either fails, the entire transaction rolls back.
**Verification:** `outbox.service.ts` uses `tx.enterpriseEventOutbox.create()` inside the caller's transaction

### RISK-006: Test Pollution Between Runs

**Severity:** LOW
**Status:** MITIGATED
**Description:** Tests may share state (mocked singletons).
**Mitigation:** `beforeEach` resets all mocks. No persistent state between tests.
**Verification:** All 27 tests pass consistently across 10 runs.

---

## Acceptance Criteria for G1

For G1 approval, all of the following must be true:

- [x] All 27 tests pass
- [x] 0 TypeScript errors
- [x] Prisma client generates successfully
- [x] Architecture rules enforced by tests
- [x] Command catalog has at least 2 commands
- [x] State machines for all 5 aggregates
- [x] Idempotency matrix defined and implemented
- [x] Outbox infrastructure operational
- [x] Tenant isolation tested
- [x] Correlation ID propagation verified
- [x] SOLID compliance verified by architecture tests
- [x] All known gaps documented

**STATUS: ALL CRITERIA MET**

---

## Follow-up Tickets Required

| Ticket | Title | Priority | Owner | Phase |
|--------|-------|----------|-------|-------|
| OPS-001 | Push AWL CI workflow, fix `gh` auth, confirm first green run, apply branch protection | HIGH | Platform/Operations | Before Phase 2 |
| SIGN-001 | Collect 5 formal reviewer signatures | HIGH | All reviewers | Before Phase 2 |

---

## Reviewer Sign-Off Acknowledgement

By approving G1, each reviewer acknowledges that:

1. They have reviewed the **G1 Test Report** (27/27 tests pass)
2. They have reviewed the **G1 Architecture Evidence** (layer rules, state machines, idempotency)
3. They are aware of the **2 remaining external gates** plus the resolved tool-bypass remediation documented above
4. They accept the **6 risks** documented above
5. They commit to the **2 follow-up tickets** being tracked
6. They authorize Phase 2 (Enterprise Initiation) to begin

---

**G1 Known Gaps Status: DOCUMENTED AND ACCEPTED**
