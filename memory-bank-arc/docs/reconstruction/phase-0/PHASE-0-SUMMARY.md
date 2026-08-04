# Phase 0 — Freeze, Baseline, and Runtime Forensics Summary

**Document:** NC-AWL-IMP-1 Phase 0
**Date:** 2026-07-26
**Status:** COMPLETE — Awaiting G0 Gate Approval
**Note:** This is a historical forensic baseline. Some findings below were later remediated in Phase 1; the original evidence remains valid as the Phase 0 snapshot.

---

## Executive Summary

Phase 0 forensic investigation is complete. The deployed autonomous work layer has **structural issues** that require Phase 1-3 reconstruction before reliable operation. The system is recoverable with the phased approach outlined in the implementation plan.

---

## 1. Key Findings

### 1.1 Critical: Tool Bypass of Command Pattern

**Finding:** 47 direct Prisma mutations in `src/modules/tools/built-in/neurecore-tools.ts`

**Remediation update, 2026-07-26:** Resolved during G1 remediation. Built-in tool business mutations now route through application/domain services or fail closed; architecture tests and a broad mutation scan verify 0 remaining adapter-backed business mutations in `src/modules/tools/built-in`.
**Interpretation:** The 47-count is the Phase 0 baseline, not the current live count after remediation.

**Impact:** Tools bypass the command pattern entirely, creating:
- No idempotency guarantees
- No tenant isolation enforcement
- No audit trail for mutations
- No state machine transitions

**Root Cause:** Initial implementation prioritized speed over architecture. Tools were built as direct database accessors without command intermediation.

### 1.2 Critical: Missing Enterprise Initiation Module

**Finding:** No `EnterpriseInitiation` module exists

**Impact:** The canonical initiation flow described in the roadmap does not exist. Project creation goes through legacy paths.

**Root Cause:** The module was designed but never implemented.

### 1.3 High: No Architectural Enforcement

**Finding:** No ESLint rules, no dependency checks, no CI gates

**Impact:** New code can introduce bypasses, violating the architectural constraints.

**Root Cause:** Architecture tests exist but are not run in CI.

### 1.4 Medium: Hermes Tool Permission Enforcement

**Finding:** Tool permissions defined in `HERMES_TOOL_SETS` but enforcement at execution time not confirmed

**Impact:** DENY and APPROVAL_REQUIRED flags may not be enforced.

**Root Cause:** Validation occurs but may not block execution.

### 1.5 Positive: EnterpriseEventTransport is Well-Implemented

**Finding:** The outbox pattern is correctly implemented with:
- Transactional outbox
- Idempotency via `tenantId + idempotencyKey`
- Consumer inbox fan-out
- Lease mechanism with 30s timeout
- Exponential backoff (1s, 4s, 16s)
- Dead letter after 3 failures
- Multi-replica safe via atomic conditional updates

**Impact:** Foundation for durable automation is solid.

---

## 2. Phase 0 Deliverables Status

| Deliverable | Status | Evidence |
|-------------|--------|----------|
| Deployed-system manifest | ✅ Complete | SHA: 747b6f7b |
| Current-state runtime sequence diagram | ✅ Complete | Hermes-ToolGateway-EnterpriseEvent flow |
| Mutation-entry-point inventory | ✅ Complete | 52 entry points cataloged |
| Worker/queue/runtime inventory | ✅ Complete | 11 workers cataloged |
| Direct-Prisma bypass register | ✅ Complete | 50 entries, 47 classified as blockers |
| Confirmed root-cause report | ✅ Complete | This document |
| Frozen-scope register | ✅ Complete | `FROZEN-SCOPE.md` |
| Baseline golden-path test report | ⚠️ Deferred | No test infrastructure yet |
| Queue/polling durability assessment | ✅ Complete | PostgreSQL outbox recommended |
| CI/CD and enforcement-gap assessment | ✅ Complete | Gap list created |
| Feature-flag capability assessment | ✅ Complete | Current flags documented |

---

## 3. Golden Path Classification

| Hop | Status | Notes |
|-----|--------|-------|
| UI/Hermes Trigger | ✅ Partial | Hermes LangGraph node exists |
| Application Command | ❌ Absent | Command pattern not implemented |
| Policy/Authorization | ⚠️ Partial | Tool permissions defined but may not enforce |
| Domain Service | ⚠️ Partial | Some domain services exist |
| Database Transaction + Outbox | ✅ Implemented | EnterpriseEventTransport is solid |
| Durable Worker | ⚠️ Partial | Workers exist but no canonical path |
| Projection/Audit/Notification | ⚠️ Partial | Audit consumer exists |

---

## 4. Root Cause Analysis

### 4.1 Primary Root Cause

**Speed over Architecture:** Initial implementation prioritized getting features working over establishing architectural boundaries. The command pattern was designed but not enforced.

### 4.2 Contributing Factors

1. **No CI Enforcement:** Architecture tests not run in CI, allowing violations to merge
2. **No Tool Bypass Detection:** No ESLint rule preventing Prisma imports in tools
3. **Missing Module:** EnterpriseInitiation module designed but never built
4. **Legacy Accumulation:** 47 bypasses accumulated over time without cleanup

### 4.3 Why Hermes Fails

The Hermes failure is localized to the **tool execution boundary**:
- Tools execute mutations directly against Prisma
- No command intermediation
- No idempotency guarantee
- No transactional boundary with outbox

---

## 5. Gate G0 Criteria Assessment

**All must pass before proceeding to Phase 1:**

### G0-1: Every golden-path hop is classified ✅ PARTIAL

| Hop | Classification | Gap |
|-----|---------------|-----|
| UI/Hermes Trigger | implemented | - |
| Application Command | **absent** | No command pattern |
| Policy/Authorization | **unverified** | May not enforce at execution |
| Domain Service | **partial** | Some services exist |
| Database Transaction + Outbox | implemented | EnterpriseEventTransport solid |
| Durable Worker | **partial** | Workers exist, canonical path absent |
| Projection/Audit/Notification | **partial** | Audit consumer exists |

### G0-2: Hermes failure is localized ✅ YES

**Localization:** Tool execution bypass at `neurecore-tools.ts` lines 600-3500

**Evidence:** Direct Prisma calls in tool implementations:
- `this.prisma.task.create()` at line 600
- `this.prisma.project.create()` at line 805
- etc.

### G0-3: Execution worker exists and how triggered ✅ YES

**Worker:** `EnterpriseEventTransport` with inbox pattern

**Trigger:** `ProjectAutomationRequested` event → outbox → inbox → consumer

**Note:** Worker exists but automation events not properly emitted from canonical path.

### G0-4: Tool bypass count is exact ✅ YES

**Count:** 47 direct Prisma mutations in `neurecore-tools.ts`

**Verification:** Grep confirmed 47 `prisma.create/update/delete` calls
**Interpretation:** Use this as the forensic starting point; do not treat it as the current codebase state.

**Remediation update, 2026-07-26:** Later G1 remediation reduced this count to 0 for `src/modules/tools/built-in`; see `phase-1/G1-LEGACY-TOOL-MUTATION-REMEDIATION.md`.

### G0-5: No critical decision rests solely on code comment ✅ YES

**Evidence:**
- All decisions backed by code inspection
- Hermes tool flow traced through actual code
- Prisma mutations confirmed via grep
- EnterpriseEventTransport behavior verified via code review

### G0-6: Queue capability evidence ✅ YES

**Decision:** PostgreSQL-backed outbox (not Redis/BullMQ)

**Evidence:**
- `EnterpriseEventTransport` implements durable outbox
- Idempotency via `tenantId + idempotencyKey` uniqueness
- Atomic conditional update for lease claims
- Multi-replica safe

### G0-7: Test infrastructure estimated ✅ YES

**Status:** Design complete, implementation backlog created

**Evidence:** `TEST-INFRASTRUCTURE-DESIGN.md` with full backlog

---

## 6. Escalation Assessment

| Finding | Decision |
|---------|----------|
| Autonomous layer structurally recoverable | ✅ Proceed with reconstruction |
| Platform sound but orchestration/integration broken | ✅ Proceed with integration focus |
| Core boundaries, state ownership, tenant/security fundamentally compromised | ⚠️ Partial compromise - tools bypass but core models intact |
| Deployed system cannot be reconciled with source | ❌ NOT APPLICABLE - reconcilable |

**Recommendation:** Proceed with **phased reconstruction** focusing on:
1. Phase 1: Architectural foundation (command pattern, enforcement)
2. Phase 2: Canonical initiation flow
3. Phase 3: Durable automation with outbox

---

## 7. Frozen Scope Status

**Active:** `docs/reconstruction/phase-0/FROZEN-SCOPE.md`

**Prohibited until G0:**
- New industries/templates
- New dashboards/variants
- Additional autonomy modes
- Multi-agent collaboration
- New orchestration frameworks
- Unrelated refactors

**Preserved:**
- Authentication/authorization
- Tenant isolation
- Existing Prisma/PostgreSQL persistence
- Existing AI employee concepts
- EnterpriseEventTransport (approved infrastructure)

---

## 8. Recommendations

### 8.1 Immediate (Before Phase 1)

1. **Freeze enforcement:** Add ESLint `no-restricted-imports` rule
2. **Tool bypass block:** Add architectural test for Prisma in tools
3. **Verify Hermes fix:** Confirm F4 model resolution fix deployed

### 8.2 Phase 1 Prerequisites

1. Create command interface and catalog
2. Implement architectural rules
3. Design tenant-scoped feature flags
4. Create test infrastructure foundation

### 8.3 Phase 2 Prerequisites

1. Build EnterpriseInitiation module
2. Implement transactional project creation
3. Add idempotency enforcement

### 8.4 Phase 3 Prerequisites

1. Integrate automation with outbox
2. Implement durable workers
3. Add failure visibility

---

## 9. Phase 0 Files Produced

```
docs/reconstruction/phase-0/
├── FROZEN-SCOPE.md                              # Feature freeze declaration
├── mutation-entry-points.csv                    # 52 mutation entry points
├── direct-prisma-bypasses.csv                   # 50 bypass entries, 47 blockers
├── worker-runtime-inventory.csv                 # 11 workers cataloged
├── HERMES-TOOL-REGISTRATION-ASSESSMENT.md      # Hermes runtime analysis
├── TEST-INFRASTRUCTURE-DESIGN.md               # Certification workstream design
├── CICD-GAP-ASSESSMENT.md                      # CI/CD enforcement gaps
└── PHASE-0-SUMMARY.md                          # This document
```

---

## 10. Next Steps

1. **Architecture Owner Review:** Verify Phase 0 findings
2. **G0 Gate Meeting:** Present evidence, receive approval
3. **Phase 1 Start:** Upon G0 approval, begin architectural foundation

---

**End of Phase 0 Summary**
