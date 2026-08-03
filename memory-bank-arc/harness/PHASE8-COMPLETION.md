# Phase 8 Completion Report — Performance and Load

**Date:** 2026-08-03
**Phase:** 8 — Performance and Load
**Status:** ⚠️ **PARTIAL** — every code-testable §10 deliverable and §15 DoD
criterion that does not require an external SRE/Platform approval is
implemented and exercised by executable conformance tests
(102/102 Phase 8, 1076/1076 full harness). The §10 exit gate and several
§15 DoD criteria depend on **external approvals and external
infrastructure** that have not been recorded. The release capacity gate
is fail-closed.
**Source plan:** `neurecore/memory-bank-arc/comms/harness-elementsv1.md`
§10 Phase 8, §11 CI/CD lanes, §15 DoD

> ⚠️ **Honest framing.** This is not a "Phase 8 DONE" report. The §10
> exit gate requires "SLO/error-budget thresholds are approved; no
> correctness or isolation loss under supported load; recovery time is
> demonstrated", with the §10 gate owned by **SRE/Platform capacity
> approval**. As of 2026-08-03, **no SLO policy is approved**, **no
> staging environmentClass evidence exists**, and **no SRE/Platform
> sign-off has been recorded**. The harness executes correctly against
> in-memory simulated ports and the release capacity gate correctly
> refuses to authorize release promotion. The §15 DoD criterion 9
> ("Known limitations and unsupported environments are visible in the
> certificate") is therefore the only DoD criterion that maps cleanly to
> the current in-memory evidence.
>
> **Do not interpret a green `pnpm certify:phase8` as production
> capacity approval.** That command produces a `SIMULATED_NO_PRODUCTION_CLAIM`
> report by design.

---

## §10 Phase 8 Deliverables

| # | Deliverable | Status | Module / Evidence |
|---|---|---|---|
| 1 | Workload models | ✅ DONE | `src/harness/phase8/contracts.ts` (`PHASE8_DEFAULT_PROFILES`) — baseline cold/warm, spike, stress, soak (5 windows), provider-throttle, queue/db/cache pressure, concurrent tenants/agents, recovery |
| 2 | Latency / cost / throughput profiles (p50/p95/p99) | ✅ DONE | `buildLatencyDistribution`, `buildTokenCost` in `src/harness/phase8/ports.ts`; exercised by `Phase 8 / Conformance / Runner` specs |
| 3 | Spike, stress, soak, provider-throttle, queue/db/cache pressure, recovery tests | ✅ DONE | Per-profile `WorkloadRunner.runProfile` invokes `pressureConfig` against `CachePort`/`DbPort`/`QueuePort`/`ProviderPort`; recovery curve produced with `pressureCurve` + `recoveryCurve` |
| 4 | Capacity report | ✅ DONE | `src/harness/phase8/report-writer.ts` (`writePhase8Report`) emits JSON / summary / capacity / checksum / **integrity** artifacts; verdict `SIMULATED_NO_PRODUCTION_CLAIM` |
| 5 | Sample size, confidence, regression, saturation, recovery time, resource/error curves | ✅ DONE | `LatencyDistributionSchema`, `ConfidenceIntervalSchema`, `RegressionVerdictSchema`, `SaturationPointSchema`, `RecoveryCurveSchema`, `ResourceSampleSchema`; **`StatisticalConfidenceSchema`** and **`RegressionEvidenceSchema`** now record sample size, method, margin-of-error, baseline pointers, and tolerances; `detectSaturationFromCurves` derives from observed curves, not always p95 |
| 6 | Correctness and isolation assertions under load; fail-closed | ✅ DONE | `correctnessVerdict` (PASSED/FAILED/INCONCLUSIVE), `isolationVerdict` (PASSED/FAILED/INCONCLUSIVE); `Phase8Coordinator` finalizes with `BLOCK`/`FAILED` when `criticalFailures > 0`; **emits `CORRECTNESS_FAILURE` and `ISOLATION_FAILURE` alerts on the `OperationalAlertPort`** |
| 7 | Immutable evidence / provenance / checksum | ✅ DONE | Each profile emits one `EvidenceEnvelope` with `sha256:` checksum; `reportChecksum` over counters + caseResults + status + bundle IDs; **`buildPhase8IntegrityReport` runs `detectTampering` + `roundTripPhase8Report` + `evaluateReportRetention` and writes an integrity artifact** |
| 8 | Capacity report generator + machine-readable writer | ✅ DONE | `writePhase8Report` writes JSON + summary + capacity + checksum + **integrity**; `buildPhase8CapacityReport` is the structured generator |
| 9 | CI lane / gate policy (weekly soak + release capacity semantics) | ✅ DONE | `src/harness/phase8/ci-lane.ts` (`Phase8LaneSelector` with `WEEKLY_SOAK` and `RELEASE_CAPACITY` lanes, `ReleaseCapacityGate`, `evaluateReleaseCapacityGate`); **three workflows wired: `phase8-pr-smoke.yml`, `phase8-nightly.yml`, `phase8-weekly-soak.yml`**; weekly workflow explicitly asserts `SIMULATED_NO_PRODUCTION_CLAIM` and FAILS if a real capacity verdict is ever produced |
| 10 | Cancellation / timeout / retry / cleanup | ✅ DONE | `runWithGuards` (timeout + retry + cancel), `RunnerCancelledError`, `RunnerTimeoutError`, per-profile `resetState`, `FailingCleanupAdapter`, `UnsupportedCleanupAdapter`; **`InMemoryCleanupPort` now treats idempotent re-cleanup as `cleaned: true` (no longer flags as a failure)**; **`finalizePhase8Report` requires an explicit `cleanupResult` and throws `PHASE8_FABRICATED_CLEANUP_BLOCKED` if a default success is attempted** |
| 11 | Phase 8 control/SLO mappings | ✅ DONE | `memory-bank-arc/harness/harness-slo-policy.yaml::phase8ControlAndSloMapping` links SLO-011..SLO-018 to Phase 8 default profiles and the `ReleaseCapacityGate` |
| 12 | Phase 8 migration map | ✅ DONE | `memory-bank-arc/harness/harness-migration-map.md::§7.6 Phase 8 Migration` |
| 13 | **Statistical confidence metadata in reports** | ✅ DONE | `StatisticalConfidenceSchema` (sample size, confidence level, method `NORMAL_APPROX`/`BOOTSTRAP`/`WILCOXON`/`NONE`, margin-of-error, sufficient boolean, reason). `buildStatisticalConfidence` returns `sufficient: false` with method `NONE` and `marginOfError: null` when `sampleSize < 30`. **Confidence intervals are degenerate (lower === upper, confidenceLevel 0) when method is `NONE`** — no fake CIs |
| 14 | **Regression evidence in reports** | ✅ DONE | `RegressionEvidenceSchema` (baseline runId / bundleId / provenance, tolerances, observedP95Ratio, observedErrorDelta, comparedAt, reason). Recorded for every profile |
| 15 | **Operational alert port + adapter** | ✅ DONE | `OperationalAlertPort` interface + `InMemoryOperationalAlertPort` (records + `countByKind()`) + `UnsupportedOperationalAlertPort`. **`Phase8Coordinator` invokes alerts for CLEANUP_FAILURE, CORRECTNESS_FAILURE, ISOLATION_FAILURE, SATURATION_DETECTED, PROVIDER_THROTTLE_SUSTAINED, QUEUE_BACKLOG_GROWTH, RECOVERY_FAILURE, and UNSUPPORTED_ROUTING (when SIMULATED)** |
| 16 | **Report schema migration + restore** | ✅ DONE | `report-migration.ts::ReportSchemaMigratorChain`, `roundTripPhase8Report`, `restoreReport`, `evaluateReportRetention`, `tamperedReport`, `detectTampering`, `KNOWN_REPORT_VERSIONS` |
| 17 | **Integrity / tamper tests** | ✅ DONE | `detectTampering` and `roundTripPhase8Report` exercised; `writePhase8Report` now writes a `<runId>-integrity.json` artifact containing tampering + round-trip + retention results |
| 18 | **Honest adapter registry** | ✅ DONE | `unsupportedRegistrationStamps()` returns `UNSUPPORTED` for all 11 production adapters; `UnsupportedProductionAdapterStub` per adapter throws `PHASE8_PROD_ADAPTER_UNSUPPORTED` on any method invocation; `unsupportedProductionAdapterStubs()` returns one stub per adapter |
| 19 | **CI workflows (PR / nightly / weekly)** | ✅ DONE | `.github/workflows/phase8-pr-smoke.yml`, `phase8-nightly.yml`, `phase8-weekly-soak.yml`. All three **annotate the workflow summary with the honest SIMULATED framing** and the weekly workflow **fails** if it ever produces a non-SIMULATED verdict |

---

## §10 Phase 8 Exit Gate

> "SLO/error-budget thresholds are approved; no correctness or isolation
> loss under supported load; recovery time is demonstrated."

| Criterion | Status | Evidence |
|---|---|---|
| SLO thresholds approved | ❌ NOT RECORDED | `harness-slo-policy.yaml::honestAssessment` records zero approved policies; no `SloPolicy` registered with `approvedBy/approvedAt/approvedEnvironment` populated |
| No correctness loss under load (in-process) | ✅ SATISFIED | `Phase 8 / Conformance / Pressure profile evidence` exercises real cache/db/provider/queue pressure profiles; `Phase 8 / Conformance / Coordinator ports` proves injected ports flow through |
| No isolation loss under load (in-process) | ✅ SATISFIED | `Phase 8 / Conformance / IsolationOracle correlates by requestId map not array index`; `TenantKeyIsolationOracle` rejects cross-tenant provider prefixes |
| Recovery time demonstrated | ⚠️ IN-PROCESS ONLY | `RECOVERY` profile produces `pressureCurve`/`recoveryCurve`/`recoveryTimeMs` from simulated pressure phases; not validated against real provider/queue outage |
| External SRE/Platform capacity approval | ❌ NOT RECORDED | No record in this document; `gate.friendlyAcknowledgement: NOT_RECORDED` |
| Phase 7 must be stable (dependency) | ⚠️ PARTIAL | Phase 7 reports `PARTIAL` per `memory-bank-arc/harness/PHASE7-COMPLETION.md`; Security + Compliance sign-off not recorded |

The release capacity gate in `backend/src/harness/phase8/ci-lane.ts` is
**fail-closed**: it requires both an approved SLO policy AND a real
environmentClass (`STAGING` / `PRODUCTION_PROBE` / `PRODUCTION`).

---

## §15 Definition of Done

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Canonical owner, capability mapping, threat considerations, runbook exist | ✅ DONE for harness scope; ⚠️ PARTIAL for SRE/Platform capacity owner sign-off | `harness-capability-inventory.yaml::EL-013/EL-014::phase8Progress20260803`; `memory-bank-arc/harness/runbooks/phase8-certification.md`; SRE/Platform sign-off not recorded |
| 2 | Contracts runtime-validated, versioned, conformance tests | ✅ DONE | `src/harness/phase8/contracts.ts` (`PHASE8_VERSION = "1.1.0"`); `phase8.conformance.spec.ts` (102/102 Phase 8, 1076/1076 full harness) |
| 3 | Positive, negative, boundary, failure, cancellation, timeout, retry, cleanup paths | ✅ DONE | `runWithGuards` (timeout/retry/cancellation), `FailingCleanupAdapter` and `UnsupportedCleanupAdapter` exercised by `Phase 8 / Conformance / Cleanup`; `IsolationOracle` correlation; cleanup BLOCK → criticalFailures count; **`InMemoryCleanupPort` idempotent re-cleanup is now `cleaned: true` (was incorrectly a failure)**; **`finalizePhase8Report` throws `PHASE8_FABRICATED_CLEANUP_BLOCKED` when `cleanupResult` is missing** |
| 4 | Tenant isolation enforced at every touched layer | ⚠️ PARTIAL | Phase 8 in-process isolation oracles (`DeterministicIsolationOracle`, `TenantKeyIsolationOracle`) cover the harness port; real tenant isolation still depends on Phase 7 sign-off |
| 5 | Immutable evidence + complete provenance without prohibited sensitive data | ✅ DONE | `EvidenceEnvelope` per profile with `sha256:` checksum; `provenance` field includes `environmentClass`; producer tag encodes environment; no raw prompts, no chain-of-thought; **integrity artifact captures `reportChecksum` + per-artifact sha256 + tamper detection + round-trip checksum + retention verdict** |
| 6 | Determinism or statistical uncertainty explicitly measured | ✅ DONE | `buildStatisticalConfidence` per bundle (sample size, method, margin-of-error, sufficient, reason); `ConfidenceInterval` method `NONE` returns degenerate CIs (no fake CIs); statistical evaluator wired; soak profile produces N windows with drift detection |
| 7 | CI lane and release policy consume the result | ✅ DONE for in-process lanes; ⚠️ PARTIAL for production lanes | `phase8-pr-smoke.yml` (PR), `phase8-nightly.yml` (nightly), `phase8-weekly-soak.yml` (weekly); `ReleaseCapacityGate` blocks on missing policy/environment. **Weekly workflow explicitly asserts `SIMULATED_NO_PRODUCTION_CLAIM` and fails if a real capacity verdict is ever produced** |
| 8 | Operational alerts, retention, restore, schema migration | ✅ DONE | `OperationalAlertPort` + `InMemoryOperationalAlertPort` + `UnsupportedOperationalAlertPort`; `Phase8Coordinator` emits alerts for CLEANUP_FAILURE, CORRECTNESS_FAILURE, ISOLATION_FAILURE, SATURATION_DETECTED, PROVIDER_THROTTLE_SUSTAINED, QUEUE_BACKLOG_GROWTH, RECOVERY_FAILURE, UNSUPPORTED_ROUTING. `ReportSchemaMigratorChain` (plan/apply/verify) + `roundTripPhase8Report` + `evaluateReportRetention` + `restoreReport` + `tamperedReport` + `detectTampering` all exercised by `Phase 8 / Conformance / Report schema migration and integrity` |
| 9 | Known limitations and unsupported environments visible in the certificate | ✅ DONE | Capacity report `caveats` lists simulation caveat, no SLO/SRE approval, environmentClass, release-gate-block reason; `PHASE8-CAPACITY-REPORT.md` documents honest limitations; every CI workflow annotates the SIMULATED framing |
| 10 | Independent reviewer accepts the element | ❌ NOT RECORDED | No external reviewer has accepted Phase 8 — the certification capability (§10 exit gate) is not recorded |

---

## What was wired (this delivery)

| Artifact | Status | Path |
|---|---|---|
| Phase 8 contracts (runtime-versioned Zod) | ✅ UPDATED | `backend/src/harness/phase8/contracts.ts` — added `StatisticalConfidenceSchema`, `RegressionEvidenceSchema`, `OperationalAlertSchema`; extended `Phase8RunnerReportSchema` |
| Phase 8 narrow ports + deterministic in-process adapters | ✅ UPDATED | `backend/src/harness/phase8/ports.ts` — added `OperationalAlertPort`, `InMemoryOperationalAlertPort`, `UnsupportedOperationalAlertPort`, `UnsupportedProductionAdapterStub`, `unsupportedProductionAdapterStubs`, `PRODUCTION_ADAPTER_UNSUPPORTED_PREFIX`, `UNSUPPORTED_ALERT_REASON`; `InMemoryCleanupPort` re-cleanup is now `cleaned: true` (idempotent); `buildConfidenceIntervals` returns degenerate CIs when method is `NONE` |
| Phase 8 WorkloadRunner + Phase8Coordinator | ✅ UPDATED | `backend/src/harness/phase8/runners.ts` — `Phase8Coordinator` accepts `alertPort`, generates `statisticalConfidence` + `regressionEvidence` per bundle, emits alerts for cleanup/correctness/isolation/saturation/provider-throttle/queue-backlog/recovery/UNSUPPORTED_ROUTING (SIMULATED); `finalizePhase8Report` rejects default-success fabrication |
| Phase 8 release capacity gate + lane policy | ✅ DONE (pre-existing) | `backend/src/harness/phase8/ci-lane.ts` |
| Phase 8 machine-readable capacity report writer | ✅ UPDATED | `backend/src/harness/phase8/report-writer.ts` — `writePhase8Report` now also writes `<runId>-integrity.json`; `buildPhase8IntegrityReport` exercises tamper + round-trip + retention |
| Phase 8 conformance + closure specs | ✅ UPDATED | `backend/src/harness/phase8/phase8.conformance.spec.ts` — **102/102** (was 73/73) |
| Phase 8 standalone runner script | ✅ UPDATED | `backend/src/harness/phase8/run-phase8-certification.ts` — emits `alerts` + `alertGate` block, dispatches via `dispatchOperationalAlerts`, exits non-zero when `alertGate.blocked` is true under SIMULATED |
| Phase 8 report schema migration / restore / retention module | ✅ NEW | `backend/src/harness/phase8/report-migration.ts` |
| Phase 8 alert gateway module | ✅ NEW | `backend/src/harness/phase8/alerts.ts` |
| Phase 8 PR smoke CI workflow | ✅ NEW | `.github/workflows/phase8-pr-smoke.yml` |
| Phase 8 nightly CI workflow | ✅ NEW | `.github/workflows/phase8-nightly.yml` — verifies integrity, round-trip, retention on every run |
| Phase 8 weekly soak CI workflow | ✅ NEW | `.github/workflows/phase8-weekly-soak.yml` — asserts `SIMULATED_NO_PRODUCTION_CLAIM` and FAILS if a real capacity verdict is produced |

---

## Verifier run output (2026-08-03)

```
$ pnpm certify:phase8:all
…
Test Suites: 1 passed, 1 total
Tests:       102 passed, 102 total
…
artifacts:
  jsonPath:      …/phase8/phase8-phase8-coordinator-<runId>.json
  summaryPath:   …/phase8/phase8-phase8-coordinator-<runId>-summary.json
  capacityPath:  …/phase8/phase8-phase8-coordinator-<runId>-capacity.json
  checksumPath:  …/phase8/phase8-phase8-coordinator-<runId>-checksum.txt
  integrityPath: …/phase8/phase8-phase8-coordinator-<runId>-integrity.json

$ npx jest --config jest.config.js --runInBand src/harness/
Test Suites: 36 passed, 36 total
Tests:       1076 passed, 1076 total

$ npx eslint "src/harness/phase8/**/*.ts" --max-warnings=0
(clean — 0 errors, 0 warnings)

$ npx tsc --noEmit | grep phase8
(clean — 0 errors)
```

---

## Remaining blockers (explicit, not "none within scope")

The following blockers are §10/§15 prerequisites that this delivery
**cannot close without external action**. They are recorded here so the
next phase owner does not mistake a green Phase 8 conformance for a
released Phase 8.

1. **Phase 7 dependency is PARTIAL.** Phase 7 reports
   `memory-bank-arc/harness/PHASE7-COMPLETION.md::Status` as PARTIAL
   because Security + Compliance sign-off has not been recorded.
   Phase 8 isolation verdicts build on Phase 7 isolation runners, so a
   green Phase 8 isolation verdict is a **harness-port assertion**, not
   a production guarantee, until Phase 7 is closed.
2. **No SLO thresholds are approved.** `harness-slo-policy.yaml` records
   `approvedSlos: 18` but every SLO has `currentBaseline: null` and no
   Phase 8 SloPolicy has been registered with the `ReleaseCapacityGate`.
   The gate therefore reports `policyEnforceable=false`.
3. **No production-like staging adapter is registered.**
   `unsupportedRegistrationStamps()` returns `UNSUPPORTED` for every one
   of the 11 production adapters; `unsupportedProductionAdapterStubs()`
   returns one stub per adapter that throws `PHASE8_PROD_ADAPTER_UNSUPPORTED`
   on any method invocation. There is no real queue, DB, cache, or
   provider integration behind the harness.
4. **No load generator measurements against real infrastructure.**
   All throughput / latency / saturation / recovery / soak curves come
   from in-process Node.js scheduling and in-memory port simulators.
   `backend/src/harness/phase8/ports.ts::SimulatedWorkloadPort` is the
   only active `WorkloadPort`.
5. **SRE/Platform capacity approval is not recorded.** Per
   `harness-capability-inventory.yaml::EL-013::owner.confirmedBy`, the
   SRE Lead sign-off pertains to baseline ownership, not Phase 8
   capacity. No record of §10 exit-gate approval exists in this document
   or in the runbook.
6. **Independent reviewer has not accepted Phase 8.** §15 DoD #10 is
   ❌ NOT RECORDED.

---

## Next actions (when external conditions are met)

1. Register an approved SLO policy (with `approvedBy/approvedAt/approvedEnvironment`)
   via the production adapter registry; wire it into
   `evaluateReleaseCapacityGate`.
2. Register production-like staging adapters for `CACHE_PORT`,
   `DB_PORT`, `QUEUE_PORT`, `PROVIDER_PORT`. The runner will then emit
   real environmentClass evidence. The current stubs will refuse to
   measure anything; replace them with real adapters.
3. Confirm the weekly-soak CI workflow still produces a non-simulated
   verdict; the workflow is fail-closed so it will fail loudly if a
   real adapter is wired without a matching SLO policy and SRE sign-off.
4. Record the SRE/Platform capacity sign-off in this document and
   promote the status to `IMPLEMENTED` per §15 DoD criteria 9 and 10.

Until all six blockers above are resolved, the truthful status of
Phase 8 remains **PARTIAL**.
