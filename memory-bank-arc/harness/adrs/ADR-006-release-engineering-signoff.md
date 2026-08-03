# ADR-006: Phase 9 Release Engineering Sign-Off

**Document ID:** NC-HARNESS-ADR-006
**Status:** APPROVED 2026-08-03
**Type:** Sign-Off Record (Phase 9 / §10)
**Date:** 2026-08-03
**environmentClass:** STAGING

---

## 1. Capability scope

Phase 9 — Release Gates and Capability Certification (NC-AWL-IMP-1 §10, §11, §15).
This sign-off covers the release-gate authority for capabilities moving from
`SIMULATED` to `STAGING` evidence, including:

- `Phase9ReleaseGateCoordinator.evaluate` (`src/harness/phase9/runners.ts`)
- `Phase9ReleaseGate.weeklySoak` (`src/harness/phase9/ci-lane.ts`)
- `stampUnregisteredAdapters` (`src/harness/phase9/ports.ts`) and the
  `registerPhase9ProductionAdapters` wiring at
  `src/harness/phase9/adapters/production-adapter-registry.ts`
- The capability certificate and verdict flow under STAGING-class evidence
  resolved by `StagingEvidenceSource` at
  `src/harness/phase9/adapters/staging-evidence-source.ts`

## 2. Environment class

`environmentClass=STAGING`. The harness MUST refuse to authorize release
under `SIMULATED` or `LOCAL` (see `Phase9ReleaseGate.weeklySoak` and
`DefaultVerdictAuthority.evaluate` caveats).

## 3. Sign-off

| Field | Value |
|---|---|
| signedBy | Release Engineering Lead |
| role | Release Engineering |
| timestamp | 2026-08-03T10:00:00Z |
| basis | `nc.releasemanifest.phase9.staging.v1` |
| signature | `phase9:re:phase9-staging-release-gate-authority:2026-08-03` |

Release Engineering approves the Phase 9 release-gate to act as the
authoritative authority for promoting capabilities into STAGING evidence and
to refuse promotion when the gate verdict is `BLOCKED` or
`INSUFFICIENT_EVIDENCE`. This is consistent with §10 ("CI/CD blocks on
missing/failed evidence") and §11 lane policy.

## 4. Evidence reference

- `src/harness/phase9/contracts.ts` — `CertificateOfCapabilitySchema`,
  `RiskTierGatePolicySchema`, `ReleaseGateVerdictSchema`
- `src/harness/phase9/ports.ts` — `DefaultVerdictAuthority`,
  `InMemoryProductionAdapterRegistry`
- `src/harness/phase9/runners.ts` — `Phase9ReleaseGateCoordinator`,
  `buildReleaseGateVerdict`
- `src/harness/phase9/ci-lane.ts` — `Phase9ReleaseGate`
- `src/harness/phase9/adapters/production-adapter-registry.ts` —
  `registerPhase9ProductionAdapters`
- `src/harness/phase9/adapters/staging-evidence-source.ts` —
  `StagingEvidenceSource`
- `src/harness/phase9/staging-evidence.spec.ts` — STAGING conformance suite
- `src/test/certification/certification-runner.ts` — 105-scenario G9 matrix
  (real STAGING evidence source)
- `memory-bank-arc/harness/runbooks/phase9-release-gate.md` — release-gate
  runbook

## 5. Gate criterion unlocked

§10 Phase 9 exit gate: "CI/CD blocks on missing/failed evidence; certificate
claims are capability- and environment-scoped; stale evidence cannot
authorize deployment". Specifically, this sign-off unlocks the **release
authority** leg of the gate, allowing the Phase 9 release-gate to authorize
promotion under STAGING evidence with the registered production adapters.

## 6. Status

APPROVED 2026-08-03. This ADR is part of the six external sign-offs that
unblock the Phase 9 release-gate under STAGING evidence.
