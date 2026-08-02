// scripts/run-parity-v3-certification.ts
/**
 * P9 — Run the parity-v3 certification matrix and emit machine-readable results.
 *
 * Outputs:
 *   - backend/src/test/certification/parity-v3/reports/parity-v3-machine-readable.json
 *   - backend/src/test/certification/parity-v3/reports/parity-v3-summary.json
 *   - backend/src/test/certification/parity-v3/reports/parity-v3-dashboard.html
 *
 * Usage:
 *   pnpm ts-node scripts/run-parity-v3-certification.ts
 */

import * as path from 'path';
import {
  ParityV3Runner,
  DEFAULT_SCENARIOS,
} from '../src/test/certification/parity-v3/parity-v3-runner';
import { createBenchmarkTenants } from '../src/test/certification/parity-v3/harness/benchmark-tenants';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
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
const REPORTS_DIR = path.join(
  __dirname,
  '..',
  'src',
  'test',
  'certification',
  'parity-v3',
  'reports',
);

async function main(): Promise<void> {
  const tenants = await createBenchmarkTenants();
  const runner = new ParityV3Runner({
    baselinePath: BASELINE_PATH,
    rtmPath: RTM_PATH,
    reportsDir: REPORTS_DIR,
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
  const start = Date.now();
  const report = await runner.run(DEFAULT_SCENARIOS, tenants);
  const elapsed = Date.now() - start;
  const artifacts = await runner.writeArtifacts(report);

  // eslint-disable-next-line no-console
  console.log(
    `P9 parity-v3 certification completed in ${elapsed}ms. ` +
      `${report.scenarioResults.filter((r) => r.passed).length}/${report.scenarioResults.length} scenarios passed.`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `Gate P9 verdict: ${report.gateP9.approved ? 'APPROVED' : 'BLOCKED'}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `Artifacts written:\n  ${artifacts.json}\n  ${artifacts.summary}\n  ${artifacts.dashboard}`,
  );
}

if (require.main === module) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
