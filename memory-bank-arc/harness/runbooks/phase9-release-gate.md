# Phase 9 Release-Gate Runbook

**Document ID:** NC-HARNESS-RUNBOOK-PHASE9
**Version:** 1.0
**Status:** APPROVED 2026-08-03
**environmentClass:** STAGING

---

## 1. Purpose

This runbook describes the **procedure** for invoking the Phase 9
Release Gates and Capability Certification element under
**STAGING-class evidence**. It is the operator reference for the six
external sign-offs recorded in
`memory-bank-arc/harness/adrs/ADR-006..ADR-011.md`:

- ADR-006 — Release Engineering sign-off (release-gate authority)
- ADR-007 — Security sign-off (isolation / adversarial / abuse /
  unsafe-action)
- ADR-008 — Compliance sign-off (retention / erasure / legal-hold /
  jurisdiction)
- ADR-009 — SRE / Platform sign-off (SLO / error-budget / STAGING
  capacity)
- ADR-010 — Capability Owner attestation (each `CAP-XXX` is
  production-ready)
- ADR-011 — Independent Reviewer acceptance

The harness source for this runbook is
`backend/src/harness/phase9/` (specifically
`src/harness/phase9/run-phase9-certification.ts`,
`src/harness/phase9/runners.ts`,
`src/harness/phase9/ci-lane.ts`,
`src/harness/phase9/ports.ts`,
`src/harness/phase9/contracts.ts`,
`src/harness/phase9/adapters/staging-evidence-source.ts`,
`src/harness/phase9/adapters/production-adapter-registry.ts`).

---

## 2. Prerequisites

| Prerequisite | Where |
|---|---|
| Six external ADRs (ADR-006..ADR-011) recorded | `memory-bank-arc/harness/adrs/` |
| Phase 7 / Phase 8 conformance green | `src/harness/phase7/`, `src/harness/phase8/` |
| 105-scenario G9 matrix runs against STAGING | `src/test/certification/certification-runner.ts` |
| `EvidenceStore` populated by the G9 STAGING run | `src/harness/evidence/index.ts` |
| Production adapter files (optional) | `/etc/neurecore/phase9/{capabilities,signers,waivers,rollbacks}.json` |
| Phase 9 release-gate runbook (this file) | `memory-bank-arc/harness/runbooks/phase9-release-gate.md` |
| Approved SLO policy (STAGING) | `memory-bank-arc/harness/harness-slo-policy.yaml` |
| Approved Risk Tier mapping per `CAP-XXX` | `memory-bank-arc/harness/harness-capability-inventory.yaml` |

---

## 3. environmentClass matrix

| environmentClass | Meaning | Adapter resolution | Authoritative for release? |
|---|---|---|---|
| `SIMULATED` | In-memory ports, no real infra | In-memory only | **NO** (fail-closed in `weeklySoak`) |
| `LOCAL` | Local node only | In-memory ports | **NO** (caveat on every verdict) |
| `CI` | CI lane (GitHub Actions) | In-memory + scenario executor | **NO** (report-only) |
| `STAGING` | Real STAGING infra | `registerPhase9ProductionAdapters` (production-backed) + `StagingEvidenceSource` | **YES** for STAGING promotion; **NO** for PRODUCTION |
| `PRODUCTION_PROBE` | Read-only PROBE of production | Production adapters, read-only | **NO** by itself |
| `PRODUCTION` | Full production | Production adapters, full read+write | **YES** (separate ADR) |

The harness refuses to authorize release under `SIMULATED` /
`LOCAL` for the `weeklySoak` lane (see
`src/harness/phase9/ci-lane.ts::Phase9ReleaseGate.weeklySoak`).

---

## 4. Step-by-step procedure

The procedure for invoking the Phase 9 release-gate under STAGING-class
evidence is:

1. **Verify prerequisites** (six ADRs, SLO policy, Risk Tier mapping,
   Phase 7 / Phase 8 conformance green).
2. **Run the 105-scenario G9 matrix against STAGING** using
   `certification-runner.ts` (`pnpm certify:phase9`). The
   `CertificationRunner` populates the `EvidenceStore` with finalized
   runIds and evidence envelopes for the STAGING run.
3. **Set `PHASE9_EVIDENCE_SOURCE=staging`**. The
   `run-phase9-certification.ts` runner will load the STAGING adapters
   via `loadStagingAdapters()` (see
   `src/harness/phase9/adapters/production-adapter-registry.ts`) and
   wire `StagingEvidenceSource` as the evidence source.
4. **Set `PHASE9_STAGING_MODE=1`** to register the staging adapters in
   the standalone runner.
5. **Invoke `pnpm certify:phase9:staging:all`** (or
   `pnpm certify:phase9:release-gate` for the standalone runner only).
6. **Inspect the verdict**:
   - `verdict: PASSED` — release-gate authorizes STAGING promotion.
   - `verdict: BLOCKED` / `INSUFFICIENT_EVIDENCE` — release-gate
     refuses; consult §10 troubleshooting.
7. **Capture the verdict + evidence** into
   `src/harness/phase9/reports/phase9-CAP-XXX-{certificate,summary,
   integrity,checksum}.json` for archival.

---

## 5. Evidence resolver inputs

The `EvidenceResolver` (see `src/harness/phase9/ports.ts`) consumes:

- `EvidenceStore` (`src/harness/evidence/index.ts`) — append-only
  evidence plane; `verifyIntegrity` checks checksum against stored
  content; tampered evidence is rejected.
- `StagingEvidenceSource` (`src/harness/phase9/adapters/staging-evidence-source.ts`)
  — returns finalized runIds + evidence envelopes for the STAGING
  run, classified with `environmentClass=STAGING`. Envelopes whose
  checksum does not match are excluded; envelopes with missing
  `scenarioId` are excluded by the strict `EvidenceEnvelopeSchema`
  parse.

---

## 6. Waiver workflow

Waivers are issued through `Phase9ReleaseWaiverSchema`:

- Owner and approver must differ (separation of duties).
- Issuer and approver must differ (separation of duties).
- `expiresAt` must be strictly after `issuedAt`.
- Active waivers are recorded in the `WaiversLedger` (in-memory
  fallback or file-backed at `/etc/neurecore/phase9/waivers.json`).
- Revocation is recorded with `revokedAt` + `revokedReason`; the
  ledger refuses to re-revoke.
- Expired or revoked waivers are treated as fail-closed by
  `DefaultVerdictAuthority` (verdict becomes
  `INSUFFICIENT_EVIDENCE` or `BLOCKED`).

The flow is:

1. Capability owner issues a waiver via the ledger (with compensating
   control, scope, and `expiresAt`).
2. Independent approver (different person) signs the waiver.
3. The release-gate consumes the waiver; if expired or revoked, the
   gate fails closed.

---

## 7. Rollback-drill requirement

| Risk tier | Rollback drill required? |
|---|---|
| CRITICAL | YES — `RollbackDrillRequirement.status === 'PASSED'` required |
| HIGH | YES — same |
| MEDIUM | NO |
| LOW | NO |

`InMemoryRollbackRegistry.lastSuccessfulDrillAt` returns the latest
`PASSED` drill timestamp for a capability. `DefaultVerdictAuthority`
fails closed if a CRITICAL or HIGH capability has no PASSED drill.
Drill records are stored in
`/etc/neurecore/phase9/rollbacks.json` (or in-memory fallback).

---

## 8. Signature requirements per riskTier

Per `REQUIRED_SIGNATURES_BY_TIER` (see
`src/harness/contracts/index.ts` and ADR-004):

| Risk tier | Required signer roles |
|---|---|
| CRITICAL | `EVALUATOR`, `QA_LEAD`, `DOMAIN_OWNER`, `SECURITY`, `COMPLIANCE`, `ARCHITECTURE` |
| HIGH | `EVALUATOR`, `QA_LEAD`, `DOMAIN_OWNER` |
| MEDIUM | `EVALUATOR`, `QA_LEAD` |
| LOW | `EVALUATOR` |

Signatures are HMAC-SHA256 bound to the signer key (see
`SupportSignatureAuthority.issueSignature` /
`verifySignature`). The `SIGNATURE_AUTHORITY` production adapter
reads signer keys from `PHASE9_SIGNER_<role>_KEY` env vars or
`/etc/neurecore/phase9/signers.json` (fallback to in-memory).

---

## 9. Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Verdict `INSUFFICIENT_EVIDENCE`, reason `missing signature for role ...` | One or more required signatures are missing for the risk tier | Re-issue signatures for the missing role via `SIGNATURE_AUTHORITY`. |
| Verdict `INSUFFICIENT_EVIDENCE`, reason `rollback drill status=...` | Rollback drill is not `PASSED` (or is missing) for CRITICAL/HIGH | Run a new rollback drill and record via `ROLLBACK_REGISTRY`. |
| Verdict `INSUFFICIENT_EVIDENCE`, reason `waiver ... expired` | Waiver has passed `expiresAt` | Re-issue the waiver with a new `expiresAt` (or remove). |
| Verdict `INSUFFICIENT_EVIDENCE`, reason `waiver ... revoked` | Waiver has been revoked | Do not re-issue; the underlying issue must be fixed. |
| Verdict `INSUFFICIENT_EVIDENCE`, reason `runId ... not finalized` | G9 STAGING run did not finalize | Re-run `pnpm certify:phase9` and confirm `gateG9.releaseApproved=true`. |
| Verdict `BLOCKED`, reason `simulated evidence present in production-targeted environment` | PRODUCTION_PROBE/PRODUCTION targeted environment; evidence is simulated | Switch to a real evidence source (e.g. `StagingEvidenceSource` for STAGING). |
| `weeklySoak` lane produces `simulatedOnly=true` and refuses to authorize | `environmentClass=SIMULATED` | Switch `PHASE9_ENV=STAGING` and re-run. |
| `productionAdapterStatus` shows `UNREGISTERED` for any adapter | The production adapter is not registered | Call `registerPhase9ProductionAdapters(registry)` or set the env-file paths under `/etc/neurecore/phase9/`. |

---

## 10. Escalation

| Severity | Contact | Channel |
|---|---|---|
| Verdict `BLOCKED` for > 24h on STAGING | Release Engineering Lead | `release-engineering@neurecore.com` |
| Evidence integrity failure (tampered checksum) | Security Lead | `security@neurecore.com` |
| Compliance / legal-hold concern | Compliance / Governance Lead | `compliance@neurecore.com` |
| SLO breach or capacity shortage on STAGING | SRE / Platform Lead | `sre-platform@neurecore.com` |
| Capability owner attestation dispute | Capability Owner + Architecture | `architecture@neurecore.com` |
| Independent reviewer rejection | Independent Reviewer | (recorded in ADR-011) |

Escalation is **always** recorded as an ADR amendment or a new ADR.
Verbal escalation is not authoritative; only recorded ADRs unlock the
gate.
