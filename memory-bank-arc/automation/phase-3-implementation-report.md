# Phase 3 Implementation Report — Canonical AI Employee Core

Date: 2026-08-10  
Plan: `memory-bank-arc/automation/implementation-plan-sol-02.md`  
Phase: 3 — Implement `AIEmployeeCoreService`  
Verdict: **LOCALLY IMPLEMENTED; DATABASE/DEPLOYMENT GATES PENDING**

## Outcome

The canonical AI Employee application service and HTTP boundary are
implemented. No production code was deployed and no production database was
mutated.

The implementation now provides one thin path:

```text
authenticated request
  -> validate bounded input
  -> resolve eligible tenant Employee
  -> idempotently create-or-get WorkRun
  -> creation winner executes
  -> replay observes canonical run without executing
  -> return redacted EmployeeRunView
```

## Contabo investigation

Both Contabo operations documents were inspected, with credentials redacted
from command output.

Read-only SSH verification found:

- all four NeureCore PM2 processes online;
- production PostgreSQL 16 online on port 5432;
- production migration history currently behind the new local Phase 2
  migration;
- the documented audit/test PostgreSQL on port 5433 is not running;
- no production migration or deploy was attempted.

Production was deliberately not used as a concurrency-test database.

## Implemented components

### AIEmployeeCoreService

- `start`, `get`, `list`, `resume`, and `cancel` application operations;
- bounded objective, idempotency key, file count, and capability count checks;
- wildcard/missing tenant rejection;
- Employee eligibility resolution before starting work;
- execution identity always set to the selected Employee;
- requesting identity persisted separately;
- only a newly created WorkRun can execute;
- idempotent replays never call `execute`;
- terminal/running/waiting runs are returned without duplicate execution;
- stable redacted result mapping;
- defensive tenant-match checks on runtime results.

### Separate identity reader

Historical/read operations use a tenant-scoped identity reader rather than the
eligibility resolver. This prevents active runs becoming unreadable merely
because the Employee has reached concurrency capacity or was archived after
performing the work.

### HTTP controller

Added versioned routes under `/api/v1/ai-employees/runs`:

- `POST /`;
- `GET /`;
- `GET /:id`;
- `POST /:id/resume`;
- `POST /:id/cancel`.

Tenant and requesting actor come exclusively from the authenticated JWT. A
normal HTTP client cannot provide `actorType=AI_AGENT` or impersonate the
requesting actor. DTO validation bounds UUIDs, arrays, strings, triggers, and
cancellation reasons.

### WorkRuntime additions

- tenant-scoped `listRuns` port;
- replay signal returned by idempotent creation;
- `startedAt` and `completedAt` stable view fields;
- request file/task/project/customer references added to the authorized
  context snapshot for later Phase 4 planning;
- idempotency keys remain persistence-only and are not exposed publicly.

## Minimal validation requested

The intentionally small critical suite covers:

- start/resolution/create/execute/map golden path;
- replay cannot execute;
- active-run read uses identity-only lookup;
- defensive tenant mismatch denial;
- tenant-scoped list;
- cancellation validation;
- JWT-derived HUMAN requester safety;
- existing WorkRuntime creation and repository idempotency behavior.

Results:

```text
Focused Jest: 22 passed, 0 failed
Backend build: passed
Focused ESLint: passed
git diff --check: passed
Scoped TypeScript diagnostics: no Phase 3 findings
```

## Honest exit-gate status

| Gate | Status |
|---|---|
| Canonical service implemented | Pass |
| Duplicate replay cannot execute | Pass in focused unit test |
| JWT actor/tenant derivation | Pass in focused controller test |
| Get/list/resume/cancel implemented | Pass |
| Existing backend build | Pass |
| One HTTP call proven against real PostgreSQL | Pending |
| Concurrent duplicate-start proof against PostgreSQL | Pending |
| Migration deployed to production | Not attempted |
| Production route smoke test | Not applicable until deployment |

Phase 3 is locally implemented but cannot be honestly certified end-to-end
while the Phase 2 database migration and concurrency gate remain pending.

## Next safe action

Restore or provision a disposable PostgreSQL test instance, apply all
migrations, generate the Prisma client, and run the Phase 2 database suites plus
one HTTP integration test. Only then should a production snapshot, migration,
backend rebuild, PM2 reload, and public route smoke test be considered.
