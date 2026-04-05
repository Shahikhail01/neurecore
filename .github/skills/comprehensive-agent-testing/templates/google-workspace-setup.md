# Google Workspace Setup for NeureCore Demo

**Account**: `gecdropship@gmail.com`  
**Password**: `Shahikhail@F005698`  
**Purpose**: Multi-user marketing agency collaboration (email, Drive, Docs, Sheets, Slides)

---

## Step 1: Gmail OAuth in NeureCore

### 1.1 Connect Google Account

1. Log in to NeureCore as demo@marketing admin
2. Navigate: Dashboard → Settings → Integrations
3. Click "Google Gmail" → "Connect"
4. OAuth popup → Select `gecdropship@gmail.com` account
5. Grant permissions:
   - ✅ Gmail API (compose, read, send)
   - ✅ Google Drive API (read, write, create)
   - ✅ Google Sheets API (read, write)
   - ✅ Google Docs API (read)
   - ✅ Google Calendar API (read)

### 1.2 Verify Connection

```bash
# List Gmail connectors
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/connectors?type=gmail | jq '.data[0]'

# Expected:
# {
#   "id": "...",
#   "type": "GMAIL",
#   "status": "CONNECTED",
#   "oauthTokens": { "access_token": "ya29...", "refresh_token": "1//..." }
# }
```

---

## Step 2: Gmail Email Aliases

### 2.1 Create Aliases in Google Workspace

Go to `https://mail.google.com/` as `gecdropship@gmail.com`

**Settings → Accounts → Send email as:**

| Alias                 | Email                               | Role              |
| --------------------- | ----------------------------------- | ----------------- |
| Primary               | gecdropship@gmail.com               | Team inbox        |
| Marketing Campaigns   | marketing-campaigns@gecdropship.com | Campaign manager  |
| Client Relations      | client-relations@gecdropship.com    | Account executive |
| Analytics & Reporting | analytics@gecdropship.com           | Data analyst      |
| Creative Studio       | creative@gecdropship.com            | Designer/Creative |
| Strategy & Planning   | strategy@gecdropship.com            | Strategic lead    |

Each alias can be used as "From" address in agents' email-send tool calls.

---

## Step 3: Google Drive Organization

### 3.1 Create Folder Structure

1. Go to Google Drive (`drive.google.com`)
2. Create shared folder: **"NeureCore Demo"** (share with `gecdropship@gmail.com`)
3. Sub-folders:

```
NeureCore Demo/
├── Client Work/
│   ├── Acme Corp (TechSaaS)
│   │   ├── Briefs/
│   │   ├── Proposals/
│   │   ├── Reports/
│   │   └── Deliverables/
│   ├── TechStart Growth (EdTech)
│   │   └── (same structure)
│   └── RetailCo Turnaround (Retail)
│       └── (same structure)
├── Content Library/
│   ├── Blog Posts (Drafts, Published, Archive)
│   ├── Social Media (Twitter, LinkedIn, Instagram)
│   ├── Email Templates/
│   ├── Video Scripts/
│   └── Case Studies/
├── Analytics & Reports/
│   ├── Monthly KPIs/
│   ├── Client Dashboards/
│   ├── Competitive Analysis/
│   └── Campaign Performance/
├── Team Resources/
│   ├── Brand Guidelines/
│   ├── Process Documentation/
│   ├── Templates/
│   │   ├── Campaign Brief Template
│   │   ├── Proposal Template
│   │   ├── Meeting Notes Template
│   │   └── Post-Mortem Template
│   └── Training Materials/
└── Archive/
    └── Completed Campaigns/
```

### 3.2 Permissions

- **Owner**: gecdropship@gmail.com
- **Editors**: All 5 email aliases (auto-included with main account access)
- **Viewers**: (optional) Client stakeholders (e.g., clients@acmecorp.com)

### 3.3 Sample Files

Create initial documents (templates for agents to reference):

**Docs**:

- `Campaign Brief Template.docx` (500 words, agency standard)
- `Meeting Notes Template.docx` (outline format)
- `Proposal Template.docx` (with pricing table)
- `Post-Mortem Template.docx` (retrospective format)

**Sheets**:

- `Content Calendar 2026.xlsx` (dates, content type, status, assigned to)
- `Lead Tracking.xlsx` (name, source, stage, contact, value)
- `Budget Tracker.xlsx` (project, allocated, spent, % utilization)
- `KPI Dashboard.xlsx` (metrics linked to analytics)
- `A/B Test Results.xlsx` (variant A, variant B, winner)

**Slides**:

- `Monthly Client Deck Template.pptx` (10 slides, branding guidelines)

**Upload**: ~30 files representing 2 weeks of work (drafts, published, revisions)

---

## Step 4: Google Sheets Setup

### 4.1 Create Shared Sheets

**File**: `Content Calendar 2026`

Columns:

```
| Date | Content Type | Topic | Status | Owner | Client | Notes |
|------|--------------|-------|--------|-------|--------|-------|
| 2026-04-07 | Blog | AI in Marketing | Draft | Content Creator Pro | Acme Corp | Outline done |
| 2026-04-08 | Social | Product launch | Published | Social Media Manager | TechStart | 5 posts |
| ... | ... | ... | ... | ... | ... | ... |
```

**File**: `Lead Tracking`

Columns:

```
| Lead Name | Source | Company | Stage | Contact | Email | Phone | Value | Assigned To | Updated |
|-----------|--------|---------|-------|---------|-------|-------|-------|-------------|---------|
| John Doe | LinkedIn | Acme Inc | Contacted | Sales | john@acme.com | 555-0101 | $50K | Lead Analyzer | 2026-04-07 |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
```

**File**: `Budget Tracker`

Columns:

```
| Project | Phase | Allocated | Spent | % Used | Remaining | Status |
|---------|-------|-----------|-------|--------|-----------|--------|
| Acme Corp Campaign | Creative | $5,000 | $3,200 | 64% | $1,800 | On Track |
| TechStart Growth | Execution | $12,000 | $8,950 | 75% | $3,050 | Monitoring |
| ... | ... | ... | ... | ... | ... | ... |
```

---

## Step 5: Google Docs Setup

### 5.1 Campaign Brief Template

**File**: `Campaign Brief Template`

```
# Campaign Brief

## Client
- Name: [Client Name]
- Industry: [Industry]
- Contact: [Contact Info]

## Campaign Objective
[2-3 sentence summary of business goal]

## Target Audience
- Demographics: [Age, location, job title]
- Interests: [Key interests/pain points]
- Behaviors: [Online habits, platforms]

## Key Messages
1. [Message 1]
2. [Message 2]
3. [Message 3]

## Campaign Tactics
- [ ] Email campaigning
- [ ] Social media
- [ ] Blog content
- [ ] Paid ads
- [ ] Webinars
- [ ] Other: ___

## Timeline
- Kickoff: [Date]
- Creative review: [Date]
- Launch: [Date]
- Conclude: [Date]

## Success Metrics
- Primary KPI: [Metric] (target: [value])
- Secondary KPIs: [List]

## Budget
- Creative: $[X]
- Distribution: $[X]
- Analytics: $[X]
- Total: $[X]

## Notes
[Additional context]

---
Created by: [Agent Name]
Last updated: [Date]
```

### 5.2 Proposal Template

```
# Proposal

**Date**: [Date]
**Client**: [Client Name]
**From**: Marketing Agency Demo Team

## Executive Summary
[1-paragraph overview of proposal]

## Scope of Work
1. [Deliverable 1] - [Description]
2. [Deliverable 2] - [Description]
3. [Deliverable 3] - [Description]

## Timeline
- Phase 1: [Weeks 1-2] - [Activities]
- Phase 2: [Weeks 3-4] - [Activities]
- Phase 3: [Weeks 5-6] - [Activities]

## Investment

| Item | Qty | Rate | Subtotal |
|------|-----|------|----------|
| Strategy & Planning | 40 hrs | $150 | $6,000 |
| Creative Development | 60 hrs | $125 | $7,500 |
| Content Production | 20 hrs | $100 | $2,000 |
| Analytics & Reporting | 10 hrs | $100 | $1,000 |
| **Total** | | | **$16,500** |

## Terms
- 50% due upon signature
- 50% due upon completion
- Timeline: [X] weeks from kickoff

---
Prepared by: [Agent Name]
Approved by: [Admin]
```

---

## Step 6: Verify Integration in NeureCore

### 6.1 Test Document Tool

```bash
curl -s -X POST http://localhost:3000/api/v1/tools/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "document_summary",
    "input": {
      "url": "https://docs.google.com/document/d/1ABC.../edit"
    }
  }' | jq '.output'
```

Expected: Summary of document content

### 6.2 Test Sheets Tool

```bash
curl -s -X POST http://localhost:3000/api/v1/tools/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "google_sheets_append",
    "input": {
      "sheet_id": "1ABC.../",
      "data": [["2026-04-09", "Blog", "New Feature", "In Progress", "Content Creator Pro"]]
    }
  }' | jq '.output'
```

Expected: "Appended X rows to sheet"

### 6.3 Test Email Tool

```bash
curl -s -X POST http://localhost:3000/api/v1/tools/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "email_send",
    "input": {
      "to": "marketing-campaigns@gecdropship.com",
      "subject": "Campaign Launch Confirmation",
      "body": "Campaign is live as of 2026-04-09 10:00 AM",
      "from": "strategy@gecdropship.com"
    }
  }' | jq '.output'
```

Expected: "Email sent to marketing-campaigns@gecdropship.com"

---

## Step 7: Email Rules & Organization

### 7.1 Gmail Filters

Create filters in Gmail Settings → Filters:

| Filter Name         | Condition                               | Action                      |
| ------------------- | --------------------------------------- | --------------------------- |
| Marketing Campaigns | To: marketing-campaigns@gecdropship.com | Label: Campaigns, Auto-read |
| Client Comms        | To: client-relations@gecdropship.com    | Label: Clients, Star        |
| Analytics Reports   | To: analytics@gecdropship.com           | Label: Reports, Archive     |
| Creative            | To: creative@gecdropship.com            | Label: Creative             |
| Strategy            | To: strategy@gecdropship.com            | Label: Strategy             |

### 7.2 Labels/Folders

- **Campaigns** (email-send → marketing-campaigns@gecdropship.com)
- **Clients** (email-send → client-relations@gecdropship.com)
- **Reports** (email-send → analytics@gecdropship.com)
- **Creative** (email-send → creative@gecdropship.com)
- **Strategy** (email-send → strategy@gecdropship.com)

---

## Troubleshooting

### "OAuth scope mismatch"

- Re-consent: Settings → Integrations → Google Gmail → Disconnect & Reconnect
- Ensure scopes include: gmail, drive, sheets, docs, calendar

### "Email send 403 Forbidden"

- Verify email alias exists in Gmail settings
- Try sending from primary account first (gecdropship@gmail.com)
- Check OAuth token hasn't expired (refresh manually in connector settings)

### "Drive file not found 404"

- Verify file is shared with `gecdropship@gmail.com`
- Use file ID, not file name (e.g., `1ABC...EFG` from URL)
- Ensure document-summary tool can access public/shared links

### "Sheets append failing"

- Verify sheet has data headers in row 1
- Check append range (default: A:Z)
- Ensure column count matches data array length

---

## Next Steps

1. ✅ Complete setup above
2. ✅ Verify all 5 email aliases working
3. ✅ Create 30+ sample files in Drive (Docs, Sheets, Slides)
4. ✅ Run tool-registry-audit.sh to confirm all tools connected
5. ✅ Execute Phase 4 marketing workflow simulation with real Google Workspace integration
