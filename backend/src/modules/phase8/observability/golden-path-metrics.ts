// src/modules/phase8/observability/golden-path-metrics.ts
import { Counter, Gauge, Histogram } from 'prom-client';
import { MetricsService } from '../../metrics/metrics.service';

/**
 * Phase 8 — §10.2 Metrics Catalog.
 *
 * Plan requires "non-empty help text and controlled low-cardinality
 * labels. Tenant, project, task, attempt, event, and correlation
 * identifiers belong in logs/traces—not metric labels." The catalog
 * below uses only `status`, `action`, `result`, `agentType` and
 * `classification` labels so cardinality stays bounded.
 */
export interface GoldenPathMetrics {
  // Initiation
  initiationsCreated: Counter<'result'>;
  initiationsApproved: Counter<'result'>;
  initiationsFailed: Counter<'classification'>;

  // Project
  projectCommandSuccess: Counter<'action'>;
  projectCommandDuplicateSuppressed: Counter<'action'>;

  // Outbox
  outboxEventAgeSeconds: Histogram<string>;
  outboxBacklogSize: Gauge<string>;
  eventProcessingLatencySeconds: Histogram<'result'>;
  jobRetries: Counter<'classification'>;
  jobDeadLetters: Counter<'eventType'>;

  // Automation
  automationCompletionRate: Gauge<string>;
  assignmentSuccess: Counter<'result'>;
  assignmentFailure: Counter<'classification'>;

  // Execution
  executionQueueTimeSeconds: Histogram<string>;
  executionDurationSeconds: Histogram<'result'>;
  attemptSuccess: Counter<'result'>;
  attemptRetry: Counter<'classification'>;
  attemptFailure: Counter<'classification'>;
  needsInput: Counter<'reason'>;
  needsReview: Counter<'reason'>;

  // Review
  approval: Counter<'result'>;
  revisionRequested: Counter<'result'>;

  // Tools
  toolFailure: Counter<'agentType'>;
  tokenUsage: Counter<'direction'>;
  estimatedCost: Counter<'model'>;

  // Realtime / session
  socketReconnect: Counter<'result'>;
  socketError: Counter<'classification'>;
  sessionRefreshFailure: Counter<'classification'>;
}

export function buildGoldenPathMetrics(
  registry: MetricsService['registry'],
): GoldenPathMetrics {
  return {
    // Initiation
    initiationsCreated: new Counter({
      name: 'initiations_created_total',
      help: 'Enterprise initiations created by the canonical path',
      labelNames: ['result'] as const,
      registers: [registry],
    }),
    initiationsApproved: new Counter({
      name: 'initiations_approved_total',
      help: 'Enterprise initiations approved by the canonical path',
      labelNames: ['result'] as const,
      registers: [registry],
    }),
    initiationsFailed: new Counter({
      name: 'initiations_failed_total',
      help: 'Enterprise initiation failures classified by reason',
      labelNames: ['classification'] as const,
      registers: [registry],
    }),

    // Project
    projectCommandSuccess: new Counter({
      name: 'project_command_success_total',
      help: 'Project-domain command successes',
      labelNames: ['action'] as const,
      registers: [registry],
    }),
    projectCommandDuplicateSuppressed: new Counter({
      name: 'project_command_duplicate_suppressed_total',
      help: 'Project-domain commands suppressed by idempotency',
      labelNames: ['action'] as const,
      registers: [registry],
    }),

    // Outbox
    outboxEventAgeSeconds: new Histogram({
      name: 'outbox_event_age_seconds',
      help: 'Outbox event age in seconds when processed',
      buckets: [1, 5, 10, 30, 60, 300, 600, 1800, 3600],
      registers: [registry],
    }),
    outboxBacklogSize: new Gauge({
      name: 'outbox_backlog_size',
      help: 'Current outbox backlog (pending + processing) row count',
      registers: [registry],
    }),
    eventProcessingLatencySeconds: new Histogram({
      name: 'event_processing_latency_seconds',
      help: 'Outbox event processing latency in seconds',
      labelNames: ['result'] as const,
      buckets: [0.05, 0.1, 0.5, 1, 2, 5, 10, 30, 60, 300],
      registers: [registry],
    }),
    jobRetries: new Counter({
      name: 'job_retries_total',
      help: 'Outbox job retries classified by failure reason',
      labelNames: ['classification'] as const,
      registers: [registry],
    }),
    jobDeadLetters: new Counter({
      name: 'job_dead_letters_total',
      help: 'Outbox events transitioned to dead letter',
      labelNames: ['eventType'] as const,
      registers: [registry],
    }),

    // Automation
    automationCompletionRate: new Gauge({
      name: 'automation_completion_rate',
      help: 'Project automation completion rate (0.0-1.0) over the last 50 runs',
      registers: [registry],
    }),
    assignmentSuccess: new Counter({
      name: 'assignment_success_total',
      help: 'Task assignment successes by result',
      labelNames: ['result'] as const,
      registers: [registry],
    }),
    assignmentFailure: new Counter({
      name: 'assignment_failure_total',
      help: 'Task assignment failures by classification',
      labelNames: ['classification'] as const,
      registers: [registry],
    }),

    // Execution
    executionQueueTimeSeconds: new Histogram({
      name: 'execution_queue_time_seconds',
      help: 'Time between TaskExecutionRequested and RUNNING in seconds',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 300],
      registers: [registry],
    }),
    executionDurationSeconds: new Histogram({
      name: 'execution_duration_seconds',
      help: 'Execution attempt duration in seconds',
      labelNames: ['result'] as const,
      buckets: [0.5, 1, 2, 5, 10, 30, 60, 300, 600, 1800],
      registers: [registry],
    }),
    attemptSuccess: new Counter({
      name: 'attempt_success_total',
      help: 'Execution attempt terminal successes',
      labelNames: ['result'] as const,
      registers: [registry],
    }),
    attemptRetry: new Counter({
      name: 'attempt_retry_total',
      help: 'Execution attempt retries by classification',
      labelNames: ['classification'] as const,
      registers: [registry],
    }),
    attemptFailure: new Counter({
      name: 'attempt_failure_total',
      help: 'Execution attempt terminal failures by classification',
      labelNames: ['classification'] as const,
      registers: [registry],
    }),
    needsInput: new Counter({
      name: 'needs_input_total',
      help: 'Executions transitioned to NEEDS_INPUT by reason',
      labelNames: ['reason'] as const,
      registers: [registry],
    }),
    needsReview: new Counter({
      name: 'needs_review_total',
      help: 'Executions transitioned to NEEDS_REVIEW by reason',
      labelNames: ['reason'] as const,
      registers: [registry],
    }),

    // Review
    approval: new Counter({
      name: 'approval_total',
      help: 'Task approvals by result',
      labelNames: ['result'] as const,
      registers: [registry],
    }),
    revisionRequested: new Counter({
      name: 'revision_requested_total',
      help: 'Task revisions requested by result',
      labelNames: ['result'] as const,
      registers: [registry],
    }),

    // Tools
    toolFailure: new Counter({
      name: 'tool_failure_total',
      help: 'Tool call failures by agent type',
      labelNames: ['agentType'] as const,
      registers: [registry],
    }),
    tokenUsage: new Counter({
      name: 'token_usage_total',
      help: 'Token usage by direction (input/output)',
      labelNames: ['direction'] as const,
      registers: [registry],
    }),
    estimatedCost: new Counter({
      name: 'estimated_cost_total',
      help: 'Estimated USD cost by model',
      labelNames: ['model'] as const,
      registers: [registry],
    }),

    // Realtime / session
    socketReconnect: new Counter({
      name: 'socket_reconnect_total',
      help: 'Realtime socket reconnects by result',
      labelNames: ['result'] as const,
      registers: [registry],
    }),
    socketError: new Counter({
      name: 'socket_error_total',
      help: 'Realtime socket errors by classification',
      labelNames: ['classification'] as const,
      registers: [registry],
    }),
    sessionRefreshFailure: new Counter({
      name: 'session_refresh_failure_total',
      help: 'Session refresh failures by classification',
      labelNames: ['classification'] as const,
      registers: [registry],
    }),
  };
}
