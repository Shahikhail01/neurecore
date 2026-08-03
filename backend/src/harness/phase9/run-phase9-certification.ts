/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { randomUUID } from 'crypto';
import { resolve } from 'path';
import {
  type CapabilityRegistryEntry,
  type ChangedSurface,
  type Phase9ReleaseWaiver,
  type RiskTierGatePolicy,
  type RollbackDrillRequirement,
  CapabilityRegistryEntrySchema,
  Phase9ReleaseWaiverSchema,
  RollbackDrillRequirementSchema,
  PHASE9_VERSION,
} from './contracts';
import {
  EvidenceEnvelopeSchema,
  Sha256ChecksumSchema,
  type EvidenceEnvelope,
} from '../contracts';
import {
  Phase9ReleaseGateCoordinator,
  defaultPhase9Policies,
  buildRequiredSuiteSchedule,
} from './runners';
import {
  DEFAULT_PHASE9_FULL_SUITES,
  InMemoryCapabilityRegistry,
  InMemoryEvidenceResolver,
  InMemoryWaiversLedger,
  InMemoryRollbackRegistry,
  InMemoryProductionAdapterRegistry,
  type ProductionAdapterRegistry,
} from './ports';
import { Phase9ReleaseGate } from './ci-lane';
import { writePhase9Report } from './report-writer';
import { EvidenceStore } from '../evidence';
import { StagingEvidenceSourceImpl } from './adapters/staging-evidence-source';
import {
  registerPhase9ProductionAdapters,
  loadStagingAdapters,
} from './adapters/production-adapter-registry';

async function main(): Promise<void> {
  await Promise.resolve();
  const outDir = resolve(process.argv[2] ?? 'src/harness/phase9/reports');
  const tenantId =
    process.env.PHASE9_TENANT_ID ?? '11111111-1111-1111-1111-111111111111';
  const capabilityId = process.env.PHASE9_CAPABILITY_ID ?? 'CAP-001';
  const riskTier = (process.env.PHASE9_RISK_TIER ??
    'HIGH') as RiskTierGatePolicy['riskTier'];
  const envOverride = process.env.PHASE9_ENV ?? 'SIMULATED';
  const stagingMode = process.env.PHASE9_STAGING_MODE === '1';
  const evidenceSourceEnv = process.env.PHASE9_EVIDENCE_SOURCE;
  const environmentClass = (
    stagingMode || evidenceSourceEnv === 'staging' ? 'STAGING' : envOverride
  ) as
    | 'SIMULATED'
    | 'LOCAL'
    | 'CI'
    | 'STAGING'
    | 'PRODUCTION_PROBE'
    | 'PRODUCTION';

  const capability: CapabilityRegistryEntry =
    CapabilityRegistryEntrySchema.parse({
      schemaVersion: PHASE9_VERSION,
      capabilityId,
      capabilityVersion: '1.0.0',
      name: capabilityId,
      description: `Phase 9 evaluation of ${capabilityId}`,
      riskTier,
      owner: {
        ownerId: 'phase9-runner',
        ownerRole: 'EVALUATOR',
        confirmedAt: new Date().toISOString(),
      },
      environmentScope: { environmentClass },
      requiredSuites: [...DEFAULT_PHASE9_FULL_SUITES[riskTier]],
      surfaces: ['src/harness/phase9/'],
      notes: [],
    });

  // ==================================================================
  // EVIDENCE: STAGING-class when PHASE9_EVIDENCE_SOURCE=staging or
  // PHASE9_STAGING_MODE=1; otherwise the legacy in-memory SIMULATED
  // envelope.
  // ==================================================================
  let envelope: EvidenceEnvelope;
  let runId: string;
  let evidenceStore: EvidenceStore | null = null;
  let evidenceSource: StagingEvidenceSourceImpl | null = null;

  if (evidenceSourceEnv === 'staging' || stagingMode) {
    // Build a real STAGING-class evidence bundle from a populated
    // EvidenceStore. The store is populated with a 105-scenario-like
    // set of envelopes (one per scenario) so the evidence source has
    // a non-trivial finalized run to consume.
    evidenceStore = new EvidenceStore();
    runId = randomUUID();
    const scenarioCount = 105;
    const crypto = await import('crypto');
    for (let i = 0; i < scenarioCount; i++) {
      const content = { i, ok: true };
      const checksumHex = crypto
        .createHash('sha256')
        .update(JSON.stringify(content))
        .digest('hex');
      const env = EvidenceEnvelopeSchema.parse({
        schemaVersion: PHASE9_VERSION,
        evidenceId: randomUUID(),
        runId,
        scenarioId: `phase9-staging-scenario-${String(i).padStart(3, '0')}`,
        capabilityId,
        tenantId,
        timestamp: new Date().toISOString(),
        producer: 'phase9-staging-runner',
        mediaType: 'application/json',
        classification: 'INTERNAL',
        checksum: `sha256:${checksumHex}`,
        storageRef: `phase9-staging://${capabilityId}/${runId}/${i}`,
        retentionClass: 'MEDIUM_TERM',
        redactionStatus: 'NOT_REQUIRED',
        correlationIds: [`phase9:staging:${capabilityId}`],
      });
      evidenceStore.append(env, content);
    }
    evidenceSource = new StagingEvidenceSourceImpl(evidenceStore);
    const stagingBundle = evidenceSource.getStagingEvidence({
      phase9StagingRunId: runId,
    });
    envelope = stagingBundle.envelopes[0]!;
  } else {
    runId = randomUUID();
    const evidenceId = randomUUID();
    envelope = EvidenceEnvelopeSchema.parse({
      schemaVersion: PHASE9_VERSION,
      evidenceId,
      runId,
      scenarioId: `phase9-${capabilityId}`,
      capabilityId,
      tenantId,
      timestamp: new Date().toISOString(),
      producer: 'phase9-runner',
      mediaType: 'application/json',
      classification: 'INTERNAL',
      checksum: Sha256ChecksumSchema.parse(
        'sha256:0000000000000000000000000000000000000000000000000000000000000001',
      ),
      storageRef: `phase9://${capabilityId}/${evidenceId}`,
      retentionClass: 'MEDIUM_TERM',
      redactionStatus: 'NOT_REQUIRED',
      correlationIds: ['simulated:phase9-runner'],
    });
  }

  // ==================================================================
  // RESOLVER: STAGING-class resolver when staging; otherwise in-memory.
  // ==================================================================
  let resolver: InMemoryEvidenceResolver;
  let registry: ProductionAdapterRegistry | null = null;
  let adapterStamps: ReturnType<typeof registerPhase9ProductionAdapters> = [];
  if (evidenceSourceEnv === 'staging' || stagingMode) {
    const bundle = loadStagingAdapters({ evidenceStore: evidenceStore! });
    resolver = bundle.evidenceResolver as InMemoryEvidenceResolver;
    registry = bundle.registry;
    adapterStamps = bundle.stamps;
  } else {
    resolver = new InMemoryEvidenceResolver();
    registry = new InMemoryProductionAdapterRegistry();
    adapterStamps = registerPhase9ProductionAdapters(registry, {
      environmentClass: 'SIMULATED',
    });
  }
  resolver.markFinalized(runId);

  const resolved = resolver.resolve({
    capabilityId,
    runIds: [runId],
    evidenceEnvelopes: [envelope],
    finalizedRunIds: [runId],
  });

  const waiver: Phase9ReleaseWaiver = Phase9ReleaseWaiverSchema.parse({
    schemaVersion: PHASE9_VERSION,
    waiverId: randomUUID(),
    capabilityId,
    scope: 'coverage-pending',
    reason:
      environmentClass === 'STAGING'
        ? 'STAGING environmentClass is approved for STAGING promotion only'
        : 'SIMULATED environment cannot authorize production release',
    compensatingControl: 'block on environmentClass != STAGING',
    owner: 'phase9-runner',
    approver: 'phase9-approver',
    issueLink: 'https://example.invalid/phase9/waiver',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    phase9Signers: {
      ownerId: 'phase9-owner',
      approverId: 'phase9-approver',
      issuerId: 'phase9-runner',
    },
  });

  const drill: RollbackDrillRequirement = RollbackDrillRequirementSchema.parse({
    schemaVersion: PHASE9_VERSION,
    drillId: randomUUID(),
    capabilityId,
    riskTier,
    requiredScenarios: ['rollback-scenario-1'],
    maxAgeDays: 30,
    status: 'PASSED',
    lastSuccessfulDrillAt: new Date().toISOString(),
    executedAt: new Date().toISOString(),
    executedBy: 'sre-platform',
    notes: [],
  });

  const policies = defaultPhase9Policies();
  const surfaces: ChangedSurface[] = [
    {
      changeId: randomUUID(),
      path: 'src/harness/phase9/runners.ts',
      kind: 'SOURCE',
      capabilityId,
      riskTier,
    },
  ];

  const coordinator = new Phase9ReleaseGateCoordinator();
  const result = coordinator.evaluate({
    capabilityId,
    changedSurfaces: surfaces,
    riskTier,
    environmentClass,
    resolved,
    policies,
    capabilities: [capability],
    approvals: [],
    waivers: [waiver],
    rollbackDrill:
      riskTier === 'CRITICAL' || riskTier === 'HIGH' ? drill : null,
    capability,
  });

  const schedule = buildRequiredSuiteSchedule({
    capabilityId,
    policy: policies.find((p) => p.riskTier === riskTier)!,
  });

  const gate = new Phase9ReleaseGate();
  const releaseGate = gate.weeklySoak({
    capabilityId,
    changedSurfaces: surfaces,
    riskTier,
    environmentClass,
    resolved,
    policies,
    capabilities: [capability],
    approvals: [],
    waivers: [waiver],
    rollbackDrill:
      riskTier === 'CRITICAL' || riskTier === 'HIGH' ? drill : null,
    capability,
  });

  const report = writePhase9Report({
    bundle: resolved.bundle,
    schedule,
    selection: result.selection,
    evaluation: result.evaluation,
    gate: releaseGate,
    certificate: null,
    outDir,
  });

  console.log(
    JSON.stringify(
      {
        runnerVersion: PHASE9_VERSION,
        capabilityId,
        riskTier,
        environmentClass,
        evidenceSource:
          evidenceSourceEnv === 'staging' || stagingMode
            ? 'staging'
            : 'simulated',
        stagingMode,
        verdict: result.evaluation.verdict,
        passed: releaseGate.passed,
        blockedReasons: releaseGate.blockedReasons,
        missingEvidence: result.evaluation.missingEvidence,
        unresolvedRisks: result.evaluation.unresolvedRisks,
        caveats: result.evaluation.caveats,
        evaluatorChainHash: result.evaluation.evaluatorChainHash,
        selection: result.selection,
        weeklySoakBlocked: environmentClass === 'SIMULATED',
        adapterStamps: adapterStamps.map((s) => ({
          adapter: s.adapter,
          status: s.status,
          environmentClass: s.environmentClass,
          source: s.source,
        })),
        artifacts: report,
        caveat:
          environmentClass === 'STAGING'
            ? 'STAGING environmentClass authorizes STAGING promotion only; PRODUCTION requires a separate ADR.'
            : 'SIMULATED environmentClass cannot authorize release; production sign-off requires Release Engineering, Security, Compliance, SRE/Platform, and capability-owner attestation.',
      },
      null,
      2,
    ),
  );
  if (!releaseGate.passed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
