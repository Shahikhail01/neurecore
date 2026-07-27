# Failed Automation Runbook

**Trigger:** Project automation status = `FAILED` for > 5min

## Symptoms
- Project row shows `automationStatus = FAILED` or `FAILED_FINAL`.
- `automation_completion_rate` drops below the alert threshold.
- Customers report that "the project was created but no tasks appeared".

## Diagnosis
1. Find the project and check `OutboxEvent` for the original
   `ProjectAutomationRequested` event.
2. Inspect `OutboxDeadLetter` rows that match the projectId/eventId.
3. Walk the outbox worker logs filtered by `correlationId` to find
   the first failing step (goal / task / assignment).
4. Check `attempt_failure_total{classification=...}` to classify
   the failure as transient, invalid input, or policy denial.

## Resolution
1. **Transient infra failure** — re-enqueue via `replayDeadLetter()`
   after the upstream service is healthy.
2. **Invalid input** — patch the missing/incorrect project metadata,
   then re-enqueue.
3. **Policy denial** — update the project automation policy and add
   a regression test. The policy change is recorded in
   `FeatureFlagAuditLog`.
4. If the project is now in a half-initialised state (some goals,
   some tasks, no assignments), let the worker reconcile by
   re-enqueing — every step is idempotent on
   `(tenantId, projectId, automationVersion, templateKey)`.

## Verification
- `automationStatus = COMPLETED` for the affected project.
- `Goal`/`Task`/`TaskAssignment` row counts match the template.
- The fix has a unit or integration test committed alongside.
