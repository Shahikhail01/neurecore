# Pending Tasks

> Open defects, G-series gaps, and phase work that has not yet landed. Last refreshed: 2026-07-31.

Each entry: **ID · Title · Area · Status · Source pointer**.

---

## A. SIM-04 (Accounting Customer HITL Walkthrough) — open defects

Per AGENTS.md §"SIM-04 — Status 2026-07-28": ❌ **FAIL** (S1 + S2 failed;
S3–S12 skipped). Two FE-only defects remain.

### NC-SIM04-002 — Customer "Create" button blocked by modal backdrop
- **Area:** `frontend-tenant/src/app/customers/` (modal with `<div class="fixed inset-0 bg-black/50 z-40">`)
- **Symptom:** "Create Customer" button is visible and enabled but the
  backdrop overlay intercepts pointer events.
- **Fix direction:** raise the modal panel's `z-index` above the backdrop
  (`z-50`+), or move the backdrop inside the same stacking context.
- **Status:** Open.

### NC-SIM04-005 — Chat does not create a project after natural-language request
- **Area:** `frontend-tenant/src/services/command-registry.ts`,
  `register-commands.ts`, and the chat agent graph.
- **Symptom:** After 4 conversational turns in natural business language,
  the LLM only ran diagnostic tools; no `createProject` invocation.
- **Fix direction:** wire the chat agent's tool graph so natural language
  ("let's onboard ACME as a new customer") triggers the right command.
- **Status:** Open.

### Missing FE controls for SIM-04 stages
- S6 — Execute button on the project detail page.
- S11 — Complete button.
- S10 — REVIEW state pill in the project status bar.
- **Status:** Open.

### Closed SIM-04 defects (for reference)
NC-SIM04-001 (chat-create one-shot bypass), NC-SIM04-003
(`customers.financialSubType` + `lifecycleStage` enum cast), G-07
(`POST /customers/:id/lifecycle` subroute + timeline events), G-10
(CORS proxy Socket.IO shim — landed in `scripts/contabo/cors-proxy.js`),
G-03 (calendar surface), G-04/G-05/G-06 (goal endpoints), G-01
(admin password reset issuance), G-08 (admin impersonation flag),
conversationId ESLint warning (`backend/src/modules/chat/services/chat.service.ts:731`).

---

## B. Open G-series gaps (SIM-04 + Phase 4 accounting surface)

| ID | Description | Area |
|---|---|---|
| G-01 | Admin password reset UX flow (token issuance done; UX TBD) | `frontend-admin/` |
| G-08 | Admin "impersonate tenant" mode + audit surfacing | `frontend-admin/` |
| G-10 | ✅ Closed — Socket.IO CORS shim landed | `scripts/contabo/cors-proxy.js` |

---

## C. Accounting sidecar — phased follow-ups (NC-ACCT-IMP-1)

Per `backend/src/modules/accounting/accounting.module.ts:17-23`:

| Phase | Description | Status |
|---|---|---|
| 1j | Wire `nc.accounting.*` tools into `ScopedToolGatewayService` chat graph | Partial |
| 1k | Beancount snapshot regeneration (server-side) | Planned |
| 1l | Merkle root background job | Planned |
| 1m+ | AR/AP/payroll/fixed-asset/bank-recon/tax subledgers | Planned |

---

## D. AWL (Autonomous Work Layer) — open phase items

Per AGENTS.md §"10 Mandatory Invariants" — enforced by the certification
harness. Gate G9 must stay green:

- **G9 verdict:** `APPROVED` / `BLOCKED` — must stay APPROVED.
- **Reports:** `src/test/certification/reports/`
  - `g9-machine-readable.json`
  - `g9-summary.json`
  - `g9-dashboard.html`
- **Commands:** `pnpm certify:phase9`, `pnpm certify:dashboard`,
  `pnpm certify:phase9:all`.
- **105-scenario matrix** must remain green; see
  `runbook.md § "Phase 9 certification"` for thresholds.

### D.1 Outstanding AWL polish
- OutboxWorker retry/backoff tuning (look for noisy logs).
- `ExecutionAttempt` evidence preservation audit (rev cycles must not
  mutate prior evidence).
- AI-self-approval guard surfaces in chat UI.

---

## E. Performance / observability gaps

- Per-request slow-request alarm exists (>1500ms via pino-http) but no
  dashboard yet on the admin Monitoring page.
- OpenTelemetry trace exporter is configured but visualisation
  (Grafana / Jaeger) is not wired in `frontend-admin/monitoring/`.
- `frontend-admin/monitoring/` shows a snapshot; live WS push is planned
  (TBD owner).

---

## F. Documentation debt (this folder)

This new `memory-bank/` is intentionally lean. Once these docs are
trusted, the legacy `memory-bank-arc/` set can be archived or deleted.
Concretely still owed:

- `architecture-decisions.md` — collect all `ADR-00X` referenced in
  comments (ADR-001 Enterprise Event Fabric, ADR-002 Org Context Plane,
  ADR-003/004 Governed Work Runtime, ADR-006 Approval Port).
- `data-model-tour.md` — walk the 174 Prisma models by domain cluster.
- `chat-and-agents.md` — the unified chat implementation across the
  tenant portal.
- `solutions-and-marketplace.md` — SolutionPacks + Marketplace flow.

---

## G. Tooling debt

- `tsc-errors.txt` exists at `frontend-tenant/tsc-errors.txt` — needs to
  be either fixed or replaced with a "known errors" annotation.
- ESLint config drift between `backend/` and the two frontends — should
  consolidate where possible.
- Admin `pnpm verify` runs `vitest run --coverage` but coverage gates
  are not enforced; revisit.

---

## H. How to add a new pending task

1. Add the entry under the appropriate category above (or create one).
2. Cross-link to the affected file/line.
3. Reference the fix in `fixes.md` when closed.
4. If it blocks a release, surface it in `runbook.md` § "Open
   production risks".

---

## Source pointers

- `AGENTS.md` (repo root) — Phase 9 cert + SIM-04 status.
- `backend/src/modules/accounting/accounting.module.ts:17-23`.
- `backend/src/test/certification/` (gate G9 + invariants).
- `frontend-tenant/src/services/command-registry.ts` (NC-SIM04-005).
- `frontend-tenant/src/app/customers/` (NC-SIM04-002).