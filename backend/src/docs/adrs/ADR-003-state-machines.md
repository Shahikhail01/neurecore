# ADR-003: State Machines

## Status: Accepted

## Context
Each aggregate has discrete states with explicit transitions. Without enforcement, invalid transitions corrupt business state.

## Decision
Implement typed state machines for all aggregates:
- `INITIATION_TRANSITIONS`
- `AUTOMATION_TRANSITIONS`
- `TASK_TRANSITIONS`
- `ATTEMPT_TRANSITIONS`
- `REVIEW_TRANSITIONS`

Each transition is asserted via state machine class. Invalid transitions throw `InvalidTransitionError`.

## Consequences
- All status changes go through state machine
- No direct status writes to Prisma
- State machine is single source of truth
