/**
 * NeureCore Harness - Phase 6 Runner Conformance
 *
 * Document ID: NC-HARNESS-PHASE6-RUNNER-CONFORMANCE-001
 * Version: 1.0
 */

import {
  SimulationRunner,
  RunnerConfigSchema,
  SimulationReportSchema,
  SimulationVerdictSchema,
  buildCoverageMap,
  PHASE6_RUNNER_VERSION,
  type RunnerConfig,
  type SimulationVerdict,
} from './index';
import {
  buildSim04Manifest,
  buildSim05Manifest,
  buildSim06Manifest,
  buildSim07Manifest,
  buildSim08Manifest,
  buildSim09Manifest,
  buildSim10Manifest,
  buildSim11Manifest,
} from '../migration';
import {
  InMemoryEvidenceSink,
  InMemoryToolEventSink,
  InMemoryDomainEventSink,
  InMemoryApiCallWatchdog,
  type StepResult,
  type IFeFirstBrowserLauncher,
  type IFeFirstBrowserContext,
  type IFeFirstBrowserPage,
  type BrowserContextOptions,
} from '../adapter';

const TENANT_A = '11111111-1111-1111-1111-111111111111';

class NoopPage implements IFeFirstBrowserPage {
  constructor(private readonly ctx: NoopContext) {}
  async goto(url: string) {
    this.ctx.calls.push({
      url,
      method: 'GET',
      initiatedBy: 'BROWSER' as const,
      ts: new Date().toISOString(),
    });
  }
  async fill(sel: string) {
    this.ctx.calls.push({
      url: sel,
      method: 'POST',
      initiatedBy: 'BROWSER' as const,
      ts: new Date().toISOString(),
    });
  }
  async click(sel: string) {
    this.ctx.calls.push({
      url: sel,
      method: 'POST',
      initiatedBy: 'BROWSER' as const,
      ts: new Date().toISOString(),
    });
    if (sel === '#create-project') this.ctx.currentUrl = '/projects/123';
    if (sel === '#state') this.ctx.currentUrl = '/projects/123';
  }
  async select() {
    void 0;
  }
  async waitForSelector() {
    void 0;
  }
  async waitForText() {
    void 0;
  }
  async textContent(sel: string): Promise<string | null> {
    if (sel === '#state') return 'COMPLETED';
    return null;
  }
  url(): string {
    return this.ctx.currentUrl;
  }
  async screenshot(): Promise<Buffer | null> {
    return null;
  }
  on() {
    void 0;
  }
  async chatSend(text: string) {
    this.ctx.calls.push({
      url: '/chat',
      method: 'POST',
      initiatedBy: 'BROWSER' as const,
      ts: new Date().toISOString(),
    });
    void text;
  }
  async approveCard() {
    void 0;
  }
  async close() {
    void 0;
  }
}

class NoopContext implements IFeFirstBrowserContext {
  calls: Array<{
    url: string;
    method: string;
    initiatedBy: 'BROWSER' | 'TEST_API';
    ts: string;
  }> = [];
  currentUrl = 'https://hq.neurecore.test/dashboard';
  options: BrowserContextOptions;
  constructor(opts: BrowserContextOptions) {
    this.options = opts;
  }
  async newPage(): Promise<IFeFirstBrowserPage> {
    return new NoopPage(this);
  }
  async close() {
    void 0;
  }
}

class NoopLauncher implements IFeFirstBrowserLauncher {
  async launch(o: BrowserContextOptions): Promise<IFeFirstBrowserContext> {
    return new NoopContext(o);
  }
}

function makeRunnerConfig(): RunnerConfig {
  return {
    baseUrl: 'https://hq.neurecore.test',
    tenantId: TENANT_A,
    actorId: 'actor-1',
    feFirstMode: 'STRICT',
    evidenceClassification: 'INTERNAL',
  };
}

function makeRunner() {
  return new SimulationRunner(makeRunnerConfig(), {
    launcher: new NoopLauncher(),
    evidence: new InMemoryEvidenceSink(),
    tools: new InMemoryToolEventSink(),
    events: new InMemoryDomainEventSink(),
    watchdog: new InMemoryApiCallWatchdog(),
  });
}

describe('Phase 6 / Runner', () => {
  it('PHASE6_RUNNER_VERSION is exposed', () => {
    expect(PHASE6_RUNNER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('RunnerConfigSchema rejects bad baseUrl', () => {
    const r = RunnerConfigSchema.safeParse({
      baseUrl: 'not-a-url',
      tenantId: TENANT_A,
      actorId: 'a',
      feFirstMode: 'STRICT',
      evidenceClassification: 'INTERNAL',
    });
    expect(r.success).toBe(false);
  });

  it('RunnerConfigSchema accepts a valid config', () => {
    const r = RunnerConfigSchema.safeParse(makeRunnerConfig());
    expect(r.success).toBe(true);
  });

  it('SimulationVerdictSchema has 6 verdicts', () => {
    expect(SimulationVerdictSchema.options).toHaveLength(6);
  });

  it('SimulationReportSchema requires evidence + checksum', () => {
    const bad = SimulationReportSchema.safeParse({});
    expect(bad.success).toBe(false);
  });

  it('evaluateDefectGate returns blocking defects', () => {
    const runner = makeRunner();
    const r = runner.evaluateDefectGate([
      { defectId: 'A', title: 'a', blockingCapability: 'x', isBlocking: true },
      { defectId: 'B', title: 'b', blockingCapability: 'y', isBlocking: false },
    ]);
    expect(r.blocking).toEqual(['A']);
    expect(r.acknowledged).toEqual(['B']);
    expect(r.gateOpen).toBe(false);
  });

  it('evaluateDefectGate opens when no blocking defects', () => {
    const runner = makeRunner();
    const r = runner.evaluateDefectGate([
      { defectId: 'X', title: 'x', blockingCapability: 'y', isBlocking: false },
    ]);
    expect(r.gateOpen).toBe(true);
  });

  it('classifyCohortVerdict returns BLOCKED_KNOWN_DEFECT when gate is closed', () => {
    const runner = makeRunner();
    expect(runner.classifyCohortVerdict(false, [], false)).toBe(
      'BLOCKED_KNOWN_DEFECT',
    );
  });

  it('classifyCohortVerdict returns INCONCLUSIVE on API fallback', () => {
    const runner = makeRunner();
    expect(
      runner.classifyCohortVerdict(
        true,
        [{ outcome: 'PASSED' } as StepResult],
        true,
      ),
    ).toBe('INCONCLUSIVE');
  });

  it('classifyCohortVerdict returns FAILED when any step failed', () => {
    const runner = makeRunner();
    expect(
      runner.classifyCohortVerdict(
        false,
        [
          { outcome: 'PASSED' } as StepResult,
          { outcome: 'FAILED' } as StepResult,
        ],
        true,
      ),
    ).toBe('FAILED');
  });

  it('classifyCohortVerdict returns INSUFFICIENT_EVIDENCE for empty steps', () => {
    const runner = makeRunner();
    expect(runner.classifyCohortVerdict(false, [], true)).toBe(
      'INSUFFICIENT_EVIDENCE',
    );
  });

  it('classifyCohortVerdict returns PASSED when all steps passed', () => {
    const runner = makeRunner();
    expect(
      runner.classifyCohortVerdict(
        false,
        [{ outcome: 'PASSED' } as StepResult],
        true,
      ),
    ).toBe('PASSED');
  });

  it('run on SIM-04 manifest returns BLOCKED_KNOWN_DEFECT (NC-SIM04-002 + NC-SIM04-005)', async () => {
    const runner = makeRunner();
    const m = buildSim04Manifest();
    const report = await runner.run(m);
    expect(report.verdict).toBe('BLOCKED_KNOWN_DEFECT');
    expect(report.defectGate.blocking).toContain('NC-SIM04-002');
    expect(report.defectGate.blocking).toContain('NC-SIM04-005');
    expect(report.aggregate.totalRuns).toBe(0);
    expect(report.aggregate.blockedRuns).toBe(m.cohort.entries.length);
  });

  it('run on SIM-05 manifest executes and produces a SimulationReport', async () => {
    const runner = makeRunner();
    const m = buildSim05Manifest();
    const report = await runner.run(m);
    expect(report.simulationId).toBe('SIM-05');
    expect(report.cohort).toHaveLength(m.cohort.entries.length);
    expect(report.reportChecksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(report.manifestChecksum).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('SimulationReport is parseable by SimulationReportSchema', async () => {
    const runner = makeRunner();
    const report = await runner.run(buildSim05Manifest());
    expect(SimulationReportSchema.safeParse(report).success).toBe(true);
  });

  it('every simulation builder produces a runnable manifest', async () => {
    const runner = makeRunner();
    const all = [
      buildSim04Manifest(),
      buildSim05Manifest(),
      buildSim06Manifest(),
      buildSim07Manifest(),
      buildSim08Manifest(),
      buildSim09Manifest(),
      buildSim10Manifest(),
      buildSim11Manifest(),
    ];
    for (const m of all) {
      const report = await runner.run(m);
      expect(report.simulationId).toBe(m.simulationId);
      expect(report.verdict).toBeDefined();
      expect(typeof report.reportChecksum).toBe('string');
    }
  });

  it('aggregate counts totalRuns = cohort * journeys', async () => {
    const runner = makeRunner();
    const m = buildSim05Manifest();
    const report = await runner.run(m);
    const expected = m.cohort.entries.length * m.journeys.length;
    expect(report.aggregate.totalRuns).toBe(expected);
  });

  it('feFirstViolations stays empty when no TEST_API calls occurred', async () => {
    const runner = makeRunner();
    const report = await runner.run(buildSim05Manifest());
    expect(report.feFirstViolations).toEqual([]);
  });

  it('buildCoverageMap summarizes the SIM-04 manifest', () => {
    const m = buildSim04Manifest();
    const cov = buildCoverageMap(m);
    expect(cov.manifestId).toBe(m.manifestId);
    expect(cov.industry).toBe('ACCOUNTING');
    expect(cov.lane).toBe('TENANT_HQ');
    expect(cov.journeyCount).toBe(m.journeys.length);
    expect(cov.stepCount).toBe(m.journeys[0].steps.length);
    expect(cov.feFirstMode).toBe('STRICT');
    expect(cov.hasKnownDefects).toBe(true);
  });

  it('buildCoverageMap marks hasKnownDefects false when none present', () => {
    const m = buildSim05Manifest();
    const cov = buildCoverageMap(m);
    expect(cov.hasKnownDefects).toBe(false);
  });

  it('runner is deterministic for the same manifest (manifestChecksum)', async () => {
    const r1 = makeRunner();
    const r2 = makeRunner();
    const m1 = buildSim05Manifest();
    const m2 = buildSim05Manifest();
    const rep1 = await r1.run(m1);
    const rep2 = await r2.run(m2);
    expect(rep1.manifestChecksum).toBe(rep2.manifestChecksum);
  });

  it('SIM-04 manifest remains blocking regardless of feFirst mode', async () => {
    const cfg: RunnerConfig = { ...makeRunnerConfig(), feFirstMode: 'RELAXED' };
    const runner = new SimulationRunner(cfg, {
      launcher: new NoopLauncher(),
      evidence: new InMemoryEvidenceSink(),
      tools: new InMemoryToolEventSink(),
      events: new InMemoryDomainEventSink(),
      watchdog: new InMemoryApiCallWatchdog(),
    });
    const report = await runner.run(buildSim04Manifest());
    expect(report.verdict).toBe('BLOCKED_KNOWN_DEFECT');
  });

  it('SimulationVerdict enum is a closed set', () => {
    const verdicts: SimulationVerdict[] = [
      'PASSED',
      'FAILED',
      'BLOCKED_KNOWN_DEFECT',
      'INFRA_ERROR',
      'INCONCLUSIVE',
      'INSUFFICIENT_EVIDENCE',
    ];
    for (const v of verdicts) {
      expect(SimulationVerdictSchema.safeParse(v).success).toBe(true);
    }
    expect(SimulationVerdictSchema.safeParse('GREEN').success).toBe(false);
  });

  it('SimulationReport rejection when manifestChecksum format invalid', () => {
    const r = SimulationReportSchema.safeParse({
      schemaVersion: '1.0.0',
      reportId: '11111111-1111-1111-1111-111111111111',
      simulationId: 'SIM-05',
      simulationVersion: '1.0.0',
      manifestChecksum: 'not-a-checksum',
      runnerVersion: '1.0.0',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      verdict: 'PASSED',
      cohort: [],
      defectGate: { blocking: [], acknowledged: [], gateOpen: true },
      feFirstViolations: [],
      aggregate: {
        totalRuns: 0,
        passedRuns: 0,
        failedRuns: 0,
        blockedRuns: 0,
        apiFallbackRuns: 0,
      },
      reportChecksum: 'sha256:' + 'a'.repeat(64),
    });
    expect(r.success).toBe(false);
  });
});
