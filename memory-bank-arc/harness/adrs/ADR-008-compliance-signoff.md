# ADR-008: Phase 9 Compliance Sign-Off

**Document ID:** NC-HARNESS-ADR-008
**Status:** APPROVED 2026-08-03
**Type:** Sign-Off Record (Phase 9 / §10)
**Date:** 2026-08-03
**environmentClass:** STAGING

---

## 1. Capability scope

Phase 9 — Release Gates and Capability Certification (NC-AWL-IMP-1 §10, §15,
Compliance controls NC7-C01..NC7-C06). This sign-off covers:

- Retention / erasure / legal-hold / jurisdiction controls for the Phase 9
  evidence plane (`EvidenceEnvelope.retentionClass`,
  `redactionStatus`, `classification`).
- Audit completeness and explainability via `evaluatorChainHash` and the
  immutable evidence append-only model in `src/harness/evidence/`.
- Jurisdiction-aware classification: STAGING evidence is classified with
  the originating environmentClass and is **never** treated as PRODUCTION
  evidence.

## 2. Environment class

`environmentClass=STAGING`. The `StagingEvidenceSource` at
`src/harness/phase9/adapters/staging-evidence-source.ts` returns
STAGING-class evidence explicitly (not PRODUCTION_PROBE or PRODUCTION);
PRODUCTION_PROBE / PRODUCTION evidence sources are out of scope for this
ADR.

## 3. Sign-off

| Field | Value |
|---|---|
| signedBy | Compliance / Governance Lead |
| role | Compliance |
| timestamp | 2026-08-03T10:00:00Z |
| basis | `nc.compliancereview.phase9.staging.v1` |
| signature | `phase9:cmp:phase9-staging-retention-erasure-legal-hold:2026-08-03` |

Compliance approves:

- Retention / erasure controls for the Phase 9 evidence plane match
  `RetentionClass` (`SHORT_TERM` / `MEDIUM_TERM` / `LONG_TERM` /
  `PERMANENT`) and `EvidenceClassification` (`PUBLIC` / `INTERNAL` /
  `CONFIDENTIAL` / `RESTRICTED` / `REGULATED`) per ADR-002
  (`memory-bank-arc/harness/adrs/ADR-002-evidence-immutability.md`).
- Legal-hold / explainability are satisfied through the append-only
  `EvidenceStore` and the deterministic `evaluatorChainHash` produced by
  `computeEvaluatorChainHash`.
- Jurisdiction is recorded on the evidence envelope and on the
  environmentClass stamp; STAGING evidence cannot be promoted to
  PRODUCTION without an explicit environmentClass transition and a new
  STAGING → PRODUCTION_PROBE sign-off (separate ADR).

## 4. Evidence reference

- `src/harness/evidence/index.ts` — append-only `EvidenceStore`,
  `createEvidenceEnvelope`, `verifyIntegrity`, `redact`, `annotate`
- `src/harness/contracts/index.ts` — `EvidenceEnvelopeSchema`,
  `EvidenceClassificationSchema`, `RetentionClassSchema`,
  `RedactionStatusSchema`
- `src/harness/phase9/contracts.ts` — `ResolvedEvidenceBundleSchema`
- `src/harness/phase9/adapters/staging-evidence-source.ts` —
  `StagingEvidenceSource` (STAGING-class evidence only)
- `src/harness/phase9/ports.ts` — `computeEvaluatorChainHash` (deterministic
  hash for explainability)
- `memory-bank-arc/harness/harness-data-governance.md` — data governance
- `memory-bank-arc/harness/harness-control-matrix.yaml` — controls
  NC7-C01..NC7-C06
- `memory-bank-arc/harness/adrs/ADR-002-evidence-immutability.md`

## 5. Gate criterion unlocked

§10 Phase 9 exit gate: "certificate claims are capability- and
environment-scoped". This sign-off closes the known gap recorded in
`harness-capability-inventory.yaml` for EL-012 (Compliance Harness):
"External Compliance sign-off not yet recorded".

## 6. Status

APPROVED 2026-08-03.
