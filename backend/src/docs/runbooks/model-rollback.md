# Model Rollback Runbook

**Trigger:** Model quality failure rate > 10% over a rolling 1h
window, or a customer-visible regression in draft quality.

## Symptoms
- `attempt_retry_total{classification="MODEL_QUALITY_FAILURE"}` rising.
- Customer feedback: "drafts are now lower quality than yesterday".
- A change to the default model in the `AI Gateway` config that has
  not yet been validated against the certification harness.

## Diagnosis
1. Identify the currently pinned model and prompt version on
   `TenantModelOverride` rows.
2. Compare the recent model output to the previous baseline using
   a sample of 20 failed tasks (drawn from `ExecutionAttempt`
   filtered by `classification = MODEL_QUALITY_FAILURE`).
3. Cross-check upstream provider release notes (often a silent
   model version bump is the cause).

## Resolution
1. Revert `TenantModelOverride` to the previous model+version for
   affected tenants. Record the change in
   `FeatureFlagAuditLog` and `AuditLog`.
2. Disable the new model in the AI Gateway catalog
   (`enabled = false`).
3. Re-enqueue the affected in-flight attempts with the previous
   model — these are durable because they live in the outbox.
4. Once the upstream issue is resolved, validate the new model in
   the certification harness before re-enabling.

## Verification
- `attempt_retry_total{classification="MODEL_QUALITY_FAILURE"}` is
  flat or declining.
- Drafts re-queued with the previous model complete without
  quality complaints.
- The AI Gateway catalog lists the new model as `enabled = false`
  and `supersededByModelId` points to the previous model.
