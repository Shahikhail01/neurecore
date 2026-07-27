// src/modules/phase8/observability/golden-path-alerts.ts
// Phase 8 — §10.6 Gate G8 criterion 2: alerts exist for stuck / backlogged /
// failed core work. The catalog below is the canonical source of alert rules;
// `AlertingService` (next file) reads it to register Prometheus alert rules
// and to drive dashboard wiring.

export type AlertSeverity = 'page' | 'warn' | 'info';

export type AlertComparator = '>' | '>=' | '<' | '<=' | '==';

export interface GoldenPathAlertRule {
  /** Stable identifier — used as the alert label and the runbook link. */
  id: string;
  /** Human-readable description that shows up on the receiver page. */
  description: string;
  /** Phase 8 runbook to follow when the alert fires. */
  runbookFile: string;
  /** Prometheus expression evaluated against the golden-path metrics. */
  expression: string;
  /** Comparator used when rendered in non-Prometheus dashboards. */
  comparator: AlertComparator;
  /** Threshold value paired with `comparator`. */
  threshold: number;
  /** Duration the condition must hold before the alert fires. */
  for: string;
  severity: AlertSeverity;
  /** Labels with stable, low-cardinality values (no tenant or attempt ids). */
  labels: Record<string, string>;
}

export const GOLDEN_PATH_ALERTS: readonly GoldenPathAlertRule[] = Object.freeze(
  [
    {
      id: 'outbox-backlog-critical',
      description: 'Outbox backlog has crossed the critical (1000) threshold',
      runbookFile: 'outbox-backlog.md',
      expression: 'outbox_backlog_size > 1000',
      comparator: '>',
      threshold: 1000,
      for: '5m',
      severity: 'page',
      labels: { component: 'outbox', phase: 'g3' },
    },
    {
      id: 'outbox-backlog-warning',
      description: 'Outbox backlog above warning (100) but below critical',
      runbookFile: 'outbox-backlog.md',
      expression: 'outbox_backlog_size > 100',
      comparator: '>',
      threshold: 100,
      for: '2m',
      severity: 'warn',
      labels: { component: 'outbox', phase: 'g3' },
    },
    {
      id: 'outbox-poison-event',
      description: 'One or more outbox events reached the dead-letter sink',
      runbookFile: 'poison-event.md',
      expression: 'increase(job_dead_letters_total[5m]) > 0',
      comparator: '>',
      threshold: 0,
      for: '1m',
      severity: 'page',
      labels: { component: 'outbox', phase: 'g3' },
    },
    {
      id: 'execution-stuck',
      description: 'One or more attempts have been RUNNING for > 30 minutes',
      runbookFile: 'stuck-execution.md',
      expression: 'execution_duration_seconds > 1800',
      comparator: '>',
      threshold: 1800,
      for: '1m',
      severity: 'page',
      labels: { component: 'execution', phase: 'g5' },
    },
    {
      id: 'provider-outage',
      description: 'Tool / model provider circuit open for > 5 minutes',
      runbookFile: 'provider-outage.md',
      expression: 'increase(tool_failure_total[5m]) > 10',
      comparator: '>',
      threshold: 10,
      for: '5m',
      severity: 'page',
      labels: { component: 'provider', phase: 'g8' },
    },
    {
      id: 'assignment-failure-spike',
      description: 'Assignment failure rate spiked above 10% of attempts',
      runbookFile: 'failed-automation.md',
      expression:
        'rate(assignment_failure_total[5m]) / rate(assignment_success_total[5m]) > 0.1',
      comparator: '>',
      threshold: 0.1,
      for: '5m',
      severity: 'warn',
      labels: { component: 'assignment', phase: 'g4' },
    },
    {
      id: 'automation-completion-rate-low',
      description: 'Automation completion rate under 95%',
      runbookFile: 'failed-automation.md',
      expression: 'automation_completion_rate < 0.95',
      comparator: '<',
      threshold: 0.95,
      for: '10m',
      severity: 'warn',
      labels: { component: 'automation', phase: 'g3' },
    },
    {
      id: 'session-refresh-failure',
      description: 'Session refresh 5xx ratio above threshold',
      runbookFile: 'session-failure.md',
      expression: 'increase(session_refresh_failure_total[5m]) > 5',
      comparator: '>',
      threshold: 5,
      for: '5m',
      severity: 'page',
      labels: { component: 'auth', phase: 'g8' },
    },
    {
      id: 'socket-error-burst',
      description: 'Realtime socket errors climbing over baseline',
      runbookFile: 'socket-failure.md',
      expression: 'increase(socket_error_total[2m]) > 25',
      comparator: '>',
      threshold: 25,
      for: '2m',
      severity: 'warn',
      labels: { component: 'realtime', phase: 'g7' },
    },
    {
      id: 'attempt-quality-failures',
      description:
        'MODEL_QUALITY_FAILURE classification exceeds 10% of attempts',
      runbookFile: 'model-rollback.md',
      expression:
        'rate(attempt_failure_total{classification="MODEL_QUALITY_FAILURE"}[1h]) / rate(attempt_failure_total[1h]) > 0.1',
      comparator: '>',
      threshold: 0.1,
      for: '30m',
      severity: 'warn',
      labels: { component: 'execution', phase: 'g8' },
    },
  ],
);

/** Stable, single-source-of-truth listing of alert rule IDs. Used by tests. */
export const GOLDEN_PATH_ALERT_IDS: readonly string[] = Object.freeze(
  GOLDEN_PATH_ALERTS.map((rule) => rule.id),
);
