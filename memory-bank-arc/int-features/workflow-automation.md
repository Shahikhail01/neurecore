# Workflow Automation

## Overview
Multi-step workflow automation engine. Define complex sequences of AI employee actions, conditional logic, human approval steps, and external system integrations — all in a visual builder.

## Category
AUTOMATION

## Backend Status
- ❌ **No dedicated workflow engine exists**
- Agents have task queues and execution logs but no multi-step workflow abstraction
- `Task` model supports scheduling and status tracking — could serve as workflow steps

## Tenant Frontend Status
- ❌ **No workflow builder UI**

## Admin Frontend Status
- ❌ **No workflow management UI**

## AI Employee Integration
- ⚠️ Agents can execute sequential tasks via conversation, but no formal workflow engine
- Routines system (Phase 10?) may evolve into a workflow capability

## Package/Tier Integration
- Key: `workflow_automation`
- Currently a placeholder flag

## Implementation Gaps
- Workflow definition model (steps, branching, conditions, parallel execution)
- Visual workflow builder UI (drag-and-drop, similar to n8n)
- Step types: AI action, HTTP request, human approval, condition, delay, email, notification
- Workflow execution engine with state management
- Error handling, retry, and rollback per step
- Workflow templates library
- Agent tools for creating and triggering workflows
- Webhook triggers for workflow start
