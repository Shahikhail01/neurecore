# Phase 10 — SuperAdmin Harness Control Center Runbook

**Owner:** Platform Product (A) · Admin FE + Backend (R) · Security, Compliance, UX (C)
**Depends on:** Phases 1–9 stable APIs and governance
**Source plan:** `neurecore/memory-bank-arc/comms/harness-elementsv1.md` §10 Phase 10, §12 boundaries, §15 DoD

## Purpose

Operate the Phase 10 control center: catalog/status dashboard, run launcher,
evidence/replay viewer, policy/rubric/prompt/dataset management, approvals,
certification & waiver management, and audit trail. This runbook covers the
incidents the operator may face.

## Surfaces

- API: `GET/POST /api/v1/harness-control/*` under role `SUPER_ADMIN`
- UI: `/harness-control` (admin app, sidebar group `control`)
- DB tables: `harness_run_policies`, `harness_runs`, `harness_evidence`,
  `harness_change_versions`, `harness_waivers`, `harness_certificates`,
  `harness_audit_events`, `harness_replay_bundles`, `harness_replay_executions`
- Triggers: `harness_evidence_immutable`, `harness_audit_immutable`
  (reject UPDATE/DELETE on those tables; admin cannot rewrite history)

## Forbidden actions (mirror §12)

A control-center operator MUST NOT:

1. Edit or delete evidence or audit events (DB trigger raises `immutable harness
   record cannot be updated or deleted`).
2. Flip a failed run/certificate to passed (no `PATCH /api/v1/harness-control/runs/:id/outcome`).
3. Read another tenant's evidence (returns `NotFoundException` to mask existence).
4. Launch a destructive PRODUCTION run (service rejects even with an approved
   `HarnessRunPolicy` that allows production + destructive).
5. Self-approve a run, waiver, change, or revoke. Enforced at the service layer.
6. Hard-delete certifications/audit/holds. Revoke-only path exists.
7. Execute a replay bundle with `externalSideEffects = true` or
   `environment = PRODUCTION` (side-effect firewall).

If a tester or admin needs to bypass any of the above, the standard
break-glass procedure in `runbooks/break-glass.md` applies: a second approver
and a time-bound ticket. **This runbook does not authorize unilateral bypass.**

## Common incidents

### Stuck run

**Symptom:** run stuck in `REQUESTED`, `APPROVED`, or `RUNNING`.
**Action:**

1. `GET /api/v1/harness-control/runs` and locate `id`.
2. `POST /api/v1/harness-control/runs/:id/cancel` (idempotent; service rejects
   if the run is already in a terminal state).
3. Verify the audit event `harness.run.cancel` was written.
4. If the run was tenant-scoped, notify the tenant owner.

### Evidence checksum mismatch

**Symptom:** integrity counter rises; `GET /api/v1/harness-control/audit/verify`
returns `{ ok: false, brokenAt: <eventId> }`.
**Action:**

1. Capture the broken event id, actor, and timestamp.
2. Quarantine the platform: disable replay execution
   (`harness.replay.bundle.create` keeps working; `executeReplay` will fail).
3. Page Security and Compliance.
4. Do **not** modify `harness_audit_events` or `harness_evidence` rows;
   the DB trigger will reject any UPDATE/DELETE anyway. The right action is to
   re-derive state from sources of truth (worker logs, outbox) and write a
   follow-up audit event explaining the discrepancy.

### Replay with external side effects

**Symptom:** an operator attempted `POST /api/v1/harness-control/replay/:id/execute`
and the API returned `403 side-effect firewall`.
**Action:** This is the correct behavior. Do not bypass. If the bundle was
incorrectly flagged, fix the bundle in source (not via API) and re-create.

### Waiver expired

**Symptom:** waiver with `state = ACTIVE` and `expiresAt < now`.
**Action:** the next `approveWaiver` will reject; the existing waiver remains
active until manual revocation. Operators can either:

- `POST /api/v1/harness-control/waivers/:id/revoke` with reason; or
- leave alone and require a new waiver (recommended).

### Cross-tenant evidence query

**Symptom:** tenant user reports an evidence 404. Operator suspects mis-routing.
**Action:** `GET /api/v1/harness-control/evidence/:id` as SUPER_ADMIN returns the
record; as a tenant actor it returns 404 if `actor.tenantId` mismatches. This is
intentional — we never confirm existence across tenants. If a tenant needs the
evidence, file an approval request and re-run under their tenant context.

## Break-glass

This control center does not implement an in-app break-glass. If a destructive
bypass is necessary, follow `runbooks/break-glass.md` (Security + Compliance +
independent approver). Any unilateral edit is detected by:

- audit chain verifier (`/api/v1/harness-control/audit/verify`)
- DB triggers on `harness_evidence` and `harness_audit_events`

## Operational readiness checklist (per §15 DoD)

- [x] Canonical owner (Platform Product) + RACI recorded in `harness-elementsv1.md` §13.
- [x] Runtime-validated Zod contracts (`backend/src/harness/phase10/contracts.ts`).
- [x] Conformance spec asserting forbidden actions and audit chain integrity
      (`backend/src/harness/phase10/conformance.spec.ts`).
- [x] Tenant isolation: cross-tenant evidence returns 404.
- [x] Append-only evidence/audit enforced by DB trigger.
- [x] Deterministic recomputation of audit chain.
- [ ] Independent Security, UX, and Operational Readiness sign-offs recorded
      in `neurecore/memory-bank-arc/audits/phase10-control-center-pre-audit.md`.
- [ ] CI lane consumes `pnpm certify:phase10` and blocks on failure.
- [ ] Restore and reviewer-timeout drills executed.

## CI / certify command

```bash
pnpm --filter backend exec tsc --noEmit
pnpm --filter backend lint --quiet
pnpm --filter backend jest --config jest.config.js --runInBand src/harness/phase10
pnpm certify:phase10
```
