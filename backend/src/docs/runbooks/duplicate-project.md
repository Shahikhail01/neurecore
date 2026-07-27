# Duplicate Project Runbook

**Trigger:** `project_command_duplicate_suppressed_total` rising or
manual report of a project appearing twice in the UI.

## Symptoms
- Two projects share the same `executionEngineVersion`, `initiationId`,
  or `(tenantId, projectName)`.
- `outbox_event_age_seconds` shows two `ProjectAutomationRequested`
  events for the same `initiationId` within seconds of each other.

## Diagnosis
```sql
SELECT id, "tenantId", "initiationId", "executionEngineVersion",
       "createdAt", "name"
FROM "Project"
WHERE "initiationId" = $1
ORDER BY "createdAt" ASC;
```

If the second row was created within a few seconds of the first,
the cause is most likely a duplicate webhook / retry storm.

## Resolution
1. Confirm the duplicate (do NOT delete yet — preserve the audit trail).
2. Identify the duplicate by sorting `createdAt ASC` and keeping the
   earliest record as the authoritative owner.
3. Soft-archive the duplicate via a controlled operator command —
   the action is recorded in `AuditLog` and `OutboxEvent`.
4. Inspect the originating webhook / idempotency key and fix the
   upstream retry policy.
5. Add a regression test against `IdempotencyRecord` for the
   `(tenantId, initiationId, commandType)` key.

## Verification
- Project list shows exactly one project per initiation.
- `project_command_duplicate_suppressed_total` continues to rise on
  retried submissions (expected) but no NEW duplicate rows exist.
- Audit log shows the soft-archive operator action with the reviewer
  identity.
