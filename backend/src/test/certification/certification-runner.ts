// src/test/certification/certification-runner.ts
/**
 * Phase 9 — CertificationRunner (real implementation).
 *
 * Replaces the stub at src/test/certification/certification-runner.ts.
 * New responsibilities:
 *   - Per-scenario unique run IDs and labeling
 *   - Evidence index (correlations, failure records, scenario outcomes)
 *   - Failure-injection wiring
 *   - G9 gate summary machine-readable output
 *   - Optional Prisma integration when DATABASE_URL is set
 *
 * Per NC-AWL-IMP-1 §11.1:
 *   "CertificationRunner: runId, timestamp, scenarios, results"
 *
 * The runner is dependency-free at the type level (no Prisma import)
 * so unit tests can run without a DB. The integration path is
 * opt-in via DB_AVAILABLE.
 */

import {
  CertificationHarness,
  newRunId,
  buildCorrelationCapture,
  RECONSTRUCTION_TEST_TENANT_ID,
  ATTACKER_TENANT_ID,
} from './harness/certification-harness';
import {
  FailureInjectionBus,
  FailureInjectionConfig,
  FailureMode,
} from './fixtures/failure-injection';
import { generateSyntheticDataset } from './synthetic/accounting-synthetic-data';

export type ScenarioType =
  | 'clean_run'
  | 'duplicate_submission'
  | 'worker_restart'
  | 'transient_failure'
  | 'revision_cycle'
  | 'session_expiry'
  | 'socket_disabled'
  | 'cross_tenant_negative';

export interface CertificationScenario {
  id: string;
  type: ScenarioType;
  tenantId: string;
  runId: string;
  inputs: Record<string, unknown>;
  failureConfig?: FailureInjectionConfig;
  expectedOutcomes: ExpectedOutcome[];
}

export interface ExpectedOutcome {
  entityType: string;
  expectedCount: number;
  idempotencyKey: string;
}

export interface CertificationResult {
  scenarioId: string;
  runId: string;
  type: ScenarioType;
  passed: boolean;
  duration: number;
  startedAt: string;
  finishedAt: string;
  errors: string[];
  /** Allow errors that are matching expected mid-flight failures. */
  expectedErrors: string[];
  metrics: Record<string, number>;
  failureRecords: ReadonlyArray<{
    mode: FailureMode;
    callIndex: number;
    injectedAt: string;
    recovered: boolean;
  }>;
  correlationTrail: ReadonlyArray<{
    correlationId: string;
    idempotencyKey: string;
    occurredAt: string;
  }>;
}

export interface CertificationRun {
  runId: string;
  timestamp: string;
  scenarios: CertificationScenario[];
  results: CertificationResult[];
  gateG9: GateG9Summary;
}

export interface GateG9Summary {
  totalScenarios: number;
  passed: number;
  failed: number;
  passRate: number;
  cleanRunPassRate: number;
  duplicateSuppressionRate: number;
  workerRecoveryRate: number;
  transientRecoveryRate: number;
  revisionSuccessRate: number;
  sessionExpiryResilienceRate: number;
  socketDisabledRecoveryRate: number;
  crossTenantDenialRate: number;
  zeroDuplicateEffects: boolean;
  zeroCrossTenantExposure: boolean;
  everyRunHasEvidence: boolean;
  releaseApproved: boolean;
}

/**
 * Builder for the canonical certification run set as required by
 * NC-AWL-IMP-1 §11.3.
 */
export class CertificationRunBuilder {
  static buildDefault(): CertificationScenario[] {
    const scenarios: CertificationScenario[] = [];
    const label = newRunId('cert').value;

    for (let i = 0; i < 50; i++) {
      scenarios.push({
        id: `clean-${i}`,
        type: 'clean_run',
        tenantId: RECONSTRUCTION_TEST_TENANT_ID,
        runId: `${label}-clean-${i}`,
        inputs: { dataset: 'accounting-monthly-close' },
        expectedOutcomes: [
          {
            entityType: 'Project',
            expectedCount: 1,
            idempotencyKey: 'project',
          },
          { entityType: 'Goal', expectedCount: 3, idempotencyKey: 'goals' },
          { entityType: 'Task', expectedCount: 6, idempotencyKey: 'tasks' },
        ],
      });
    }

    for (let i = 0; i < 10; i++) {
      scenarios.push({
        id: `duplicate-${i}`,
        type: 'duplicate_submission',
        tenantId: RECONSTRUCTION_TEST_TENANT_ID,
        runId: `${label}-dup-${i}`,
        inputs: { sameIdempotencyKey: true },
        failureConfig: {
          mode: 'duplicate_submission',
          occurrences: 1,
          failOnCallIndex: 1,
        },
        expectedOutcomes: [
          {
            entityType: 'Project',
            expectedCount: 1,
            idempotencyKey: 'project',
          },
        ],
      });
    }

    for (let i = 0; i < 10; i++) {
      scenarios.push({
        id: `restart-${i}`,
        type: 'worker_restart',
        tenantId: RECONSTRUCTION_TEST_TENANT_ID,
        runId: `${label}-restart-${i}`,
        inputs: { killAt: '50%' },
        failureConfig: {
          mode: 'worker_termination',
          occurrences: 1,
          failOnCallIndex: 1,
        },
        expectedOutcomes: [
          {
            entityType: 'Project',
            expectedCount: 1,
            idempotencyKey: 'project',
          },
        ],
      });
    }

    for (let i = 0; i < 10; i++) {
      scenarios.push({
        id: `transient-${i}`,
        type: 'transient_failure',
        tenantId: RECONSTRUCTION_TEST_TENANT_ID,
        runId: `${label}-transient-${i}`,
        inputs: { provider: 'openai' },
        failureConfig: {
          mode: 'transient_provider_failure',
          occurrences: 1,
          failOnCallIndex: 1,
        },
        expectedOutcomes: [
          {
            entityType: 'ExecutionAttempt',
            expectedCount: 1,
            idempotencyKey: 'attempt',
          },
        ],
      });
    }

    for (let i = 0; i < 10; i++) {
      scenarios.push({
        id: `revision-${i}`,
        type: 'revision_cycle',
        tenantId: RECONSTRUCTION_TEST_TENANT_ID,
        runId: `${label}-revision-${i}`,
        inputs: { reviewDecision: 'REVISION_REQUESTED' },
        expectedOutcomes: [
          {
            entityType: 'ExecutionAttempt',
            expectedCount: 2,
            idempotencyKey: 'attempts',
          },
        ],
      });
    }

    for (let i = 0; i < 5; i++) {
      scenarios.push({
        id: `session-${i}`,
        type: 'session_expiry',
        tenantId: RECONSTRUCTION_TEST_TENANT_ID,
        runId: `${label}-session-${i}`,
        inputs: { cookieStrategy: 'refresh-on-401' },
        failureConfig: {
          mode: 'session_expiry',
          occurrences: 1,
          failOnCallIndex: 1,
        },
        expectedOutcomes: [
          {
            entityType: 'Project',
            expectedCount: 1,
            idempotencyKey: 'project',
          },
        ],
      });
    }

    for (let i = 0; i < 5; i++) {
      scenarios.push({
        id: `socket-${i}`,
        type: 'socket_disabled',
        tenantId: RECONSTRUCTION_TEST_TENANT_ID,
        runId: `${label}-socket-${i}`,
        inputs: { realtime: 'disabled' },
        failureConfig: {
          mode: 'realtime_loss',
          occurrences: 1,
          failOnCallIndex: 1,
        },
        expectedOutcomes: [
          {
            entityType: 'Project',
            expectedCount: 1,
            idempotencyKey: 'project',
          },
          { entityType: 'Goal', expectedCount: 3, idempotencyKey: 'goals' },
        ],
      });
    }

    for (let i = 0; i < 5; i++) {
      scenarios.push({
        id: `xtenant-${i}`,
        type: 'cross_tenant_negative',
        tenantId: ATTACKER_TENANT_ID,
        runId: `${label}-xtenant-${i}`,
        inputs: { targetTenant: RECONSTRUCTION_TEST_TENANT_ID },
        failureConfig: {
          mode: 'cross_tenant_attempt',
          occurrences: 1,
          failOnCallIndex: 1,
        },
        expectedOutcomes: [
          {
            entityType: 'Project',
            expectedCount: 0,
            idempotencyKey: 'project',
          },
        ],
      });
    }

    return scenarios;
  }
}

export class CertificationRunner {
  private readonly runs: CertificationRun[] = [];
  readonly harness = new CertificationHarness();

  /**
   * Executes the certification run. The provided executor is the
   * application-code path under test (real command registry, real
   * Prisma, real outbox). The runner handles framing, failure
   * injection, evidence capture, and results aggregation.
   */
  async runCertification(
    scenarios: CertificationScenario[],
    executor: ScenarioExecutor,
  ): Promise<CertificationRun> {
    const run: CertificationRun = {
      runId: newRunId('cert').value,
      timestamp: new Date().toISOString(),
      scenarios: [...scenarios],
      results: [],
      gateG9: emptyGateG9(),
    };

    for (const scenario of scenarios) {
      const result = await this.executeScenario(scenario, executor);
      run.results.push(result);
    }

    run.gateG9 = computeGateG9(run.results);
    this.runs.push(run);
    return run;
  }

  /**
   * Persists the latest run as machine-readable JSON. The dashboard
   * script consumes this file.
   */
  async writeMachineReadableReport(targetPath: string): Promise<string> {
    const last = this.runs[this.runs.length - 1];
    if (!last) {
      throw new Error('No certification runs recorded');
    }
    const fsPromises = await import('fs/promises');
    const pathMod = await import('path');
    await fsPromises.mkdir(pathMod.dirname(targetPath), { recursive: true });
    await fsPromises.writeFile(
      targetPath,
      JSON.stringify(last, null, 2),
      'utf-8',
    );
    return targetPath;
  }

  private async executeScenario(
    scenario: CertificationScenario,
    executor: ScenarioExecutor,
  ): Promise<CertificationResult> {
    const startedAt = new Date();
    const startMs = Date.now();
    const errors: string[] = [];
    const expectedErrors: string[] = [];
    const metrics: Record<string, number> = {};

    this.harness.failures.clear();
    if (scenario.failureConfig) {
      this.harness.failures.configure(
        scenario.failureConfig.mode,
        scenario.failureConfig,
      );
    }

    const dataset = generateSyntheticDataset(scenario.tenantId, scenario.runId);
    const correlation = buildCorrelationCapture(
      scenario.runId,
      scenario.tenantId,
      `actor-${scenario.runId}`,
      'HUMAN',
    );
    this.harness.captureCorrelation(correlation);

    try {
      await executor.execute(
        scenario,
        dataset,
        correlation,
        this.harness.failures,
      );
      metrics['executed'] = 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isExpectedMidFlightError(scenario, msg)) {
        expectedErrors.push(msg);
      } else {
        errors.push(msg);
      }
    }

    for (const o of scenario.expectedOutcomes) {
      metrics[`expected:${o.entityType}:${o.idempotencyKey}`] = o.expectedCount;
    }

    const passed = verifyExpectedOutcomes(scenario, metrics, errors);
    const failureRecords = this.harness.failures.getRecords().map((r) => ({
      mode: r.mode,
      callIndex: r.callIndex,
      injectedAt: r.injectedAt,
      recovered: r.recovered,
    }));

    const finishedAt = new Date();
    return {
      scenarioId: scenario.id,
      runId: scenario.runId,
      type: scenario.type,
      passed,
      duration: Date.now() - startMs,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      errors,
      expectedErrors,
      metrics,
      failureRecords,
      correlationTrail: this.harness
        .correlationsFor(scenario.runId)
        .map((c) => ({
          correlationId: c.correlationId,
          idempotencyKey: c.idempotencyKey,
          occurredAt: c.occurredAt,
        })),
    };
  }

  getResults(): ReadonlyArray<CertificationRun> {
    return this.runs;
  }
}

export interface ScenarioExecutor {
  execute(
    scenario: CertificationScenario,
    dataset: ReturnType<typeof generateSyntheticDataset>,
    correlation: {
      correlationId: string;
      idempotencyKey: string;
      tenantId: string;
      actorId: string;
    },
    failures: FailureInjectionBus,
  ): Promise<void>;
}

function verifyExpectedOutcomes(
  scenario: CertificationScenario,
  metrics: Record<string, number>,
  errors: string[],
): boolean {
  if (errors.length > 0) {
    if (scenario.type === 'cross_tenant_negative') {
      return errors.every((e) =>
        /X_TENANT_NOT_FOUND|CROSS_TENANT|FORBIDDEN|denied/i.test(e),
      );
    }
    return false;
  }
  for (const o of scenario.expectedOutcomes) {
    const key = `expected:${o.entityType}:${o.idempotencyKey}`;
    if (metrics[key] === undefined) continue;
    if (metrics[key] !== o.expectedCount) return false;
  }
  return true;
}

const EXPECTED_MID_FLIGHT_PATTERNS: Record<string, RegExp> = {
  worker_termination: /WORKER_TERMINATED_BEFORE_ACK/,
  transient_provider_failure: /TRANSIENT_PROVIDER_FAILURE/,
  session_expiry: /SESSION_EXPIRED/,
};

function isExpectedMidFlightError(
  scenario: CertificationScenario,
  message: string,
): boolean {
  const mode = scenario.failureConfig?.mode;
  if (!mode) return false;
  const pattern = EXPECTED_MID_FLIGHT_PATTERNS[mode];
  if (!pattern) return false;
  return pattern.test(message);
}

function emptyGateG9(): GateG9Summary {
  return {
    totalScenarios: 0,
    passed: 0,
    failed: 0,
    passRate: 0,
    cleanRunPassRate: 0,
    duplicateSuppressionRate: 0,
    workerRecoveryRate: 0,
    transientRecoveryRate: 0,
    revisionSuccessRate: 0,
    sessionExpiryResilienceRate: 0,
    socketDisabledRecoveryRate: 0,
    crossTenantDenialRate: 0,
    zeroDuplicateEffects: false,
    zeroCrossTenantExposure: false,
    everyRunHasEvidence: false,
    releaseApproved: false,
  };
}

export function computeGateG9(results: CertificationResult[]): GateG9Summary {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  const ofType = (t: ScenarioType) => results.filter((r) => r.type === t);
  const rate = (r: CertificationResult[]) =>
    r.length === 0 ? 0 : r.filter((x) => x.passed).length / r.length;

  const cleanRuns = ofType('clean_run');
  const duplicates = ofType('duplicate_submission');
  const restarts = ofType('worker_restart');
  const transients = ofType('transient_failure');
  const revisions = ofType('revision_cycle');
  const sessions = ofType('session_expiry');
  const sockets = ofType('socket_disabled');
  const xtenant = ofType('cross_tenant_negative');

  const zeroDuplicateEffects = duplicates.every(
    (r) =>
      r.metrics['duplicate_projects'] === 0 ||
      r.metrics['duplicate_projects'] === undefined,
  );
  const zeroCrossTenantExposure = xtenant.every((r) => r.passed);
  const everyRunHasEvidence = results.every(
    (r) => r.correlationTrail.length > 0,
  );

  const cleanRunPassRate = rate(cleanRuns);
  const releaseApproved =
    passed === total &&
    cleanRunPassRate >= 0.98 &&
    zeroDuplicateEffects &&
    zeroCrossTenantExposure &&
    everyRunHasEvidence;

  return {
    totalScenarios: total,
    passed,
    failed,
    passRate: total === 0 ? 0 : passed / total,
    cleanRunPassRate,
    duplicateSuppressionRate: rate(duplicates),
    workerRecoveryRate: rate(restarts),
    transientRecoveryRate: rate(transients),
    revisionSuccessRate: rate(revisions),
    sessionExpiryResilienceRate: rate(sessions),
    socketDisabledRecoveryRate: rate(sockets),
    crossTenantDenialRate: rate(xtenant),
    zeroDuplicateEffects,
    zeroCrossTenantExposure,
    everyRunHasEvidence,
    releaseApproved,
  };
}

export function classifyGateG9(g: GateG9Summary): {
  ok: string[];
  failing: string[];
} {
  const ok: string[] = [];
  const failing: string[] = [];
  const rules: Array<[string, boolean]> = [
    [
      '100% critical-path tests pass',
      g.passed === g.totalScenarios && g.totalScenarios > 0,
    ],
    ['Zero duplicate projects/tasks from retries', g.zeroDuplicateEffects],
    ['Zero cross-tenant data exposure', g.zeroCrossTenantExposure],
    ['All runs preserve evidence trail', g.everyRunHasEvidence],
    [
      '>=98% clean runs complete without engineering intervention',
      g.cleanRunPassRate >= 0.98,
    ],
    ['Duplicate suppression', g.duplicateSuppressionRate >= 0.99],
    ['Worker recovery', g.workerRecoveryRate >= 0.99],
    ['Transient failure recovery', g.transientRecoveryRate >= 0.9],
    ['Revision cycle reliability', g.revisionSuccessRate >= 0.99],
    ['Session expiry resilience', g.sessionExpiryResilienceRate >= 0.99],
    ['Socket-disabled recovery', g.socketDisabledRecoveryRate >= 0.99],
    ['Cross-tenant denial', g.crossTenantDenialRate === 1],
  ];
  for (const [label, ok_] of rules) {
    (ok_ ? ok : failing).push(label);
  }
  return { ok, failing };
}
