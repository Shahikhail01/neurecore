// scripts/run-phase9-certification.ts
/**
 * Phase 9 G9 — Run the certification matrix and emit machine-readable results.
 *
 * Outputs:
 *   - src/test/certification/reports/g9-machine-readable.json
 *
 * Then the operator may run:
 *   pnpm ts-node scripts/certification-dashboard.ts
 * to render the HTML dashboard.
 *
 * Usage:
 *   pnpm ts-node scripts/run-phase9-certification.ts
 */

import {
  CertificationRunner,
  CertificationRunBuilder,
} from '../src/test/certification/certification-runner';
import { createSimulatedScenarioExecutor } from '../src/test/certification/scenarios/scenario-executor';

async function main(): Promise<void> {
  const runner = new CertificationRunner();
  const scenarios = CertificationRunBuilder.buildDefault();
  const executor = createSimulatedScenarioExecutor();

  const start = Date.now();
  const run = await runner.runCertification(scenarios, executor);
  const elapsed = Date.now() - start;

  const outPath = 'src/test/certification/reports/g9-machine-readable.json';
  const written = await runner.writeMachineReadableReport(outPath);

  // eslint-disable-next-line no-console
  console.log(
    `Phase 9 G9 certification completed in ${elapsed}ms. ${run.gateG9.passed}/${run.gateG9.totalScenarios} passed.`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `Gate G9 verdict: ${run.gateG9.releaseApproved ? 'APPROVED' : 'BLOCKED'}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `Parity inventory: ${run.parity?.capabilityCount ?? 0} capabilities, ${run.parity?.certifiedCapabilityCount ?? 0} baseline-certified, ${run.parity?.mappedScenarioCount ?? 0} mapped scenarios.`,
  );
}

if (require.main === module) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });
}
