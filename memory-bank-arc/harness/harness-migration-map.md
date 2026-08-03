# NeureCore Harness Migration Map v1

**Document ID:** NC-HARNESS-MIGRATION-MAP-001
**Version:** 1.1
**Status:** PHASE_0_BASELINE (rectified 2026-08-02)
**Audience:** Architecture, QA, Backend, Frontend
**Decision Owner:** Architecture
**Last Reviewed:** 2026-08-02

---

## 1. Purpose and Scope

This document maps every existing test suite and report to its future harness adapter and defines retirement criteria. It ensures no test coverage is lost during the migration from the current state to the unified harness platform.

**In Scope:**
- All existing test suites in `backend/src/test/`
- All certification runners and reports
- All simulation runners in `simulations/`
- All Playwright tests in `frontend-tenant/tests/`
- All documentation and runbooks
- All `package.json` certify/test scripts

**Out of Scope:**
- Production application code
- Infrastructure configuration
- CI/CD pipeline configuration (documented separately)

---

## 2. Existing Test Assets Inventory (per-suite/per-report)

### 2.1 Backend Test Suite

| Path | Type | Purpose | Current Status | Owner | Future Adapter |
|------|------|---------|---------------|-------|---------------|
| `backend/jest.config.js` | Config | Jest configuration | ACTIVE | Architecture | `harness-adapters/jest-adapter.ts` |
| `backend/src/test/test-harness.module.ts` | Module | Test harness module | ACTIVE | Architecture | `harness-contracts/fixtures.ts` |
| `backend/src/test/unit/*.spec.ts` | Unit | Individual component tests | ACTIVE | Backend | `harness-adapters/jest-adapter.ts` |
| `backend/src/test/integration/*.integration.spec.ts` | Integration | Component integration | ACTIVE | Backend | `harness-adapters/jest-adapter.ts` |
| `backend/src/test/architecture/*.spec.ts` | Architecture | Architecture boundary tests | ACTIVE | Architecture | `harness-adapters/architecture-adapter.ts` |
| `backend/src/test/characterization/*.spec.ts` | Characterization | Legacy behavior capture | ACTIVE | Backend | `harness-adapters/characterization-adapter.ts` |
| `backend/src/test/parity/*.spec.ts` | Parity | Feature parity verification | ACTIVE | Architecture | `harness-adapters/parity-adapter.ts` |
| `backend/src/test/certification/*.spec.ts` | Certification | G7/G9 certification | ACTIVE — RETRACTED output (see §6) | Release Engineering | `harness-adapters/certification-adapter.ts` |
| `backend/src/test/cert/*.integration.spec.ts` | Cert | Domain certification | ACTIVE | QA | `harness-adapters/certification-adapter.ts` |
| `backend/src/harness/contracts/*.spec.ts` | Contracts | Conformance tests | ACTIVE | Architecture | (target — already migrated) |

### 2.2 Certification Reports (with retraction status)

| Path | Type | Purpose | Status | Notes |
|------|------|---------|--------|-------|
| `backend/src/test/certification/reports/g7-machine-readable.json` | Report | G7 cert | ACTIVE — historical | Pre-G9, keep |
| `backend/src/test/certification/reports/g9-summary.json` | Report | G9 summary | **RETRACTED 2026-08-02** | `releaseApproved: false`, retraction block present |
| `backend/src/test/certification/reports/g9-machine-readable.json` | Report | G9 detailed | **RETRACTED 2026-08-02** | `gateG9.releaseApproved: false`, retraction blocks present |
| `backend/src/test/certification/reports/g9-dashboard.html` | Report | G9 dashboard | **RETRACTED 2026-08-02** | Banner: "SCOPED — NOT A PRODUCTION CERTIFICATION" |
| `backend/src/test/certification/parity-v3/reports/parity-v3-summary.json` | Report | Parity summary | ACTIVE | Parity-v3 separate stream |
| `backend/src/test/certification/parity-v3/reports/parity-v3-machine-readable.json` | Report | Parity detailed | ACTIVE | Parity-v3 separate stream |
| `backend/src/test/certification/parity-v3/reports/parity-v3-dashboard.html` | Report | Parity dashboard | ACTIVE | Parity-v3 separate stream |

### 2.3 Simulation Suites

| Path | Type | Purpose | Status | Owner | Future Adapter |
|------|------|---------|--------|-------|---------------|
| `simulations/SIM-04-Accounting-Project-Full-Flow/` | SIM | Accounting project flow | **FAIL — FE-first defects open** | QA | `harness-adapters/sim-adapter.ts` |
| `simulations/SIM-05-Financial-Services-Project-Full-Flow/` | SIM | Financial services flow | PARTIAL | QA | `harness-adapters/sim-adapter.ts` |
| `simulations/SIM-06-Technology-Digital-Services-Project-Full-Flow/` | SIM | Tech services flow | PARTIAL | QA | `harness-adapters/sim-adapter.ts` |
| `simulations/SIM-07-Professional-Business-Services-Project-Full-Flow/` | SIM | Pro services flow | PARTIAL | QA | `harness-adapters/sim-adapter.ts` |
| `simulations/SIM-08-Retail-Commerce-Consumer-Project-Full-Flow/` | SIM | Retail commerce flow | PARTIAL | QA | `harness-adapters/sim-adapter.ts` |
| `simulations/SIM-09-Media-Communications-Creative-Project-Full-Flow/` | SIM | Media flow | PARTIAL | QA | `harness-adapters/sim-adapter.ts` |
| `simulations/SIM-10-Nonprofit-International-Project-Full-Flow/` | SIM | Nonprofit flow | PARTIAL | QA | `harness-adapters/sim-adapter.ts` |
| `simulations/SIM-11-Special-Purpose-Organizations-Project-Full-Flow/` | SIM | Special purpose flow | PARTIAL | QA | `harness-adapters/sim-adapter.ts` |
| `simulations/_lib/` | Library | Common SIM utilities | ACTIVE | QA | `harness-scenarios/` |

### 2.4 Frontend Test Suite

| Path | Type | Purpose | Status | Owner | Future Adapter |
|------|------|---------|--------|-------|---------------|
| `frontend-tenant/playwright.config.ts` | Config | Playwright configuration | ACTIVE | Frontend | `harness-adapters/playwright-adapter.ts` |
| `frontend-tenant/tests/*.spec.ts` | E2E | End-to-end browser tests | ACTIVE | QA | `harness-adapters/playwright-adapter.ts` |
| `frontend-admin/playwright.config.ts` | Config | Admin Playwright config | UNKNOWN — pending Phase 10 | Platform | `harness-adapters/playwright-adapter.ts` |

### 2.5 Scripts

| Script | Purpose | Status | Future Adapter |
|--------|---------|--------|---------------|
| `pnpm certify:phase9` | Run Phase 9 G9 | **RETRACTED 2026-08-02** | Wrapped by `harness-orchestrator` |
| `pnpm certify:phase9:all` | Full Phase 9 + dashboard | **RETRACTED 2026-08-02** | Wrapped by `harness-orchestrator` |
| `pnpm certify:dashboard` | Render dashboard | ACTIVE — points to retracted source | Updates to include retraction banner |
| `pnpm certify:parity-v3` | Run parity-v3 | ACTIVE | Wrapped by `harness-adapters/parity-adapter.ts` |
| `pnpm certify:parity-v3:all` | Full parity-v3 | ACTIVE | Wrapped by `harness-adapters/parity-adapter.ts` |
| `pnpm certify:toolset` | Domain toolset cert | ACTIVE | Wrapped by `harness-adapters/certification-adapter.ts` |
| `pnpm certify:sim04` | SIM-04 runner | **FAIL — FE-first defects open** | Migrated to `harness-adapters/sim-adapter.ts` |
| `pnpm inventory:templates` | Template inventory | ACTIVE | Informational only |

---

## 3. Migration Source-to-Target Mapping

### 3.1 Test Harness Migration (EL-001)

| Current Asset | Future Adapter | Migration Action | Retirement Criteria |
|---------------|---------------|-----------------|-------------------|
| `backend/jest.config.js` | `harness-adapters/jest-adapter.ts` | Wrap existing Jest config | New adapter passes existing tests |
| `backend/src/test/unit/*.spec.ts` | `harness-adapters/jest-adapter.ts` | Run via unified adapter | All unit tests pass via adapter |
| `backend/src/test/test-harness.module.ts` | `harness-contracts/fixtures.ts` | Refactor into fixture contracts | Fixtures are runtime-validated |

### 3.2 Certification Harness Migration (EL-016)

| Current Asset | Future Adapter | Migration Action | Retirement Criteria |
|---------------|---------------|-----------------|-------------------|
| `backend/src/test/certification/certification-runner.ts` | `harness-adapters/certification-adapter.ts` | Refactor into adapter pattern | Adapter produces same results |
| `backend/src/test/certification/reports/g9-summary.json` | `harness-evidence/` | Migrate to evidence schema | Evidence schema validated (RETRACTED first) |
| `backend/src/test/certification/reports/g9-machine-readable.json` | `harness-evidence/` | Migrate to evidence schema | Same |
| `backend/src/test/certification/reports/g9-dashboard.html` | `harness-control-api/dashboard` | Regenerate from canonical source | Same |
| `pnpm certify:phase9*` | `harness-orchestrator/` | Integrate into scheduler | Scheduler runs certification |
| `backend/src/test/certification/parity-v3/` | `harness-adapters/parity-adapter.ts` | Adapterize existing runner | Adapter produces same results |

### 3.3 Browser/E2E Harness Migration (EL-005)

| Current Asset | Future Adapter | Migration Action | Retirement Criteria |
|---------------|---------------|-----------------|-------------------|
| `frontend-tenant/playwright.config.ts` | `harness-adapters/playwright-adapter.ts` | Wrap existing config | All scenarios run via adapter |
| `frontend-tenant/tests/*.spec.ts` | `harness-adapters/playwright-adapter.ts` | Run via unified adapter | Same test results |
| `simulations/SIM-04-*/certify-sim04.mjs` | `harness-adapters/sim-adapter.ts` | Migrate to common manifest | Manifest-based execution works |
| `simulations/SIM-05-*/certify-sim*.mjs` | `harness-adapters/sim-adapter.ts` | Same as above | Same as above |

### 3.4 Simulation Harness Migration (EL-003)

| Current Asset | Future Adapter | Migration Action | Retirement Criteria |
|---------------|---------------|-----------------|-------------------|
| `simulations/SIM-04-Accounting-Project-Full-Flow/` | `harness-adapters/sim-adapter.ts` | Migrate to manifest format | Manifest runner passes SIM scenarios |
| `simulations/SIM-05-Financial-Services-Project-Full-Flow/` | `harness-adapters/sim-adapter.ts` | Same | Same |
| `simulations/SIM-06-*/` to `simulations/SIM-11-*/` | `harness-adapters/sim-adapter.ts` | Same | Same |
| `simulations/_lib/` | `harness-scenarios/` | Move to scenarios dir | All SIMs use common lib |

### 3.5 Tenant Isolation Harness Migration (EL-018)

| Current Asset | Future Adapter | Migration Action | Retirement Criteria |
|---------------|---------------|-----------------|-------------------|
| `backend/src/test/certification/tenant-isolation.spec.ts` | `harness-adapters/isolation-adapter.ts` | Extend with matrix coverage | All matrix tests pass |
| `backend/src/test/certification/phase8-tenant-isolation.spec.ts` | `harness-adapters/isolation-adapter.ts` | Same | Same |
| `backend/src/test/certification/cross-tenant-negative.spec.ts` | `harness-adapters/isolation-adapter.ts` | Same | Same |

### 3.6 Evaluation Harness Migration (EL-002)

| Current Asset | Future Adapter | Migration Action | Retirement Criteria |
|---------------|---------------|-----------------|-------------------|
| `backend/src/modules/agent-templates/agent-template-certification.ts` | `harness-adapters/eval-adapter.ts` | Wrap existing certification | Adapter produces same results |
| `backend/src/modules/analytics/services/model-card.service.ts` | `harness-adapters/eval-adapter.ts` | Integrate as evaluator | Integration tested |
| Decision evaluations (internal) | `harness-evaluation/` | Consolidate rubric/v datasets | Consolidated and validated |

### 3.7 Failure Injection Migration (EL-017)

| Current Asset | Future Adapter | Migration Action | Retirement Criteria |
|---------------|---------------|-----------------|-------------------|
| `backend/src/test/certification/fixtures/failure-injection.ts` | `harness-replay/failure-bus.ts` | Extend to full replay | Full replay works |
| Failure modes (8 types) | `harness-replay/fault-plans.ts` | Formalize fault plans | All 8 modes supported |
| Failure injection in existing tests | `harness-replay/` | Migrate to replay system | Replay produces same failures |

---

## 4. Retirement Criteria

### 4.1 Retirement Decision Tree

```
ASSET_MIGRATED?
├── YES → ALL_ADAPTERS_PASS?
│   ├── YES → WAIT_FOR_HARNESS_STABLE?
│   │   ├── YES → SCHEDULE_RETIREMENT
│   │   └── NO → KEEP_CURRENT_AND_NEW
│   └── NO → FIX_ADAPTERS_BEFORE_RETIREMENT
└── NO → IS_ASSET_DEPRECATED?
    ├── YES → SCHEDULE_RETIREMENT_WITH_MIGRATION_PLAN
    └── NO → KEEP_UNTIL_MIGRATION_READY
```

### 4.2 Specific Retirement Criteria

| Asset | Retirement Requires | Retirement Date |
|-------|-------------------|-----------------|
| Phase 9 runner (direct) | Certification adapter passes all scenarios | After Phase 2 stable |
| G9 summary.json (direct use) | Evidence API provides same data | After Phase 2 stable |
| Parity V3 runner (direct) | Parity adapter passes all scenarios | After Phase 3 stable |
| SIM-04 certify-sim04.mjs | SIM adapter runs same scenarios + NC-SIM04-002/005 closed | After Phase 6 stable |
| SIM-05-11 certify-sim*.mjs | SIM adapter runs same scenarios | After Phase 6 stable |
| Legacy jest.config.js | Jest adapter is stable | After Phase 1 stable |

### 4.3 Deprecation Notices

When an asset is deprecated:
1. Deprecation notice added to asset header
2. Asset continues to work during transition period
3. Migration guide provided
4. Transition period minimum 30 days
5. Final retirement announced 2 weeks in advance

---

## 5. Adapter Interface Contracts

### 5.1 Universal Adapter Interface

```typescript
interface IHarnessAdapter {
  // Identity
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly supportedHarnessElement: HarnessElement;

  // Execution
  execute(runRequest: RunRequest): Promise<RunResult>;
  cancel(runId: string): Promise<void>;

  // Evidence
  getEvidence(runId: string): Promise<EvidenceBundle>;

  // Health
  healthCheck(): Promise<HealthStatus>;
}
```

### 5.2 Jest Adapter Contract

```typescript
interface IJestAdapter extends IHarnessAdapter {
  readonly adapterId: 'jest-adapter';

  execute(runRequest: JestRunRequest): Promise<JestRunResult>;

  // Jest-specific
  getCoverage(runId: string): Promise<CoverageReport>;
  getFlakyTests(runId: string): Promise<FlakyTest[]>;
}
```

### 5.3 Certification Adapter Contract

```typescript
interface ICertificationAdapter extends IHarnessAdapter {
  readonly adapterId: 'certification-adapter';
  readonly supportedCertStandard: 'G9' | 'G7' | 'PARITY_V3' | 'DOMAIN_TOOLSET';

  execute(runRequest: CertificationRunRequest): Promise<CertificationResult>;
  getVerdict(runId: string): Promise<CertificationVerdict>;
  getCertificate(capabilityId: string): Promise<Certificate | null>;
}
```

### 5.4 Browser Adapter Contract

```typescript
interface IBrowserAdapter extends IHarnessAdapter {
  readonly adapterId: 'playwright-adapter';

  execute(runRequest: BrowserRunRequest): Promise<BrowserRunResult>;

  // Browser-specific
  getTrace(runId: string): Promise<TraceData>;
  getVideo(runId: string): Promise<VideoData | null>;
  getScreenshots(runId: string): Promise<Screenshot[]>;
}
```

### 5.5 Adapter Contract Status

Adapter interface contracts are **DEFINED** in this document and will be implemented in Phase 1.

---

## 6. SIM-04 / G9 Retraction (per Phase 0 Exit: unsupported claims removed/scoped)

### 6.1 SIM-04 Status

| Field | Value |
|-------|-------|
| Verdict | **FAIL** |
| Reason | Runner treated API endpoints as substitute for FE-first workflow |
| Open defects | NC-SIM04-002, NC-SIM04-005 |
| Source | `AGENTS.md` SIM-04 status 2026-07-28 |
| Phase 1 remediation | Independent verdict service (EL-016, ADR-004) |

### 6.2 G9 Status

| Field | Value |
|-------|-------|
| Verdict | **SCOPED** (not production certification) |
| Scope | `phase9-synthetic-only` |
| `releaseApproved` | `false` |
| `certifiedCapabilityCount` | `0` (was 2, retracted) |
| Affected files | `g9-summary.json`, `g9-machine-readable.json`, `g9-dashboard.html` |
| Retraction annotations | Present in all 3 files (see Phase 0 completion) |

---

## 7. Migration Phasing

### 7.1 Phase 1 Migration (Harness Kernel - Phase 1)

| Asset | Action | Adapter |
|-------|--------|---------|
| `backend/src/test/test-harness.module.ts` | Refactor to contracts | `harness-contracts/` |
| Jest config | Wrap | `harness-adapters/jest-adapter.ts` |
| Basic unit tests | Run via adapter | Adapter validates |
| Adapter interface contracts | Implement | `harness-adapters/*.ts` |

### 7.2 Phase 2 Migration (Evidence Foundation - Phase 2)

| Asset | Action | Adapter |
|-------|--------|---------|
| `backend/src/test/certification/reports/` | Migrate to evidence schema | `harness-evidence/` |
| G9 machine-readable format | Adopt standard format | `harness-certification/` |
| Certification runner | Wrap | `harness-adapters/certification-adapter.ts` |

### 7.3 Phase 3 Migration (Test & Regression - Phase 3)

| Asset | Action | Adapter |
|-------|--------|---------|
| All unit tests | Run via adapter | `harness-adapters/jest-adapter.ts` |
| Integration tests | Wrap | `harness-adapters/` |
| Defect registry | Formalize | `harness-catalog/` |

### 7.4 Phase 6 Migration (Browser/E2E & Simulation - Phase 6)

| Asset | Action | Adapter |
|-------|--------|---------|
| `frontend-tenant/playwright.config.ts` | Wrap | `harness-adapters/playwright-adapter.ts` |
| All Playwright tests | Run via adapter | Adapter validates |
| SIM-04 certify-sim04.mjs | Migrate to manifest | `harness-adapters/sim-adapter.ts` |
| SIM-05-11 certify-sim*.mjs | Same | Same |

### 7.5 Phase 7 Migration (Security & Compliance - Phase 7)

| Asset | Action | Adapter |
|-------|--------|---------|
| Tenant isolation tests | Extend via adapter | `harness-adapters/isolation-adapter.ts` |
| Cross-tenant tests | Same | Same |
| Security tests | Formalize | `harness-adapters/security-adapter.ts` |

### 7.6 Phase 8 Migration (Performance & Load - Phase 8) [2026-08-03]

Phase 8 is **PARTIAL**. In-memory adapters exist; production-like staging
adapters are NOT registered and SRE/Platform capacity approval is not recorded.

| Asset | Action | Adapter / Mapping |
|-------|--------|-------------------|
| `backend/src/harness/phase8/` (contracts, ports, runners, ci-lane, report-writer) | **Adopt** as Phase 8 kernel | Reuses `harness-contracts` + `harness-evidence` from Phase 1/2 |
| 12 default workload profiles (baseline cold/warm, spike, stress, soak, provider-throttle, queue/db/cache pressure, concurrent tenants/agents, recovery) | **Adopt** | Defined in `backend/src/harness/phase8/contracts.ts` (`PHASE8_DEFAULT_PROFILES`) |
| Production adapter registry (`InMemoryPhase8AdapterRegistry`, `UnsupportedPhase8Adapters`, `unsupportedRegistrationStamps`) | **Adopt** | All 11 production adapters stamp UNSUPPORTED by default |
| Phase 8 capacity report | **Adopt** | Generated by `pnpm certify:phase8:report`; verdict is `SIMULATED_NO_PRODUCTION_CLAIM` |
| Phase 8 release capacity gate | **Adopt** | Blocks release promotion when `environmentClass != STAGING/PRODUCTION_PROBE/PRODUCTION` OR `SloPolicy.approvedBy == null` |
| SRE/Platform capacity approval | **NOT RECORDED** | SLO policy remains `currentBaseline: null` for all SLOs |
| External load generator integration (k6/Locust/etc.) | **NOT STARTED** | No production-like staging adapter registered |
| Approved SLO policy registered with the Phase 8 gate | **NOT STARTED** | Gate fails-closed until a policy with `approvedBy/approvedAt/approvedEnvironment` is supplied |

Dependencies on Phase 7:

| Phase 8 dependency | Phase 7 status | Effect on Phase 8 |
|---|---|---|
| Stable tenant isolation under load | PARTIAL — Security + Compliance sign-off not recorded | Phase 8 isolation verdict is a harness-port assertion, not a production guarantee |
| Approved control matrix for SLO-002 (zero-tolerance tenant isolation) | PARTIAL — sign-off not recorded | Phase 8 cannot claim SLO-002 satisfied at release time |

### 7.7 Phase 9+ Migration (Release Gates - Phase 9, dependent on Phase 8)

Phase 9 cannot close until Phase 8 is approved for at least one real
environment (STAGING, PRODUCTION_PROBE, or PRODUCTION) with a registered
SLO policy.

---

## 8. Migration Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Adapter introduces test flakiness | HIGH | MEDIUM | Extensive comparison testing before retirement |
| Evidence schema migration loses data | CRITICAL | LOW | Backup before migration, rollback plan |
| SIM scenarios fail in adapter | HIGH | HIGH | Incremental migration, one SIM at a time |
| Performance regression | MEDIUM | MEDIUM | Performance benchmarks before and after |
| CI/CD integration breakage | HIGH | MEDIUM | Parallel CI lanes during transition |
| SIM-04 defects block SIM adapter | HIGH | MEDIUM | Fix NC-SIM04-002/005 before SIM-04 adapter migration |

---

## 9. Rollback Procedures

### 9.1 Rollback Decision Criteria

Initiate rollback if:
- Adapter fails to reproduce existing test results (>1% difference)
- Evidence schema migration loses critical data
- CI/CD integration fails after 48 hours of debugging
- Security regression detected

### 9.2 Rollback Procedure

1. Stop new test runs through adapter
2. Restore original test runners
3. Verify original runners produce same results
4. Analyze adapter failure root cause
5. Fix and reschedule migration

---

## 10. Migration Checklist

### 10.1 Pre-Migration Checklist

- [ ] Adapter source code reviewed
- [ ] Adapter unit tests written
- [ ] Adapter integration tests written
- [ ] Comparison tests run (old vs new)
- [ ] Performance benchmarks captured
- [ ] Rollback plan documented
- [ ] CI/CD integration tested
- [ ] Stakeholders notified

### 10.2 Migration Execution Checklist

- [ ] Original assets backed up
- [ ] Adapter deployed to staging
- [ ] Staging tests pass
- [ ] Production deployment
- [ ] Production tests pass
- [ ] Monitoring enabled
- [ ] Original assets marked deprecated

### 10.3 Post-Migration Checklist

- [ ] Original assets removed after transition period
- [ ] Documentation updated
- [ ] Runbooks updated
- [ ] Training materials updated
- [ ] Lessons learned documented

---

## 11. Honest Assessment

**Current State:**
- Migration map: **DEFINED** (this document, rectified)
- Adapter contracts: **DEFINED** (interfaces specified in §5, to be implemented Phase 1)
- Migration execution: **NOT STARTED** (pending Phase 1)
- Retirement of legacy assets: **NOT SCHEDULED**

**Rectifications Applied 2026-08-02:**
- Replaced broad category rows with per-asset rows (every suite/report/script/config mapped)
- Used exact repository-relative paths
- Added Owner column for every row
- Added Future Adapter column for every row
- Explicitly marked G9 / SIM-04 outputs as RETRACTED / FAIL in §6
- Resolved "adapter contracts not defined" contradiction by formally specifying them in §5
- Marked SIM-04 retirement blocked behind NC-SIM04-002/005 fix

**Critical Dependencies:**
1. Adapter contracts must be implemented before any migration (Phase 1)
2. Comparison testing methodology must be established
3. CI/CD integration points must be identified
4. Rollback procedures must be tested
5. SIM-04 must be fixed before SIM adapter migration

**Status:** FRAMEWORK DEFINED - Execution pending Phases 1-10

---

## 4. Phase 7 — Security, Compliance, Tenant Isolation, HITL

### 4.1 Phase 7 Source-to-Target Mapping

| Current Asset | Phase 7 Adapter | Migration Action | Retirement Criteria |
|---------------|-----------------|------------------|---------------------|
| `backend/src/test/certification/cross-tenant-negative.spec.ts` | `src/harness/phase7/runners.ts` (IsolationRunner, TenantKeyIsolationPort) | Phase 7 matrix builds the 15x9x12 cases; negative tests remain as product-layer coverage | IsolationRunner report is PASS |
| `backend/src/test/certification/idempotency.spec.ts` | `src/harness/phase7/runners.ts` (HITL idempotency assertion in HitlRunner) | Reused as product signal; HITL idempotency is enforced through `InMemoryReviewQueue.isIdempotent` | idempotent test passes |
| `backend/src/modules/work-runtime/runtime/work-runtime.service.ts` | `src/harness/phase7/ports.ts` (InMemoryReviewQueue, HitlExecutor) | Harness wraps and asserts queue behavior via the port; no product duplication | conformance suite PASS |
| `backend/src/modules/audit-interceptor/*` + retention engine | `src/harness/phase7/runners.ts` (ComplianceRunner, InMemoryComplianceEvidencePort) | Runner reads compliance control contracts and verifies evidence completeness via `evidenceComplete`; reuses `createEvidenceEnvelope` from Phase 2 | conformance suite PASS |
| Production Prisma persistence | not registered | `UnsupportedDurableStore` is the default for `DurableReviewQueueStore` | a production adapter is registered in `InMemoryPhase7AdapterRegistry` |
| External Security/Compliance approvals | not registered | PHASE7-COMPLETION.md records this as BLOCKED until recorded | sign-off captured |

### 4.2 Phase 7 Capability Inventory References

- `harness-capability-inventory.yaml` — `phase7Progress20260803` block lists EL-011, EL-012, EL-018, EL-021 progress
- `harness-control-matrix.yaml` — `phase7Controls` block lists NC7-C01..NC7-C06, NC7-ISO-MATRIX, NC7-HITL-INDEPENDENCE, NC7-HITL-DENY

### 4.3 Phase 7 Scripts and Reports

| Script | Purpose | Status |
|--------|---------|--------|
| `pnpm certify:phase7` | Run conformance suite | ACTIVE |
| `pnpm certify:phase7:report` | Run Phase 7 coordinator, write machine-readable JSON + summary + checksum | ACTIVE |

### 4.4 Phase 7 Production Adapter Registration

Phase 7 ships an `InMemoryPhase7AdapterRegistry`. Until a production adapter is registered for `ISOLATION_PORT`, `ADVERSARIAL_PORT`, `ABUSE_PORT`, `UNSAFE_ACTION_PORT`, `COMPLIANCE_EVIDENCE_PORT`, `REVIEW_PORT`, `DURABLE_REVIEW_QUEUE_STORE`, and `CLEANUP_PORT`, runners execute against in-memory fail-closed doubles only. The harness pass is **NOT** a claim of production enforcement.