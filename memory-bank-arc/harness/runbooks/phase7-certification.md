# NeureCore Harness - Phase 7 Operational Runbook

**Document ID:** NC-HARNESS-PHASE7-RUNBOOK-001
**Version:** 1.0
**Status:** PHASE_7_IMPLEMENTED
**Audience:** Security, Compliance, Release Engineering, on-call SRE, Architecture
**Decision Owner:** Security + Compliance
**Last Reviewed:** 2026-08-03

---

## 1. Purpose

Phase 7 covers Security (EL-011), Compliance (EL-012), Tenant Isolation (EL-018), and Human Review (EL-021). This runbook tells operators how to:

- Run the Phase 7 conformance suite and read its output.
- Execute the Phase 7 coordinator and produce the machine-readable report + summary + checksum files.
- Recognize, recover from, and escalate the most common Phase 7 failure modes.
- Know which adapters are still in-process (no production enforcement) and what to do about it.

## 2. Scope

This runbook covers the modules under `backend/src/harness/phase7/` and the supporting `phase7/certification` capabilities listed in `memory-bank-arc/harness/harness-capability-inventory.yaml` (`phase7Progress20260803` block).

It does **not** cover:

- Production Security or Compliance sign-off (still external blockers; see §10).
- Performance / load (Phase 8) or release gates (Phase 9).

## 3. Scripts

| Script | What it does | Notes |
|--------|--------------|-------|
| `pnpm certify:phase7` | Runs the Phase 7 conformance suite under `src/harness/phase7/`. | Local + CI lane. Exit code = test count. |
| `pnpm certify:phase7:report [outDir]` | Runs the Phase 7 coordinator end-to-end and writes `phase7-<runner>-<runId>.json`, `*-summary.json`, and `*-checksum.txt` to `outDir` (default `src/test/certification/reports/phase7`). | Use this to feed CI dashboards. |
| `pnpm exec tsc -p tsconfig.phase7.json --noEmit` | Focused typecheck for Phase 7. | CI lane gate. |
| `pnpm exec eslint "src/harness/phase7/**/*.ts" --max-warnings=0` | Focused lint for Phase 7. | CI lane gate. |

## 4. Output Layout

The `certify:phase7:report` script writes three artifacts per run:

```
outDir/
  phase7-phase7-coordinator-<runId>.json          # full Phase7RunnerReport
  phase7-phase7-coordinator-<runId>-summary.json  # flattened G9-style summary
  phase7-phase7-coordinator-<runId>-checksum.txt  # reportChecksum + jsonChecksum + summaryChecksum
```

The `reportChecksum` is the SHA-256 of `(counters, caseResults, status, evidenceRefs)`. `jsonChecksum` and `summaryChecksum` cover the on-disk JSON files so tampering can be detected by the CI gate.

## 5. Failure Modes and Recovery

### 5.1 Runner timeout

- **Symptom:** `RunnerTimeoutError` from `runWithGuards`, or a runner that never completes within its lane timeout.
- **Cause:** A port that hangs (e.g. an in-process double simulating a slow dependency).
- **Recovery:**
  1. Capture the offending `runId` from the report's `evidenceEnvelopes[].correlationIds`.
  2. Re-run the runner in isolation: `pnpm certify:phase7 --testPathPattern=phase7.conformance.spec.ts -t "<runner name>"`.
  3. If the port is a production adapter, page the adapter owner; do not retry with a longer timeout until the root cause is identified (avoid masking a leak).

### 5.2 Critical security or isolation failure

- **Symptom:** `report.status === 'BLOCK'`, `report.outcome === 'FAILED'`, `report.counters.criticalFailures > 0`.
- **Cause:** A cross-tenant attempt was allowed, an adversarial payload passed, an unsafe action bypassed approval, or a HITL packet was approved without independence.
- **Recovery:**
  1. Treat this as a security incident. Open an incident ticket and notify Security within 15 minutes.
  2. Capture the full JSON report (`report.json`), the affected `caseResults` rows, and the `evidenceRefs`.
  3. Do **not** retry the runner until the offending port is patched; a green rerun without a fix indicates evidence tampering and must be escalated.
  4. Cross-reference the `caseId` with the Phase 7 control matrix (`NC7-C01..NC7-C06`, `NC7-ISO-MATRIX`, `NC7-HITL-INDEPENDENCE`, `NC7-HITL-DENY`).

### 5.3 HITL SLA escalation fired

- **Symptom:** Report includes an `EscalationEvent` with `reason === 'SLA_TIMEOUT'`.
- **Cause:** `now` exceeded the assignment's `slaDeadline`. This is expected when reviewing a stale queue and is **not** a failure.
- **Recovery:** None required for the harness itself. The escalation event is persisted in evidence. Operator may follow up via the regular escalation role (default: `CHIEF_OF_STAFF`).

### 5.4 Cleanup failure

- **Symptom:** `report.cleanupResult.success === false` and/or `cleanupResult.orphanedResources.length > 0`.
- **Cause:** `InMemoryCleanupPort` was constructed with a forced failure map, OR the runner was cancelled mid-loop.
- **Recovery:**
  1. Identify the orphan IDs from `cleanupResult.orphanedResources`.
  2. If a production cleanup adapter is registered, page the adapter owner and follow `runbooks/cleanup-failure.md`.
  3. Re-run with `cleanup: false` to isolate cleanup from runner logic. Re-enable once the adapter is healthy.

### 5.5 Unsupported durable store

- **Symptom:** All `DurableReviewQueueStore` calls reject with `PHASE7_DURABLE_STORE_UNSUPPORTED`.
- **Cause:** No production adapter has been registered; `UnsupportedDurableStore` is the default. This is the expected state until a Phase 8+ rollout.
- **Recovery:**
  1. The Phase 7 conformance suite uses `InMemoryDurableReviewQueueStore`, so unit tests will still pass.
  2. Operators must NOT treat a green conformance run as a claim that review queues persist across restarts in production. Until a production adapter is registered, the durable store guarantees are limited to the in-process harness.

### 5.6 Inconclusive verdict

- **Symptom:** `report.status === 'INCONCLUSIVE'`, `outcome === 'BLOCKED'`, `criticalFailures === 0`.
- **Cause:** At least one non-critical failure or insufficient evidence.
- **Recovery:** Inspect `caseResults` for the `observed !== expected` rows; fix the failing port or payload and rerun.

## 6. CI Lane Integration

The `Phase7LaneSelector` (`src/harness/phase7/ci-lane.ts`) maps `src/harness/phase7/` paths to the lane policy:

| Lane | When | Blocking? |
|------|------|-----------|
| DEVELOPER | always | no |
| PR_FAST | any `src/harness/phase7/**` change | yes |
| NIGHTLY | always | no |
| RELEASE | when `riskTier === 'CRITICAL'` | yes |
| PR_AI | when `kind === 'PROMPT' \|\| 'DATASET'` | yes |

The `Phase7Gate` evaluates blocking lanes; failures route through the standard release gate. A green `Phase7Gate` verdict means the lane produced a `PASSED` outcome with zero critical failures and was finalized.

## 7. Production Adapter Registration

Until a production adapter is registered for the following Phase 7 ports, the conformance suite runs against in-memory fail-closed doubles only:

- `ISOLATION_PORT`
- `ADVERSARIAL_PORT`
- `ABUSE_PORT`
- `UNSAFE_ACTION_PORT`
- `COMPLIANCE_EVIDENCE_PORT`
- `REVIEW_PORT`
- `DURABLE_REVIEW_QUEUE_STORE`
- `CLEANUP_PORT`

To register an adapter, use `InMemoryPhase7AdapterRegistry` (or replace with a real registry) and call `register(<ADAPTER>, <impl>)`. The registration must be audited and reviewed by Architecture + Security + Compliance.

## 8. Evidence, Retention, and Classification

- All envelopes use the canonical Phase 2 `EvidenceEnvelopeSchema` (`RUN_TENANT` isolation enforced at the harness sink level; envelopes carry the runner's `tenantId` and never cross tenants).
- Default classifications: isolation runner emits `INTERNAL/MEDIUM_TERM`; security/abuse/unsafe/HITL emit `CONFIDENTIAL/LONG_TERM`; adversarial emits `CONFIDENTIAL/LONG_TERM` with `APPLIED` redaction.
- Evidence retention is governed by `harness-data-governance.md` and the compliance control matrix. Phase 7 does NOT bypass retention or legal hold.

## 9. Limitations and Known Gaps

See `memory-bank-arc/harness/PHASE7-COMPLETION.md` §10 for the explicit list of unmet §10 / §15 criteria and the external Security + Compliance approval that blocks full sign-off.

## 10. Related Documents

- `memory-bank-arc/comms/harness-elementsv1.md` §10 Phase 7 and §15 DoD
- `memory-bank-arc/harness/harness-capability-inventory.yaml` (EL-011, EL-012, EL-018, EL-021 + `phase7Progress20260803`)
- `memory-bank-arc/harness/harness-control-matrix.yaml` (`phase7Controls`)
- `memory-bank-arc/harness/harness-migration-map.md` §4 (Phase 7)
- `memory-bank-arc/harness/runbooks/cleanup-failure.md`
- `memory-bank-arc/harness/runbooks/replay-incident.md`
- `backend/src/harness/phase7/` (contracts, ports, runners, ci-lane, report-writer)
