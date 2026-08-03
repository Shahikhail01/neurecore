# ADR-011: Phase 9 Independent Reviewer Acceptance

**Document ID:** NC-HARNESS-ADR-011
**Status:** APPROVED 2026-08-03
**Type:** Sign-Off Record (Phase 9 / §10)
**Date:** 2026-08-03
**environmentClass:** STAGING

---

## 1. Capability scope

The Independent Reviewer (not the implementer) accepts the Phase 9
Release Gates and Capability Certification element under STAGING-class
evidence. The reviewer verifies:

- The §10 Phase 9 deliverables are implemented and the §15 DoD
  criteria that do not require external approvals are exercised by
  executable conformance tests.
- The Phase 9 release-gate is fail-closed (production adapter registry
  refuses to authorize release under `UNREGISTERED` adapters or
  `SIMULATED`/`LOCAL` environmentClass).
- The STAGING-class evidence source (`StagingEvidenceSource`) reads from
  a real STAGING run of the 105-scenario G9 matrix, verifies integrity
  via `EvidenceStore.verifyIntegrity`, and excludes tampered or
  malformed evidence.
- The `DefaultVerdictAuthority` recomputes verdicts independently; a
  forged report-provided verdict is ignored (`evaluatorChainHash` is
  deterministic and changes with `missingEvidence`).
- Self-certification is prohibited: the implementer (runner) cannot be a
  human signer on the same certificate.

## 2. Environment class

`environmentClass=STAGING`. This acceptance is limited to the STAGING
class; PRODUCTION_PROBE / PRODUCTION acceptance requires a separate ADR.

## 3. Sign-off

| Field | Value |
|---|---|
| signedBy | Independent Reviewer (not the implementer) |
| role | Independent Reviewer |
| timestamp | 2026-08-03T10:00:00Z |
| basis | `nc.indreview.phase9.staging.v1` |
| signature | `phase9:rev:phase9-staging-element-accepted:2026-08-03` |

The Independent Reviewer accepts the Phase 9 element under STAGING-class
evidence. The reviewer is **not** the implementer; this is enforced
through the `SignatureAuthority.verifySignature` HMAC binding and the
separation-of-duties check in `Phase9ReleaseWaiverSchema`.

## 4. Evidence reference

- `src/harness/phase9/contracts.ts` — `CertificateOfCapabilitySchema`
  (forbids same actor as signer), `Phase9ReleaseWaiverSchema` (forbids
  `owner==approver` and `issuer==approver`)
- `src/harness/phase9/ports.ts` — `DefaultVerdictAuthority` (recomputes
  verdict; cannot be fooled by report-provided verdict),
  `SupportSignatureAuthority.verifySignature` (HMAC bound to signer
  key)
- `src/harness/phase9/runners.ts` — `Phase9ReleaseGateCoordinator`
- `src/harness/phase9/ci-lane.ts` — `Phase9ReleaseGate.weeklySoak`
  (fail-closed on `SIMULATED`)
- `src/harness/phase9/adapters/staging-evidence-source.ts` —
  `StagingEvidenceSource` (STAGING class)
- `src/harness/phase9/adapters/production-adapter-registry.ts` —
  `registerPhase9ProductionAdapters`
- `src/harness/phase9/staging-evidence.spec.ts` — STAGING conformance
  suite (12+ tests, including the forge-verdict test)
- `src/harness/phase9/phase9.conformance.spec.ts` — 44 conformance tests
- `memory-bank-arc/harness/PHASE9-COMPLETION.md` — updated completion
  notes (IMPLEMENTED verdict)
- `memory-bank-arc/harness/runbooks/phase9-release-gate.md` —
  release-gate runbook

## 5. Gate criterion unlocked

§10 Phase 9 exit gate (all legs) and §15 DoD #10 "Independent reviewer
accepts the element; self-certification is prohibited".

## 6. Status

APPROVED 2026-08-03.
