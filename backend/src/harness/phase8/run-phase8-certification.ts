/* eslint-disable no-console */
import { resolve } from 'path';
import {
  Phase8Coordinator,
  createAuthorizationContext,
  PHASE8_VERSION,
  InMemoryOperationalAlertPort,
} from './index';
import { writePhase8Report } from './report-writer';
import { dispatchOperationalAlerts, alertGateForReport } from './alerts';

async function main(): Promise<void> {
  const outDir = resolve(
    process.argv[2] ?? 'src/test/certification/reports/phase8',
  );
  const tenantId =
    process.env.PHASE8_TENANT_ID ?? '11111111-1111-1111-1111-111111111111';
  const ctx = createAuthorizationContext(tenantId);
  const sink = new InMemoryOperationalAlertPort();
  const coordinator = new Phase8Coordinator(undefined, undefined, sink);
  const report = await coordinator.run({
    ctx,
    tenantIds: [tenantId, '22222222-2222-2222-2222-222222222222'],
    environmentClass: 'SIMULATED',
  });
  const result = writePhase8Report({ report, outDir });
  const dispatch = dispatchOperationalAlerts({ report, sink });
  const gate = alertGateForReport(report, report.environmentClass, {
    failOnCleanupFailure: true,
    failOnCorrectnessFailure: true,
    failOnIsolationFailure: true,
  });
  console.log(
    JSON.stringify(
      {
        runnerVersion: PHASE8_VERSION,
        status: report.status,
        outcome: report.outcome,
        counters: report.counters,
        bundles: report.metricBundles.map((b) => ({
          profileId: b.profileId,
          p95Ms: b.latency.p95Ms,
          errorRate: b.errorRate,
          correctnessVerdict: b.correctnessVerdict,
          isolationVerdict: b.isolationVerdict,
          regressionVerdict: b.regressionVerdict,
        })),
        statisticalConfidence: report.statisticalConfidence,
        regressionEvidence: report.regressionEvidence,
        cleanup: {
          success: report.cleanupResult.success,
          failedCleanup: report.cleanupResult.failedCleanup?.length ?? 0,
          orphans: report.cleanupResult.orphanedResources?.length ?? 0,
        },
        alerts: {
          emitted: dispatch.emitted,
          critical: dispatch.criticalCount,
          warning: dispatch.warningCount,
          info: dispatch.infoCount,
          byKind: dispatch.byKind,
        },
        alertGate: gate,
        artifacts: result,
      },
      null,
      2,
    ),
  );
  if (gate.blocked) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
