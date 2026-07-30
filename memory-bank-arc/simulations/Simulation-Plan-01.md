# Simulation Plan-01: Accounting Project Management Through AI Employees

**Simulation ID:** SIM-01
**Date:** 2026-07-25
**Tenant:** umarabdullah@gmail.com
**Industry:** Accounting & Audit Services (`accounting-audit-services`)
**Customer:** Bakers Pizza
**Objective:** Verify NeureCore can manage accounting projects through AI employees via frontend browser
**Status:** PENDING APPROVAL

---

## 1. Test Objective

Verify that the NeureCore system can:
1. Authenticate as tenant `umarabdullah@gmail.com` (Shahikhail@@0098)
2. Create a customer "Bakers Pizza" (a pizza restaurant business)
3. Create an accounting project for Bakers Pizza (Bookkeeping Cycle)
4. Have AI employees execute tasks within the project
5. Complete the project lifecycle (Lead → Active → Completed)
6. Demonstrate end-to-end accounting project management through AI employees

---

## 2. Pre-Conditions

| Item | Status | Notes |
|------|--------|-------|
| Tenant account exists | ? | umarabdullah@gmail.com with password Shahikhail@@0098 |
| Tenant industry | ? | Should be `accounting-audit-services` |
| Browser automation ready | ✅ | Playwright/heavy-browser.js available |
| Simulation folder created | ✅ | `/memory-bank-new/simulations/` |
| Previous audit reports reviewed | ✅ | Run-6 professional verification complete |

---

## 3. Simulation URL & Credentials

| Item | Value |
|------|-------|
| Tenant Frontend | https://hq.neurecore.com |
| Backend API | https://brain.neurecore.com/api/v1 |
| Login Email | umarabdullah@gmail.com |
| Login Password | Shahikhail@@0098 |

---

## 4. Simulation Stages

### Stage 1: Authentication & Dashboard Verification

**Objective:** Login to tenant frontend and verify dashboard loads

**Steps:**
1. Navigate to https://hq.neurecore.com
2. Click Login
3. Enter email: umarabdullah@gmail.com
4. Enter password: Shahikhail@@0098
5. Submit login form
6. Verify dashboard loads with tenant-specific UI

**Expected Results:**
- Login successful (JWT issued)
- Dashboard shows accounting industry context
- Left navigation shows: Home, Customers, Projects, Departments, Marketplace, Workspace (with accounting extras), Finance, Intelligence, Settings

**Success Criteria:**
- [ ] Login form submits without error
- [ ] Dashboard loads with tenant name visible
- [ ] Industry indicator shows "Accounting & Audit Services" or similar

---

### Stage 2: Customer Creation - Bakers Pizza

**Objective:** Create a new customer "Bakers Pizza" with appropriate accounting fields

**Steps:**
1. From dashboard, click "Customers" in left navigation
2. Click "New Customer" or "+" button
3. Fill customer form:
   - **Customer Name:** Bakers Pizza
   - **Industry:** Restaurant/Food Service (or appropriate sub-industry)
   - **Client Type:** Small Business
   - **Service Type:** Bookkeeping Cycle
   - **Engagement Status:** Prospect
   - **Fiscal Year End:** December 31
4. Save customer

**Expected Results:**
- Customer created successfully
- Customer appears in customers list
- Customer detail page shows all accounting-specific fields

**Success Criteria:**
- [ ] Customer form saves without validation errors
- [ ] Customer appears in list with name "Bakers Pizza"
- [ ] Customer detail page shows industry-specific fields (Client Type, Service Type, etc.)

---

### Stage 3: Project Creation - Bookkeeping Cycle for Bakers Pizza

**Objective:** Create a Bookkeeping Cycle project linked to Bakers Pizza customer

**Steps:**
1. From dashboard or Customers page, navigate to Projects
2. Click "New Project" or "+" button
3. Fill project form:
   - **Project Name:** Bakers Pizza - Monthly Bookkeeping (Q3 2026)
   - **Project Type:** Bookkeeping Cycle
   - **Customer:** Bakers Pizza (linked)
   - **Industry:** Accounting & Audit Services
   - **Description:** Monthly bookkeeping and financial close for Bakers Pizza restaurant
   - **Priority:** Medium
   - **Target Date:** 2026-09-30 (quarter-end)
4. Save project

**Expected Results:**
- Project created with LEAD status
- Project linked to Bakers Pizza customer
- Project shows 5 standard stages: Bank Rec → Journal Entries → Reconciliation → Adjustments → Close

**Success Criteria:**
- [ ] Project created with Bookkeeping Cycle type
- [ ] Project status is LEAD
- [ ] Project appears in projects list
- [ ] Project detail page shows linked customer

---

### Stage 4: AI Employee Task Assignment & Execution

**Objective:** Verify AI employees can be assigned and execute tasks within the project

**Steps:**
1. Open the Bakers Pizza Bookkeeping project
2. Navigate to Tasks or Goals section
3. Create or view tasks:
   - **Task 1:** Prepare bank reconciliation for July 2026
   - **Task 2:** Record journal entries for the month
   - **Task 3:** Reconcile credit card statements
4. Assign tasks to AI employees (Bookkeeper, Tax Specialist)
5. Initiate task execution via AI chat or direct assignment
6. Monitor AI employee responses and task status changes

**Expected Results:**
- Tasks visible in project
- AI employees can be assigned to tasks
- AI responds with execution plan
- Task status progresses: QUEUED → IN_PROGRESS → NEEDS_REVIEW

**Success Criteria:**
- [ ] Tasks created within project
- [ ] At least one AI employee assigned
- [ ] AI employee responds to task assignment
- [ ] Task status changes reflect AI activity

---

### Stage 5: Project Lifecycle Progression

**Objective:** Move project through lifecycle stages using AI employees

**Steps:**
1. **Lead → Proposal Sent:** AI generates proposal summary
2. **Proposal Sent → Won:** Mark as Won (manual or AI-triggered)
3. **Won → Active:** Project becomes Active, AI begins work
4. **Active → Review:** AI completes fieldwork, moves to review
5. **Review → Completed:** All tasks approved, project completed
6. Verify project appears in Completed/Archived section

**Expected Results:**
- Project status correctly reflects lifecycle stage
- AI activity logged in execution log
- Timeline shows stage transitions
- Completed project shows all deliverables

**Success Criteria:**
- [ ] Project progresses through lifecycle stages
- [ ] Stage transitions are logged
- [ ] Project ends in Completed status
- [ ] Completion summary generated

---

### Stage 6: Financial Tracking & Reporting

**Objective:** Verify accounting-specific financial tracking features

**Steps:**
1. Within Bakers Pizza project, navigate to Financials or related section
2. Verify budget/time tracking capabilities
3. Check if invoice milestones are visible (if applicable)
4. Access or generate reports

**Expected Results:**
- Financial tracking section accessible
- Budget vs. actual visible (if project has budget)
- Reports section shows accounting templates

**Success Criteria:**
- [ ] Financials section accessible
- [ ] At least one financial report template visible

---

## 5. Success Criteria Summary

| # | Criterion | Weight |
|---|-----------|--------|
| 1 | Login and dashboard access | Critical |
| 2 | Customer "Bakers Pizza" created with accounting fields | Critical |
| 3 | Bookkeeping Cycle project created and linked to customer | Critical |
| 4 | AI employees assignable to project tasks | High |
| 5 | AI employees respond and execute tasks | High |
| 6 | Project progresses through lifecycle stages | High |
| 7 | Project completes with all stages documented | Medium |
| 8 | Financial tracking features visible | Medium |

**Overall Pass:** 5/8 Critical + High criteria must pass

---

## 6. Evidence Collection

For each stage, capture:
- Screenshot of key UI state
- Timestamp of action
- Any error messages or warnings
- AI employee responses (chat history)

**Evidence Files:**
```
simulations/Simulation-01-Bakers-Pizza/
├── stage1-login-dashboard.png
├── stage2-customer-created.png
├── stage2-customer-detail.png
├── stage3-project-created.png
├── stage4-ai-assignment.png
├── stage4-ai-response.png
├── stage5-lifecycle-progression.png
├── stage6-financials.png
└── final-report.md
```

---

## 7. Risk Factors & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tenant not registered or password invalid | Medium | Blocked | Confirm credentials before simulation |
| Tenant not on accounting-audit-services industry | Medium | Partial | Note industry mismatch, adjust expectations |
| AI chat returns error or times out | Medium | Medium | Retry with shorter prompt |
| Socket.IO 400 errors interfere | Low | Low | Ignore, documented known issue |
| JWT session expires mid-simulation | Medium | Medium | Keep session active, avoid idle |

---

## 8. Simulation Execution Notes

- **Browser:** Headed Chrome via playwright/heavy-browser.js
- **Approach:** Real browser automation, not API calls
- **Interactivity:** Each stage waits for page load before action
- **Errors:** Log and continue, document all failures
- **Approval Required:** Yes - await user approval before starting

---

## 9. Next Steps After Approval

1. Execute simulation stages in order
2. Collect evidence screenshots
3. Document any deviations from expected
4. Generate final report in `simulations/Simulation-01-Bakers-Pizza/final-report.md`
5. Present findings for review

---

**Prepared by:** Kilo Agent
**Awaiting:** User approval to begin execution
