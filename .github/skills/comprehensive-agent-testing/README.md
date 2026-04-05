# Comprehensive Agent Testing Skill — Overview

This folder contains a complete **5-phase testing framework** for NeureCore's AI agent platform.

## What's Here

| File                        | Purpose                                                 | Read Time |
| --------------------------- | ------------------------------------------------------- | --------- |
| **SKILL.md**                | Full testing methodology with detailed phase breakdowns | 20 min    |
| **QUICKSTART.md**           | Fast setup guide to get testing in 5 minutes            | 3 min     |
| **VALIDATION_CHECKLIST.md** | Printable checklist to track all 5 phases + sign-off    | 10 min    |
| **templates/**              | Reusable scripts, guides, and templates                 | varies    |

## Quick Navigation

- **Just starting?** → Read [QUICKSTART.md](QUICKSTART.md)
- **Need details?** → Read [SKILL.md](SKILL.md)
- **Tracking progress?** → Use [VALIDATION_CHECKLIST.md](VALIDATION_CHECKLIST.md)
- **Need templates?** → See `templates/` folder

## The 5 Phases at a Glance

```
Phase 1 (15 min)  — Platform Readiness       → Health check, tool audit
Phase 2 (30 min)  — Google Workspace Setup   → Email, Drive, Sheets, Docs
Phase 3 (1 hour)  — Agent Capability Map     → Feature validation per agent
Phase 4 (2 hours) — Weekly Workflow          → Mon–Fri simulation
Phase 5 (1 hour)  — Metrics & Validation     → Cost, versions, maturity, KPIs
```

**Total Time**: ~4–5 hours spread across a week

## What You'll Test

- **10 AI Agents**: All deployed agents in demo@marketing tenant
- **50+ Tools**: Web search, email, database, Sheets, Docs, Drive, CRM, calculator, etc.
- **All Features**: Version control, PII masking, cost tracking, workflows, supervision, knowledge spaces, maturity scores
- **Google Workspace**: Full integration with Gmail, Drive, Sheets, Docs, Slides
- **Real Workflow**: Simulate a week of actual marketing agency work

## How to Use This Skill

### Option 1: Manual Testing

1. Read [QUICKSTART.md](QUICKSTART.md)
2. Follow the 5 phases
3. Track progress in [VALIDATION_CHECKLIST.md](VALIDATION_CHECKLIST.md)

### Option 2: Guided (Chat with AI Agent)

Invoke in Copilot Chat:

```
/comprehensive-agent-testing Let's run a comprehensive test of demo@marketing with Google Workspace integration
```

## Deliverables After Testing

- `test-results.json` — Summary of all phases
- `cost-audit.csv` — Cost tracking data
- `version-history.csv` — Agent version snapshots
- Screenshots of dashboard, workflows, cost tracking
- (Optional) Video walkthrough of live workflow demo

## Key Contacts & Resources

- **Demo Tenant**: `demo@marketing-agency.local` / `Marketing@123!`
- **Google Account**: `gecdropship@gmail.com` / `Shahikhail@F005698`
- **Backend API Docs**: http://localhost:3000/api/docs
- **Platforms**: NeureCore (Phases 1–4 all ✅ COMPLETE)

## Questions?

Refer back to:

- Detailed methodology: [SKILL.md](SKILL.md#phase-5-validation--metrics)
- Agent templates: `templates/agent-test-tasks.md`
- Google setup: `templates/google-workspace-setup.md`
- Tool audit: `templates/tool-registry-audit.sh`

**Start now**: [→ QUICKSTART.md](QUICKSTART.md)
