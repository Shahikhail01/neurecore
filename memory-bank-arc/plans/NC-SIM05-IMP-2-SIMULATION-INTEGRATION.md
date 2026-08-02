# NC-SIM05-IMP-2: Sim-05 Accounting Simulation Integration

**Document ID:** NC-SIM05-IMP-2
**Date:** 2026-07-30
**Status:** PROPOSED
**Supersedes:** none
**Parent plan:** `NC-SIM05-IMP-1-FINANCIAL-SIMULATION-PLAN.md` (umbrella, now decomposed)
**Depends on:** `NC-ACCT-IMP-1-NEURECORE-CAPABILITY.md` (must reach Phase 2 cert PASS before this plan begins)
**Triggered by:** The 20 Sim-05 training scenarios (`neurecore/simulations/Sim-05`) need a runtime that can perform accounting work. The accounting capability is delivered by `NC-ACCT-IMP-1`. This plan wires the simulation harness to the capability and produces the training content for the 20 scenarios.

---

## 0. Honest Scope Statement

This plan delivers the **simulation integration layer** between the Sim-05 training content and the NeureCore accounting capability:

- A `Sim05Module` that registers 20 scenarios as a `ServiceIdentity` family inside the existing `SimulationsModule`.
- 6 of 20 scenarios wired to the accounting capability in Phase 1 of this plan (those requiring numpy-financial or Beancount compute).
- 14 of 20 scenarios wired in Phase 2 (those requiring judgment, evidence, and report generation).
- A scoring system specific to accounting correctness on top of the existing organizational-intelligence scoring.
- A separate Sim-05 cert framework that integrates with the G9 cert (work coordination) and the accounting cert A1-A11 gates (NC-ACCT-IMP-1 §10).

This plan does **NOT** deliver:

- The accounting capability itself (separate plan: `NC-ACCT-IMP-1`).
- Pakistani / FBR / SECP tax rules. Sim-05 Scenario 6 (Tax Audit) is either:
  (a) Re-scoped to a generic tax scenario with no FBR/Sales Tax specifics, OR
  (b) Held until `NC-TAX-IMP-1` ships a tax engine.
  Decision required (see Open Questions §10).
- The Sim-05 training content itself. The scenarios are 1-page prompts in `simulations/Sim-05`. A separate curriculum effort (training/product owned) is required to expand each into a full scenario brief with dataset specifications, evaluation rubric, and management-presentation template.
- Real-tenant accounting work (handled by NC-ACCT-IMP-1 directly).
- AR/AP/payroll subledger simulations. The 20 Sim-05 scenarios include payroll, AR, expense reimbursement, and bank reconciliation — these are judgment scenarios that produce findings, not full subledger simulations. Findings are recorded; no subledger simulation is run.

### Phase boundary

| Phase | Scope | Status |
|---|---|---|
| **Phase A (this plan, weeks 1-3)** | Wire 6 of 20 scenarios to the capability: NPV/IRR (13), Lease (10), Inventory obsolescence (9), FX (18), IPO valuation (17), Payroll findings (5) | After NC-ACCT-IMP-1 cert PASS |
| **Phase B (this plan, weeks 4-6)** | Wire remaining 14 scenarios: Audit, Fraud, AR, Bank recon, Expense, Tax (re-scoped), Budget, M&A, Cost reduction, Insurance, Loan, Valuation, QPA, Performance | After Phase A cert |
| **Out of scope (separate plans)** | Tax engine (NC-TAX-IMP-1), AR/AP subledgers, full curriculum expansion | |

The 6/14 split is deliberate. The 6 scenarios are the ones that **require** numpy-financial or Beancount compute to produce a numerical answer. The 14 scenarios are primarily LLM-judgment scenarios that use accounting tools to record findings, not to compute answers.

---

## 1. Sim-05 Scenario Classification

Based on the 20 scenarios in `simulations/Sim-05`:

### Group 1: Numerical compute (6 scenarios — Phase A)

| # | Scenario | What compute is needed | Tools used |
|---|---|---|---|
| 9 | Inventory Obsolescence | NRV calculation, write-down journal entry | `np.accounting.compute_npv`, `np.accounting.post_ledger` |
| 10 | Lease Accounting | Liability PV, ROU asset, amortization schedule | `np.accounting.amortize_loan`, `np.accounting.post_ledger` |
| 13 | Capital Investment Appraisal | NPV, IRR, MIRR, sensitivity | `np.accounting.compute_npv`, `np.accounting.compute_irr`, `np.accounting.compute_mirr` |
| 17 | IPO Preparation | Comparable-company multiples, share price | `np.accounting.compute_npv` (DCF) |
| 18 | Foreign Exchange Analysis | FX exposure, gain/loss, hedge recommendation | `np.accounting.get_account_balance`, dataset FX rates |
| 5 | Payroll Review | Net pay, ghost-employee detection, duplicate payment | `np.accounting.record_finding` (no journal entry) |

### Group 2: LLM judgment with structured output (14 scenarios — Phase B)

| # | Scenario | What the LLM does | Tools used |
|---|---|---|---|
| 1 | Inventory Warehouse Audit | Reconcile 500 items, identify 15 discrepancies | `np.accounting.generate_dataset`, `np.accounting.record_finding` |
| 2 | Annual Financial Statement Audit | Find 10 misstatements, calculate materiality, issue opinion | `np.accounting.generate_dataset`, `np.accounting.record_finding`, `np.accounting.export_beancount` |
| 3 | Budget Preparation | 5-year history + 2027 forecast | `np.accounting.generate_dataset`, `np.accounting.record_finding` |
| 4 | Cash Fraud Investigation | Trace missing cash among 3 suspects | `np.accounting.generate_dataset`, `np.accounting.record_finding` |
| 6 | Tax Audit | (re-scoped or deferred) | — |
| 7 | Accounts Receivable Review | Calculate bad-debt provision | `np.accounting.generate_dataset`, `np.accounting.record_finding` |
| 8 | Bank Reconciliation | Match outstanding cheques, identify fraud | `np.accounting.generate_dataset`, `np.accounting.record_finding` |
| 11 | Quarterly Performance Analysis | Calculate ratios, explain movements | `np.accounting.get_account_balance`, `np.accounting.export_beancount` |
| 12 | (Phase B placeholder) | (re-use slot if needed) | — |
| 14 | Loan Application Analysis | Ratios, rate, risk, decision | `np.accounting.get_account_balance`, `np.accounting.record_finding` |
| 15 | Business Valuation | DCF, multiples, fair value | `np.accounting.compute_npv` (DCF), `np.accounting.record_finding` |
| 16 | Merger Due Diligence | Valuation, hidden-liability exposure | `np.accounting.compute_npv`, `np.accounting.record_finding` |
| 19 | Cost Reduction Project | Identify 20 opportunities, rank feasibility | `np.accounting.generate_dataset`, `np.accounting.record_finding` |
| 20 | Insurance Claim Assessment | Calculate covered loss | `np.accounting.record_finding` |

Note: the original Sim-05 list has 20 entries; mapping above uses the canonical numbering from `simulations/Sim-05`. The original plan's table of 20 was a re-numbering. We use the original numbering here.

---

## 2. Architecture

### Sim-05 attaches to the existing SimulationsModule

The existing `SimulationsModule` provides:
- `POST /api/v1/simulations` (transactional sequence allocation, URI scheme `sim://YYYY/MM/DD/orgSlug/framework/seq`).
- `POST /api/v1/simulations/:id/days/:day/run` (idempotent day execution).
- `SimulationsDayRunner` — deterministic work-coordination slice with timeline events, decisions, debate/devil's-advocate/auditor threads, scoring.

Sim-05 attaches as a `ServiceIdentity` family:

```typescript
// backend/src/modules/simulations/simulations.module.ts
import { Sim05Module } from '../sim05/sim05.module';

@Module({
  imports: [
    // ... existing imports
    AccountingModule,        // NC-ACCT-IMP-1
    Sim05Module,             // NC-SIM05-IMP-2 (this plan)
  ],
})
export class SimulationsModule {}

// backend/src/modules/simulations/sim05/sim05.module.ts
@Module({
  imports: [AccountingModule, ToolGatewayModule],
  providers: [
    Sim05ServiceIdentityRegistrar,
    Sim05ScenarioRegistry,
    Sim05DayExecutor,
    Sim05ScoringEngine,
  ],
  controllers: [Sim05Controller],
})
export class Sim05Module {}
```

### Sim05DayExecutor

Reuses the existing `SimulationsDayRunner` flow but adds:

1. **Scenario dispatch** — given `simulationRunId`, look up the scenario spec and run its day plan.
2. **Tool invocation** — the executor calls `nc.accounting.*` tools via `ScopedToolGatewayService` (provided by NC-ACCT-IMP-1).
3. **Evidence collection** — every tool call returns a `computationId` or `journalEntryId` or `findingId`; these are stored as `TimelineEvent` evidence.
4. **Scoring** — the existing scoring engine computes work-coordination scores; the new `Sim05ScoringEngine` computes accounting-correctness scores (separate dimension, displayed alongside).

### Sim05ScenarioRegistry

Each scenario is a TypeScript spec:

```typescript
// backend/src/modules/simulations/sim05/scenarios/scenario-13-capital-investment.spec.ts
export const CapitalInvestmentScenario: Sim05Scenario = {
  id: 13,
  title: 'Capital Investment Appraisal',
  companyName: 'Skyline Manufacturing Ltd',
  difficulty: 'INTERMEDIATE',
  estimatedDays: 5,
  requiredTools: [
    'np.accounting.compute_npv',
    'np.accounting.compute_irr',
    'np.accounting.compute_mirr',
  ],
  datasetSchema: {
    initialInvestment: { type: 'number', min: 100000, max: 10000000 },
    cashflows: { type: 'number[]', minItems: 1, maxItems: 20 },
    discountRate: { type: 'number', min: 0.01, max: 0.30 },
    salvageValue: { type: 'number', min: 0 },
  },
  dayPlan: [
    { day: 1, type: 'GENERATE', prompt: 'Generate company profile, machine specs, cashflow forecast' },
    { day: 2, type: 'COMPUTE', tools: ['np.accounting.compute_npv', 'np.accounting.compute_irr'] },
    { day: 3, type: 'ANALYZE', prompt: 'Compute sensitivity to ±20% cashflows and ±2pp discount rate' },
    { day: 4, type: 'DECIDE', prompt: 'Recommend invest/reject with justification' },
    { day: 5, type: 'PRESENT', prompt: 'Prepare board presentation with NPV/IRR/MIRR tables' },
  ],
  scoring: {
    npvAccuracy: 0.30,    // bit-for-bit match with reference
    irrConvergence: 0.20, // matched IRR within 1bp
    decisionQuality: 0.30, // correct invest/reject based on NPV>0
    presentationQuality: 0.20, // LLM-as-judge on the board presentation
  },
  referenceOracle: 'src/test/accounting-cert/math-oracle/capital-investment.fixtures.json',
};
```

### Sim05ScoringEngine

Computes three score dimensions per scenario run:

1. **Work coordination score** — from existing `computeOrganizationalIntelligence` (NC-AWL-IMP-1 §14.1).
2. **Accounting correctness score** — bit-for-bit match with reference oracle (textbook cases) plus 1bp tolerance for IRR.
3. **Judgment quality score** — LLM-as-judge on the management presentation, with a rubric per scenario.

Total scenario score = weighted sum (weights per scenario spec).

---

## 3. Frontend Surfaces (additions to NC-ACCT-IMP-1 §8)

### Tenant frontend — `frontend-tenant/src/app/simulations/`

**Routes (replacing the retired `ScenarioSimulator` component):**
- `/simulations` — list of all Sim-05 scenarios (20 cards)
- `/simulations/[scenarioId]` — detail view: scenario description, input dataset state, generated datasets, reports, findings, export buttons
- `/simulations/[scenarioId]/run` — execution view (chat-style, drives the agent through the day plan)
- `/simulations/[scenarioId]/score` — final score with breakdown of three dimensions

**Components** (`frontend-tenant/src/components/simulations/`):
- `SimulationCard.tsx` — one of 20 scenario cards
- `SimulationRunner.tsx` — chat-like runner using `UnifiedChatPanel`
- `DatasetTable.tsx` — generic JSONB renderer with filter/search/pagination, handles >100 rows via `payloadUrl`
- `ReportViewer.tsx` — renders `AccountingReport.results` as BS/IS/CF/NPV/IRR
- `FindingsPanel.tsx` — lists `AuditFinding` rows with severity badge
- `BeancountExportButton.tsx` — calls `GET /api/v1/accounting/ledger/export.beancount`
- `ScoringBreakdown.tsx` — three-dimension score display
- `ScenarioBrief.tsx` — full scenario description + dataset schema

**Service** (`frontend-tenant/src/services/simulations.service.ts`):
- `listScenarios()` → returns the 20 scenario specs
- `getScenario(id)` → single scenario spec
- `listDatasets(scenarioId?)` → `AccountingDataset[]`
- `getDataset(id)` → header metadata
- `getDatasetRows(id, page, limit)` → paginated payload
- `generateDataset(scenarioId, kind, seed?)` → POST
- `listReports(scenarioId?)` → `AccountingReport[]`
- `generateReport(scenarioId, reportType, period?)` → POST
- `listFindings(scenarioId?)` → `AuditFinding[]`
- `recordFinding(scenarioId, finding)` → POST
- `exportBeancount(scenarioId)` → GET
- `runScenario(scenarioId, prompt)` → POST starts via SimulationsModule
- `getScore(scenarioId)` → final score with three-dimension breakdown

### Retirement of existing `ScenarioSimulator`

The frontend-tenant's existing `ScenarioSimulator` component (`src/features/strategy/components/ScenarioSimulator.tsx`) is **retired**. It was in-memory only and doesn't support the persistence/scoring requirements. New simulation pages supersede it.

---

## 4. Certifying Sim-05

### Sim-05 cert framework — `src/test/sim05-cert/`

```
src/test/sim05-cert/
├── README.md
├── scenario-runner/                        # 20-scenario runner
│   ├── runner.spec.ts                      # main entry
│   └── provisioning.ts                     # 20 clean tenants
├── scenarios/                              # per-scenario test specs
│   ├── scenario-01-inventory-warehouse.spec.ts
│   ├── scenario-02-annual-fs-audit.spec.ts
│   ├── ...
│   └── scenario-20-insurance-claim.spec.ts
├── reference-oracles/                      # textbook answers per scenario
│   ├── scenario-09-inventory-obsolescence.fixtures.json
│   ├── scenario-13-capital-investment.fixtures.json
│   └── ...
├── scoring/
│   ├── work-coordination-score.spec.ts     # reuses G9 framework
│   ├── accounting-correctness-score.spec.ts # reuses A1-A11
│   └── judgment-quality-score.spec.ts      # LLM-as-judge
├── gates/
│   ├── gate-S1.spec.ts                     # 6/6 Phase-A scenarios PASS
│   ├── gate-S2.spec.ts                     # 14/14 Phase-B scenarios PASS
│   ├── gate-S3.spec.ts                     # all 20 scenarios across 20 tenants PASS
│   └── gate-S4.spec.ts                     # cross-tenant isolation
└── reports/
    ├── sim05-machine-readable.json
    ├── sim05-summary.json
    └── sim05-dashboard.html
```

### Gate metrics

| Gate | Metric | Target |
|---|---|---|
| S1 | Phase-A scenarios (6/6) pass | 100% |
| S2 | Phase-B scenarios (14/14) pass | 100% |
| S3 | All 20 scenarios across 20 spawned tenants pass | 100% |
| S4 | Cross-tenant isolation (one tenant's data never appears in another's run) | 100% |
| S5 | NPV/IRR match reference oracle within 1bp | 100% |
| S6 | Beancount export roundtrips (post → export → re-parse → balance matches) | 100% |
| S7 | Tool invocations logged with computationId | 100% |
| S8 | LLM-as-judge inter-rater agreement (Cohen's κ) | ≥ 0.7 |

### Failure-tombstone

If any gate fails, the cert path is closed. Sim-05 wiring does not get re-attempted without a new architecture decision. This mirrors the NC-AWL-IMP-2 §5 failure-tombstone rule.

---

## 5. Open Questions (require user decision)

1. **Plan approval:** ACCEPTED on 2026-07-30.
2. **Scenario 6 (Tax Audit) disposition:** Two options:
   (a) Re-scope to "Generic Tax Audit" with no FBR/Sales Tax specifics. Certifiable now.
   (b) Hold until `NC-TAX-IMP-1` ships a tax engine. Then wire to it.
   **Recommendation: (a) + a NOTE in scenario metadata: "Jurisdiction-specific tax support is in NC-TAX-IMP-1, not yet shipped."**
   This keeps the 20-scenario cert honest: 19 certifiable scenarios + 1 placeholder.

3. **Curriculum content ownership:** The 20 scenarios are 1-page prompts. A full scenario brief (dataset schema, evaluation rubric, reference oracle, management presentation template) needs to be authored. Who owns this? Options:
   (a) Training/product team
   (b) The plan owner (you)
   (c) External contractor
   **Recommendation: (a) Training/product team, with `reference-oracles/` authored by accounting SME and reviewed by plan owner.**

4. **LLM-as-judge inter-rater agreement target:** Cohen's κ ≥ 0.7 is a typical target for human-vs-LLM agreement. Lower is acceptable (0.5) but reduces cert signal value. Decision required.

5. **Reference oracle source:** The textbook answers for NPV/IRR (Brigham/Ehrhardt, Ross/Westerfield) are well-known. For inventory obsolescence, lease accounting, FX exposure, payroll: which edition/textbook is the source of truth? Decision required.

6. **Scoring weights per scenario:** Each scenario's `scoring` block has weights (e.g. NPV 0.30, IRR 0.20, decision 0.30, presentation 0.20). These are subjective. Lock them at planning time and freeze during cert.

7. **Per-tenant isolation in Sim-05 cert:** Sim-05 cert spawns 20 tenants. Each tenant runs all 20 scenarios. Cross-tenant assertion: tenant A's NPV result never equals tenant B's (because the data is random per tenant, not the same seed). Confirm.

8. **Out of scope: Pakistani / FBR / SECP tax rules.** Confirmed. Reaffirm in this plan's sign-off.

9. **Beancount export during simulation runs:** Simulations can call `nc.accounting.export_beancount` to produce an export. The export reflects the simulation's tenant ledger. Confirm: the simulation ledger is real (DB-backed), not sandboxed. This means simulation journal entries are real tenants' ledgers in the DB, with `sourceRef = 'scenario:N'`. SoD still applies.

10. **Phase A / Phase B split:** 6 scenarios in Phase A (numerical compute), 14 in Phase B (judgment). The Phase B scenarios use `nc.accounting.record_finding` heavily but no journal entries. Acceptable?

---

## 6. Honest Effort Estimate (working days)

| Phase | Days | Notes |
|---|---|---|
| Phase A0: Scenario spec authoring (6 specs + reference oracles) | 4 | Requires accounting SME review. |
| Phase A1: `Sim05Module` skeleton + `ServiceIdentity` registration | 2 | Wires into `SimulationsModule`. |
| Phase A2: `Sim05ScenarioRegistry` (typed scenario specs) | 2 | Reusable across phases. |
| Phase A3: `Sim05DayExecutor` (tool invocation + evidence collection) | 4 | Includes LLM prompt templates per day plan step. |
| Phase A4: `Sim05ScoringEngine` (three dimensions) | 3 | Reuses `computeOrganizationalIntelligence` + A1-A11 + LLM-as-judge. |
| Phase A5: Tenant UI (simulations list + runner + dataset table + report viewer + findings) | 8 | New pages + 8 components + service. |
| Phase A6: Cert framework (runner, gates S1, S5, S6, S7) | 4 | Reuses A1-A11. |
| Phase A7: Phase A cert (6 scenarios × 5 spawned tenants) | 2 | Mirrors SIM-04 provisioning pattern. |
| **Phase A total** | **~29 days** | "6 scenarios wired, certified, UI complete" |
| Phase B0: Scenario spec authoring (14 specs + reference oracles) | 8 | Larger content effort. |
| Phase B1-B3: Reuse Phase A infrastructure for judgment scenarios | 6 | LLM-as-judge prompt engineering. |
| Phase B4: UI updates for remaining 14 scenarios | 4 | Mostly card-list updates. |
| Phase B5: Cert framework expansion (gates S2, S3, S4, S8) | 3 | Cross-tenant isolation is the hardest. |
| Phase B6: Phase B cert (14 scenarios × 5 spawned tenants) | 3 | |
| **Phase B total** | **~24 days** | "All 20 scenarios wired and certified" |
| **Sim-05 total** | **~53 working days** | Roughly 10-11 weeks with a 2-person team (1 backend + 1 frontend), running parallel to NC-ACCT-IMP-1's UI/cert phase. |

**Critical dependency:** NC-ACCT-IMP-1 must reach Phase 2 cert PASS (2026-09-12) before Sim-05 work begins. Until then, Sim-05 work is blocked on the capability itself being production-ready.

---

## 7. Sequencing (depends on NC-ACCT-IMP-1)

```
2026-09-12                ─ NC-ACCT-IMP-1 Phase 2 cert PASS
2026-09-12 .. 2026-09-15  ─ Sim-05 Phase A0 (scenario specs + reference oracles)
2026-09-15 .. 2026-09-26  ─ Phase A1-A4 (backend wiring)
2026-09-15 .. 2026-09-29  ─ Phase A5 (tenant UI)
2026-09-26 .. 2026-09-30  ─ Phase A6-A7 (cert)
2026-09-30                ─ Phase A cert: PASS / FAIL
                              if FAIL → failure-tombstone
2026-09-30 .. 2026-10-15  ─ Phase B0-B4
2026-10-15 .. 2026-10-22  ─ Phase B5-B6
2026-10-22                ─ Phase B cert: PASS / FAIL
                              if PASS → Sim-05 certified, all 20 scenarios available
                              if FAIL → failure-tombstone
```

---

## 8. What changed from the original `NC-SIM05-IMP-1` plan

| Original plan | This plan | Why |
|---|---|---|
| One plan covering 35 days | Two plans: capability (62 days) + simulation (53 days) | Capability must be production-ready before simulation wiring. |
| Sidecar purely stateless | Stateful-but-isolated for reports (mmap'd snapshot) | Pure stateless breaks at >10k postings. |
| `nc.accounting.*` deferred to Phase 2.5 | Shipped day one of NestJS deploy | Chat agent is the primary user. |
| `infra/_common/auth.{py,ts}` (one library) | `scope_token` + `webhook_sig` + `deploy_token` (three libraries) | Three distinct protocols. |
| COA + Period + JournalEntry models missing | All three added as Phase 1 schema | Without these, no real accounting is possible. |
| SoD not addressed | DB-enforced SoD with role taxonomy (POSTING, REVIEWER, CONTROLLER, CFO, AUDITOR) | Real accounting firms have segregation of duties. |
| Tamper-evidence via file checksum | Tamper-evidence via Merkle root over outbox events | File checksums detect corruption, not tampering. |
| 145-scenario cert into G9 | Math oracle (150 cases) + A1-A11 gates (separate from G9) | G9 certifies work coordination, not financial math. |
| 35-day estimate | 62 + 53 = 115 days total | Honest accounting of effort. |
| Sim-05 cert integrated into G9 | Sim-05 cert is its own framework, uses G9 + A1-A11 | Different dimensions; conflating corrupts both. |
| Scenario 6 (Pakistan tax) silently OK | Re-scoped to generic OR held until NC-TAX-IMP-1 | Honest about jurisdictional scope. |
| 20 scenarios in one phase | 6 in Phase A, 14 in Phase B | Distinguishes compute-required from judgment-only scenarios. |
