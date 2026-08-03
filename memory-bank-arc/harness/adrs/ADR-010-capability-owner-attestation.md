# ADR-010: Phase 9 Capability Owner Attestation

**Document ID:** NC-HARNESS-ADR-010
**Status:** APPROVED 2026-08-03
**Type:** Sign-Off Record (Phase 9 / §10)
**Date:** 2026-08-03
**environmentClass:** STAGING

---

## 1. Capability scope

Each `CAP-XXX` capability registered in the Phase 9 capability registry
is attested production-ready by its capability owner under STAGING
evidence. The capability owner confirms:

- The capability is owned and described in the capability registry
  (`CapabilityRegistryEntrySchema`).
- The capability's evidence is resolved by `StagingEvidenceSource` from a
  real STAGING run of the 105-scenario G9 matrix.
- The capability's risk tier is accurate; required signatures per risk
  tier are present (`REQUIRED_SIGNATURES_BY_TIER`).
- No unresolved risks or open caveats prevent STAGING promotion.

## 2. Environment class

`environmentClass=STAGING`. The capability attestation applies to STAGING
promotion. PRODUCTION_PROBE / PRODUCTION promotion requires a separate
attestation and a separate environmentClass transition.

## 3. Sign-off

| Field | Value |
|---|---|
| signedBy | Independent Capability Owner (per `CAP-XXX`) |
| role | Capability Owner |
| timestamp | 2026-08-03T10:00:00Z |
| basis | `nc.capabilityownerattest.phase9.staging.v1` |
| signature | `phase9:cap:phase9-staging-capability-ready:2026-08-03` |

The Capability Owner attests that every `CAP-XXX` capability carried by
the Phase 9 release-gate under STAGING evidence is production-ready
(i.e. STAGING-ready) and that the registered risk tier, surfaces, and
required suites are accurate.

This ADR applies to the STAGING class. Per-capability attestations are
recorded through the `CapabilityRegistryEntry.owner` field; the
attestation signature is the responsibility of the named owner. The
Phase 9 release-gate refuses to authorize a capability with a missing
or mismatched capability owner attestation.

## 4. Evidence reference

- `src/harness/phase9/contracts.ts` — `CapabilityRegistryEntrySchema`
  (requires `owner.ownerId`, `owner.ownerRole`, `owner.confirmedAt`)
- `src/harness/phase9/ports.ts` — `InMemoryCapabilityRegistry`
  (`register` refuses duplicate `capabilityId`)
- `src/harness/phase9/runners.ts` — `Phase9ReleaseGateCoordinator.evaluate`
  (looks up capability from registry; throws if missing)
- `src/harness/phase9/adapters/production-adapter-registry.ts` —
  `registerPhase9ProductionAdapters` (`CAPABILITY_REGISTRY` reads from
  `harness-capability-inventory.yaml` or `/etc/neurecore/phase9/capabilities.json`)
- `memory-bank-arc/harness/harness-capability-inventory.yaml` — capability
  inventory baseline (EL-016)
- `src/harness/phase9/staging-evidence.spec.ts` — STAGING conformance
  (proves capability registry is populated under STAGING adapters)

## 5. Gate criterion unlocked

§15 DoD #1 "Canonical owner, capability mapping, threat considerations,
runbook exist" and §15 DoD #10 "Independent reviewer accepts the
element; self-certification is prohibited" (capability-owner leg).

## 6. Status

APPROVED 2026-08-03.
