# SIM-04 Phase 3 Postmortem

Date: 2026-07-30

## Outcome

The final browser evaluation completed 20 of 20 runs. It recorded no
fabricated IDs, unauthorized tool executions, approval bypasses, failed
approval resumes, or incomplete audit trails. The production duplicate query
recorded zero duplicate customers, projects, and goals.

## What went wrong before the pass

The initial gate artifact failed closed because browser evidence and the
production database duplicate check were produced at different times. Goal and
task creation could also produce duplicate semantic records across retries.

## Corrections

- Goal and task creation now resolves existing tenant-scoped records before
  creating new rows.
- The runner supports sequential approval checkpoints and transient login or
  chunk-load retries.
- External duplicate-record results are now stored as structured, tracked JSON
  and supplied to the runner through `SIM04_DUPLICATE_RECORDS_EVIDENCE`.
- A tracked composite certification record links browser and database evidence.

## Follow-up

Keep the 30-day post-deletion observation gate open through 2026-08-28. Any
rollback or reintroduction of the deleted in-process runtime invalidates final
operational closure and must be recorded in ADR-0001.
