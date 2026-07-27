// src/modules/phase8/observability/golden-path-metrics-shapes.ts
/**
 * Phase 8 — §10.6 Gate G8 correlation-propagation evidence.
 *
 * Each property documents the *required* shape that a downstream
 * component must satisfy for "one correlation ID is enough to locate
 * any failed golden run". Tested in
 * `test/architecture/phase8-correlation-trace.spec.ts`.
 */
export const GOLDEN_PATH_METRICS_SHAPE = Object.freeze({
  outboxEventFields: Object.freeze([
    'tenantId',
    'correlationId',
    'causationId',
    'eventType',
    'aggregateId',
    'idempotencyKey',
    'attemptCount',
    'lastErrorCode',
    'createdAt',
  ]),
  attemptFields: Object.freeze([
    'tenantId',
    'taskId',
    'agentId',
    'correlationId',
    'status',
    'attemptNumber',
    'policySnapshot',
    'createdAt',
    'completedAt',
  ]),
  reviewFields: Object.freeze([
    'tenantId',
    'taskId',
    'executionAttemptId',
    'correlationId',
    'decision',
    'reviewerId',
    'comment',
  ]),
  searchableByFields: Object.freeze([
    'correlationId',
    'tenantId',
    'actorId',
    'initiationId',
    'projectId',
    'taskId',
    'assignmentId',
    'executionAttemptId',
    'reviewId',
    'outboxEventId',
  ]),
});
