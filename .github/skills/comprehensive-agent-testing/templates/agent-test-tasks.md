# Agent Test Task Templates

Reusable JSON templates for creating comprehensive test tasks for each AI agent in demo@marketing tenant.

---

## Template 1: Content Creator Pro

**Goal**: Test LLM-based content creation, version control, approval workflows

```json
{
  "agent_id": "content-creator-pro",
  "test_phase": 4,
  "day": "Tuesday",
  "tasks": [
    {
      "title": "Write Blog Post: AI in Marketing Strategy",
      "description": "Create 1500-word blog post on how AI is transforming marketing strategies",
      "tools_required": ["openai.gpt-4", "document-summary", "web-search"],
      "expected_output": "1500+ word article saved to Google Drive",
      "metrics": {
        "llm_calls": {
          "expected": 2,
          "reasoning": "Initial draft + refinement"
        },
        "token_count": { "expected": 3000 },
        "cost_usd": { "expected": 0.15 },
        "version_created": true,
        "approval_required": true
      },
      "validation": [
        "Output exists in /Client Work/Acme Corp/Deliverables",
        "Cost record ≥ $0.10 created",
        "Version snapshot stored in agent_versions table",
        "Approval request created"
      ]
    },
    {
      "title": "Email Sequence: Product Onboarding (3 emails)",
      "description": "Create 3-email welcome sequence for new users",
      "tools_required": ["openai.gpt-4", "email-send"],
      "expected_output": "3 emails created, saved as templates",
      "metrics": {
        "llm_calls": { "expected": 3 },
        "token_count": { "expected": 2000 },
        "cost_usd": { "expected": 0.09 },
        "emails_composed": 3,
        "version_created": true,
        "approval_required": true
      },
      "validation": [
        "3 email templates exist",
        "Cost tracked",
        "1 version created",
        "Approval pending"
      ]
    },
    {
      "title": "Generate Social Media Posts (15 posts)",
      "description": "Create 15 LinkedIn posts (daily schedule for 3 weeks)",
      "tools_required": ["openai.gpt-4", "google-sheets-append"],
      "expected_output": "Content Calendar Sheets updated with 15 rows",
      "metrics": {
        "llm_calls": {
          "expected": 3,
          "reasoning": "Batch generation in groups of 5"
        },
        "posts_created": 15,
        "cost_usd": { "expected": 0.12 }
      },
      "validation": [
        "Content Calendar sheet has 15 new rows",
        "Dates span 3 weeks",
        "Posts are unique/varied"
      ]
    }
  ],
  "success_criteria": {
    "minimum_tasks": 3,
    "minimum_versions": 1,
    "minimum_approvals": 2,
    "minimum_cost": 0.3,
    "maximum_cost": 0.5
  }
}
```

---

## Template 2: Lead Analyzer

**Goal**: Test database queries, email sending (rate limiting), PII masking

```json
{
  "agent_id": "lead-analyzer",
  "test_phase": 4,
  "day": "Wednesday",
  "tasks": [
    {
      "title": "Import and Score 20 Leads from CSV",
      "description": "Import 20 new leads, qualify and score them, send welcome emails",
      "tools_required": ["database-query", "email-send", "calculator"],
      "expected_output": "20 leads in DB, 20 emails sent, lead scores calculated",
      "metrics": {
        "database_queries": { "expected": 2 },
        "emails_sent": { "expected": 20 },
        "leads_qualified": { "expected": 18 },
        "cost_usd": { "expected": 0.05 },
        "pii_detections": {
          "expected": 20,
          "reasoning": "Each email contains email addresses"
        },
        "pii_masked": { "expected": 20 }
      },
      "validation": [
        "20 leads in database",
        "20 email-send logs exist",
        "At least 1 email PII masked ([REDACTED:EMAIL])",
        "Lead scores in 0-100 range",
        "Cost ≤ $0.05"
      ]
    },
    {
      "title": "Daily Lead Quality Check",
      "description": "Query leads from last 24h, flag low-quality ones",
      "tools_required": ["database-query", "calculator"],
      "expected_output": "Low-quality leads flagged (score < 30), escalation task created",
      "metrics": {
        "database_queries": { "expected": 1 },
        "leads_reviewed": { "expected": 20 },
        "flagged": { "expected": 3 }
      },
      "validation": [
        "Query executed",
        "3+ leads flagged",
        "Escalation task created in task-management"
      ]
    }
  ],
  "success_criteria": {
    "minimum_emails": 20,
    "minimum_pii_masking": 15,
    "maximum_cost": 0.1,
    "email_rate_limit_tested": true
  }
}
```

---

## Template 3: Campaign Orchestrator

**Goal**: Test workflow canvas, supervision, multi-step orchestration

```json
{
  "agent_id": "campaign-orchestrator",
  "test_phase": 4,
  "day": "Monday & Thursday",
  "tasks": [
    {
      "title": "Create Campaign Planning Workflow (Canvas)",
      "description": "Build 4-step workflow: Research → Brief → Approve → Schedule",
      "tools_required": ["workflow-canvas"],
      "expected_output": "Visual workflow saved with 4 nodes, 2 supervision nodes",
      "metrics": {
        "workflow_nodes": { "expected": 4 },
        "supervision_nodes": { "expected": 2 },
        "version_created": true
      },
      "validation": [
        "Workflow retrieved via GET /workflows/:id",
        "Canvas saves correctly",
        "Supervision nodes configured"
      ]
    },
    {
      "title": "Execute Campaign Orchestration Workflow",
      "description": "Trigger workflow: invoke Research → wait for completion → invoke Brief → approve → schedule",
      "tools_required": ["orchestration", "email-send", "calendar"],
      "expected_output": "All 4 workflow steps executed, tasks delegated to workers",
      "metrics": {
        "workflow_executions": { "expected": 1 },
        "worker_tasks": { "expected": 3 },
        "emails_sent": { "expected": 1, "reasoning": "Approval request" },
        "calendar_events": { "expected": 1 }
      },
      "validation": [
        "Workflow execution logged",
        "Worker agents invoked",
        "All sub-tasks completed",
        "Calendar event created for campaign launch"
      ]
    },
    {
      "title": "Orchestrate Campaign Health Check",
      "description": "Daily check: pull analytics → if CTR < 2%, create incident",
      "tools_required": ["orchestration", "task-management"],
      "expected_output": "Conditional task creation based on performance",
      "metrics": {
        "workflows_executed": 1,
        "conditional_logic": true,
        "incidents_created": { "expected": 1 }
      },
      "validation": ["Governance rule triggered", "Incident task created"]
    }
  ],
  "success_criteria": {
    "minimum_workflows": 2,
    "minimum_executions": 2,
    "supervision_tested": true,
    "conditional_logic_tested": true
  }
}
```

---

## Template 4: Analytics Master

**Goal**: Test CSV exports, Sheets updates, calculator, cost tracking

```json
{
  "agent_id": "analytics-master",
  "test_phase": 5,
  "day": "Friday",
  "tasks": [
    {
      "title": "Generate Weekly KPI Report",
      "description": "Aggregate week's data: leads, cost, ROI, trends; export to CSV and Sheets",
      "tools_required": [
        "database-query",
        "csv-export",
        "google-sheets-append",
        "calculator",
        "document-summary"
      ],
      "expected_output": "CSV file + Sheets update with 30+ metrics",
      "metrics": {
        "database_queries": { "expected": 2 },
        "csv_exports": { "expected": 1 },
        "sheets_appended": { "expected": 1 },
        "calculator_calls": {
          "expected": 3,
          "reasoning": "ROI, CAC, CPA calculations"
        },
        "cost_usd": { "expected": 0.15 }
      },
      "validation": [
        "CSV exists in Drive/Analytics & Reports/",
        "Sheets has new row with week's data",
        "ROI, CAC, CPA calculated",
        "Cost record created"
      ]
    },
    {
      "title": "Compare Performance to Baseline",
      "description": "Pull last week and this week, calculate % change, flag anomalies",
      "tools_required": ["database-query", "calculator"],
      "expected_output": "Comparison table with trending arrows",
      "metrics": {
        "database_queries": { "expected": 2 },
        "metrics_compared": { "expected": 10 }
      },
      "validation": [
        "Percent change calculated",
        "Anomalies (>20% variance) flagged"
      ]
    },
    {
      "title": "Create Client Dashboard Presentation",
      "description": "Generate executive summary slide deck with charts/tables for 1 client",
      "tools_required": [
        "document-summary",
        "calculator",
        "google-drive-create"
      ],
      "expected_output": "PDF/Slide deck saved to Drive/Analytics & Reports/Client Dashboards/",
      "metrics": {
        "slides_created": { "expected": 8 },
        "visualizations": { "expected": 5 }
      },
      "validation": [
        "Presentation exists",
        "Contains 5+ charts/tables",
        "Is executive-friendly (summary-focused)"
      ]
    }
  ],
  "success_criteria": {
    "minimum_csv_exports": 1,
    "minimum_sheets_updates": 1,
    "minimum_calculator_calls": 3,
    "analytics_confidence_high": true
  }
}
```

---

## Template 5: All Other Agents (Consolidated)

```json
{
  "agents": [
    {
      "agent_id": "social-media-manager",
      "tasks": [
        {
          "title": "Schedule Social Posts from Content Calendar",
          "tools": ["google-sheets", "calendar", "task-management"]
        },
        {
          "title": "Generate Engagement Report",
          "tools": ["web-search", "document-summary"]
        }
      ]
    },
    {
      "agent_id": "client-success-lead",
      "tasks": [
        {
          "title": "Send 3 Client Check-in Emails",
          "tools": ["email-send", "document-summary"]
        },
        {
          "title": "Update Client CRM with Recent Activity",
          "tools": ["task-management", "crm-contact"]
        }
      ]
    },
    {
      "agent_id": "crm-sync-bot",
      "tasks": [
        {
          "title": "Sync HubSpot Opportunities to Tasks",
          "tools": ["crm-contact", "task-management"]
        }
      ]
    },
    {
      "agent_id": "brand-guardian",
      "tasks": [
        {
          "title": "Audit Published Content for Brand Compliance",
          "tools": ["document-summary", "web-search"]
        },
        {
          "title": "Flag Non-Compliant Assets for Revision",
          "tools": ["task-management", "email-send"]
        }
      ]
    },
    {
      "agent_id": "research-insights",
      "tasks": [
        {
          "title": "Run Competitive Analysis (10 Competitors)",
          "tools": ["web-search", "knowledge-spaces"]
        },
        {
          "title": "Generate Insights Document",
          "tools": ["document-summary", "openai.gpt-4"]
        }
      ]
    },
    {
      "agent_id": "admin-coordinator",
      "tasks": [
        {
          "title": "Review Approval Queue (5 pending)",
          "tools": ["approvals", "email-send"]
        },
        {
          "title": "Create Week Recap for Leadership",
          "tools": ["task-management", "document-summary"]
        }
      ]
    }
  ]
}
```

---

## Cross-Agent Feature Tests

```json
{
  "feature_tests": [
    {
      "feature": "Version Control & Rollback",
      "agents": ["Content Creator Pro", "Brand Guardian"],
      "test": "Create 3 versions per agent, rollback 1, verify history",
      "validation": "Agent versions table has ≥6 rows, 1 rollback logged"
    },
    {
      "feature": "PII Masking",
      "agents": ["Lead Analyzer", "Client Success Lead"],
      "test": "Send emails with recipient addresses; verify masking in logs",
      "validation": "Logs contain [REDACTED:EMAIL] patterns"
    },
    {
      "feature": "Knowledge Spaces",
      "agents": ["Research & Insights", "Brand Guardian"],
      "test": "Index 50+ docs, search via ILIKE, verify results",
      "validation": "Knowledge space has 50+ documents, search queries work"
    },
    {
      "feature": "Workflow Supervision",
      "agents": ["Campaign Orchestrator"],
      "test": "Create supervisor → invoke 3 workers in parallel",
      "validation": "All workers execute, supervisor aggregates results"
    },
    {
      "feature": "Cost Tracking",
      "agents": ["All"],
      "test": "All agent tasks should create cost records",
      "validation": "costs.records table has ≥50 rows, sum ≥ $15"
    },
    {
      "feature": "Agent Maturity",
      "agents": ["All"],
      "test": "Execute tasks; verify maturity scores increase",
      "validation": "Maturity levels L1→L3 progression observed"
    }
  ]
}
```
