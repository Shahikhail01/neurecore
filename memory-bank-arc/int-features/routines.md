# Scheduled Routines

## Overview
Schedule AI employees to execute recurring tasks automatically. Routines can run on cron schedules, trigger on events, or execute at fixed intervals — enabling autonomous operation without human intervention.

## Category
AUTOMATION

## Backend Status
- ⚠️ **Partial implementation — WEBHOOK triggers implemented, schedule triggers exist**
- `Routine`, `RoutineRun`, `RoutineTrigger` models in Prisma
- `Agent` → `ownedRoutines` and `routineRuns` relations
- `RoutineTrigger` supports types: `SCHEDULE`, `WEBHOOK`, `EVENT`, `MANUAL`
- `backend/src/modules/routines/`:
  - `routines.controller.ts` — CRUD + `WebhooksController` for incoming webhook triggers
  - `services/routine-execution.service.ts` — execution engine with `handleWebhookTrigger()`
  - `repositories/prisma-routine.repository.ts` — `PrismaRoutineTriggerRepository`
  - `langgraph/routine-graph.ts` — LangGraph execution graph
- **Webhook trigger** (`WEBHOOK` type): routines can be triggered via `POST /webhooks/routines/:path` with secret validation

## Tenant Frontend Status
- ❌ **No tenant routine management UI**

## Admin Frontend Status
- ❌ **No admin routine management UI**

## AI Employee Integration
- ⚠️ Agent model has `routineRuns RoutineRun[]` and `ownedRoutines Routine[]`
- `WEBHOOK` trigger type allows external systems to trigger routines via HTTP
- Agents may have pre-configured routines executed by the scheduler

## Package/Tier Integration
- Key: `routines`
- Referenced in accounting packages

## Implementation Gaps
- Tenant UI for creating and managing schedules (cron expression builder or interval picker)
- Routine template library (common patterns: daily standup, weekly report, hourly monitor)
- Agent tool: "create routine", "list routines", "pause routine"
- Routine execution logs and history viewer in UI
- Failure notifications when a routine fails
- Routine chaining (routine completion triggers another routine)
- One-time scheduled tasks (not recurring)
