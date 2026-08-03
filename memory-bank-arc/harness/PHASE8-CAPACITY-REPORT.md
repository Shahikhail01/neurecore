# Phase 8 Capacity Report — Reference Schema

**Document ID:** NC-HARNESS-PHASE8-CAPACITY-DOC
**Version:** 1.1
**Status:** REFERENCE — generated from the in-memory harness, SIMULATED environment
**Date:** 2026-08-03

> ⚠️ **NOT PRODUCTION CAPACITY.** All numbers in any Phase 8 capacity report
> are produced from in-memory simulated ports. The report's `environmentClass`
> field is `SIMULATED` and `verdict` is `SIMULATED_NO_PRODUCTION_CLAIM`. The
> release capacity gate in `backend/src/harness/phase8/ci-lane.ts` rejects
> this evidence for release promotion.

This document is the human-readable companion to the JSON capacity report
emitted by `backend/src/harness/phase8/report-writer.ts::writePhase8Report()`.

---

## 1. How to read the verdict

The `verdict` field is derived from the report's `environmentClass` and `status`:

| `environmentClass` | `status` | `verdict` |
|--------------------|----------|-----------|
| `SIMULATED`        | any      | `SIMULATED_NO_PRODUCTION_CLAIM` |
| `STAGING` / `PRODUCTION_PROBE` / `PRODUCTION` | `PASS` | `CAPACITY_REPORT_PASSED` |
| `STAGING` / `PRODUCTION_PROBE` / `PRODUCTION` | `INCONCLUSIVE` | `CAPACITY_REPORT_INCONCLUSIVE_INVESTIGATE` |
| `STAGING` / `PRODUCTION_PROBE` / `PRODUCTION` | `BLOCK` | `CAPACITY_REPORT_BLOCKED_FAIL_CLOSED` |

The verdict is **not** SRE/Platform approval. Approval is a separate
sign-off recorded in `PHASE8-COMPLETION.md`.

## 2. Capacity report fields

| Field | Meaning |
|-------|---------|
| `schemaVersion` | Capacity report contract version (currently `1.1.0`) |
| `generatedAt` | ISO timestamp the report was rendered |
| `runnerVersion` | Phase 8 runner version (currently `1.1.0`) |
| `runId` | UUID of the underlying `Phase8RunnerReport.runId` |
| `tenantId` | Primary tenant scope of the run |
| `environmentClass` | Source environment; default `SIMULATED` |
| `provenance` | Structured provenance URI of the run |
| `profiles` | Per-profile metric bundle summary (one per default profile) |
| `caveats` | Honest caveats; always include the in-memory simulation warning |
| `verdict` | See §1 |
| `sloEvaluation` | `null` if no SLO policy supplied; otherwise status, error-budget consumption, threshold results, missing samples, reasons |
| `adapterRegistrations` | Adapter identifiers registered for the run; UNSUPPORTED by default |
| `statisticalConfidence` | One entry per profile: sample size, confidence level, method (`NORMAL_APPROX`/`BOOTSTRAP`/`WILCOXON`/`NONE`), margin of error, sufficient, reason. **When `sufficient: false`, the run must not be used to claim statistical evidence for SLO regressions** |
| `regressionEvidence` | One entry per profile: baseline runId / bundleId / provenance, tolerances, observedP95Ratio, observedErrorDelta, comparedAt, reason |
| `operationalAlerts` | One entry per alert: kind (`CLEANUP_FAILURE`, `CORRECTNESS_FAILURE`, `ISOLATION_FAILURE`, `SATURATION_DETECTED`, `PROVIDER_THROTTLE_SUSTAINED`, `QUEUE_BACKLOG_GROWTH`, `RECOVERY_FAILURE`, `UNSUPPORTED_ROUTING`), severity, message, profileId, runId, tenantId, context |

## 3. Per-profile fields

Each entry in `profiles[]` corresponds to one `WorkloadMetricBundle`:

| Field | Meaning |
|-------|---------|
| `profileId` / `kind` | Profile identifier and workload kind |
| `sampleSize` | Number of completed requests |
| `p50Ms` / `p95Ms` / `p99Ms` | Latency percentiles |
| `throughputRps` | Achieved throughput in requests per second |
| `errorRate` | Fraction of requests that did not return `OK` |
| `tokenCost` | Total provider cost for the profile (USD) |
| `saturation` | Detected inflection point; `null` when no curve crossed the detection thresholds (see §4) |
| `recoveryTimeMs` | Time from pressure end to recovery, only set for the `RECOVERY` profile |
| `correctness` / `isolation` / `regression` | Verdict per dimension |
| `soakWindows` | Number of windows computed for the `SOAK` profile (else 0) |
| `environmentClass` | Inherited from the run |
| `provenance` | Per-bundle provenance URI |
| `pressureEvidence` | Pressure configuration actually applied to the port during the run |
| `notes` | Reasons for any INSUFFICIENT_EVIDENCE verdicts |

## 4. Saturation detection

`detectSaturationFromCurves()` (in `backend/src/harness/phase8/ports.ts`) scans
the observed resource/error series for the first inflection in priority order:

1. `QUEUE_DEPTH` — successive samples where depth grows by ≥50 jobs and current > 100
2. `DB_CONNECTIONS` — successive samples where connections grow by ≥4 and current ≥ 8
3. `CPU_PERCENT` — any sample ≥ 90%
4. `CACHE_HIT_RATIO` — any sample < 0.2 when prior was > 0.5
5. `ERROR_RATE` (inflight ≥ 10) — fallback when no other trigger fires

The `saturation` field in the capacity report is the literal first match.
The full curve is retained on `metricBundle.saturationPoint.curve` for the
machine-readable runner report.

## 5. Release capacity gate

`evaluateReleaseCapacityGate()` (in `backend/src/harness/phase8/ci-lane.ts`)
blocks release promotion when:

1. `environmentClass` is not `STAGING`, `PRODUCTION_PROBE`, or `PRODUCTION`;
2. the supplied SLO policy is missing `approvedBy`, `approvedAt`, or
   `approvedEnvironment`;
3. the supplied policy's `approvedEnvironment` does not match the report
   `environmentClass`;
4. any bundle reports `correctnessVerdict === 'FAILED'`;
5. any bundle reports `isolationVerdict === 'FAILED'`;
6. any bundle reports `regressionVerdict === 'REGRESSED'` AND `releaseCandidate=true`;
7. any soak bundle has `errorRate > 0.05` AND `weeklySoakDue=true`;
8. `report.status !== 'PASS'` AND `releaseCandidate=true`.

The current state of the repository has no approved SLO policy registered and
no real environmentClass evidence, so the gate is in blocking mode.

## 6. Example output (annotated)

The current schema produces, for example:

```json
{
  "schemaVersion": "1.1.0",
  "environmentClass": "SIMULATED",
  "verdict": "SIMULATED_NO_PRODUCTION_CLAIM",
  "caveats": [
    "capacity derived from in-memory simulation, not production telemetry",
    "no external SLO/SRE approval implied",
    "release capacity gate blocks on unapproved SLO policy or non-real environment"
  ],
  "adapterRegistrations": [
    "WORKLOAD_PORT", "METRICS_PORT", "PRESSURE_PORT",
    "CACHE_PORT", "DB_PORT", "QUEUE_PORT", "PROVIDER_PORT",
    "CORRECTNESS_ORACLE", "ISOLATION_ORACLE", "CLEANUP_PORT",
    "OBSERVABILITY_PORT"
  ],
  "sloEvaluation": null,
  "profiles": [ /* 12 entries, one per default profile */ ]
}
```

A full sample is preserved in
`backend/src/test/certification/reports/phase8/phase8-phase8-coordinator-<runId>-capacity.json`
files. The directory is gitignored; no production capacity claim should be
made from any artifact in it.

## 8. Integrity artifact

Every `writePhase8Report` invocation also writes a sibling
`<runId>-integrity.json` artifact. The integrity artifact contains:

- `reportChecksum`, `jsonChecksum`, `summaryChecksum`, `capacityChecksum`
- `tampered` (boolean) and `reasons[]` from `detectTampering`
- `roundTrip.checksumOk` and `reasons[]` from `roundTripPhase8Report`
- `retention.kept` / `retention.purged` and `reasons[]` from `evaluateReportRetention`

A `tampered: true` or `roundTrip.checksumOk: false` finding means the
report cannot be trusted. The nightly CI workflow
(`.github/workflows/phase8-nightly.yml`) verifies all three signals and
fails the lane if any of them indicates tampering, drift, or expiry.

## 9. Report schema migration and restore

`backend/src/harness/phase8/report-migration.ts` exposes:

- `ReportSchemaMigratorChain.buildDefaultChain()` — a chain from
  `1.0.0` to the current `PHASE8_VERSION` that adds the
  `statisticalConfidence`, `regressionEvidence`, and
  `operationalAlerts` arrays when they are missing
- `roundTripPhase8Report(report)` — applies the chain and verifies
  the round-trip preserves runId, counters, and checksum
- `restoreReport({ report, sourceChecksum, expectedSchemaVersion })` —
  rejects restored reports whose checksum or schema version does not
  match
- `evaluateReportRetention({ runId, retentionClass, retentionUntilMs, legalHold })` —
  `kept: true` only if not expired and not under legal hold

These are exercised by `Phase 8 / Conformance / Report schema migration
and integrity` and consumed by the nightly CI workflow.

## 7. Honest limitations (do not paper over)

- All `latency.*` numbers reflect in-process scheduling jitter, not network
  or DB I/O latency. Reading them as production percentiles is incorrect.
- `throughputRps` is bounded by Node.js event-loop scheduling; reading it as
  cluster throughput is incorrect.
- `errorRate` is dominated by `PROVIDER_THROTTLE` injection rate; real
  provider errors are not observed.
- `saturation` is a function of the simulated curve shape; do not extrapolate
  to production queue capacity.
- `recoveryTimeMs` is bounded by the simulated recovery window; real
  recovery involves restarts, leader election, and DB catch-up not modeled.
- `tokenCost` is computed against a fixed per-token rate; no real provider
  billing API is consulted.
