# Mali — ACCOUNTING | 1-Month Company Work Plan

**Tenant:** mali@live.com (ID: `726522f0-a9e4-4c13-b22f-a9a967b914dc`)
**Plan Period:** 2026-07-09 → 2026-08-08 (4 weeks / 20 working days)
**Owner:** Mali Owner (mali@live.com)
**Industry:** Accounting & Audit Services
**Tier:** Enterprise ($499/mo)
**Locale/Timezone:** en-US / UTC | **Currency:** USD
**Platform:** NeureCore hq.neurecore.com (AI-employee workforce)

---

## 0. Executive Summary

Mali is a single-owner accounting practice (or small firm) running on the NeureCore Enterprise plan. The workforce is 27 AI employees spread across 7 active departments, plus a 12-agent Accounting sub-department template (AP, AR, Audit, Budget, Cost, Financial Reporting, Fixed Assets, GL, Intercompany, Payroll, Tax, Treasury) that has been deployed but not yet activated.

This plan operationalizes that workforce for one month: it activates the Accounting sub-department, assigns every agent, defines daily/weekly/monthly routines, runs the month-end close, delivers a financial package to the owner, and sets up 2-3 client engagements (bookkeeping, monthly close, advisory). The plan is grounded in what the platform can actually do today (Hermes comms off, COMM_* flags off, routines partial, workflows not yet built) and uses the agents the tenant already has, with the Google Workspace integration for Gmail/Calendar/Drive/Sheets.

**Primary goals for the month:**
1. **G1 — Activate the full Accounting workforce** (12 sub-dept agents brought online and assigned).
2. **G2 — Close the July 2026 books** for 2-3 clients end-to-end.
3. **G3 — Stand up recurring routines** (daily AR/AP, weekly payroll prep, monthly close) that run automatically.
4. **G4 — Deliver one client-facing report pack** (financial statements + management commentary).
5. **G5 — Establish the firm's operating cadence** (daily standup, weekly WIP, monthly close calendar) that the owner can sustain.

---

## 1. Org Chart & Roster (27 AI Employees + Owner)

### 1.1 Reporting lines

```
Mali Owner (mali@live.com) — OWNER
│
├── Customer Success (3 agents)
│   ├── Customer Onboarding Specialist       [CS-Onboarding]
│   ├── Customer Health & Risk Manager        [CS-Health]
│   └── Customer Retention & Renewal Manager  [CS-Renewal]
│
├── Finance (3 agents + 12 sub-dept agents to activate)
│   ├── Bookkeeper & Controller              [FIN-BOOK]
│   ├── FP&A Analyst                          [FIN-FPA]
│   ├── M&A Analyst                           [FIN-MA]
│   ├── (activate) General Ledger Accountant  [FIN-GL]
│   ├── (activate) Accounts Payable           [FIN-AP]
│   ├── (activate) Accounts Receivable        [FIN-AR]
│   ├── (activate) Payroll Accountant         [FIN-PR]
│   ├── (activate) Tax Compliance Specialist  [FIN-TAX]
│   ├── (activate) Audit Coordinator          [FIN-AUD]
│   ├── (activate) Budget Accountant          [FIN-BUD]
│   ├── (activate) Cost Accountant            [FIN-COST]
│   ├── (activate) Financial Reporting Spec.  [FIN-FR]
│   ├── (activate) Fixed Assets Accountant    [FIN-FA]
│   ├── (activate) Intercompany Accounting    [FIN-IC]
│   └── (activate) Treasury Accountant        [FIN-TR]
│
├── Accounting (department — 0 agents today → host the 12 above)
│
├── Human Resources (2 agents)
│   ├── HR Generalist                         [HR-GEN]
│   └── Recruiter                             [HR-REC]
│
├── Legal (4 agents)
│   ├── Corporate Counsel                     [LEG-CC]
│   ├── Contract Manager                      [LEG-CM]
│   ├── Compliance Officer                    [LEG-CO]
│   └── Legal Operations Specialist           [LEG-LO]
│
├── Specialized (3 agents)
│   ├── Industry Research Analyst             [SP-RES]
│   ├── Knowledge Manager                     [SP-KM]
│   └── Strategy Consultant                   [SP-STR]
│
└── Support (3 agents)
    ├── IT Support Specialist                 [SUP-IT]
    ├── Customer Support Agent                [SUP-CS]
    └── Quality Assurance Reviewer            [SUP-QA]
```

### 1.2 Assignment matrix (remediates the 9 unassigned agents + 12 dormant sub-dept agents)

| # | Agent | Assign to | Reports to | Primary client? |
|---|---|---|---|---|
| 1 | Bookkeeper & Controller | Finance | Owner | Yes |
| 2 | FP&A Analyst | Finance | Owner | Yes |
| 3 | M&A Analyst | Finance | Owner | Optional |
| 4 | Customer Onboarding | Customer Success | Owner | Yes |
| 5 | Customer Health & Risk | Customer Success | Owner | Yes |
| 6 | Customer Retention & Renewal | Customer Success | Owner | Yes |
| 7 | General Ledger Accountant | Accounting | FIN-BOOK | Yes |
| 8 | Accounts Payable | Accounting | FIN-BOOK | Yes |
| 9 | Accounts Receivable | Accounting | FIN-BOOK | Yes |
| 10 | Payroll Accountant | Accounting | FIN-BOOK | Yes |
| 11 | Tax Compliance Specialist | Accounting | FIN-BOOK | Yes |
| 12 | Audit Coordinator | Accounting | FIN-BOOK | Optional |
| 13 | Budget Accountant | Accounting | FIN-FPA | Yes |
| 14 | Cost Accountant | Accounting | FIN-FPA | Optional |
| 15 | Financial Reporting Specialist | Accounting | FIN-FPA | Yes |
| 16 | Fixed Assets Accountant | Accounting | FIN-BOOK | Optional |
| 17 | Intercompany Accounting | Accounting | FIN-BOOK | Optional |
| 18 | Treasury Accountant | Accounting | FIN-BOOK | Optional |
| 19-27 | 9 unassigned + HR/Legal/Specialized/Support | Existing depts | Dept lead | Mixed |

**Note on the deploy permission bug:** Section 10 of the tenant doc shows all deploy/PATCH endpoints return `PERMISSION_DENIED`. If the fix is not in place by W1D1, fall back to running agents via the chat/Hermes path and the in-app **Start** toggle (read endpoints work; only the backend write guards are broken). Log every failed assign call in the W1 status report.

---

## 2. Client Portfolio (assumed)

Treat Mali as a 2-3-client bookkeeping & advisory practice. Adjust names/sizes as the owner wishes.

| Client | Industry | Engagements | Monthly fee (USD) | Lead agent(s) |
|---|---|---|---|---|
| **C1 — Northwind Bakery LLC** | Retail / F&B | Monthly close, AP, payroll (4 emp) | $850 | FIN-BOOK, FIN-AP, FIN-PR |
| **C2 — Atlas Consulting Group** | Professional services | Monthly close, AR, mgmt reports | $1,400 | FIN-BOOK, FIN-AR, FIN-FR |
| **C3 — Halcyon Holdings (owner's HCO)** | Holding | Consolidations, intercompany, treasury | Internal | FIN-GL, FIN-IC, FIN-TR |

Total monthly revenue (bookkeeping only): **$2,250**. Plus the platform's own books for Mali (internal).

---

## 3. Operating Cadence (Routines)

The platform's Routines feature is partial (no UI; backend scheduler exists). Until routines UI ships, every routine below is **executed by the owner prompting the named agent in the Command Center chat** at the stated time. Once `/routines` UI is available, each routine below is a 1:1 mapping to a `Routine` row.

### 3.1 Daily routines (Mon–Fri, 08:00 UTC)

| ID | Time (UTC) | Routine | Owner agent | Trigger | Output |
|---|---|---|---|---|---|
| D-01 | 08:00 | **Daily Cash Position** — pull prior-day bank balances (C1, C2, C3, Mali operating) from Google Sheets "Daily Cash" tab, compute net, flag < threshold. | FIN-TR | Cron daily 08:00 | 1-paragraph note + table in `Briefings/2026-07/DD-cash.md` |
| D-02 | 08:30 | **AP Inbox Triage** — scan Gmail for vendor invoices, log to AP register (Sheets), flag missing PO/receipt. | FIN-AP | Cron daily 08:30 | AP register rows added; Slack-style digest to owner. |
| D-03 | 09:00 | **AR Collections** — pull aging report, draft collection emails for invoices > 30 days. | FIN-AR | Cron daily 09:00 | 1-3 draft emails queued for owner approval. |
| D-04 | 17:00 | **Day-end Journal Check** — review today's proposed journal entries, ensure debits = credits, push to GL. | FIN-GL | Cron daily 17:00 | Journal summary + "OK to post" prompt. |
| D-05 | 17:30 | **Client Email Triage** — read overnight client emails, classify, draft replies. | SUP-CS | Cron daily 17:30 | Triaged inbox + draft replies for >$ impact. |

### 3.2 Weekly routines

| ID | Cadence | Routine | Owner agent | Output |
|---|---|---|---|---|
| W-01 | Mon 09:00 | **Weekly WIP / Pipeline Review** — open engagements, hours-to-bill, blockers. | CS-Health + FIN-FPA | 1-page WIP report. |
| W-02 | Tue 10:00 | **Payroll Prep** — for the two payroll clients (C1 weekly, C2 bi-weekly), compute gross-to-net, prepare journal. | FIN-PR | Pay register + JE. |
| W-03 | Wed 14:00 | **Vendor 1099 / 1099-NEC Tracking** — YTD vendor payments; flag >$600 thresholds. | FIN-AP + FIN-TAX | 1099 workpaper (Q3 prep). |
| W-04 | Thu 11:00 | **Fixed Asset Reconciliation** — sample-check capex additions, depreciation, disposals. | FIN-FA | Variance note. |
| W-05 | Fri 15:00 | **Management Report Draft** — flash P&L, cash, AR/AP aging, budget vs actual for Mali + each client. | FIN-FR | Draft pack saved to Drive. |
| W-06 | Fri 16:00 | **Owner Weekly Briefing** — single summary combining D-01..D-05 + W-01..W-05. | SP-STR | Briefing doc + 5-bullet email to owner. |

### 3.3 Monthly routines (Month-End Close, July 2026)

| ID | Date | Routine | Owner agent | Output |
|---|---|---|---|---|
| M-01 | 07-30 | **Pre-close checklist** — confirm all D-series ran, all bank recs done, all W-series complete. | FIN-BOOK | Checklist + go/no-go. |
| M-02 | 07-31 | **Bank & Credit Card Reconciliations** (C1, C2, C3, Mali). | FIN-GL | Recs signed off. |
| M-03 | 07-31 | **Accruals & Prepaids** — compute and post. | FIN-GL | JEs posted. |
| M-04 | 07-31 | **Depreciation Run** — post monthly depreciation. | FIN-FA | JE posted. |
| M-05 | 08-01 | **Trial Balance** — pull, review for anomalies. | FIN-GL | TB report. |
| M-06 | 08-02 | **Financial Statements** — IS, BS, CF, equity rollforward. | FIN-FR | Draft FS. |
| M-07 | 08-03 | **Budget vs Actual** — variance commentary. | FIN-BUD | Commentary doc. |
| M-08 | 08-04 | **Tax Provision (Mali + C3)** — current & deferred tax estimate. | FIN-TAX | Tax memo. |
| M-09 | 08-05 | **Client Delivery Pack** — combine FS + commentary, PDF, send via Brevo (when connected) or Gmail. | CS-Renewal + FIN-FR | PDF + delivery email. |
| M-10 | 08-06 | **Internal Mali P&L** — close Mali's own books (the firm's revenue, expenses, profitability). | FIN-BOOK | Mali P&L. |
| M-11 | 08-07 | **Close Retrospective** — what slipped, what to fix next month. | SP-STR | Retro doc. |

### 3.4 Ad-hoc / one-time

| ID | Trigger | Routine | Owner agent |
|---|---|---|---|
| A-01 | New client signed | Onboarding workflow: collect prior-year FS, set up COA, connect bank feeds, schedule kickoff. | CS-Onboarding |
| A-02 | Invoice dispute | Escalation: research, draft position memo, loop in Legal if > $5k. | FIN-AR + LEG-CM |
| A-03 | Vendor contract > $10k | Contract review + redline. | LEG-CM + FIN-AP |
| A-04 | Quarterly | Tax projection update (Q3 for owners of C1/C2/C3). | FIN-TAX |
| A-05 | Annual | 1099 / 1096 dispatch (Jan), 1094/1095-C (if applicable), W-2/W-3 (Jan). | FIN-PR + FIN-TAX |

---

## 4. Workflows (current state + manual adapters)

The platform's Workflow Automation engine is **not yet shipped** (see `workflow-automation.md`). Until then, every workflow below is implemented as a **Command Center chat script** that the owner runs on the named trigger; the agents do the work in sequence.

### 4.1 Workflow: New Client Onboarding (A-01)
**Trigger:** New engagement letter signed.
**Steps:**
1. CS-Onboarding creates a client folder in Drive: `Clients/{ClientCode}/`, with subfolders `00-Admin`, `10-Financials`, `20-Tax`, `30-Payroll`, `40-Reports`.
2. CS-Onboarding drafts an information request list (prior 2 years FS, tax returns, bank statements, COA) and emails it to the client.
3. FIN-BOOK + FIN-GL design the COA from the `Accounting` department template (12 sub-agents' standard chart).
4. CS-Onboarding schedules kickoff call via Google Calendar.
5. FIN-AP + FIN-AR set up vendor/customer master files.
6. FIN-PR sets up payroll calendar.
7. CS-Health registers the client in the health-score tracker.
**Output:** Onboarding complete checklist + first month-end runbook.

### 4.2 Workflow: Month-End Close (M-01 → M-11)
Sequential handoff chain. Each step's output becomes the next step's input. See §3.3 for the full sequence.

### 4.3 Workflow: Collections Escalation
**Trigger:** Invoice > 45 days past due, owner approves.
1. FIN-AR drafts initial collection email (D-03 routine).
2. If no response in 7 days → FIN-AR drafts second notice.
3. If still unpaid > 60 days → FIN-AR + LEG-CM draft a formal demand letter referencing the original invoice and the engagement contract.
4. If still unpaid > 90 days → FIN-AR + FIN-BOOK recommend: write-off, payment plan, or attorney referral.
5. CS-Health flags the client account with elevated risk.

### 4.4 Workflow: Vendor Onboarding + 1099 Tracking
**Trigger:** New vendor added.
1. FIN-AP captures W-9 (or W-8 for non-US).
2. FIN-AP classifies: 1099-NEC eligible? >$600 threshold tracking enabled.
3. FIN-TAX reviews for backup withholding requirements.
4. FIN-AP sets payment terms and AP register entry.
5. Quarterly (W-03), FIN-AP + FIN-TAX reconcile YTD 109s.

### 4.5 Workflow: Approvals (per Hermes / approval engine)
All of the following require owner approval before posting:
- Journal entries > $5,000 (single line or aggregate)
- Vendor payments > $2,000
- Payroll runs (any)
- Client invoices / engagement letters (any)
- Tax filings (any)
- Write-offs > $500
- 1099 issuance

Use the ApprovalsWidget (right column of /home) to triage daily.

---

## 5. Goal Cascade (OKRs, August 2026)

### Objective 1 — Run a real accounting practice on NeureCore
| KR | Target | Owner |
|---|---|---|
| KR1.1 | All 12 Accounting sub-dept agents activated and assigned | Owner + FIN-BOOK |
| KR1.2 | ≥ 90% of D-routines run without manual intervention for the full month | FIN-BOOK |
| KR1.3 | Month-end close for C1, C2, C3, Mali completed by 08-06 | FIN-BOOK + FIN-FR |
| KR1.4 | Zero material misstatements in trial balance (TB ties to GL) | FIN-GL |

### Objective 2 — Deliver a great client experience
| KR | Target | Owner |
|---|---|---|
| KR2.1 | All client reports delivered within 5 business days of month-end | CS-Renewal + FIN-FR |
| KR2.2 | All client emails responded to within 1 business day | SUP-CS + CS-Health |
| KR2.3 | ≥ 1 client health review completed per client per month | CS-Health |
| KR2.4 | Zero client escalations to Legal | CS-Health + LEG-CC |

### Objective 3 — Grow the firm
| KR | Target | Owner |
|---|---|---|
| KR3.1 | 1 new client onboarded by 08-08 | CS-Onboarding |
| KR3.2 | Mali operating margin > 60% (revenue $2,250 + own billing) | FIN-FPA |
| KR3.3 | Pipeline of 3+ qualified prospects by month end | CS-Onboarding + FIN-MA |
| KR3.4 | One thought-leadership piece published (e.g. "July 2026 SMB Tax Calendar") | SP-RES + FIN-TAX |

---

## 6. Project Plan — Week by Week

### Week 1 (07-09 → 07-15): **Foundation & Activation**
**Theme:** Bring the workforce online.

| Day | Owner | Task | Agent(s) | Deliverable |
|---|---|---|---|---|
| W1D1 (Thu) | Owner | Health check: log in to hq.neurecore.com, review agent list, confirm all 27 present. | — | Health-check note. |
| W1D1 | Owner | Try to assign dormant Accounting sub-dept agents to the `Accounting` department (4daf4d34...). | — | If 403 persists, log + work around via Start toggle. |
| W1D1 | FIN-BOOK | Draft the **Chart of Accounts Standard** doc (5-digit accounts: 1000-1999 Assets, 2000-2999 Liab, 3000-3999 Equity, 4000-4999 Rev, 5000-5999 COGS, 6000-7999 OpEx, 8000-8999 Other, 9000-9999 Memo). | FIN-BOOK | COA Standard v1. |
| W1D2 (Fri) | FIN-GL | Open the July GL for C1, C2, C3, Mali. | FIN-GL | GL ledgers initialized. |
| W1D2 | FIN-AP | Build the **Vendor Master** template (W-9, 1099 box, payment terms, default GL). | FIN-AP | Vendor Master template. |
| W1D2 | FIN-AR | Build the **Customer Master** template. | FIN-AR | Customer Master template. |
| W1D3 (Sat) | — | (no scheduled work — catch-up buffer) | — | — |
| W1D4 (Sun) | — | (no scheduled work) | — | — |
| W1D5 (Mon) | All depts | **Daily routines D-01..D-05 begin.** | Multiple | First daily pack. |
| W1D5 | CS-Onboarding | Run W-01 WIP review. | CS-Health + FIN-FPA | WIP doc. |
| W1D6 (Tue) | FIN-PR | W-02 payroll prep for C1. | FIN-PR | Pay register v1. |
| W1D7 (Wed) | FIN-TAX + FIN-AP | W-03 1099 tracking (YTD). | FIN-TAX + FIN-AP | 1099 workpaper v1. |
| W1D7 | FIN-FA | W-04 fixed-asset check. | FIN-FA | Variance note. |

### Week 2 (07-16 → 07-22): **Operations & First Monthly Cycle**
**Theme:** Run the daily/weekly cadence; deliver first weekly briefing.

| Day | Owner | Task | Agent(s) | Deliverable |
|---|---|---|---|---|
| W2D1-W2D5 | All | Daily + weekly routines continue (D-01..D-05, W-01..W-05). | Multiple | Daily packs + WIP + payroll + 1099 + FA + mgmt report draft. |
| W2D5 (Fri) | SP-STR | W-06 owner weekly briefing. | SP-STR | Briefing #1 to owner. |
| W2D3 (Wed) | CS-Onboarding | Outreach to 3 prospects identified in pipeline. | CS-Onboarding | Outreach log. |
| W2D4 (Thu) | FIN-FPA | Mid-month Mali P&L flash. | FIN-FPA | Flash P&L. |
| W2D5 (Fri) | FIN-FA | Run mid-month depreciation (for clients on mid-month convention). | FIN-FA | Mid-month JE. |

### Week 3 (07-23 → 07-29): **Pre-Close & Onboarding Push**
**Theme:** Pre-close for July 2026; sign 1 new client.

| Day | Owner | Task | Agent(s) | Deliverable |
|---|---|---|---|---|
| W3D1-W3D5 | All | Daily + weekly routines continue. | Multiple | — |
| W3D1 (Mon) | FIN-BOOK | M-01 pre-close checklist. | FIN-BOOK | Pre-close go/no-go. |
| W3D2 (Tue) | CS-Onboarding | Target close date for 1 new client engagement letter. | CS-Onboarding | Signed letter. |
| W3D3 (Wed) | CS-Onboarding | Kick off A-01 onboarding workflow for the new client. | CS-Onboarding + FIN-BOOK | Onboarding plan. |
| W3D3 | FIN-AP | Vendor 1099 mid-year reconciliation; flag any missing W-9s. | FIN-AP | Missing-W-9 list. |
| W3D4 (Thu) | FIN-PR | Payroll for the new client — first run. | FIN-PR | Pay register + JE. |
| W3D5 (Fri) | SP-STR | W-06 owner weekly briefing #2. | SP-STR | Briefing #2. |
| W3D5 | FIN-FR | Draft month-end report template (cover, IS, BS, CF, KPI, commentary). | FIN-FR | Template v1. |

### Week 4 (07-30 → 08-08): **Month-End Close & Delivery**
**Theme:** Close July 2026 and deliver client packs.

| Day | Owner | Task | Agent(s) | Deliverable |
|---|---|---|---|---|
| W4D1 (Wed 07-30) | FIN-BOOK | M-01 pre-close checklist run; bank/CC recs in progress. | FIN-BOOK | Checklist sign-off. |
| W4D1 | FIN-FA | M-04 mid-month → end-of-month depreciation sweep (catch-up). | FIN-FA | Depreciation JE. |
| W4D2 (Thu 07-31) | FIN-GL | M-02 bank recs complete for all 4 entities. | FIN-GL | Recs signed. |
| W4D2 | FIN-GL | M-03 accruals & prepaids posted. | FIN-GL | JEs. |
| W4D3 (Fri 08-01) | FIN-GL | M-05 trial balance pulled & reviewed. | FIN-GL | TB. |
| W4D3 | FIN-BOOK | Variance investigation on any TB anomalies. | FIN-BOOK | Anomaly note. |
| W4D3 | FIN-TAX | Q3 tax projection refresh for owner of C3. | FIN-TAX | Tax memo. |
| W4D4 (Sat 08-02) | FIN-FR | M-06 financial statements drafted (C1, C2, C3, Mali). | FIN-FR | Draft FS x4. |
| W4D5 (Sun 08-03) | FIN-BUD | M-07 budget vs actual. | FIN-BUD | BvA commentary. |
| W4D5 | FIN-COST | Cost analysis for C1 (bakery — food cost, labor cost). | FIN-COST | Cost memo. |
| W4D6 (Mon 08-04) | FIN-TAX | M-08 tax provision (Mali + C3). | FIN-TAX | Tax memo. |
| W4D6 | FIN-IC | Intercompany elimination entries (C3 → C1/C2 if any). | FIN-IC | Eliminations. |
| W4D7 (Tue 08-05) | FIN-FR + CS-Renewal | M-09 client delivery pack assembled. | FIN-FR + CS-Renewal | PDFs ready. |
| W4D7 | Owner | Owner reviews & approves each client pack. | Owner | Sign-off. |
| W4D8 (Wed 08-06) | CS-Renewal | M-09 client packs delivered. | CS-Renewal | Delivery confirmations. |
| W4D8 | FIN-BOOK | M-10 internal Mali P&L closed. | FIN-BOOK | Mali P&L. |
| W4D9 (Thu 08-07) | SP-STR | M-11 close retrospective. | SP-STR | Retro doc. |
| W4D9 | FIN-FPA | August forecast & Mali margin check (KR3.2). | FIN-FPA | Forecast. |
| W4D10 (Fri 08-08) | SP-STR | W-06 owner weekly briefing #4 (month-end edition). | SP-STR | Briefing #4. |
| W4D10 | Owner | End-of-month sign-off: close the July books; lock the period. | FIN-GL | Period locked. |

---

## 7. Communication & Meeting Cadence

| Meeting | Cadence | Attendees | Duration | Owner |
|---|---|---|---|---|
| Daily standup (async) | Mon-Fri 08:30 UTC | All agents (output digest) | 5 min read | FIN-BOOK |
| Owner inbox triage | Mon-Fri 09:00 UTC | Owner + SUP-CS | 15 min | Owner |
| Weekly WIP | Mon 09:00 UTC | Owner + CS-Health + FIN-FPA | 30 min | CS-Health |
| Monthly close kickoff | Last business day of month | Owner + FIN-BOOK + FIN-GL | 30 min | FIN-BOOK |
| Client check-in (per client) | Monthly | Client + Owner + CS-Renewal | 30 min | CS-Renewal |
| Tax sync | Monthly (or quarterly) | Owner + FIN-TAX | 30 min | FIN-TAX |
| Legal review (if needed) | Ad-hoc | Owner + LEG-CC + relevant agent | 30 min | LEG-CC |
| HR / firm-people sync | Monthly | Owner + HR-GEN | 30 min | HR-GEN |

Channel conventions (within the Hermes / Communication Platform — when COMM_* flags are flipped on):
- **#firm-general** — firmwide announcements.
- **#client-c1 / c2 / c3** — per-client working channel.
- **#close-july** — month-end working channel (created W4D1, archived after M-11).
- **#approvals** — approval queue feed (mapped to the ApprovalsWidget).

Until COMM_* flags are enabled, all "chat" between agents and the owner happens through:
1. The **Command Center** chat panel (`/command-center` or `/home` chat).
2. **Email digests** via the Google Workspace integration (Gmail + Drive + Calendar).
3. **Shared Google Drive folders** for handoffs.

---

## 8. Tooling & Integrations in Use

| Tool | Status | Used for |
|---|---|---|
| Google Workspace (Gmail/Calendar/Drive/Sheets) | **Connected** (expires 2026-07-07 → must re-auth immediately) | Email, calendar, all working files, daily cash sheet, AP/AR registers, COA, client packs. |
| Brevo email relay | **Not connected** | Optional: agent email aliases. Connect during W1 if owner wants 300/day free alias. |
| Command Center chat | Available | Primary agent interface. |
| Approvals widget | Available | Owner approval queue. |
| Activity feed | Available | Real-time visibility into what each agent is doing. |
| Hermes (cross-agent comms) | **COMM_* flags off** | Use the chat panel as a substitute until enabled. |
| Workflow Automation | **Not built** | Implemented as chat scripts. |
| Routines UI | **Not built** | Implemented as recurring chat prompts. |

**Immediate action (W1D1):** Re-authenticate Google Workspace (it expired 2026-07-07). Without it, the entire operating cadence breaks.

---

## 9. Risk Register & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Deploy/PATCH endpoints still 403 on 2026-07-09 | Med | High | Use Start toggle; report to backend team; manual department assignment via direct DB only as last resort. |
| R2 | Google Workspace token expired | High | High | Re-auth on W1D1; if SSO flow broken, escalate to cc.neurecore.com admin team. |
| R3 | Routines UI not available | High | Med | Run routines as owner-initiated chat prompts; document timestamps for audit. |
| R4 | Workflow engine not available | High | Med | Implement workflows as numbered chat scripts; build a "playbook library" in Drive. |
| R5 | Agent context drift / hallucinations | Med | Med | Owner reviews every output > $1,000 impact; weekly FP&A spot-checks. |
| R6 | Client deliverable slip | Med | High | Pre-close checklist (M-01); 2-day buffer in W4; W-06 briefing tracks progress. |
| R7 | Month-end close overrun | Med | High | Hard deadline 08-06 17:00 UTC; if miss, deliver "interim" pack by EOD, final by 08-08. |
| R8 | Payroll error (C1 weekly) | Low | High | FIN-PR pre-flight check; owner dual-signs every payroll run. |
| R9 | Tax compliance miss | Low | High | FIN-TAX owns calendar; quarterly tax projection (A-04). |
| R10 | Client churn | Low | Med | CS-Health monthly review; CS-Renewal 60-day pre-renewal conversation. |

---

## 10. Success Metrics (Month-End Review, 2026-08-08)

| Metric | Target | Source |
|---|---|---|
| Daily routines executed | ≥ 90% | Routine log (manual for now) |
| Weekly routines executed | 100% | Routine log |
| Monthly close on-time (C1, C2, C3, Mali) | 4/4 by 08-06 | Close calendar |
| TB ties to GL | 4/4 | FIN-GL rec |
| Client delivery on-time | 100% by 08-06 | Delivery log |
| Client emails < 1 business day response | ≥ 95% | Email timestamps |
| New clients onboarded | ≥ 1 | Engagement letters |
| Mali operating margin | ≥ 60% | Mali P&L |
| Agent utilization (active hours / capacity) | ≥ 40% | Activity feed |
| Owner approval SLA | < 4 business hours | Approvals log |

---

## 11. Open Questions / Decisions Needed

1. **Q1:** Does the owner want Brevo connected for agent email aliases? (Recommended: yes, 300 emails/day free, gives agents real-looking email.)
2. **Q2:** Is the **Accounting** department (4daf4d34) the right place for the 12 sub-agents, or should each be its own sub-department? Current memory bank shows 12 empty sub-departments; flat-by-firm is simpler.
3. **Q3:** Daily/weekly routines — confirm the times (all UTC). Owner is en-US/UTC tenant; if owner is in a different timezone, shift all times accordingly.
4. **Q4:** Which two clients are C1, C2, C3 in reality? Replace placeholders with real names.
5. **Q5:** Confirm client fee structure ($2,250/month example) and whether any clients are flat-fee vs hourly.
6. **Q6:** Brevo status — connect or skip?
7. **Q7:** When does the owner want to flip the COMM_* flags? (Per `system-state.md`, the Enterprise Communication Platform is implemented but feature-flagged off.) Recommend flipping `COMM_DIGEST_ENABLED`, `COMM_THREADS_ENABLED`, `AGENT_MESSAGING_ENABLED` after Week 1 to test.

---

## 12. Handoff to Operations

After the W4D10 sign-off:
- The daily/weekly/monthly routine calendar **continues into August** (rotate M-01..M-11 to August dates).
- KR tracking rolls forward (O1, O2, O3 continue; refresh targets).
- This document is archived to the tenant memory bank (proposed path: `neurecore/memory-bank-new/tenants/mali-live-com-plans/2026-07-08-one-month-plan.md`).
- A **month-2 plan** is drafted in the last week of August using the same skeleton.

---

**Approved by:** Mali Owner (pending)
**Plan author:** Kilo
**Plan date:** 2026-07-08
**Next review:** 2026-08-08 (month-end retrospective)
