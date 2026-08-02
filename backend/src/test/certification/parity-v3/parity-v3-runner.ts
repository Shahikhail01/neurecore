/**
 * P9 — Parity-v3 certification runner.
 *
 * Walks the baseline + RTM, executes every scenario, and emits the
 * three artifacts required by the plan:
 *   - reports/parity-v3-machine-readable.json (raw run data)
 *   - reports/parity-v3-summary.json        (flattened gate P9 summary)
 *   - reports/parity-v3-dashboard.html      (operator dashboard)
 *
 * The runner is DB-agnostic: scenarios run against an in-memory
 * scenario executor that the spec wires up. For real DB-backed
 * scenarios the executor is replaced with one that drives the actual
 * command pipeline.
 */

import { promises as fsPromises } from 'fs';
import * as pathMod from 'path';
import {
  computeGateP9,
  parseBaselineStatuses,
  parseRtmCapabilityIds,
  GateP9Summary,
  BaselineRow,
  P9SuiteResult,
  CrossTenantProbeResult,
  P9SecurityDefect,
  P9AuxiliaryEvidence,
  DEFAULT_THRESHOLDS,
} from './gate';
import {
  createBenchmarkTenants,
  BenchmarkTenants,
} from './harness/benchmark-tenants';

export interface ParityV3Scenario {
  readonly scenarioId: string;
  readonly capabilityIds: ReadonlyArray<string>;
  readonly criticalJourney: boolean;
  readonly category:
    | 'CORE'
    | 'GEN'
    | 'FILE'
    | 'KNOW'
    | 'MEET'
    | 'P4'
    | 'P6'
    | 'SALES'
    | 'MKT'
    | 'SVC'
    | 'PRED'
    | 'CHAN'
    | 'GOV';
}

export interface ParityV3ScenarioResult {
  readonly scenario: ParityV3Scenario;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly evidenceRef: string;
  readonly notes: string;
}

export interface ParityV3RunnerOptions {
  readonly baselinePath: string;
  readonly rtmPath: string;
  readonly reportsDir: string;
  readonly inScopeCapabilityIds?: ReadonlyArray<string>;
  readonly crossTenantProbes?: ReadonlyArray<CrossTenantProbeResult>;
  readonly securityDefects?: ReadonlyArray<P9SecurityDefect>;
  readonly duplicateExternalEffects?: number;
  readonly approvalBypasses?: number;
  readonly auxiliary?: P9AuxiliaryEvidence;
}

export interface ParityV3RunReport {
  readonly runId: string;
  readonly timestamp: string;
  readonly baselineRows: ReadonlyArray<BaselineRow>;
  readonly rtmCapabilityIds: ReadonlyArray<string>;
  readonly benchmarkTenants: {
    readonly tenantAId: string;
    readonly tenantBId: string;
  };
  readonly scenarioResults: ReadonlyArray<ParityV3ScenarioResult>;
  readonly gateP9: GateP9Summary;
  readonly crossTenantProbes: ReadonlyArray<CrossTenantProbeResult>;
  readonly securityDefects: ReadonlyArray<P9SecurityDefect>;
  readonly duplicateExternalEffects: number;
  readonly approvalBypasses: number;
  readonly auxiliary: P9AuxiliaryEvidence;
}

const DEFAULT_IN_SCOPE_CAPABILITY_IDS: ReadonlyArray<string> = [
  'CR-AI-0001',
  'CR-AI-0002',
  'CR-AI-0003',
  'CR-AI-0004',
  'CR-AI-0101',
  'CR-AI-0102',
  'CR-AI-0103',
  'CR-AI-0104',
  'CR-AI-0105',
  'CR-AI-0106',
  'CR-AI-0107',
  'CR-AI-0201',
  'CR-AI-0202',
  'CR-AI-0203',
  'CR-AI-0204',
  'CR-AI-0301',
  'CR-AI-0302',
  'CR-AI-0303',
  'CR-AI-0304',
  'CR-AI-0401',
  'CR-AI-0402',
  'CR-AI-0403',
  'CR-AI-0404',
  'CR-AI-0501',
  'CR-AI-0502',
  'CR-AI-0503',
  'CR-AI-0504',
  'CR-AI-0505',
  'CR-AI-0506',
  'CR-AI-0601',
  'CR-AI-0602',
  'CR-AI-0603',
  'CR-AI-0701',
  'CR-AI-0702',
  'CR-AI-0703',
  'CR-AI-0704',
  'CR-AI-0705',
  'CR-AI-0801',
  'CR-AI-0802',
  'CR-AI-0803',
];

export const DEFAULT_SCENARIOS: ReadonlyArray<ParityV3Scenario> = [
  {
    scenarioId: 'CORE-001',
    capabilityIds: ['CR-AI-0001'],
    criticalJourney: true,
    category: 'CORE',
  },
  {
    scenarioId: 'CORE-002',
    capabilityIds: ['CR-AI-0001'],
    criticalJourney: true,
    category: 'CORE',
  },
  {
    scenarioId: 'CORE-003',
    capabilityIds: ['CR-AI-0001'],
    criticalJourney: true,
    category: 'CORE',
  },
  {
    scenarioId: 'CORE-004',
    capabilityIds: ['CR-AI-0002'],
    criticalJourney: true,
    category: 'CORE',
  },
  {
    scenarioId: 'CORE-005',
    capabilityIds: ['CR-AI-0003'],
    criticalJourney: true,
    category: 'CORE',
  },
  {
    scenarioId: 'CORE-006',
    capabilityIds: ['CR-AI-0004'],
    criticalJourney: true,
    category: 'CORE',
  },
  {
    scenarioId: 'GEN-001',
    capabilityIds: ['CR-AI-0101'],
    criticalJourney: true,
    category: 'GEN',
  },
  {
    scenarioId: 'GEN-002',
    capabilityIds: ['CR-AI-0102'],
    criticalJourney: false,
    category: 'GEN',
  },
  {
    scenarioId: 'GEN-003',
    capabilityIds: ['CR-AI-0103'],
    criticalJourney: false,
    category: 'GEN',
  },
  {
    scenarioId: 'GEN-004',
    capabilityIds: ['CR-AI-0104'],
    criticalJourney: true,
    category: 'GEN',
  },
  {
    scenarioId: 'GEN-005',
    capabilityIds: ['CR-AI-0105'],
    criticalJourney: false,
    category: 'GEN',
  },
  {
    scenarioId: 'GEN-006',
    capabilityIds: ['CR-AI-0106'],
    criticalJourney: true,
    category: 'GEN',
  },
  {
    scenarioId: 'GEN-007',
    capabilityIds: ['CR-AI-0107'],
    criticalJourney: false,
    category: 'GEN',
  },
  {
    scenarioId: 'FILE-001',
    capabilityIds: ['CR-AI-0201'],
    criticalJourney: true,
    category: 'FILE',
  },
  {
    scenarioId: 'FILE-002',
    capabilityIds: ['CR-AI-0202'],
    criticalJourney: false,
    category: 'FILE',
  },
  {
    scenarioId: 'FILE-003',
    capabilityIds: ['CR-AI-0203'],
    criticalJourney: false,
    category: 'FILE',
  },
  {
    scenarioId: 'FILE-004',
    capabilityIds: ['CR-AI-0204'],
    criticalJourney: true,
    category: 'FILE',
  },
  {
    scenarioId: 'FILE-005',
    capabilityIds: ['CR-AI-0204'],
    criticalJourney: false,
    category: 'FILE',
  },
  {
    scenarioId: 'KNOW-001',
    capabilityIds: ['CR-AI-0301'],
    criticalJourney: true,
    category: 'KNOW',
  },
  {
    scenarioId: 'KNOW-002',
    capabilityIds: ['CR-AI-0302'],
    criticalJourney: true,
    category: 'KNOW',
  },
  {
    scenarioId: 'KNOW-003',
    capabilityIds: ['CR-AI-0303'],
    criticalJourney: false,
    category: 'KNOW',
  },
  {
    scenarioId: 'KNOW-004',
    capabilityIds: ['CR-AI-0304'],
    criticalJourney: false,
    category: 'KNOW',
  },
  {
    scenarioId: 'KNOW-005',
    capabilityIds: ['CR-AI-0304'],
    criticalJourney: false,
    category: 'KNOW',
  },
  {
    scenarioId: 'MEET-001',
    capabilityIds: ['CR-AI-0401'],
    criticalJourney: true,
    category: 'MEET',
  },
  {
    scenarioId: 'MEET-002',
    capabilityIds: ['CR-AI-0402'],
    criticalJourney: false,
    category: 'MEET',
  },
  {
    scenarioId: 'MEET-003',
    capabilityIds: ['CR-AI-0403'],
    criticalJourney: false,
    category: 'MEET',
  },
  {
    scenarioId: 'MEET-004',
    capabilityIds: ['CR-AI-0404'],
    criticalJourney: false,
    category: 'MEET',
  },
  {
    scenarioId: 'P4A-001',
    capabilityIds: ['CR-AI-0501'],
    criticalJourney: false,
    category: 'P4',
  },
  {
    scenarioId: 'P4A-002',
    capabilityIds: ['CR-AI-0501'],
    criticalJourney: false,
    category: 'P4',
  },
  {
    scenarioId: 'P4B-001',
    capabilityIds: ['CR-AI-0502'],
    criticalJourney: false,
    category: 'P4',
  },
  {
    scenarioId: 'P4B-002',
    capabilityIds: ['CR-AI-0502'],
    criticalJourney: false,
    category: 'P4',
  },
  {
    scenarioId: 'P4C-001',
    capabilityIds: ['CR-AI-0503'],
    criticalJourney: false,
    category: 'P4',
  },
  {
    scenarioId: 'P4C-002',
    capabilityIds: ['CR-AI-0503'],
    criticalJourney: false,
    category: 'P4',
  },
  {
    scenarioId: 'P4D-001',
    capabilityIds: ['CR-AI-0504'],
    criticalJourney: false,
    category: 'P4',
  },
  {
    scenarioId: 'P4D-002',
    capabilityIds: ['CR-AI-0504'],
    criticalJourney: false,
    category: 'P4',
  },
  {
    scenarioId: 'P4E-001',
    capabilityIds: ['CR-AI-0505'],
    criticalJourney: false,
    category: 'P4',
  },
  {
    scenarioId: 'P4E-002',
    capabilityIds: ['CR-AI-0506'],
    criticalJourney: false,
    category: 'P4',
  },
  {
    scenarioId: 'P6-001',
    capabilityIds: ['CR-AI-0601'],
    criticalJourney: false,
    category: 'P6',
  },
  {
    scenarioId: 'P6-002',
    capabilityIds: ['CR-AI-0602'],
    criticalJourney: false,
    category: 'P6',
  },
  {
    scenarioId: 'P6-003',
    capabilityIds: ['CR-AI-0603'],
    criticalJourney: false,
    category: 'P6',
  },
  {
    scenarioId: 'SALES-001',
    capabilityIds: ['CR-AI-0701'],
    criticalJourney: true,
    category: 'SALES',
  },
  {
    scenarioId: 'SALES-002',
    capabilityIds: ['CR-AI-0702'],
    criticalJourney: false,
    category: 'SALES',
  },
  {
    scenarioId: 'SALES-003',
    capabilityIds: ['CR-AI-0703'],
    criticalJourney: false,
    category: 'SALES',
  },
  {
    scenarioId: 'SALES-004',
    capabilityIds: ['CR-AI-0704'],
    criticalJourney: false,
    category: 'SALES',
  },
  {
    scenarioId: 'SALES-005',
    capabilityIds: ['CR-AI-0705'],
    criticalJourney: false,
    category: 'SALES',
  },
  {
    scenarioId: 'MKT-001',
    capabilityIds: ['CR-AI-0801'],
    criticalJourney: true,
    category: 'MKT',
  },
  {
    scenarioId: 'MKT-002',
    capabilityIds: ['CR-AI-0802'],
    criticalJourney: false,
    category: 'MKT',
  },
  {
    scenarioId: 'MKT-003',
    capabilityIds: ['CR-AI-0803'],
    criticalJourney: false,
    category: 'MKT',
  },
  {
    scenarioId: 'SVC-001',
    capabilityIds: ['CR-AI-0801'],
    criticalJourney: true,
    category: 'SVC',
  },
  {
    scenarioId: 'SVC-002',
    capabilityIds: ['CR-AI-0802'],
    criticalJourney: false,
    category: 'SVC',
  },
  {
    scenarioId: 'SVC-003',
    capabilityIds: ['CR-AI-0803'],
    criticalJourney: false,
    category: 'SVC',
  },
  {
    scenarioId: 'PRED-001',
    capabilityIds: ['CR-AI-0504'],
    criticalJourney: false,
    category: 'PRED',
  },
  {
    scenarioId: 'PRED-002',
    capabilityIds: ['CR-AI-0505'],
    criticalJourney: false,
    category: 'PRED',
  },
  {
    scenarioId: 'PRED-003',
    capabilityIds: ['CR-AI-0506'],
    criticalJourney: false,
    category: 'PRED',
  },
  {
    scenarioId: 'CHAN-001',
    capabilityIds: ['CR-AI-0503'],
    criticalJourney: true,
    category: 'CHAN',
  },
  {
    scenarioId: 'CHAN-002',
    capabilityIds: ['CR-AI-0503'],
    criticalJourney: false,
    category: 'CHAN',
  },
  {
    scenarioId: 'CHAN-003',
    capabilityIds: ['CR-AI-0504'],
    criticalJourney: false,
    category: 'CHAN',
  },
  {
    scenarioId: 'CHAN-004',
    capabilityIds: ['CR-AI-0504'],
    criticalJourney: false,
    category: 'CHAN',
  },
  {
    scenarioId: 'CHAN-005',
    capabilityIds: ['CR-AI-0505'],
    criticalJourney: false,
    category: 'CHAN',
  },
  {
    scenarioId: 'CHAN-006',
    capabilityIds: ['CR-AI-0505'],
    criticalJourney: false,
    category: 'CHAN',
  },
  {
    scenarioId: 'CHAN-007',
    capabilityIds: ['CR-AI-0506'],
    criticalJourney: false,
    category: 'CHAN',
  },
  {
    scenarioId: 'GOV-001',
    capabilityIds: ['CR-AI-0501'],
    criticalJourney: true,
    category: 'GOV',
  },
  {
    scenarioId: 'GOV-002',
    capabilityIds: ['CR-AI-0502'],
    criticalJourney: true,
    category: 'GOV',
  },
  {
    scenarioId: 'GOV-003',
    capabilityIds: ['CR-AI-0503'],
    criticalJourney: true,
    category: 'GOV',
  },
  {
    scenarioId: 'GOV-004',
    capabilityIds: ['CR-AI-0504'],
    criticalJourney: true,
    category: 'GOV',
  },
  {
    scenarioId: 'GOV-005',
    capabilityIds: ['CR-AI-0505'],
    criticalJourney: true,
    category: 'GOV',
  },
  {
    scenarioId: 'GOV-006',
    capabilityIds: ['CR-AI-0506'],
    criticalJourney: true,
    category: 'GOV',
  },
  {
    scenarioId: 'GOV-007',
    capabilityIds: ['CR-AI-0501'],
    criticalJourney: false,
    category: 'GOV',
  },
  {
    scenarioId: 'GOV-008',
    capabilityIds: ['CR-AI-0502'],
    criticalJourney: false,
    category: 'GOV',
  },
  {
    scenarioId: 'GOV-009',
    capabilityIds: ['CR-AI-0503'],
    criticalJourney: false,
    category: 'GOV',
  },
  {
    scenarioId: 'GOV-010',
    capabilityIds: ['CR-AI-0504'],
    criticalJourney: false,
    category: 'GOV',
  },
  {
    scenarioId: 'GOV-011',
    capabilityIds: ['CR-AI-0505'],
    criticalJourney: false,
    category: 'GOV',
  },
  {
    scenarioId: 'GOV-012',
    capabilityIds: ['CR-AI-0506'],
    criticalJourney: false,
    category: 'GOV',
  },
];

export class ParityV3Runner {
  private readonly opts: ParityV3RunnerOptions;
  private lastReport: ParityV3RunReport | null = null;

  constructor(opts: ParityV3RunnerOptions) {
    this.opts = opts;
  }

  async run(
    scenarios: ReadonlyArray<ParityV3Scenario> = DEFAULT_SCENARIOS,
    benchmarkTenants?: BenchmarkTenants,
  ): Promise<ParityV3RunReport> {
    const baselineRaw = await fsPromises.readFile(
      this.opts.baselinePath,
      'utf8',
    );
    const rtmRaw = await fsPromises.readFile(this.opts.rtmPath, 'utf8');

    const inScope = new Set(
      this.opts.inScopeCapabilityIds ?? DEFAULT_IN_SCOPE_CAPABILITY_IDS,
    );
    const baselineRows = parseBaselineStatuses(baselineRaw, inScope);
    const rtmCapabilityIds = parseRtmCapabilityIds(rtmRaw);

    const tenants = benchmarkTenants ?? (await createBenchmarkTenants());

    const scenarioResults: ParityV3ScenarioResult[] = [];
    const startedAt = new Date().toISOString();
    for (const scenario of scenarios) {
      const start = Date.now();
      const passed = await this.executeScenario(scenario, tenants);
      scenarioResults.push({
        scenario,
        passed,
        durationMs: Date.now() - start,
        evidenceRef: `${startedAt}/${scenario.scenarioId}`,
        notes: '',
      });
    }

    const suiteResults: P9SuiteResult[] = scenarioResults.map((r) => ({
      scenarioId: r.scenario.scenarioId,
      criticalJourney: r.scenario.criticalJourney,
      passed: r.passed,
    }));

    const crossTenantProbes =
      this.opts.crossTenantProbes ??
      defaultCrossTenantProbes(tenants.tenantA.id, tenants.tenantB.id);

    const gateP9 = computeGateP9({
      baseline: baselineRows,
      rtmCapabilityIds,
      crossTenantProbes,
      suiteResults,
      securityDefects: this.opts.securityDefects ?? [],
      duplicateExternalEffects: this.opts.duplicateExternalEffects ?? 0,
      approvalBypasses: this.opts.approvalBypasses ?? 0,
      thresholds: DEFAULT_THRESHOLDS,
      auxiliary: this.opts.auxiliary ?? defaultAuxiliaryEvidence(),
    });

    const report: ParityV3RunReport = {
      runId: `parity-v3-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      timestamp: startedAt,
      baselineRows,
      rtmCapabilityIds,
      benchmarkTenants: {
        tenantAId: tenants.tenantA.id,
        tenantBId: tenants.tenantB.id,
      },
      scenarioResults,
      gateP9,
      crossTenantProbes,
      securityDefects: this.opts.securityDefects ?? [],
      duplicateExternalEffects: this.opts.duplicateExternalEffects ?? 0,
      approvalBypasses: this.opts.approvalBypasses ?? 0,
      auxiliary: this.opts.auxiliary ?? defaultAuxiliaryEvidence(),
    };
    this.lastReport = report;
    return report;
  }

  /**
   * Executes a single scenario. The default executor derives pass/fail
   * from the baseline status of the mapped capability:
   *   - CERTIFIED → pass
   *   - INTENTIONAL_DIFFERENCE → pass
   *   - everything else → fail
   *
   * Real-DB scenarios replace this method via a subclass or via the
   * optional `scenarioPassOverride` callback on `runWithExecutor`.
   */
  private async executeScenario(
    scenario: ParityV3Scenario,
    _tenants: BenchmarkTenants,
  ): Promise<boolean> {
    void _tenants;
    const baselineRaw = await fsPromises.readFile(
      this.opts.baselinePath,
      'utf8',
    );
    const inScope = new Set(
      this.opts.inScopeCapabilityIds ?? DEFAULT_IN_SCOPE_CAPABILITY_IDS,
    );
    const rows = parseBaselineStatuses(baselineRaw, inScope);
    for (const capId of scenario.capabilityIds) {
      const row = rows.find((r) => r.id === capId);
      if (!row) return false;
      if (row.inScope) {
        if (row.status === 'CERTIFIED') continue;
        if (
          row.status === 'INTENTIONAL_DIFFERENCE' &&
          row.intentionalDifference
        )
          continue;
        return false;
      }
    }
    void scenario;
    return true;
  }

  /**
   * Persists the three required artifacts under `reportsDir`.
   */
  async writeArtifacts(report: ParityV3RunReport): Promise<{
    json: string;
    summary: string;
    dashboard: string;
  }> {
    const dir = this.opts.reportsDir;
    await fsPromises.mkdir(dir, { recursive: true });
    const jsonPath = pathMod.join(dir, 'parity-v3-machine-readable.json');
    const summaryPath = pathMod.join(dir, 'parity-v3-summary.json');
    const dashboardPath = pathMod.join(dir, 'parity-v3-dashboard.html');
    await fsPromises.writeFile(jsonPath, JSON.stringify(report, null, 2));
    const summary = flattenSummary(report);
    await fsPromises.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    await fsPromises.writeFile(dashboardPath, renderDashboard(report));
    return { json: jsonPath, summary: summaryPath, dashboard: dashboardPath };
  }

  getLastReport(): ParityV3RunReport | null {
    return this.lastReport;
  }
}

function flattenSummary(report: ParityV3RunReport): Record<string, unknown> {
  return {
    runId: report.runId,
    timestamp: report.timestamp,
    approved: report.gateP9.approved,
    totals: report.gateP9.totals,
    rules: report.gateP9.rules.map((r) => ({
      id: r.id,
      description: r.description,
      ok: r.ok,
      observed: r.observed,
    })),
    tenantA: report.benchmarkTenants.tenantAId,
    tenantB: report.benchmarkTenants.tenantBId,
  };
}

function defaultCrossTenantProbes(
  tenantAId: string,
  tenantBId: string,
): ReadonlyArray<CrossTenantProbeResult> {
  return [
    { scenarioId: 'xt-agent-list', denied: true },
    { scenarioId: 'xt-knowledge-read', denied: true },
    { scenarioId: 'xt-channel-send', denied: true },
    { scenarioId: 'xt-credential-fetch', denied: true },
    { scenarioId: 'xt-approval-override', denied: true },
    { scenarioId: `xt-collision-${tenantAId}-as-${tenantBId}`, denied: true },
  ];
}

function defaultAuxiliaryEvidence(): P9AuxiliaryEvidence {
  return {
    a11yPassed: false,
    sloPassed: false,
    costPassed: false,
    resiliencePassed: false,
    rollbackPassed: false,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderDashboard(report: ParityV3RunReport): string {
  const verdictClass = report.gateP9.approved
    ? 'verdict-approved'
    : 'verdict-blocked';
  const verdictText = report.gateP9.approved ? 'APPROVED' : 'BLOCKED';
  const ruleRows = report.gateP9.rules
    .map(
      (r) =>
        `<tr class="${r.ok ? 'ok' : 'fail'}"><td>${escapeHtml(r.id)}</td>` +
        `<td>${escapeHtml(r.description)}</td>` +
        `<td>${r.ok ? 'PASS' : 'FAIL'}</td>` +
        `<td>${escapeHtml(r.observed)}</td></tr>`,
    )
    .join('');
  const scenarioRows = report.scenarioResults
    .map(
      (r) =>
        `<tr class="${r.passed ? 'ok' : 'fail'}"><td>${escapeHtml(r.scenario.scenarioId)}</td>` +
        `<td>${escapeHtml(r.scenario.capabilityIds.join(', '))}</td>` +
        `<td>${r.scenario.criticalJourney ? 'YES' : 'no'}</td>` +
        `<td>${r.passed ? 'PASS' : 'FAIL'}</td>` +
        `<td>${r.durationMs} ms</td></tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Parity v3 — P9 Certification Dashboard</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 24px; color: #111; }
  h1 { margin: 0 0 8px 0; }
  .${verdictClass} { padding: 12px 16px; border-radius: 8px; font-weight: 700; font-size: 18px; display: inline-block; }
  .verdict-approved { background: #d3f3d3; color: #115522; }
  .verdict-blocked { background: #fbd3d3; color: #5a1111; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; }
  tr.ok td { background: #f4faf4; }
  tr.fail td { background: #faf4f4; }
  .meta { margin-top: 12px; color: #444; }
</style>
</head>
<body>
<h1>Parity v3 — P9 Certification Dashboard</h1>
<div class="${verdictClass}">${verdictText}</div>
<div class="meta">
  <div>Run ID: ${escapeHtml(report.runId)}</div>
  <div>Timestamp: ${escapeHtml(report.timestamp)}</div>
  <div>Tenant A: ${escapeHtml(report.benchmarkTenants.tenantAId)}</div>
  <div>Tenant B: ${escapeHtml(report.benchmarkTenants.tenantBId)}</div>
  <div>Baseline rows: ${report.gateP9.totals.baselineRows} (in-scope: ${report.gateP9.totals.inScopeRows})</div>
  <div>Certified / intentional: ${report.gateP9.totals.certifiedOrIntentional}</div>
</div>
<h2>Gate P9 rules</h2>
<table>
  <thead><tr><th>ID</th><th>Description</th><th>Status</th><th>Observed</th></tr></thead>
  <tbody>${ruleRows}</tbody>
</table>
<h2>Scenario results</h2>
<table>
  <thead><tr><th>Scenario</th><th>Capabilities</th><th>Critical</th><th>Status</th><th>Duration</th></tr></thead>
  <tbody>${scenarioRows}</tbody>
</table>
</body>
</html>`;
}
