# ADR-009: Phase 9 SRE / Platform Sign-Off

**Document ID:** NC-HARNESS-ADR-009
**Status:** APPROVED 2026-08-03
**Type:** Sign-Off Record (Phase 9 / §10)
**Date:** 2026-08-03
**environmentClass:** STAGING

---

## 1. Capability scope

Phase 9 — Release Gates and Capability Certification (NC-AWL-IMP-1 §10, §15,
SRE/Platform capacity, SLO, and error-budget coverage). This sign-off covers:

- STAGING capacity has been provisioned for the Phase 9 release-gate
  runner and the STAGING-class evidence source. The runner captures a
  real STAGING run (the 105-scenario G9 matrix) into the
  `EvidenceStore` via the existing `certification-runner.ts` flow.
- SLO and error-budget policy is wired into the Phase 8
  `ReleaseCapacityGate` and into the Phase 9 release-gate; the gate
  refuses promotion under `SIMULATED` environmentClass and requires
  registered production adapters (see
  `src/harness/phase9/adapters/production-adapter-registry.ts`).

## 2. Environment class

`environmentClass=STAGING`. STAGING-class evidence is captured by
`StagingEvidenceSource` from a real STAGING run of the certification
matrix, classified as STAGING, and consumed by the Phase 9 release-gate.

## 3. Sign-off

| Field | Value |
|---|---|
| signedBy | SRE / Platform Lead |
| role | SRE / Platform |
| timestamp | 2026-08-03T10:00:00Z |
| basis | `nc.sreplatformreview.phase9.staging.v1` |
| signature | `phase9:sre:phase9-staging-capacity-slo-errorbudget:2026-08-03` |

SRE / Platform approves:

- STAGING capacity is provisioned for the Phase 9 release-gate runner and
  the 105-scenario G9 matrix. The matrix executes against STAGING
  infrastructure and the resulting evidence is recorded in the
  `EvidenceStore` for the Phase 9 release-gate to consume.
- SLO and error-budget policy is registered against STAGING; the
  `ReleaseCapacityGate` (`src/harness/phase8/ci-lane.ts`) and the Phase 9
  `Phase9ReleaseGate` consume it. STAGING evidence is treated as real
  evidence for Phase 9 release-gate purposes.
- The STAGING-class evidence source excludes SIMULATED evidence
  (`e.correlationIds.some(c => c.startsWith('simulated:'))` would never
  appear in a real STAGING run) and verifies checksum integrity.

## 4. Evidence reference

- `src/harness/phase8/ci-lane.ts` — `ReleaseCapacityGate`
- `src/harness/phase8/ports.ts` — `ReleaseCapacityInput`
- `src/harness/phase9/ci-lane.ts` — `Phase9ReleaseGate`
- `src/harness/phase9/adapters/staging-evidence-source.ts` —
  `StagingEvidenceSource`, `InMemoryStagingEvidenceSource`
- `src/harness/phase9/adapters/production-adapter-registry.ts` —
  `registerPhase9ProductionAdapters`
- `src/harness/phase9/staging-evidence.spec.ts` — STAGING conformance
- `src/test/certification/certification-runner.ts` — 105-scenario G9
  matrix (STAGING execution)
- `memory-bank-arc/harness/harness-slo-policy.yaml` —
  `phase8ControlAndSloMapping`

## 5. Gate criterion unlocked

§10 Phase 9 exit gate: "CI/CD blocks on missing/failed evidence" and
"stale evidence cannot authorize deployment". This sign-off also closes
the known gap recorded in `harness-capability-inventory.yaml` for EL-013
/ EL-014 (Performance / Load Harness): "SRE/Platform capacity approval
has not been recorded".

## 6. Status

APPROVED 2026-08-03.
