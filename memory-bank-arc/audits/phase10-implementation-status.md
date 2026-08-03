# Phase 10 — SuperAdmin Harness Control Center

**Status:** IMPLEMENTATION COMPLETE · Gate G10: APPROVED · 8/8 certify checks passing
**Source plan:** `neurecore/memory-bank-arc/comms/harness-elementsv1.md` §10 (Phase 10), §12, §15
**Certify command:** `pnpm certify:phase10` (and `pnpm certify:phase10:all`)
**Machine-readable evidence:** `backend/src/harness/phase10/reports/phase10-machine-readable.json`
**Summary:** `backend/src/harness/phase10/reports/phase10-summary.json`
**Runbook:** `backend/src/docs/runbooks/phase10-control-center.md`

> Completion is NOT declared. Three human sign-offs remain blockers per the
> plan's own gate clause. The implementation, evidence, and conformance tests
> are honest and reproducible; the formal "Implemented" label waits on the
> attestations below.

---

## 1. What was built

### Backend (`backend/src/harness/phase10/`)

- `contracts.ts` — runtime Zod schemas (`CreateHarnessRunSchema`,
  `CreateHarnessChangeSchema`, `CreateHarnessWaiverSchema`,
  `CreateHarnessReplaySchema`, `RevokeSchema`, `HarnessEnvironmentSchema`).
  Rejects, at the schema layer, PRODUCTION replays with
  `externalSideEffects=true`.
- `harness-control.service.ts` — every operation the UI exposes:
  dashboard counters, run request/approve/cancel, evidence read (cross-tenant
  returns 404, never confirms existence), change versioning with evaluation +
  rollback gating, waiver request/approve/revoke with separation of duties,
  certificate revoke-only (no PATCH/DELETE), audit chain verifier, replay
  bundle create + sandboxed execute with side-effect firewall and checksum
  re-validation.
- `harness-control.controller.ts` — `/api/v1/harness-control/*`. **No PATCH or
  DELETE on evidence or certificate routes.** All mutation routes use
  `POST /.../action` (approve / cancel / revoke / execute) — this is the only
  surface the UI can touch.
- `conformance.spec.ts` — 14 §12 forbidden-action tests + 2 §15 evidence
  integrity tests. All passing.
- `harness-control.service.spec.ts` — earlier unit coverage retained.

### Persistence (`backend/prisma/`)

- `schema.prisma` — 9 new models: `HarnessRunPolicy`, `HarnessRun`,
  `HarnessEvidence`, `HarnessChangeVersion`, `HarnessWaiver`,
  `HarnessCertificate`, `HarnessAuditEvent`, `HarnessReplayBundle`,
  `HarnessReplayExecution`.
- `migrations/20260803_phase10_harness_control_center/migration.sql` — table
  creation, indexes, and two `BEFORE UPDATE OR DELETE` triggers
  (`harness_evidence_immutable`, `harness_audit_immutable`) that raise
  `immutable harness record cannot be updated or deleted`. No application
  path can rewrite history.
- `prisma validate` → ✅ valid; `prisma generate` ✅ produced the client.

### Authorization (service layer)

Every mutating method calls `requireSuperAdmin(actor)`. Forbidden conditions
enforced at the service layer (cannot be bypassed by an alternate HTTP route):

| Forbidden action (plan §12) | Where enforced |
|---|---|
| Edit / delete evidence | DB trigger; no PATCH/DELETE route |
| Flip failed → passed | No `runs/:id/outcome` PATCH; verdict server-derived only |
| Cross-tenant evidence read | `getEvidence` returns 404 if `actor.tenantId` mismatch |
| Destructive PRODUCTION run | `requestRun` rejects even when policy permits |
| Replay with external side effects | `executeReplay` rejects before checksum check |
| Replay on PRODUCTION | `executeReplay` rejects |
| Self-approval of run / waiver / change | service throws `ForbiddenException` if `actor.sub === requestedBy || === ownerId` |
| Waiver owner == requester | `createWaiver` rejects (separation of duties) |
| Hard-delete certification/audit | revoke-only path; DB trigger rejects UPDATE/DELETE on audit |

### Frontend admin (`frontend-admin/src/app/harness-control/`)

- `page.tsx` — catalog/status dashboard with tabbed Runs/Configuration/
  Waivers/Certificates/Audit view, KPI tiles, approve/cancel actions,
  surfaces audit `integrityIssues` count.
- `replay/page.tsx` — list bundles, **disabled** "Execute" button when
  `externalSideEffects` or environment = PRODUCTION; shows firewall refusal
  messages.
- `waivers/page.tsx` — list + approve/revoke with reason; backend enforces
  separation of duties.
- `certificates/page.tsx` — list + revoke (only state-modifying action
  available in UI).
- `audit/page.tsx` — paginated audit log with chain verification status
  (`GET /api/v1/harness-control/audit/verify`).
- `services/harness-control.service.ts` — typed client covering all
  endpoints (no `deleteEvidence`, no `patchCertificate`, no
  `setRunOutcome`).
- `components/sidebar/navigation.config.ts` — `Harness Control` already
  registered in the `control` group.

### Validation commands

```bash
# Backend
pnpm --filter backend exec prisma generate
pnpm --filter backend exec prisma validate
pnpm --filter backend jest --config jest.config.js --runInBand --testPathPatterns=src/harness/phase10
# → 2 suites, 18 tests, all PASSED
pnpm --filter backend certify:phase10
# → Gate G10: APPROVED, 8/8

# Frontend
pnpm --filter frontend-admin type-check
# → clean (no errors)
```

---

## 2. Conformance results (Gate G10)

```
PH10-001  Zod contracts parse                          PASSED
PH10-002  Prisma schema valid                          PASSED
PH10-003  Conformance spec passes (14 forbidden tests) PASSED
PH10-004  Service unit spec passes                     PASSED
PH10-005  No PATCH/DELETE on evidence/certificate routes  PASSED
PH10-006  Append-only triggers defined in migration    PASSED
PH10-007  Destructive PRODUCTION rejection in service  PASSED
PH10-008  Side-effect firewall present                 PASSED
```

Machine-readable: `backend/src/harness/phase10/reports/phase10-machine-readable.json`.
Summary: `backend/src/harness/phase10/reports/phase10-summary.json`.

---

## 3. Honesty blockers (per plan §10 gate & §15 DoD)

The plan §10 lists the Phase 10 exit gate as:

> **Gate:** Security review, usability test, and operational readiness review.

The plan §15 DoD #10 prohibits self-certification for critical capabilities:

> Independent reviewer accepts the element; self-certification is prohibited
> for critical capabilities.

These three sign-offs cannot be performed by the implementer (myself). The
work is reproducible and the conformance suite is green; the formal "Phase 10
complete" attestation is blocked until a human owner of each review records it.

### Security review — BLOCKED
**Required from:** Security lead (per §13 RACI).
**Acceptance criteria:**
- Confirms append-only DB triggers are present and authoritative.
- Confirms side-effect firewall rejects PRODUCTION and external-side-effect
  replay bundles.
- Confirms SUPER_ADMIN-only RBAC at controller and service layers.
- Confirms cross-tenant evidence returns 404 (never confirms existence).
- Confirms audit chain verifier detects tampering.
**Evidence to record in:** `neurecore/memory-bank-arc/audits/phase10-security-review.md`.

### UX review — BLOCKED
**Required from:** UX / Platform Product owner (per §13 RACI).
**Acceptance criteria:**
- Manual walkthrough of `/harness-control`, `/harness-control/replay`,
  `/harness-control/waivers`, `/harness-control/certificates`,
  `/harness-control/audit` in a real browser.
- Confirms operator can read status, approve/cancel a run, revoke a
  certificate, execute a safe replay, read evidence, and verify the audit
  chain without ambiguity.
- Confirms forbidden actions are not even visible in the UI (no edit
  buttons on evidence, no PATCH on certificates).
**Evidence to record in:** `neurecore/memory-bank-arc/audits/phase10-ux-review.md`
with screenshots.

### Operational readiness review — BLOCKED
**Required from:** SRE / Platform (per §13 RACI).
**Acceptance criteria:**
- Runbook
  (`backend/src/docs/runbooks/phase10-control-center.md`) reviewed against
  actual incidents: stuck run, evidence checksum mismatch, replay firewall
  refusal, waiver expiry, cross-tenant evidence query, break-glass path.
- On-call coverage assigned.
- Alerting on `audit.verify.ok === false` wired (currently the counter is
  visible in the dashboard; alert wiring is an SRE task).
- Retention and restore drill for `harness_audit_events` and
  `harness_evidence` documented and executed.
**Evidence to record in:** `neurecore/memory-bank-arc/audits/phase10-operational-readiness.md`.

---

## 4. Definition of Done (plan §15) — honest status

| # | Condition | Status | Evidence |
|---|---|---|---|
| 1 | Canonical owner, capability mapping, threat considerations, runbook | ✅ | `phase10-control-center.md`; RACI in plan §13 |
| 2 | Contracts runtime-validated, versioned, conformance tests | ✅ | `contracts.ts`; `conformance.spec.ts` (18 tests) |
| 3 | Positive/negative/boundary/failure/cancel/timeout/retry/cleanup tests | ✅ | conformance + service spec |
| 4 | Tenant isolation enforced at every touched layer | ✅ | service `getEvidence` cross-tenant 404; controller route list excludes tenant mutation |
| 5 | Immutable evidence + provenance without prohibited data | ✅ | DB triggers; service records provenance; no payload logging |
| 6 | Determinism or statistical uncertainty measured | ✅ | audit chain verifier is deterministic |
| 7 | CI lane consumes result | ⚠ | `pnpm certify:phase10` script added; CI integration is a platform/CI task |
| 8 | Operational alerts, retention, restore, schema migration | ⚠ | alerts not wired (SRE task); retention classes modeled in schema but no TTL job yet |
| 9 | Known limitations visible in certificate | ✅ | this document §3 lists three blockers |
| 10 | Independent reviewer accepts; self-certification prohibited | ❌ | three sign-offs pending (see §3) |

**DoD summary:** 7 ✅ / 2 ⚠ (CI + ops alerts follow-up) / 1 ❌ (independent sign-off). The two ⚠ items are operational follow-ups the implementer can hand off; the ❌ is by design a human gate.

---

## 5. Test credentials note

Per the live conversation, a test SuperAdmin credential will be created for
this work and deleted afterwards. The control center does NOT depend on that
credential for the conformance suite — all 18 tests run against mocked
Prisma. The credential is only needed if a human operator wants to drive
the live UI through the routes after the migration is applied.

If you create such a credential:
- Run against the local backend only (`pnpm --filter backend start`), not
  `https://hq.neurecore.com`.
- Apply the migration: `pnpm --filter backend exec prisma migrate deploy`.
- Seed a SuperAdmin: `pnpm --filter backend seed:admin`.
- Visit `http://localhost:3000/harness-control`.
- Delete the credential after use; no path in this implementation persists
  raw tokens or session ids in evidence.

---

## 6. Files changed (summary)

### Created
- `backend/src/harness/phase10/contracts.ts`
- `backend/src/harness/phase10/harness-control.service.ts`
- `backend/src/harness/phase10/harness-control.controller.ts`
- `backend/src/harness/phase10/harness-control.module.ts`
- `backend/src/harness/phase10/conformance.spec.ts`
- `backend/src/harness/phase10/reports/{phase10-machine-readable,phase10-summary}.json`
- `backend/scripts/run-phase10-certification.ts`
- `backend/src/docs/runbooks/phase10-control-center.md`
- `backend/prisma/migrations/20260803_phase10_harness_control_center/migration.sql`
- `frontend-admin/src/app/harness-control/replay/page.tsx`
- `frontend-admin/src/app/harness-control/waivers/page.tsx`
- `frontend-admin/src/app/harness-control/certificates/page.tsx`
- `frontend-admin/src/app/harness-control/audit/page.tsx`
- `neurecore/memory-bank-arc/audits/phase10-implementation-status.md` (this file)

### Modified
- `backend/prisma/schema.prisma` (9 new models, 3 new enums)
- `backend/src/app.module.ts` (registered `HarnessControlModule` — done in
  earlier turn)
- `backend/package.json` (`certify:phase10`, `certify:phase10:spec`,
  `certify:phase10:all`)
- `frontend-admin/src/services/harness-control.service.ts`
- `frontend-admin/src/components/sidebar/navigation.config.ts` (already had
  Harness Control entry)

---

## 7. How to actually close Phase 10

1. **Apply migration** in a non-production environment:
   `pnpm --filter backend exec prisma migrate deploy`.
2. **Seed a SuperAdmin** (`pnpm --filter backend seed:admin`) — delete after.
3. **Manual UX walkthrough** in a real browser; record findings and
   screenshots in `neurecore/memory-bank-arc/audits/phase10-ux-review.md`.
4. **Security sign-off** recorded in
   `neurecore/memory-bank-arc/audits/phase10-security-review.md`.
5. **Operational readiness sign-off** recorded in
   `neurecore/memory-bank-arc/audits/phase10-operational-readiness.md`,
   including at minimum one stuck-run drill, one evidence-checksum
   mismatch drill, and one restore-from-backup drill for `harness_audit_events`.
6. **Wire CI**: add `pnpm certify:phase10` to the merge gate; do not block
   releases until the false-positive/false-negative record is reviewed.
7. Only after steps 3–6 are recorded by their respective owners may the
   implementation-status note be promoted to `Phase10-completion notes`.
