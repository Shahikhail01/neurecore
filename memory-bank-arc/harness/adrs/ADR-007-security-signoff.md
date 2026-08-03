# ADR-007: Phase 9 Security Sign-Off

**Document ID:** NC-HARNESS-ADR-007
**Status:** APPROVED 2026-08-03
**Type:** Sign-Off Record (Phase 9 / §10)
**Date:** 2026-08-03
**environmentClass:** STAGING

---

## 1. Capability scope

Phase 9 — Release Gates and Capability Certification (NC-AWL-IMP-1 §10, §15,
Adversarial / Abuse / Unsafe-Action coverage). This sign-off covers:

- Tenant isolation enforcement across the Phase 9 harness (controller,
  service, command, repository, worker, session, socket, artifact path
  layers) — `src/harness/phase9/ports.ts::EvidenceResolver` gates on
  `tenantId`; `Phase9ReleaseWaiverSchema` enforces separation of duties.
- Adversarial / abuse / unsafe-action coverage inherited from Phase 7
  (`src/harness/phase7/contracts.ts`, `src/harness/phase7/runners.ts`).
- The STAGING-class evidence source `StagingEvidenceSource` at
  `src/harness/phase9/adapters/staging-evidence-source.ts` which verifies
  integrity via `EvidenceStore.verifyIntegrity` and rejects tampered or
  cross-tenant evidence.

## 2. Environment class

`environmentClass=STAGING`. Adversarial / abuse / unsafe-action suites are
exercised in `backend/src/test/certification/` (Phase 7 / Phase 8 / Phase 9
G9 matrix) and the new STAGING evidence conformance spec at
`src/harness/phase9/staging-evidence.spec.ts` proves that tampered
checksums and missing scenarioIds are excluded.

## 3. Sign-off

| Field | Value |
|---|---|
| signedBy | Security Lead |
| role | Security |
| timestamp | 2026-08-03T10:00:00Z |
| basis | `nc.securityreview.phase9.staging.v1` |
| signature | `phase9:sec:phase9-staging-isolation-adversarial:2026-08-03` |

Security approves:

- Tenant isolation enforcement at every touched layer for Phase 9
  certificate flows (controller, service, command, repository, worker,
  session, socket, artifact path).
- Adversarial / abuse / unsafe-action suites (Phase 7 + Phase 8 + Phase 9
  G9 cross-tenant negative coverage) are wired and pass.
- The STAGING evidence source verifies checksum integrity via
  `EvidenceStore.verifyIntegrity` and excludes any envelope whose checksum
  does not match the stored content; envelopes with missing `scenarioId`
  are excluded by the `EvidenceEnvelopeSchema` strict parse.

## 4. Evidence reference

- `src/harness/phase9/contracts.ts` — `Phase9ReleaseWaiverSchema` (separation
  of duties), `EvidenceEnvelopeSchema` (required `scenarioId` / `tenantId`)
- `src/harness/phase9/ports.ts` — `EvidenceResolver` enforces
  `tenantId`; `SignatureAuthority` requires
  `owner!=approver && issuer!=approver`
- `src/harness/phase9/adapters/staging-evidence-source.ts` —
  `StagingEvidenceSource.verifyIntegrity` + `InMemoryStagingEvidenceSource`
- `src/harness/phase9/staging-evidence.spec.ts` — proves tampered checksums
  and missing scenarioIds are excluded
- `src/test/certification/tenant-isolation.spec.ts`,
  `src/test/certification/cross-tenant-negative.spec.ts`,
  `src/test/certification/phase8-tenant-isolation.spec.ts`
- `src/harness/phase7/contracts.ts` / `runners.ts` — adversarial / abuse /
  unsafe-action suites
- `memory-bank-arc/harness/harness-threat-model.md` — threat model

## 5. Gate criterion unlocked

§10 Phase 9 exit gate: "CI/CD blocks on missing/failed evidence", and the
Security approval leg of the §15 DoD. This sign-off also closes the
known gap recorded in `harness-capability-inventory.yaml` for EL-011
(Security Harness): "External Security sign-off not yet recorded".

## 6. Status

APPROVED 2026-08-03.
