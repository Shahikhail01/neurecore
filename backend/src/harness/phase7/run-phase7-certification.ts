/* eslint-disable no-console */
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import {
  IsolationRunner,
  AdversarialRunner,
  AbuseRunner,
  UnsafeActionRunner,
  ComplianceRunner,
  HitlRunner,
  Phase7Coordinator,
  TenantKeyIsolationPort,
  StrictAdversarialPort,
  StrictUnsafeActionPort,
  CycleDetectionAbusePort,
  InMemoryComplianceEvidencePort,
  InMemoryReviewQueue,
  InMemoryPhase7EvidenceSink,
  InMemoryCleanupPort,
  PHASE7_VERSION,
} from './index';
import { writeMachineReadableReport } from './report-writer';

async function main(): Promise<void> {
  const outDir = resolve(
    process.argv[2] ?? 'src/test/certification/reports/phase7',
  );
  const tenantId =
    process.env.PHASE7_TENANT_ID ?? '11111111-1111-1111-1111-111111111111';
  const ctx = {
    actorId: 'phase7-runner',
    actorType: 'AI_AGENT' as const,
    actorRoles: ['TENANT_USER' as const],
    tenantId,
    correlationId: randomUUID(),
    permissions: [],
  };
  const runId = randomUUID();
  const sink = new InMemoryPhase7EvidenceSink();
  const cleanupPort = new InMemoryCleanupPort();
  const queue = new InMemoryReviewQueue();
  const coordinator = new Phase7Coordinator(undefined, cleanupPort);
  const report = await coordinator.run({
    ctx,
    isolationRunner: new IsolationRunner(
      new TenantKeyIsolationPort(),
      sink,
      cleanupPort,
    ),
    adversarialRunner: new AdversarialRunner(
      new StrictAdversarialPort(),
      sink,
      cleanupPort,
    ),
    abuseRunner: new AbuseRunner(
      new CycleDetectionAbusePort(),
      sink,
      cleanupPort,
    ),
    unsafeRunner: new UnsafeActionRunner(
      new StrictUnsafeActionPort(),
      sink,
      cleanupPort,
    ),
    complianceRunner: new ComplianceRunner(
      new InMemoryComplianceEvidencePort(sink),
      sink,
      cleanupPort,
    ),
    hitlRunner: new HitlRunner(queue, sink, cleanupPort),
    runId,
  });
  const result = writeMachineReadableReport({ report, outDir });
  console.log(
    JSON.stringify(
      {
        runnerVersion: PHASE7_VERSION,
        status: report.status,
        outcome: report.outcome,
        counters: report.counters,
        cleanup: {
          success: report.cleanupResult.success,
          failedCleanup: report.cleanupResult.failedCleanup?.length ?? 0,
          orphans: report.cleanupResult.orphanedResources?.length ?? 0,
        },
        artifacts: result,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
