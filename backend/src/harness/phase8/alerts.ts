import { randomUUID } from 'crypto';
import type { OperationalAlertPort } from './ports';
import type {
  OperationalAlert,
  Phase8RunnerReport,
  Phase8Counters,
  Phase8EnvironmentClass,
} from './contracts';

export const PHASE8_ALERT_GATEWAY_VERSION = '1.0.0';

export interface Phase8AlertDispatchInput {
  report: Phase8RunnerReport;
  sink: OperationalAlertPort;
  now?: () => Date;
}

export interface Phase8AlertDispatchOutcome {
  emitted: number;
  byKind: Record<OperationalAlert['kind'], number>;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

export function dispatchOperationalAlerts(
  input: Phase8AlertDispatchInput,
): Phase8AlertDispatchOutcome {
  const byKind: Record<OperationalAlert['kind'], number> = {
    CLEANUP_FAILURE: 0,
    CORRECTNESS_FAILURE: 0,
    ISOLATION_FAILURE: 0,
    SATURATION_DETECTED: 0,
    PROVIDER_THROTTLE_SUSTAINED: 0,
    QUEUE_BACKLOG_GROWTH: 0,
    RECOVERY_FAILURE: 0,
    UNSUPPORTED_ROUTING: 0,
  };
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  for (const a of input.report.operationalAlerts) {
    input.sink.emit(a);
    byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;
    if (a.severity === 'CRITICAL') criticalCount++;
    else if (a.severity === 'WARNING') warningCount++;
    else infoCount++;
  }
  return {
    emitted: input.report.operationalAlerts.length,
    byKind,
    criticalCount,
    warningCount,
    infoCount,
  };
}

export interface AlertGateOutput {
  alerts: OperationalAlert[];
  blocked: boolean;
  reasons: string[];
}

export function alertGateForReport(
  report: Phase8RunnerReport,
  env: Phase8EnvironmentClass,
  options: {
    failOnCleanupFailure?: boolean;
    failOnCorrectnessFailure?: boolean;
    failOnIsolationFailure?: boolean;
    failOnRecoveryFailure?: boolean;
  } = {},
): AlertGateOutput {
  const reasons: string[] = [];
  const alerts = report.operationalAlerts;
  for (const a of alerts) {
    if (a.kind === 'CLEANUP_FAILURE' && options.failOnCleanupFailure) {
      reasons.push(`cleanup failure: ${a.message}`);
    }
    if (a.kind === 'CORRECTNESS_FAILURE' && options.failOnCorrectnessFailure) {
      reasons.push(`correctness failure: ${a.message}`);
    }
    if (a.kind === 'ISOLATION_FAILURE' && options.failOnIsolationFailure) {
      reasons.push(`isolation failure: ${a.message}`);
    }
    if (a.kind === 'RECOVERY_FAILURE' && options.failOnRecoveryFailure) {
      reasons.push(`recovery failure: ${a.message}`);
    }
  }
  if (
    env === 'SIMULATED' &&
    (options.failOnCorrectnessFailure || options.failOnIsolationFailure)
  ) {
    reasons.push('SIMULATED environment cannot authorize release capacity');
  }
  return { alerts, blocked: reasons.length > 0, reasons };
}

export function buildUnauthorizedCapacityAlert(input: {
  runId: string;
  tenantId: string;
  env: Phase8EnvironmentClass;
  counters: Phase8Counters;
}): OperationalAlert {
  return {
    schemaVersion: '1.0.0',
    alertId: randomUUID(),
    kind: 'UNSUPPORTED_ROUTING',
    severity: 'INFO',
    message: `simulated environmentClass=${input.env} cannot authorize production capacity; counters=${JSON.stringify(input.counters)}`,
    profileId: null,
    metricBundleId: null,
    runId: input.runId,
    tenantId: input.tenantId,
    observedAt: new Date().toISOString(),
    context: { counters: input.counters, env: input.env },
  };
}
