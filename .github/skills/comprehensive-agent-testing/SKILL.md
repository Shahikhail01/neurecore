---
name: comprehensive-agent-testing
description: "Comprehensive testing workflow for NeureCore AI agents. Use when: setting up end-to-end agent testing, creating realistic marketing agency scenarios, integrating Google Workspace, validating all tools and features, and demonstrating full platform capabilities in demo@marketing tenant."
---

# NeureCore Comprehensive Agent Testing Skill

**Purpose**: Create end-to-end test scenarios for all NeureCore AI agents and features, simulate a week of marketing agency work, integrate Google Workspace collaboration, and validate platform maturity.

**Scope**:

- All 10+ AI agents in demo@marketing tenant
- 50+ built-in tools and integrations
- Phase 1–4 features (versioning, PII masking, cost tracking, workflows, supervision, knowledge spaces, maturity scoring, agent packs, SSO)
- Google Workspace (Gmail, Drive, Docs, Sheets, Slides) via `gecdropship@gmail.com`
- Realistic marketing agency workflows (content creation, lead generation, analytics, client management, campaign orchestration)

**Prerequisites**:

- Active NeureCore backend (localhost:3000 or brain.neurecore.com)
- Frontend tenant running (localhost:3001 or production URL)
- Demo@marketing tenant provisioned with sample data
- Google Workspace account: `gecdropship@gmail.com` / `Shahikhail@F005698` (for drives, docs, sheets, slides, email aliases)
- Admin access to demo@marketing dashboard

---

## Overview: 5-Phase Testing Framework

```
Phase 1: Platform Readiness    → Health check, tenant validation, tool registry
Phase 2: Google Workspace      → Email setup, Drive org, Docs/Sheets/Slides templates
Phase 3: Agent Capability Map  → Test each agent's unique features and tool combinations
Phase 4: Marketing Workflows   → Simulate week of agency work (Mon–Fri scenarios)
Phase 5: Validation & Metrics  → Cost tracking, version history, maturity scoring, KPIs
```

---

## Phase 1: Platform Readiness Check

### 1.1 Health & Connectivity

**Endpoint checks**:

```bash
# Backend health
curl -s http://localhost:3000/api/v1/health | jq .

# Tenant data
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/tenants/me | jq .

# Agent count
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/agents | jq '.data | length'
```

**Expected results**:

- Health → `{ status: "ok" }`
- Tenant → demo@marketing details with tierId, industry, domains
- Agents → ≥10 deployed agents

### 1.2 Tool Registry Audit

**Script**: See `./templates/tool-registry-audit.sh`

Tests all 26 tools:

- ✅ Pure tools (calculator, web-search, database-query, email-send, document-summary)
- ⚠️ API-dependent (Serper, SMTP, LLM, Google OAuth, HubSpot)
- 🔗 Connectors (Google Drive, Gmail, Sheets, Docs)

**Output**: `tool-test-results.csv` with pass/fail/skip per tool

### 1.3 Tenant & Agent Verification

**Expected**: demo@marketing tenant state

```json
{
  "id": "4109424f-59fa-463a-8f5e-52299fcf47f0",
  "email": "demo@marketing-agency.local",
  "name": "Marketing Agency Demo",
  "industry": "MARKETING",
  "agents": {
    "total": 10,
    "deployed": 10,
    "active": 8+
  },
  "workflows": {
    "total": 11,
    "templates": 3
  },
  "tasks": {
    "seed": 65,
    "pending": 0,
    "completed": 40+
  }
}
```

**Reset seed data**: `cd backend && node e2e-marketing-demo.mjs --reset`

---

## Phase 2: Google Workspace Integration

### 2.1 Email Setup (Gmail)

**Account**: `gecdropship@gmail.com`  
**Action**: Connect Google OAuth in NeureCore

```
Dashboard → Settings → Integrations → Google Gmail
→ Click "Connect" → OAuth flow → Grant calendar, drive, sheets, docs access
```

**Verify**:

```bash
# Check OAuth config
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/connectors?type=gmail | jq .
```

**Aliases to create**:

- `marketing-campaigns@gecdropship.com` (Campaign manager)
- `client-relations@gecdropship.com` (Account manager)
- `analytics@gecdropship.com` (Data analyst)
- `creative@gecdropship.com` (Designer)
- `strategy@gecdropship.com` (Strategist)

### 2.2 Google Drive Organization

**Structure**:

```
NeureCore Demo (shared folder)
├── Client Work
│   ├── Acme Corp Campaign
│   ├── TechStart Growth
│   └── RetailCo Turnaround
├── Content Library
│   ├── Blog Posts (Drafts)
│   ├── Social Media
│   └── Video Scripts
├── Analytics & Reports
│   ├── Monthly KPIs
│   ├── Client Dashboards
│   └── Competitive Analysis
├── Team Resources
│   ├── Brand Guidelines
│   ├── Templates
│   └── Process Docs
└── Archive
    └── Completed Campaigns
```

**Initial upload**: ~50 files representing real agency assets (see `./templates/drive-structure.json`)

### 2.3 Shared Documents & Sheets

**Docs**:

- Campaign brief template (Google Doc)
- Meeting notes template
- Proposal template
- Post-mortem template

**Sheets**:

- Content calendar (editable)
- Lead tracking database
- Budget tracker
- KPI dashboard (linked to analytics)
- A/B test results

**All**: Shared with all 5 email aliases + document-summary.tool to parse

---

## Phase 3: Agent Capability Map

### 3.1 The 10 Agents in demo@marketing

| Agent Name                | Role                            | Primary Tools                                 | Test Focus                      |
| ------------------------- | ------------------------------- | --------------------------------------------- | ------------------------------- |
| **Content Creator Pro**   | Write blogs, social, emails     | document-summary, web-search, calculator      | LLM calls, token tracking       |
| **Lead Analyzer**         | Qualify + score leads           | database-query, email-send, web-search        | Data pipeline, SMTP             |
| **Campaign Orchestrator** | Schedule & coordinate campaigns | task-management, calendar.get, email-send     | Workflow supervision            |
| **Analytics Master**      | Parse data, create reports      | database-query, sheets, document-summary      | CSV export, visualization       |
| **Social Media Manager**  | Generate posts & schedules      | web-search, document-summary, task-management | Tool combinations, batch ops    |
| **Client Success Lead**   | Manage client comms             | email-send, task-management, document-summary | Multi-tenant isolation          |
| **CRM Sync Bot**          | Sync HubSpot ↔ NeureCore        | crm.contact, task-management                  | Connector workflow              |
| **Brand Guardian**        | Ensure brand consistency        | document-summary, web-search, calculator      | Policy enforcement, costs       |
| **Research & Insights**   | Competitive analysis            | web-search, database-query, archive.fetch     | Multi-step workflows            |
| **Admin Coordinator**     | Handle approvals, governance    | approvals, task-management, email-send        | HITL workflows, version history |

### 3.2 Feature Test Matrix

| Feature               | Agents to Test                           | Tools Required                            | Validation Criterion                           |
| --------------------- | ---------------------------------------- | ----------------------------------------- | ---------------------------------------------- |
| **Version Control**   | Content Creator, Brand Guardian          | (any)                                     | 3+ versions, rollback succeeds                 |
| **PII Detection**     | Lead Analyzer, Client Success Lead       | email-send, database-query                | Email/phone/SSN masked in logs                 |
| **Cost Tracking**     | Analytics Master, Content Creator Pro    | (all major tools)                         | Cost records created, budget policies enforced |
| **Evaluation Runs**   | All                                      | (any)                                     | Staging clone created, ≥3 metrics collected    |
| **Workflow Canvas**   | Campaign Orchestrator                    | task-management, email-send, calendar.get | Visual flow saved, supervisions checked        |
| **Supervisor-Worker** | Campaign Orchestrator, Admin Coordinator | (any)                                     | Worker agents invoked from supervisor node     |
| **Knowledge Spaces**  | Research & Insights, Brand Guardian      | document-summary, web-search              | Docs indexed, ILIKE search working             |
| **Agent Maturity**    | All                                      | (any)                                     | Maturity L1→L3 progression tracked             |
| **CSV Exports**       | Analytics Master                         | (any)                                     | Cost + analytics CSVs downloadable             |
| **Agent Packs**       | All                                      | (any)                                     | 3 packs deployed (GTM, Support, Finance)       |

---

## Phase 4: Marketing Workflow Simulation (Weekly Scenario)

### Monday: Campaign Planning & Briefing

**Actors**: Campaign Orchestrator, Content Creator Pro, Research & Insights

**Tasks**:

1. **Research Task**: Research & Insights runs competitive analysis on 3 competitors
   - Uses web-search (Serper) → 10 searches
   - Stores findings in knowledge space
   - Generates summary doc → exported to Drive
   - **Metrics**: 3+ searches, 1 KB stored, version created

2. **Campaign Brief Creation**: Content Creator Pro
   - Drafts campaign brief (Google Doc template)
   - Calls document-summary on competitor research
   - Estimates budget & timeline
   - Creates 3 versions + rolls back once
   - **Metrics**: 3 versions, 1 rollback, 2 LLM calls

3. **Planning Workflow** (Canvas): Campaign Orchestrator
   - Creates visual workflow: Research → Brief → Approve → Schedule
   - Sets approval requirement for Creative Director (Role-based)
   - **Metrics**: 1 workflow, 1 approval node, saved canvas

### Tuesday: Content Creation & Approvals

**Actors**: Content Creator Pro, Admin Coordinator, Social Media Manager

**Tasks**:

1. **Content Batch**: Content Creator Pro writes 5 pieces
   - Blog post (1500 words) → Drive
   - Email sequence (3 emails) → saved as templates
   - Social posts (15 posts) → stored in Sheets
   - LinkedIn article → Drive
   - Client case study → Google Doc
   - **Metrics**: 5 tasks created, 5 LLM calls, cost tracked

2. **Approval Workflow**: Admin Coordinator
   - Reviews each piece via approval queue
   - Approves 4/5, requests revisions on case study
   - Case study returned to Content Creator Pro
   - **Metrics**: 5 approval requests, 4 approved, 1 revision

3. **Social Schedule**: Social Media Manager
   - Reads content from Sheets
   - Schedules posts for Wed–Fri via calendar tool
   - Creates task reminders for team
   - **Metrics**: 15 calendar events, 5 tasks, 1 workflow execution

### Wednesday: Lead Generation & Analytics

**Actors**: Lead Analyzer, Analytics Master, Campaign Orchestrator

**Tasks**:

1. **Lead Import & Scoring**: Lead Analyzer
   - Queries database for new leads (database-query)
   - Sends welcome emails to 20 new leads (email-send, 2x rate-limited calls)
   - PII detection masks emails in logs
   - **Metrics**: 20 leads, 20 emails sent, 2 email tool calls, PII masking verified

2. **Analytics Report**: Analytics Master
   - Queries campaign performance data (2 weeks historical)
   - Exports to CSV (CSV export tool)
   - Creates Sheets summary with formulas
   - Generates PDF report via document-summary
   - **Metrics**: 1 CSV export, 1 Sheets update, 1 PDF generated, cost traced

3. **Campaign Health Check**: Campaign Orchestrator
   - Reads analytics results
   - Fires automated task if CTR < 2% (governance rule)
   - Creates incident + escalates to Brand Guardian
   - **Metrics**: 1 governance trigger, 1 incident created

### Thursday: Client Communication & CRM Sync

**Actors**: Client Success Lead, CRM Sync Bot, Admin Coordinator

**Tasks**:

1. **Client Updates**: Client Success Lead
   - Sends 3 client check-in emails (email-send)
   - Attaches analytics summary from Analytics Master
   - Logs all comms in task management
   - **Metrics**: 3 emails, 3 tasks, email-send tool used

2. **CRM Sync**: CRM Sync Bot
   - Syncs 10 opportunities from HubSpot (crm.contact tool)
   - Updates probability/value in task notes
   - Escalates 2 high-value deals to Client Success Lead
   - **Metrics**: 10 CRM records, 2 escalations, value tracked

3. **Approval Queue Review**: Admin Coordinator
   - Reviews pending client approvals (2 assets)
   - Approves 1, requests revision on 1
   - Notifies relevant agents
   - **Metrics**: 2 approval requests, 1 approved/1 pending

### Friday: Weekly Review & Optimization

**Actors**: Analytics Master, Brand Guardian, Campaign Orchestrator

**Tasks**:

1. **Weekly KPI Summary**: Analytics Master
   - Aggregates week's data: 5 campaigns, 20 leads, 15 approvals
   - Exports KPIs to CSV + Sheets
   - Calculates ROI per campaign (calculator tool)
   - Compares to historical baseline
   - **Metrics**: 1 CSV export, 1 Sheets update, 3 calculator calls

2. **Brand Health Audit**: Brand Guardian
   - Scans 10 published assets (document-summary)
   - Verifies tone, messaging, brand guidelines compliance
   - Flags 1 non-compliant piece for revision
   - **Metrics**: 10 docs scanned, 1 revision flagged, 1 cost record

3. **Retrospective & Planning**: Campaign Orchestrator
   - Views version history for all content (3 agents × 3 versions avg = 9 versions)
   - Identifies best-performing content variants
   - Creates lessons-learned document
   - Plans next week's rollout
   - **Metrics**: 9 versions reviewed, 1 agent maturity bump (L2→L3), 1 workflow saved

---

## Phase 5: Validation & Metrics

### 5.1 Cost Tracking Audit

**Dashboard metrics to validate**:

```json
{
  "weeklySpend": "$15–20 (API tokens + LLM calls)",
  "costByAgent": {
    "Content Creator Pro": "$5.50",
    "Analytics Master": "$3.20",
    "Lead Analyzer": "$2.10",
    "Others": "$5–10"
  },
  "costByTool": {
    "openai.gpt-4": "$8.00",
    "web-search (Serper)": "$1.50",
    "email-send": "$0.50",
    "database-query": "$0.20",
    "Others": "$3.80"
  },
  "budgetPolicies": {
    "active": ≥3,
    "enforced": ≥1 (Cost limit hit, task rejected)
  }
}
```

**Validate**:

- ✅ Cost records exist for all major tool calls
- ✅ Per-agent rollup matches tool-level sum
- ✅ Budget policy rejection logged + task marked FAILED

### 5.2 Version History & Rollback

**Expected state**:

- Content Creator Pro: 3 versions (original + 2 edits), 1 rollback performed
- Brand Guardian: 2 versions
- Campaign Orchestrator: 1 version

**Validate**:

```bash
# Pull version history
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/agents/$AGENT_ID/versions | jq '.data | length'

# Should be ≥3 for Content Creator Pro
```

- ✅ User can list versions with timestamps + change notes
- ✅ Active version clearly marked
- ✅ Rollback creates new snapshot (doesn't delete old version)

### 5.3 PII Masking Verification

**Check logs for masking**:

```bash
# Grep task logs for email/phone patterns
grep -E "\[REDACTED:(EMAIL|PHONE|SSN)\]" /tmp/task-logs.log
```

**Expected finds**:

- Lead Analyzer tasks: email fields masked in tool inputs
- Client Success Lead tasks: phone fields masked
- Content Creator Pro tasks: no sensitive data (none sent)

### 5.4 Agent Maturity Progression

**Endpoint**: `GET /api/v1/analytics/maturity`

**Expected progression**:

```json
{
  "Content Creator Pro": {
    "level": "L3",
    "score": 67,
    "trend": "+12 points this week"
  },
  "Lead Analyzer": { "level": "L2", "score": 45, "trend": "+8 points" },
  "Campaign Orchestrator": { "level": "L3", "score": 61, "trend": "+10 points" }
}
```

Maturity factors tracked:

- ✅ Agent execution count (✓)
- ✅ Cost efficiency ratio (LLM calls / results)
- ✅ Approval acceptance rate (✓)
- ✅ Error rate trend (↓ expected)
- ✅ Version iterations (improvement signal)

### 5.5 Knowledge Space Validation

**Expected state**:

- Research & Insights knowledge space: 50+ documents indexed
- 10+ ILIKE searches performed
- document-summary parsed 15+ docs

**Validate**:

```bash
# Query knowledge space
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/knowledge-spaces | jq '.data[0]'

# Should include:
# - documents: 50+
# - agent_access: Research & Insights + Brand Guardian
# - lastSearched: < 1 day ago
```

### 5.6 Workflow Canvas & Supervision

**Validate**:

- ✅ Campaign orchestration flow saved (4+ nodes)
- ✅ Supervisor node → Worker nodes executed correctly
- ✅ Each worker handled its sub-task (email-send, calendar.create, task-management)
- ✅ Supervisor aggregated results

**Endpoint**: `GET /api/v1/workflows/supervisors/:id/workers`

### 5.7 Dashboard KPIs

**demo@marketing dashboard should show**:

```
Agents: 10
Workflows: 11
Tasks Completed This Week: 32
Pending Approvals: 0–2
Cost This Week: $15–20
Agents at L3+ Maturity: 3+
Active Knowledge Spaces: 1
```

---

## Execution Checklist

### Pre-Test

- [ ] Backend running (`pnpm start:dev` on port 3000)
- [ ] Frontend running (`npm run dev` on port 3001)
- [ ] demo@marketing tenant seeded (`e2e-marketing-demo.mjs --reset`)
- [ ] Google account (`gecdropship@gmail.com`) ready + Gmail/Drive/Sheets/Docs access granted
- [ ] API token obtained (POST /auth/login → demo@marketing-agency.local / Marketing@123!)
- [ ] Tool registry audit passing ≥20/26 tools

### Test Execution (Phases 1–5)

- [ ] Phase 1: Platform ready + all agents deployed
- [ ] Phase 2: Google Workspace connected + 5 email aliases set up
- [ ] Phase 3: All 10 agents feature-tested per matrix
- [ ] Phase 4: Weekly scenario completed (Mon–Fri, 15+ tasks)
- [ ] Phase 5: Validation metrics collected + dashboard KPIs verified

### Deliverables

- [ ] `test-results.json` (Phase 1–5 summary)
- [ ] `cost-audit.csv` (all cost records)
- [ ] `version-history.csv` (all agent versions)
- [ ] Screenshots: dashboard KPIs, workflows, cost tracking, maturity chart
- [ ] Video walkthrough (optional): 5 min demo of live workflow

---

## Key Endpoints (Reference)

| Endpoint               | Method    | Purpose                        |
| ---------------------- | --------- | ------------------------------ |
| `/agents`              | GET       | List all agents                |
| `/agents/:id/versions` | GET       | Version history                |
| `/agents/:id/versions` | POST      | Create version snapshot        |
| `/agents/:id/rollback` | POST      | Rollback to version            |
| `/workflows`           | GET/POST  | Workflow CRUD                  |
| `/tasks`               | GET/POST  | Task management                |
| `/approvals`           | GET/PATCH | Approval queue                 |
| `/connectors`          | GET       | OAuth connectors (Gmail, etc.) |
| `/tools/execute`       | POST      | Run tool directly              |
| `/costs/records`       | GET       | Cost tracking                  |
| `/analytics/maturity`  | GET       | Agent maturity scores          |
| `/knowledge-spaces`    | GET/POST  | Knowledge space CRUD           |
| `/api/v1/export/csv`   | GET       | Export costs/analytics         |

---

## Troubleshooting

### "Tool X failed: API key missing"

- Check backend `.env`: `SERPER_API_KEY`, `SMTP_HOST`, `LLM_API_KEY`, etc.
- Test endpoint: `POST /tools/execute { tool: "web-search", ... }`

### "PII masking not working"

- Confirm `PII_DETECTION_ENABLED=true` in backend `.env`
- Check logs: `grep REDACTED task-logs.log`
- If no findings, add test data with emails/phones

### "Google Drive/Sheets reading returns 403"

- Verify OAuth scope includes drive.readonly, sheets.readonly
- Re-consent in UI: Settings → Integrations → Google → Reconnect
- Check token in `connectors` table has not expired

### "Cost tracking shows $0"

- LLM API key must be set; requests must actually call OpenAI/Azure
- Check `costs.records` table for rows
- Verify `tools.execute` is being called with valid tool config

### "Maturity score not changing"

- Requires ≥5 agent executions; maturity recalculates nightly (can manually call `POST /analytics/maturity-recalc`)
- Ensure tasks are completing (not stuck in RUNNING)

---

## Next Steps After Testing

1. **Document findings**: Create test report with metrics, screenshots, blockers
2. **Iterate features**: Address any failed validations (e.g., missing tool, workflow bug)
3. **Demo ready**: Once all phases pass, `demo@marketing` dashboard is portfolio-ready
4. **Client onboarding**: Use templates from this test as basis for customer deployments
5. **CI/CD integration**: Add automated test suite (`e2e-*.mjs` scripts) to deployment pipeline

---

## References

- **IMPLEMENTATION_PLAN.md**: Feature status per phase (Phases 1–4 all ✅ COMPLETE)
- **e2e-marketing-demo.mjs**: Seed script for demo data
- **Tool Registry**: `backend/src/modules/tools/built-in/` (50+ tools)
- **API Docs**: Swagger at `http://localhost:3000/api/docs`
- **Tool Test Results**: `backend/tool-test-results.csv` (from tool-registry-audit.sh)
