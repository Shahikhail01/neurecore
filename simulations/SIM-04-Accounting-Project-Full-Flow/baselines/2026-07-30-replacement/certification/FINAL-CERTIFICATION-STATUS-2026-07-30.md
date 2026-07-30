# Autonomous Work Layer Certification Status

Date: 2026-07-30

## Decision

Implementation is substantial, but the autonomous work layer is **not fully
certified** against NC-AWL-IMP-2 as written. Freeze additional domain
activation until the open gates below are closed.

## Status separation

| Status | Verdict | Evidence |
|---|---|---|
| Implementation | Complete for the accounting workflow slice | Upstream `AIAgent` wiring, isolated sidecar, scoped gateway, approvals, audit events, and accounting production workflow exist |
| Certification | Incomplete | The 20 runs reused one production login and do not prove 20 clean tenants; autonomy, delegation, skills, and per-tool contracts are not fully evidenced |
| Operational closure | Pending | The 30-day post-deletion observation period cannot finish before 2026-08-28 |

## Findings

### Phase 0

Phase 0 remains incomplete. The rename was not completed, the claimed baseline
archive is absent, the freeze was not enforced, and the sibling
`neurecore-ci-check/` repository still exists. A later scope decision does not
convert these gates into passes.

### Twenty-run evidence

The runner accepts one `TEST_EMAIL` and `TEST_PASSWORD` and contains no tenant
provisioning, reset, or cleanup step. The twenty executions therefore establish
repeatability in one production account, not isolation across twenty fresh
tenants. The raw browser summary remains `FAIL`; the later database record is a
final aggregate query and does not prove the state after each run.

### Upstream autonomy

The sidecar genuinely imports and invokes upstream `AIAgent.run_conversation`.
That proves runtime integration, but not general autonomous behavior:

- The system prompt contains locked Acme Q3 instructions, including required
  goals, assignments, and notification behavior.
- `skip_memory=True` and `save_trajectories=False` disable the learning path.
- No NeureCore trace proves `delegate_task`, operational subagents, skill
  creation/reuse, reviewer execution, or self-correction.

The current evidence certifies a model-driven, tool-using accounting workflow,
not a generally autonomous or learning AI employee.

### Tool contracts

The accounting gateway exposes ten scoped tools. Existing focused tests prove
catalog restriction, approval deferral/reuse, and idempotent customer, goal,
and task resolution. They do not provide a complete RBAC, approval,
idempotency, invalid-schema, and audit matrix for every tool.

### Legacy deletion

The in-process execution loop was removed under an accepted same-day governance
exception. `HermesModule`, multiple services, seven persistence models, and
three enums remain live. This is accurately classified as **legacy execution
loop removed**, not physical deletion complete.

### Template inventory

The original 707 figure is a historical catalog claim. The production report
of 20 certified plus 792 shadow counts 812 current public platform templates.
The repository contains later seeders that add domain-specific templates, but
there is no tracked inventory snapshot explaining every addition or detecting
duplicate natural identities. The discrepancy is unresolved until a DB-backed
inventory report groups rows by source/domain/status and records stable IDs.

## Required gates before another domain

1. Produce a DB-backed template inventory reconciling the historical 707 with
   every current template row.
2. Restore the original baseline or approve a clearly labelled replacement.
3. Provision and run SIM-04 against twenty isolated clean tenants, recording a
   unique tenant ID and pre/post duplicate query for each run.
4. Capture upstream traces for planning and tool iteration without
   workflow-specific prompt instructions.
5. Certify subagent delegation, skill creation/reuse, learning, reviewer, and
   self-correction in separate gates.
6. Complete the ten-tool contract matrix.
7. Audit surviving legacy callers and retain the accepted governance exception
   in ADR-0001.
8. Attach a zero-rollback observation report on or after 2026-08-28.

## Current release statement

NeureCore has a working, controlled accounting automation path. It has not yet
certified a generally autonomous, delegating, learning AI-employee platform.
