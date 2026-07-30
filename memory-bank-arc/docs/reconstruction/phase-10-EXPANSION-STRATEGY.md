# Phase 10: Controlled Expansion Strategy

**Document:** NC-AWL-IMP-1 Phase 10
**Date:** 2026-07-26
**Status:** READY (gated on G9 pass)

---

## Expansion Order

After G9 passes and the system is stable for the agreed observation period:

### Step 1: Additional Accounting Tasks
- Add reconciliation tasks to golden path
- Add reporting tasks
- New idempotency keys: `task:reconcile:*`, `task:report:*`
- New certification: 20 clean runs

### Step 2: Multiple Tasks with Dependencies
- Implement task dependency tracking
- Add `dependsOn` field to Task model
- New state: `WAITING_ON_DEPENDENCY`
- New certification: 20 clean runs with chains

### Step 3: Multiple AI Employees in One Project
- Add `projectMembers` for AI employees
- Role-based assignment with multiple eligible agents
- New certification: 20 clean runs

### Step 4: Parallel Work with Concurrency
- Add `parallelGroup` to Task
- Implement parallel execution coordinator
- Concurrency limits: 5 tasks per agent, 10 per project
- New certification: 20 clean runs

### Step 5: One Additional Project Type in Accounting
- Add "Tax Preparation" project type
- New goal/task templates
- New certification: 20 clean runs

### Step 6: One Additional Industry
- Add "Legal Services" industry
- New goal/task templates
- New certification: 20 clean runs

### Step 7: Enterprise Autonomy Missions
- Only after UI and policies use same command/execution boundary
- Multi-step missions
- Mission-level state machine
- Full certification: 50 clean runs

---

## Expansion Gate Criteria

Each expansion requires:
1. Own golden scenario
2. Own certification gate
3. Backward compatibility verification
4. Rollback plan

---

## File Structure

```
src/modules/expansion/
  step-1-additional-tasks/
  step-2-task-dependencies/
  step-3-multi-agent/
  step-4-parallel-work/
  step-5-tax-prep/
  step-6-legal-services/
  step-7-autonomy-missions/
```
