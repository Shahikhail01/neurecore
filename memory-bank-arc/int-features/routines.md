# Scheduled Routines

## Overview
Schedule AI employees to execute recurring tasks automatically. Routines can run on cron schedules, trigger on events, or execute at fixed intervals — enabling autonomous operation without human intervention.

## Category
AUTOMATION

## Backend Status
- ⚠️ **Partial implementation**
- `Routine` and `RoutineRun` models in Prisma
- `Agent` → `ownedRoutines` and `routineRuns` relations
- Agent model supports routines (reverse relation from Routine to Agent as `routineOwner`)
- Scheduling infrastructure exists but may not be fully wired

## Tenant Frontend Status
- ❌ **No tenant routine management UI**

## Admin Frontend Status
- ❌ **No admin routine management UI**

## AI Employee Integration
- ⚠️ Agent model has `routineRuns RoutineRun[]` and `ownedRoutines Routine[]`
- Routines are defined but no agent tool to create/manage/trigger them from chat
- Agents may have pre-configured routines executed by the scheduler

## Package/Tier Integration
- Key: `routines`
- Referenced in accounting packages

## Implementation Gaps
- Tenant UI for creating and managing schedules (cron expression builder or interval picker)
- Routine template library (common patterns: daily standup, weekly report, hourly monitor)
- Agent tool: "create routine", "list routines", "pause routine"
- Routine execution logs and history viewer
- Failure notifications when a routine fails
- Routine chaining (routine completion triggers another routine)
- One-time scheduled tasks (not recurring)
