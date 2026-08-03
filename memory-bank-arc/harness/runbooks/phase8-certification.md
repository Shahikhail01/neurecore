# Phase 8 Operational Runbook — Performance and Load

**Document ID:** NC-HARNESS-RUNBOOK-PHASE8
**Version:** 1.0
**Status:** OPERATIONAL — SIMULATED ONLY
**Date:** 2026-08-03
**Owner:** SRE / Platform (per RACI in `harness-capability-inventory.yaml`)

> ⚠️ **Honest framing:** This runbook operates against in-memory simulated ports.
> No Phase 8 capacity or SRE/Platform approval has been recorded. The release
> capacity gate (`backend/src/harness/phase8/ci-lane.ts`) **fails closed** when
> `environmentClass != STAGING|PRODUCTION_PROBE|PRODUCTION` OR when the supplied
> SLO policy lacks `approvedBy/approvedAt/approvedEnvironment`. This is enforced
> regardless of report status.

---

## 1. Scope

This runbook covers the Phase 8 Performance and Load harness element
(EL-013 + EL-014) defined in `memory-bank-arc/comms/harness-elementsv1.md`
§10 Phase 8 and §15 DoD.

Out of scope: production-load generation, SLO approval, SRE/Platform
capacity approval. Those require separate external work tracked in
`memory-bank-arc/harness/PHASE8-COMPLETION.md` "Remaining blockers".

---

## 2. Entrypoints

| Action | Command | Output |
|--------|---------|--------|
| Run all Phase 8 conformance specs | `pnpm certify:phase8` | jest in-band report |
| Run conformance + emit machine-readable artifacts | `pnpm certify:phase8:all` | JSON / summary / capacity / checksum under `backend/src/test/certification/reports/phase8/` |
| Emit capacity report only | `pnpm certify:phase8:report` | `<runId>-capacity.json` |
| Generate a fresh runId | `node -e "console.log(require('crypto').randomUUID())"` | uuid |

All artifacts are written under `backend/src/test/certification/reports/phase8/`,
which is gitignored. No runtime noise is committed.

---

## 3. Pre-flight Checks

Before invoking any of the commands above:

1. **Confirm SIMULATED environment intent.** Default is `SIMULATED`. Any
   call that sets `environmentClass: 'STAGING' | 'PRODUCTION_PROBE' | 'PRODUCTION'`
   must be backed by a registered SLO policy and SRE/Platform approval; otherwise
   the gate will block release promotion.
2. **Verify Phase 7 regression.** Run `pnpm certify:phase7` first; Phase 8
   isolation verdicts rely on Phase 7 isolation runners being green.
3. **Inspect `tenantIds`.** The coordinator requires a non-empty list with the
   `primaryTenantId` present (or omitted, defaulting to `ctx.tenantId`).
4. **Confirm no production-like staging adapter is required.** By default the
   registry stamps every adapter `UNSUPPORTED`. If you need real measurements,
   register an adapter via `InMemoryPhase8AdapterRegistry.register()` BEFORE
   invoking the coordinator; otherwise the capacity report will be honest about
   its simulated provenance.

---

## 4. Run Procedure

### 4.1 Lightweight PR smoke (in-process)

For PR smoke, run the conformance suite only:

```bash
pnpm certify:phase8
```

Expected outcome: `Tests: 73 passed, 73 total`. Any failure means the
harness regression is broken and must be fixed before merge.

### 4.2 Weekly soak (simulated)

The Phase 8 SOAK profile is run as part of the default profile sweep. To run
weekly soak in isolation:

```bash
pnpm certify:phase8:all
# filter the capacity report to the SOAK profile and inspect soakWindows
jq '.profiles[] | select(.profileId == "soak")' \
  backend/src/test/certification/reports/phase8/*-capacity.json
```

A weekly soak run MUST NOT be promoted as production capacity. The capacity
report's `verdict` field is `SIMULATED_NO_PRODUCTION_CLAIM` and the
`environmentClass` is `SIMULATED`.

### 4.3 Release candidate (real environmentClass only)

```bash
PHASE8_TENANT_ID=<real-tenant-uuid> PHASE8_ENVIRONMENT=STAGING \
PHASE8_SLO_POLICY=<approved-policy-json> \
pnpm certify:phase8:report
```

Then evaluate the gate:

```ts
import { evaluateReleaseCapacityGate } from './ci-lane';
const verdict = evaluateReleaseCapacityGate({
  report,
  policy: approvedSloPolicy,
  releaseCandidate: true,
  weeklySoakDue: false,
});
if (!verdict.passed) {
  throw new Error(`Release blocked: ${verdict.reasons.join('; ')}`);
}
```

The gate currently blocks because no approved SLO policy has been registered
and no staging environmentClass evidence has been produced.

---

## 5. Failure Modes

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `FailingCleanupAdapter` reports `cleaned: false` | Cleanup port failure injection OR real cleanup outage | Inspect cleanup logs; treat as run failure and orphan-resource alert (per §5.2 "Cleanup failure is a run failure") |
| `RunnerTimeoutError` during request execution | Per-request timeout too low OR simulated port stalled | Increase `perRequestTimeoutMs` or investigate port saturation |
| `RunnerCancelledError` on profile | `AbortSignal` fired | Inspect cancellation source (user cancel, parent cancel, circuit open) |
| `recoveryVerdict: INSUFFICIENT_EVIDENCE` | No baseline registered for `BASELINE_WARM` | Ensure `BASELINE_WARM` profile is in the profile list; or supply explicit baseline |
| `sloEvaluation.status: UNAPPROVED` | Supplied SLO policy missing `approvedBy/approvedAt/approvedEnvironment` | Register an approved SLO policy via Phase 0 RACI; do not bypass |
| `sloEvaluation.status: UNSUPPORTED_ENVIRONMENT` | Report environmentClass is `SIMULATED` / `LOCAL` / `CI` but policy is approved for `STAGING` | Acquire staging evidence; do not relabel `SIMULATED` runs as production |
| `releaseCapacityGate.passed: false` | Missing SLO policy OR SIMULATED environmentClass OR cleanup failure | See failure-mode reasons; do not waive |

---

## 6. Evidence Retention

Phase 8 evidence is written under
`backend/src/test/certification/reports/phase8/`. The directory is gitignored.

For audit retention, copy the artifacts to the project evidence store
under a `phase8/<date>/<runId>/` prefix. The JSON file's `provenance`
field carries the structured run/scenario/producer path. The capacity report
`caveats` field lists the in-memory simulation caveats so a future
reviewer cannot misread the data as production.

---

## 7. Escalation

If a Phase 8 run produces a `BLOCK` outcome in `STAGING` or
`PRODUCTION_PROBE`:

1. Page on-call SRE (per `harness-data-governance.md` and the existing
   operational escalation matrix).
2. Open a Phase 8 incident ticket referencing the runId.
3. Attach the JSON + capacity + checksum artifacts; do not regenerate
   the artifacts from the SIMULATED lane.
4. Rollback procedure: see `runbooks/rollback.md` (Phase 0 baseline).

---

## 8. Anti-patterns to refuse

- ❌ Relabel `SIMULATED` runs as `STAGING` to bypass the gate.
- ❌ Add `approvedBy: 'someone'` to the SLO policy without the actual
  SRE/Platform sign-off in `PHASE8-COMPLETION.md`.
- ❌ Commit generated capacity reports (the directory is gitignored).
- ❌ Claim "production capacity" in dashboards until §10 exit gate is met.
- ❌ Use external SLO targets (SLO-011..SLO-018) without baselining.
