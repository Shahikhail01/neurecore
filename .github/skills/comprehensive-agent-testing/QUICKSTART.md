# Quick Start: Comprehensive Agent Testing

**Time Estimate**: 4–5 hours (spread across Mon–Fri)  
**Skill Location**: `.github/skills/comprehensive-agent-testing/`

---

## 5-Minute Setup

### 1. Prerequisites Check

```bash
# Backend running?
curl -s http://localhost:3000/api/v1/health | jq .status

# Demo tenant seeded?
cat << 'EOF' > /tmp/test.sh
cd /mnt/data/Web\ Dev/NeureCore/backend
node e2e-marketing-demo.mjs --reset
EOF
bash /tmp/test.sh

# API token obtained?
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@marketing-agency.local","password":"Marketing@123!"}' \
  | jq '.data.accessToken' | head -c 50
# Save this token as $TOKEN env var
```

### 2. Read the Main Skill

- Open: `SKILL.md` (20-minute read)
- Understand: 5 phases, 10 agents, feature matrix

### 3. Phase 1: Quick Health Check

```bash
# Run tool audit (5 min)
cd /mnt/data/Web\ Dev/NeureCore/.github/skills/comprehensive-agent-testing/templates
bash tool-registry-audit.sh

# Verify agents deployed
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/agents | jq '.data | length'
# Should output: 10 (or similar)
```

**If Phase 1 passes**: Proceed to Phase 2 (Google Workspace)

---

## Phase 2: Google Workspace (30 minutes)

1. **Read guide**: `templates/google-workspace-setup.md`
2. **Quick checklist**:
   - [ ] Log into gecdropship@gmail.com
   - [ ] Grant NeureCore OAuth (Settings → Integrations → Google)
   - [ ] Create 5 email aliases in Gmail
   - [ ] Create "NeureCore Demo" folder in Google Drive
   - [ ] Create 5 Sheets: Content Calendar, Lead Tracking, Budget, KPI Dashboard, A/B Tests
   - [ ] Test email-send tool from one alias

3. **Validate integration**:

```bash
# Test document-summary
curl -s -X POST http://localhost:3000/api/v1/tools/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "document_summary",
    "input": {"url": "https://docs.google.com/document/d/YOUR_DOC_ID/edit"}
  }' | jq .output
```

---

## Phase 3 & 4: Run Agent Tests (2–3 hours)

### Setup

```bash
cd /mnt/data/Web\ Dev/NeureCore
export TOKEN="your_bearer_token"
export TENANT_ID="4109424f-59fa-463a-8f5e-52299fcf47f0"
export API_URL="http://localhost:3000/api/v1"
```

### Execute Test Tasks

Use template: `templates/agent-test-tasks.md`

**Monday**:

- Create 1 workflow (Campaign Orchestrator)
- Draft 1 blog post (Content Creator Pro)
- Run research task (Research & Insights)

**Tuesday**:

- Write 5 content pieces (Content Creator Pro)
- Process 5 approvals (Admin Coordinator)
- Schedule social posts (Social Media Manager)

**Wednesday**:

- Import 20 leads (Lead Analyzer)
- Generate analytics report (Analytics Master)

**Thursday**:

- Send client emails (Client Success Lead)
- Sync CRM (CRM Sync Bot)

**Friday**:

- Create KPI summary (Analytics Master)
- Brand audit (Brand Guardian)
- Retrospective (Campaign Orchestrator)

**Log results in**: `VALIDATION_CHECKLIST.md`

---

## Phase 5: Validate Results (1 hour)

### Endpoint Checks

```bash
# Cost tracking
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/costs/records | jq '.data | length'
# Should be: 50+

# Agent versions
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/agents/{AGENT_ID}/versions | jq '.data | length'
# Should be: 2+

# Maturity
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/analytics/maturity | jq '.data'
# Should show L2–L3 for top agents

# Knowledge spaces
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/knowledge-spaces | jq '.data[0].documentCount'
# Should be: 50+
```

### Dashboard Check

Navigate to: `http://localhost:3001/dashboard`
Verify:

- [ ] 10 agents visible
- [ ] Workflows: 11+
- [ ] Cost this week: $15–$20
- [ ] Pending approvals: 0–2

### Export Deliverables

```bash
# Cost CSV
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/costs/export/csv" \
  > cost-audit.csv

# Screenshot dashboard
# (Open http://localhost:3001/dashboard, take screenshot, save as dashboard.png)
```

---

## How to Invoke the Skill in VS Code Chat

Type in Copilot Chat:

```
/comprehensive-agent-testing setup demo@marketing for end-to-end agent validation with Google Workspace
```

Or use as reference:

```
Use the comprehensive-agent-testing skill to guide my NeureCore demo walkthrough
```

---

## File Structure

```
.github/skills/comprehensive-agent-testing/
├── SKILL.md                             ← Main skill file (read first)
├── VALIDATION_CHECKLIST.md              ← Track progress + sign-off
├── QUICKSTART.md                        ← This file
└── templates/
    ├── tool-registry-audit.sh           ← Phase 1 automation script
    ├── google-workspace-setup.md        ← Phase 2 detailed guide
    ├── drive-structure.json             ← Drive folder reference
    └── agent-test-tasks.md              ← Phase 3–4 task templates
```

---

## Common Issues & Fixes

| Issue                            | Fix                                                                |
| -------------------------------- | ------------------------------------------------------------------ |
| "Tool failed: API key missing"   | Check backend `.env` for SERPER_API_KEY, LLM_API_KEY, etc.         |
| "PII masking not working"        | Ensure `PII_DETECTION_ENABLED=true` in `.env`; restart backend     |
| "Google Sheets append fails 403" | Re-consent OAuth in UI; verify sheet exists                        |
| "Email send returns 550"         | Try from primary Gmail (gecdropship@gmail.com) first, then aliases |
| "Cost records showing $0"        | LLM API key must be set; requests must call OpenAI                 |
| "Maturity score not changing"    | Requires 5+ agent executions; score recalcs nightly                |

---

## Success Criteria

**All 5 phases PASS if**:

1. ✅ Phase 1: 20/26 tools passing
2. ✅ Phase 2: Google Workspace fully integrated, 5 aliases, 30+ files
3. ✅ Phase 3: 10 agents tested, 60/60 features validated
4. ✅ Phase 4: 40+ tasks completed Mon–Fri, $15–$20 cost tracked
5. ✅ Phase 5: Dashboards show metrics, versions/maturity tracked, deliverables exported

**demo@marketing is demo-ready** → Portfolio-quality tenant for clients ✅

---

## Next Steps After Completion

1. **Document findings**: Create test report with metrics & screenshots
2. **Iterate features**: Fix any failed validations
3. **Demo presentation**: Use validated dashboard for client walkthrough
4. **CI/CD**: Add `e2e-*.mjs` scripts to deployment pipeline for regression testing
5. **Customer onboarding**: Use templates from this test for new customer deployments

---
