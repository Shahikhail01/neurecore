# NeureCore Comprehensive Testing — Validation Checklist

Use this checklist to track progress through all 5 phases of comprehensive testing.

---

## Phase 1: Platform Readiness Check

### 1.1 Health & Connectivity

- [ ] Backend responding: `GET /api/v1/health` → 200 with `{ status: "ok" }`
- [ ] Tenant data retrieved: `GET /api/v1/tenants/me` → demo@marketing details
- [ ] Agent count: ≥10 agents deployed
- [ ] API authentication working (Bearer token valid)

### 1.2 Tool Registry Audit

- [ ] Script executed: `bash ./templates/tool-registry-audit.sh`
- [ ] Tool test results CSV generated: `tool-test-results.csv`
- [ ] Pass rate: ≥20/26 tools (76% minimum)
- [ ] All pure tools passing (calculator, web-search, database-query, email-send, document-summary)
- [ ] Google OAuth tools ready (drive, sheets, docs, gmail)
- [ ] Known fails documented (SMTP, LLM key, Serper key, HubSpot key)

### 1.3 Tenant & Agent Verification

- [ ] Tenant ID: `4109424f-59fa-463a-8f5e-52299fcf47f0`
- [ ] Email: `demo@marketing-agency.local`
- [ ] Password: `Marketing@123!` (test login works)
- [ ] 10 agents deployed and visible in `/agents` list
- [ ] Agents list:
  - [ ] Content Creator Pro
  - [ ] Lead Analyzer
  - [ ] Campaign Orchestrator
  - [ ] Analytics Master
  - [ ] Social Media Manager
  - [ ] Client Success Lead
  - [ ] CRM Sync Bot
  - [ ] Brand Guardian
  - [ ] Research & Insights
  - [ ] Admin Coordinator

### 1.4 Seed Data Reset

- [ ] Old data cleared (if needed): `cd backend && node e2e-marketing-demo.mjs --reset`
- [ ] Dashboard shows:
  - [ ] 65+ tasks seeded
  - [ ] 11 workflows
  - [ ] 10 agents
  - [ ] 0–5 pending tasks

**Phase 1 Status**: ✅ / ❌ Pass / Fail

---

## Phase 2: Google Workspace Integration

### 2.1 Gmail OAuth Connection

- [ ] OAuth consent flow completed
- [ ] Scopes granted: gmail, drive, sheets, docs, calendar
- [ ] Connector status: CONNECTED
- [ ] Token in database (check `connectors` table)
- [ ] Re-authentication test: Settings → Google Gmail → Reconnect → Success

### 2.2 Email Aliases Created

| Alias                               | Status | Test                 |
| ----------------------------------- | ------ | -------------------- |
| marketing-campaigns@gecdropship.com | ✅/❌  | Can send from? ✅/❌ |
| client-relations@gecdropship.com    | ✅/❌  | Can send from? ✅/❌ |
| analytics@gecdropship.com           | ✅/❌  | Can send from? ✅/❌ |
| creative@gecdropship.com            | ✅/❌  | Can send from? ✅/❌ |
| strategy@gecdropship.com            | ✅/❌  | Can send from? ✅/❌ |

### 2.3 Google Drive Structure

- [ ] Root folder "NeureCore Demo" created
- [ ] Shared with gecdropship@gmail.com (owner)
- [ ] Sub-folders created (run count: ✅ / ❌)
  - [ ] Client Work (3 client subfolders)
  - [ ] Content Library (5 sub-sections)
  - [ ] Analytics & Reports (4 sub-sections)
  - [ ] Team Resources (3 sub-sections)
  - [ ] Archive (1 section)

### 2.4 Google Docs & Sheets

- [ ] Campaign Brief Template created & shared
- [ ] Proposal Template created & shared
- [ ] Meeting Notes Template created & shared
- [ ] Post-Mortem Template created & shared
- [ ] Content Calendar Sheets created (30+ rows, 7 columns)
- [ ] Lead Tracking Sheets created (20+ rows, 9 columns)
- [ ] Budget Tracker Sheets created (10+ rows, 7 columns)
- [ ] KPI Dashboard Sheets created (linked formulas: ✅/❌)
- [ ] A/B Test Results Sheets created (10+ rows)

### 2.5 Sample Files Uploaded

- [ ] Docs: ≥15 documents uploaded (briefs, proposals, content drafts)
- [ ] Sheets: ≥10 spreadsheets uploaded (calendars, trackers, reports)
- [ ] Slides: ≥5 presentations uploaded (client decks, analysis)
- [ ] Total files in Drive: ≥30

### 2.6 Tool Integration Test

- [ ] `document-summary` tool reads Google Docs: ✅ / ❌
- [ ] `google-sheets-append` tool updates Sheets: ✅ / ❌
- [ ] `email-send` tool sends from aliases: ✅ / ❌
- [ ] `calendar` tool reads events: ✅ / ❌

**Phase 2 Status**: ✅ / ❌ Pass / Fail

---

## Phase 3: Agent Capability Map

### 3.1 Feature Test Matrix (10 agents × 6 features)

#### Content Creator Pro

- [ ] Version Control: 3+ versions created, 1 rollback performed
- [ ] PII Detection: None expected (no sensitive data input)
- [ ] Cost Tracking: ≥$0.30 recorded
- [ ] Workflow Canvas: Used in campaign workflow
- [ ] Knowledge Spaces: Reads from research knowledge space
- [ ] Maturity: Started at L2, now ≥L2

#### Lead Analyzer

- [ ] Version Control: 1+ versions
- [ ] PII Detection: 20+ email addresses masked in logs
- [ ] Cost Tracking: ≥$0.05 recorded
- [ ] Database Queries: 2+ queries logged
- [ ] Email Sending: 20+ emails sent (rate limited)
- [ ] Maturity: L2 or higher

#### Campaign Orchestrator

- [ ] Workflow Canvas: 2+ workflows created
- [ ] Supervision: 1+ supervisor workflows executed
- [ ] Multi-step Orchestration: Research → Brief → Approve → Schedule executed
- [ ] Conditional Logic: Governance rule triggered (CTR < 2%)
- [ ] Integration: Calendar events + task creation working
- [ ] Maturity: L2 or higher

#### Analytics Master

- [ ] CSV Exports: 1+ CSV files generated
- [ ] Sheets Updates: 1+ sheets updated with new data
- [ ] Calculator: 3+ calculations performed (ROI, CAC, CPA)
- [ ] Cost Tracking: ≥$0.15 recorded
- [ ] Database Queries: 2+ queries executed
- [ ] Maturity: L2 or higher

#### Social Media Manager

- [ ] Calendar Integration: 15+ events created (posts scheduled)
- [ ] Sheets Reading: Content Calendar read successfully
- [ ] Task Management: 5+ tasks created
- [ ] Tool Combinations: Used 3+ tools in single workflow
- [ ] Cost Tracking: ≥$0.10 recorded
- [ ] Maturity: L1 or higher

#### Client Success Lead

- [ ] Email Sending: 3+ client emails sent
- [ ] PII Masking: Email addresses masked in logs
- [ ] Task Management: 3+ tasks logged
- [ ] Document Handling: Attachments sent with emails
- [ ] Cost Tracking: ≥$0.05 recorded
- [ ] Maturity: L1 or higher

#### CRM Sync Bot

- [ ] CRM Integration: 10+ records synced from HubSpot
- [ ] Task Creation: 2+ high-value deals escalated as tasks
- [ ] Data Mapping: Opportunity values correctly parsed
- [ ] Cost Tracking: ≥$0.05 recorded
- [ ] Maturity: L1

#### Brand Guardian

- [ ] Document Summary: 10+ assets audited
- [ ] Compliance Flagging: 1+ non-compliant asset flagged
- [ ] Version Control: 2+ versions created
- [ ] Knowledge Spaces: Accesses brand knowledge space
- [ ] Cost Tracking: ≥$0.10 recorded
- [ ] Maturity: L1 or higher

#### Research & Insights

- [ ] Web Search: 10+ searches executed (Serper)
- [ ] Knowledge Spaces: 50+ docs indexed
- [ ] Document Summary: Competitive research summarized
- [ ] Multi-step Workflow: Search → Index → Summarize executed
- [ ] Cost Tracking: ≥$0.20 recorded
- [ ] Maturity: L2

#### Admin Coordinator

- [ ] Approvals: 5+ approval requests processed
- [ ] Email Notifications: 3+ approval notification emails sent
- [ ] Task Management: Completion notifications logged
- [ ] PII Masking: Email addresses masked
- [ ] Version History: Agent version history reviewed
- [ ] Maturity: L1 or higher

**Phase 3 Status**: ✅ / ❌ Pass / Fail (# features passed: \_\_/60)

---

## Phase 4: Marketing Workflow Simulation (Weekly Scenario)

### Monday: Planning & Research

- [ ] **Research & Insights**: Competitive analysis task created
  - [ ] Web searches: ≥10 searches logged
  - [ ] Knowledge space indexed: ≥10 documents
  - [ ] Summary document created in Drive
- [ ] **Content Creator Pro**: Campaign brief drafted
  - [ ] 1 document created and versioned
  - [ ] 2+ LLM calls logged
  - [ ] Cost tracked: ≥$0.15
- [ ] **Campaign Orchestrator**: Planning workflow created
  - [ ] 4-node workflow saved
  - [ ] 2+ supervision nodes configured

### Tuesday: Content Creation & Approvals

- [ ] **Content Creator Pro**: 5 pieces of content created
  - [ ] 1 blog post (1500+ words)
  - [ ] 1 email sequence (3 emails)
  - [ ] 15 social posts in Sheets
  - [ ] 1 LinkedIn article
  - [ ] 1 case study
  - [ ] Cost tracked: ≥$0.30
  - [ ] 3+ versions created
- [ ] **Admin Coordinator**: Approval workflow executed
  - [ ] 5 approval requests created
  - [ ] 4 approved, 1 rejected
  - [ ] Revision request sent
- [ ] **Social Media Manager**: Calendar filled
  - [ ] 15 calendar events created (Wed–Fri dates)
  - [ ] 5 reminder tasks created

### Wednesday: Lead Gen & Analytics

- [ ] **Lead Analyzer**: New leads processed
  - [ ] 20 leads imported to database
  - [ ] 20 welcome emails sent
  - [ ] PII masking verified: ≥15 emails masked in logs
  - [ ] Cost tracked: ≤$0.05
- [ ] **Analytics Master**: Performance report generated
  - [ ] 1 CSV export created
  - [ ] Sheets updated with weekly summary
  - [ ] PDF report generated (document-summary)
  - [ ] 3+ calculator calls logged
- [ ] **Campaign Orchestrator**: Health check triggered
  - [ ] Governance rule fired (CTR < 2%)
  - [ ] Incident task created

### Thursday: Client Comms & CRM

- [ ] **Client Success Lead**: Check-in emails sent
  - [ ] 3 client emails sent
  - [ ] Analytics attached to emails
  - [ ] 3 tasks logged
- [ ] **CRM Sync Bot**: HubSpot sync executed
  - [ ] 10 opportunities synced
  - [ ] 2 high-value deals escalated
- [ ] **Admin Coordinator**: Approval queue processed
  - [ ] 2 requests reviewed
  - [ ] 1 approved, 1 pending (revised)

### Friday: Weekly Review & Optimization

- [ ] **Analytics Master**: KPI summary created
  - [ ] Week's data aggregated (5 campaigns, 20 leads, 15 approvals)
  - [ ] 1 CSV export
  - [ ] Sheets updated
  - [ ] ROI calculated per campaign
- [ ] **Brand Guardian**: Brand audit completed
  - [ ] 10 published assets scanned
  - [ ] 1 flagged for revision
- [ ] **Campaign Orchestrator**: Retrospective completed
  - [ ] 9 versions reviewed (3 agents × 3 versions avg)
  - [ ] Lessons-learned document created
  - [ ] Next week planning initiated

### Weekly Totals (Mon–Fri)

- [ ] Total tasks created: ≥40
- [ ] Total approvals: ≥5
- [ ] Total emails sent: ≥25
- [ ] Total cost: $15–$20
- [ ] Agents at L2+: ≥3

**Phase 4 Status**: ✅ / ❌ Pass / Fail

---

## Phase 5: Validation & Metrics

### 5.1 Cost Tracking

- [ ] Weekly spend captured: $15–$20
- [ ] Cost breakdown by agent:
  - [ ] Content Creator Pro: $5–$6
  - [ ] Analytics Master: $3–$4
  - [ ] Lead Analyzer: $2–$3
  - [ ] Others: $5–$10
- [ ] Budget policies enforced: ≥1 task rejected due to cost limit
- [ ] Cost records count: ≥50 rows

### 5.2 Version History & Rollback

- [ ] Content Creator Pro versions: ≥3, rollback performed
- [ ] Brand Guardian versions: ≥2
- [ ] Campaign Orchestrator versions: ≥1
- [ ] All versions have timestamps, change notes, active flag
- [ ] Rollback endpoint tested: ✅ / ❌

### 5.3 PII Masking Verification

- [ ] PII detection enabled: `PII_DETECTION_ENABLED=true` in `.env`
- [ ] Logs scanned for masking patterns: `grep REDACTED task-logs.log`
- [ ] Email patterns masked: ≥15 instances
- [ ] Phone patterns masked: ≥2 instances
- [ ] SSN/Credit card patterns (if logged): ≥1 instance

### 5.4 Agent Maturity Progression

- [ ] Maturity endpoint called: `GET /api/v1/analytics/maturity`
- [ ] Content Creator Pro: L3 (67+ points)
- [ ] Analytics Master: L2–L3 (45–67 points)
- [ ] Lead Analyzer: L2 (45–55 points)
- [ ] Campaign Orchestrator: L3 (61+ points)
- [ ] Other agents: L1–L2 (20–55 points)
- [ ] Trend: +points for all agents (week-over-week improvement)

### 5.5 Knowledge Space Validation

- [ ] Knowledge space count: ≥1 active space
- [ ] Documents indexed: ≥50
- [ ] Search tested: `GET /api/v1/knowledge-spaces/search?q=marketing`
- [ ] Results returned: ≥5 docs per search
- [ ] Agents with access: Research & Insights, Brand Guardian

### 5.6 Workflow Canvas & Supervision

- [ ] Workflows saved: ≥2
- [ ] Canvas nodes: ≥4 nodes in Campaign workflow
- [ ] Supervision tested: Supervisor → Workers executed
- [ ] Worker tasks completed: ✅ / ❌

### 5.7 Dashboard KPIs

- [ ] Dashboard displays all of:
  - [ ] Agents: 10
  - [ ] Workflows: 11
  - [ ] Tasks Completed: 40+
  - [ ] Pending Approvals: 0–2
  - [ ] Cost This Week: $15–$20
  - [ ] Agents at L3+: 3+
  - [ ] Active Knowledge Spaces: 1
  - [ ] Agent Grid: All 10 agents visible with status/workload

### 5.8 Deliverables Generated

- [ ] `test-results.json` created (Phase 1–5 summary)
- [ ] `cost-audit.csv` exported (all cost records)
- [ ] `version-history.csv` created (all agent versions)
- [ ] Screenshots captured:
  - [ ] Dashboard KPIs full view
  - [ ] Workflow canvas
  - [ ] Cost tracking page
  - [ ] Agent maturity chart
  - [ ] Approval queue
  - [ ] Google Drive integration
- [ ] Video walkthrough (optional): ✅ / ❌ 5-min demo

**Phase 5 Status**: ✅ / ❌ Pass / Fail

---

## OVERALL SUMMARY

| Phase                    | Status  | Notes            |
| ------------------------ | ------- | ---------------- |
| 1 — Platform Readiness   | ✅ / ❌ | \_\_\_           |
| 2 — Google Workspace     | ✅ / ❌ | \_\_\_           |
| 3 — Agent Capability     | ✅ / ❌ | \_\_/60 features |
| 4 — Weekly Simulation    | ✅ / ❌ | \_\_/40+ tasks   |
| 5 — Validation & Metrics | ✅ / ❌ | \_\_\_           |

### Next Steps (if all phases pass)

- [ ] Document findings in test report
- [ ] Address any blockers (note them above)
- [ ] **demo@marketing dashboard is portfolio-ready** ✅
- [ ] Use as basis for customer onboarding
- [ ] Commit test scripts to CI/CD pipeline (optional)

### Blockers / Issues Encountered

```
[List any failures, errors, or unexpected behaviors]
```

---

## Sign-Off

**Tester Name**: ******\_\_\_\_******  
**Date Completed**: ******\_\_\_\_******  
**Overall Result**: ✅ PASS / ❌ FAIL / ⚠️ PARTIAL

**Comments**:

```
[Additional notes on test experience, performance observations, recommendations]
```
