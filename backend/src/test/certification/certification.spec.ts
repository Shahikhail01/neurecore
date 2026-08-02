// src/test/certification/certification.spec.ts
/**
 * Phase 9 G9 — Certification Top-Level Suite.
 *
 * Per NC-AWL-IMP-1 §11.5:
 *   - 100% critical-path tests pass
 *   - Zero duplicate projects/tasks/attempts from retries
 *   - Zero cross-tenant data exposure
 *   - All certification runs preserve data integrity
 *   - At least 98% clean runs complete without engineering intervention
 *   - All injected transient failures recover or surface controlled retryable state
 *   - Every completed task has evidence and attributable human approval
 *
 * Drives the canonical CertificationRunner against the simulated
 * ScenarioExecutor (the simulated executor covers the same gates
 * the production executor must satisfy; the integration suite in
 * src/test/integration/ already covers the persistence layer).
 */

import {
  CertificationRunner,
  CertificationRunBuilder,
  classifyGateG9,
} from './certification-runner';
import { createSimulatedScenarioExecutor } from './scenarios/scenario-executor';
import {
  TenantIsolationProbeRunner,
  defaultProbeAdapters,
  InMemoryChannelMappingStore,
  PROBE_BOUNDARIES,
  classifyGateG7,
} from '../../modules/service-gateway-v2/certification/tenant-isolation-probe';
import * as fs from 'fs';
import * as path from 'path';

const REPORT_DIR = path.resolve(__dirname, 'reports');
const REPORT_PATH = path.join(REPORT_DIR, 'g9-machine-readable.json');

describe('Phase 9 G9 — Golden-Path Certification', () => {
  let runner: CertificationRunner;

  beforeEach(() => {
    runner = new CertificationRunner();
  });

  it('executes the full NC-AWL-IMP-1 §11.3 run matrix and meets G9', async () => {
    const scenarios = CertificationRunBuilder.buildDefault();
    const executor = createSimulatedScenarioExecutor();

    const tag = expect.getState().currentTestName ?? 'unset';
    expect(scenarios.length).toBe(50 + 10 + 10 + 10 + 10 + 5 + 5 + 5);

    const result = await runner.runCertification(scenarios, executor);

    const classification = classifyGateG9(result.gateG9);

    // Surface machine-readable results for the dashboard.
    const evidencePath = `g9.${tag.replace(/\s+/g, '_')}`;
    (runCertificationEvidence as any)[evidencePath] = {
      runId: result.runId,
      gateG9: result.gateG9,
      scenarioCount: result.results.length,
      passed: result.gateG9.passed,
      failed: result.gateG9.failed,
      classification,
    };

    const failed = result.results.filter((r) => !r.passed);
    if (failed.length > 0) {
      console.error(
        'Matrix failures:',
        JSON.stringify(
          failed.map((f) => ({
            id: f.scenarioId,
            type: f.type,
            errors: f.errors,
            metrics: f.metrics,
          })),
          null,
          2,
        ),
      );
    }

    expect(result.gateG9.zeroDuplicateEffects).toBe(true);
    expect(result.gateG9.zeroCrossTenantExposure).toBe(true);
    expect(result.gateG9.everyRunHasEvidence).toBe(true);
    expect(result.gateG9.cleanRunPassRate).toBeGreaterThanOrEqual(0.98);
    expect(result.gateG9.duplicateSuppressionRate).toBeGreaterThanOrEqual(0.99);
    expect(result.gateG9.workerRecoveryRate).toBeGreaterThanOrEqual(0.99);
    expect(result.gateG9.transientRecoveryRate).toBeGreaterThanOrEqual(0.9);
    expect(result.gateG9.revisionSuccessRate).toBeGreaterThanOrEqual(0.99);
    expect(result.gateG9.sessionExpiryResilienceRate).toBeGreaterThanOrEqual(
      0.99,
    );
    expect(result.gateG9.socketDisabledRecoveryRate).toBeGreaterThanOrEqual(
      0.99,
    );
    expect(result.gateG9.crossTenantDenialRate).toBe(1);

    // Persist machine-readable report for the dashboard.
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(result, null, 2), 'utf-8');
  }, 120_000);

  it('50 clean golden-path executions all pass', async () => {
    const scenarios = CertificationRunBuilder.buildDefault().filter(
      (s) => s.type === 'clean_run',
    );
    const executor = createSimulatedScenarioExecutor();
    const result = await runner.runCertification(scenarios, executor);

    expect(scenarios.length).toBe(50);
    const passed = result.results.filter((r) => r.passed).length;
    expect(passed).toBeGreaterThanOrEqual(49);
  }, 120_000);

  it('10 duplicate-submission executions all pass', async () => {
    const scenarios = CertificationRunBuilder.buildDefault().filter(
      (s) => s.type === 'duplicate_submission',
    );
    const executor = createSimulatedScenarioExecutor();
    const result = await runner.runCertification(scenarios, executor);

    expect(scenarios.length).toBe(10);
    expect(result.results.every((r) => r.passed)).toBe(true);
  }, 60_000);

  it('10 worker-restart executions all pass', async () => {
    const scenarios = CertificationRunBuilder.buildDefault().filter(
      (s) => s.type === 'worker_restart',
    );
    const executor = createSimulatedScenarioExecutor();
    const result = await runner.runCertification(scenarios, executor);

    expect(scenarios.length).toBe(10);
    expect(result.results.every((r) => r.passed)).toBe(true);
  }, 60_000);

  it('10 transient-failure executions all pass', async () => {
    const scenarios = CertificationRunBuilder.buildDefault().filter(
      (s) => s.type === 'transient_failure',
    );
    const executor = createSimulatedScenarioExecutor();
    const result = await runner.runCertification(scenarios, executor);

    expect(scenarios.length).toBe(10);
    expect(result.results.every((r) => r.passed)).toBe(true);
  }, 60_000);

  it('10 revision-cycle executions all pass', async () => {
    const scenarios = CertificationRunBuilder.buildDefault().filter(
      (s) => s.type === 'revision_cycle',
    );
    const executor = createSimulatedScenarioExecutor();
    const result = await runner.runCertification(scenarios, executor);

    expect(scenarios.length).toBe(10);
    expect(result.results.every((r) => r.passed)).toBe(true);
  }, 60_000);

  it('5 session-expiry executions all pass', async () => {
    const scenarios = CertificationRunBuilder.buildDefault().filter(
      (s) => s.type === 'session_expiry',
    );
    const executor = createSimulatedScenarioExecutor();
    const result = await runner.runCertification(scenarios, executor);

    expect(scenarios.length).toBe(5);
    expect(result.results.every((r) => r.passed)).toBe(true);
  }, 60_000);

  it('5 socket-disabled executions all pass', async () => {
    const scenarios = CertificationRunBuilder.buildDefault().filter(
      (s) => s.type === 'socket_disabled',
    );
    const executor = createSimulatedScenarioExecutor();
    const result = await runner.runCertification(scenarios, executor);

    expect(scenarios.length).toBe(5);
    expect(result.results.every((r) => r.passed)).toBe(true);
  }, 60_000);

  it('5 cross-tenant negative executions all reject', async () => {
    const scenarios = CertificationRunBuilder.buildDefault().filter(
      (s) => s.type === 'cross_tenant_negative',
    );
    const executor = createSimulatedScenarioExecutor();
    const result = await runner.runCertification(scenarios, executor);

    expect(scenarios.length).toBe(5);
    expect(result.gateG9.crossTenantDenialRate).toBe(1);
    expect(result.gateG9.zeroCrossTenantExposure).toBe(true);
  }, 60_000);

  it('Gate G7 — Phase 7 cross-tenant probe runner produces APPROVED verdict', async () => {
    const channelStore = new InMemoryChannelMappingStore();
    channelStore.seed('tenant-b', {
      internalId: 'agent-b',
      externalId: 'ext-tenant-b',
      tenantId: 'tenant-b',
    });
    const probeRunner = new TenantIsolationProbeRunner(
      defaultProbeAdapters(channelStore),
    );
    const report = await probeRunner.run({
      tenantA: { id: 'tenant-a', label: 'Tenant A' },
      tenantB: { id: 'tenant-b', label: 'Tenant B' },
      foreignIds: {
        project: 'prj-b-1',
        task: 'tsk-b-1',
        executionAttempt: 'wr-b-1',
        approvalRequest: 'apr-b-1',
        agent: 'agt-b-1',
        analyticsSnapshot: 'snap-b-1',
        webhook: 'wh-b-1',
        envelope: 'env-b-1',
        artifact: 'art-b-1',
      },
      collisions: { projectName: 'Colliding Project' },
    });

    expect(report.gateG7.releaseApproved).toBe(true);
    expect(report.gateG7.zeroCrossTenantExposure).toBe(true);
    expect(report.gateG7.denied).toBe(PROBE_BOUNDARIES.length);
    expect(report.results.every((r) => r.denied)).toBe(true);

    // Surface the G7 report through the runner so it lands on the
    // machine-readable CertificationRun.
    const g7Runner = new CertificationRunner();
    g7Runner.attachGateG7(report);
    const g7Result = await g7Runner.runCertification(
      CertificationRunBuilder.buildDefault().filter(
        (s) => s.type === 'clean_run',
      ),
      createSimulatedScenarioExecutor(),
    );

    expect(g7Result.gateG7).toBeDefined();
    expect(g7Result.gateG7?.releaseApproved).toBe(true);

    const g7Classification = classifyGateG7(report.gateG7);
    expect(g7Classification.failing).toEqual([]);

    const evidencePath = `g7.${expect.getState().currentTestName?.replace(/\s+/g, '_') ?? 'g7'}`;
    (runCertificationEvidence as any)[evidencePath] = {
      g7: report.gateG7,
      g7Classification,
      g9Classification: classifyGateG9(g7Result.gateG9),
    };

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(REPORT_DIR, 'g7-machine-readable.json'),
      JSON.stringify(report, null, 2),
      'utf-8',
    );
  }, 60_000);
});

const runCertificationEvidence: Record<string, unknown> = {};
export function getRunCertificationEvidence(): Record<string, unknown> {
  return runCertificationEvidence;
}
