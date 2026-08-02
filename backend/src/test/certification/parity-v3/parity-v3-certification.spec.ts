/**
 * P9 — Top-level certification orchestrator.
 *
 * Wires together:
 *   - the ParityV3Runner (runs scenarios, emits gate P9)
 *   - the benchmark tenant harness
 *   - the existing Phase 9 G9 runner (which emits the G9 verdict)
 *
 * This spec is the single entry point that CI executes to certify
 * Parity v3 + Phase 9 + cross-tenant isolation in one run.
 */

import * as path from 'path';
import {
  ParityV3Runner,
  DEFAULT_SCENARIOS,
  ParityV3RunReport,
} from './parity-v3-runner';
import {
  createBenchmarkTenants,
  benchmarkTenantIds,
} from './harness/benchmark-tenants';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const BASELINE_PATH = path.join(
  REPO_ROOT,
  'memory-bank-new',
  'docs',
  'parity-v3',
  'creatio-parity-baseline.yaml',
);
const RTM_PATH = path.join(
  REPO_ROOT,
  'memory-bank-new',
  'docs',
  'parity-v3',
  'requirements-traceability-matrix.yaml',
);
const REPORTS_DIR = path.join(__dirname, 'reports');

describe('P9 — Parity v3 full parity certification', () => {
  it('runs the matrix, computes gate P9, and persists artifacts', async () => {
    const tenants = await createBenchmarkTenants();
    const runner = new ParityV3Runner({
      baselinePath: BASELINE_PATH,
      rtmPath: RTM_PATH,
      reportsDir: REPORTS_DIR,
      inScopeCapabilityIds: undefined,
      crossTenantProbes: [
        { scenarioId: 'xt-agent-list', denied: true },
        { scenarioId: 'xt-knowledge-read', denied: true },
        { scenarioId: 'xt-channel-send', denied: true },
        { scenarioId: 'xt-credential-fetch', denied: true },
        { scenarioId: 'xt-approval-override', denied: true },
        {
          scenarioId: `xt-collision-${tenants.tenantA.id}-as-${tenants.tenantB.id}`,
          denied: true,
        },
      ],
    });
    const report: ParityV3RunReport = await runner.run(
      DEFAULT_SCENARIOS,
      tenants,
    );
    const artifacts = await runner.writeArtifacts(report);
    expect(artifacts.json).toMatch(/parity-v3-machine-readable\.json$/);
    expect(artifacts.summary).toMatch(/parity-v3-summary\.json$/);
    expect(artifacts.dashboard).toMatch(/parity-v3-dashboard\.html$/);
    expect(report.scenarioResults.length).toBe(DEFAULT_SCENARIOS.length);
    expect(report.gateP9.totals.baselineRows).toBeGreaterThan(0);
  });

  it('exposes the canonical benchmark tenant pair', () => {
    const ids = benchmarkTenantIds();
    expect(ids.a).not.toEqual(ids.b);
    expect(ids.a).toMatch(/^bench-a-/);
    expect(ids.b).toMatch(/^bench-b-/);
  });
});
