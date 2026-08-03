import { randomUUID } from 'crypto';
import {
  type CapabilityRegistryEntry,
  type CertificateOfCapability,
  type ChangedSurfaceSelectorInput,
  type ChangedSurfaceSelectorOutput,
  type Phase9EnvironmentClass,
  type Phase9ReleaseWaiver,
  type ReleaseGateVerdict,
  type RiskTierGatePolicy,
  type RollbackDrillRequirement,
  type VerdictEvaluation,
  CapabilityRegistryEntrySchema,
  PHASE9_VERSION,
  RequiredSuiteScheduleEntrySchema,
  type RequiredSuiteScheduleEntry,
  RiskTierGatePolicySchema,
  ReleaseGateVerdictSchema,
} from './contracts';
import {
  type EvidenceResolution,
  DefaultRequiredSuiteSelector,
  DefaultVerdictAuthority,
  DEFAULT_PHASE9_FULL_SUITES,
  type RequiredSuiteSelector,
  type VerdictAuthority,
  type CapabilityRegistry,
  type EvidenceResolver,
  type WaiversLedger,
  type RollbackRegistry,
  type SignatureAuthority,
} from './ports';
import type { Signature } from '../contracts';

export interface Phase9ReleaseGateCoordinatorInput {
  capabilityId: string;
  changedSurfaces?: ChangedSurfaceSelectorInput['changedSurfaces'];
  riskTier: RiskTierGatePolicy['riskTier'];
  environmentClass: Phase9EnvironmentClass;
  resolved: EvidenceResolution;
  policies: RiskTierGatePolicy[];
  capabilities: CapabilityRegistryEntry[];
  approvals: Array<{
    signerId: string;
    signerRole: Signature['signerRole'];
    signedAt: string;
    signature: string;
    publicKey: string;
  }>;
  waivers: Phase9ReleaseWaiver[];
  rollbackDrill: RollbackDrillRequirement | null;
  certificate?: CertificateOfCapability | null;
  capability?: CapabilityRegistryEntry | null;
  capabilityRegistry?: CapabilityRegistry;
  evidenceResolver?: EvidenceResolver;
  signatureAuthority?: SignatureAuthority;
  waiversLedger?: WaiversLedger;
  rollbackRegistry?: RollbackRegistry;
  requiredSuiteSelector?: RequiredSuiteSelector;
  verdictAuthority?: VerdictAuthority;
}

export function defaultPhase9Policies(): RiskTierGatePolicy[] {
  return [
    RiskTierGatePolicySchema.parse({
      schemaVersion: PHASE9_VERSION,
      riskTier: 'CRITICAL',
      fullSuiteIds: [...DEFAULT_PHASE9_FULL_SUITES.CRITICAL],
      requiredSuiteIds: [...DEFAULT_PHASE9_FULL_SUITES.CRITICAL],
      thresholds: [],
      waiversAllowed: true,
      rollbackDrillRequired: true,
      minimumSampleSize: 30,
      notes: ['CRITICAL capabilities require all 9 suites per §15 DoD'],
    }),
    RiskTierGatePolicySchema.parse({
      schemaVersion: PHASE9_VERSION,
      riskTier: 'HIGH',
      fullSuiteIds: [...DEFAULT_PHASE9_FULL_SUITES.HIGH],
      requiredSuiteIds: [...DEFAULT_PHASE9_FULL_SUITES.HIGH],
      thresholds: [],
      waiversAllowed: true,
      rollbackDrillRequired: true,
      minimumSampleSize: 20,
      notes: ['HIGH capabilities require 6 suites per §15 DoD'],
    }),
    RiskTierGatePolicySchema.parse({
      schemaVersion: PHASE9_VERSION,
      riskTier: 'MEDIUM',
      fullSuiteIds: [...DEFAULT_PHASE9_FULL_SUITES.MEDIUM],
      requiredSuiteIds: [...DEFAULT_PHASE9_FULL_SUITES.MEDIUM],
      thresholds: [],
      waiversAllowed: true,
      rollbackDrillRequired: false,
      minimumSampleSize: 10,
      notes: ['MEDIUM capabilities require 4 suites'],
    }),
    RiskTierGatePolicySchema.parse({
      schemaVersion: PHASE9_VERSION,
      riskTier: 'LOW',
      fullSuiteIds: [...DEFAULT_PHASE9_FULL_SUITES.LOW],
      requiredSuiteIds: [...DEFAULT_PHASE9_FULL_SUITES.LOW],
      thresholds: [],
      waiversAllowed: true,
      rollbackDrillRequired: false,
      minimumSampleSize: 0,
      notes: ['LOW capabilities require 2 suites'],
    }),
  ];
}

export function findPolicy(
  policies: RiskTierGatePolicy[],
  riskTier: RiskTierGatePolicy['riskTier'],
): RiskTierGatePolicy {
  const p = policies.find((x) => x.riskTier === riskTier);
  if (!p) throw new Error(`No policy registered for riskTier ${riskTier}`);
  return p;
}

export function buildPhase9Evaluation(input: {
  evaluator: VerdictAuthority;
  capabilityId: string;
  riskTier: RiskTierGatePolicy['riskTier'];
  environmentClass: Phase9EnvironmentClass;
  resolved: EvidenceResolution;
  policy: RiskTierGatePolicy;
  approvals: Array<{
    signerId: string;
    signerRole: Signature['signerRole'];
    signedAt: string;
    signature: string;
    publicKey: string;
  }>;
  waivers: Phase9ReleaseWaiver[];
  rollbackDrill: RollbackDrillRequirement | null;
  capability: CapabilityRegistryEntry;
  certificate?: CertificateOfCapability | null;
}): VerdictEvaluation {
  return input.evaluator.evaluate({
    capabilityId: input.capabilityId,
    riskTier: input.riskTier,
    environmentClass: input.environmentClass,
    resolved: input.resolved,
    policy: input.policy,
    approvals: input.approvals,
    waivers: input.waivers,
    rollbackDrill: input.rollbackDrill,
    capability: input.capability,
    certificate: input.certificate ?? null,
  });
}

export function buildReleaseGateVerdict(input: {
  capabilityId: string;
  selection: ChangedSurfaceSelectorOutput;
  runResults: Array<{
    lane: string;
    runId: string;
    outcome: ReleaseGateVerdict['runResults'][number]['outcome'];
    finalized: boolean;
    simulatedOnly: boolean;
    reasons: string[];
  }>;
  evaluation: VerdictEvaluation | null;
}): ReleaseGateVerdict {
  const blockedReasons: string[] = [];
  const requiredLanes = new Set(input.selection.selectedLanes);
  const blockingLanes = new Set(input.selection.blockingLanes);
  const runsByLane = new Map(input.runResults.map((r) => [r.lane, r]));
  for (const lane of requiredLanes) {
    const run = runsByLane.get(lane);
    if (!run) {
      if (blockingLanes.has(lane)) {
        blockedReasons.push(`Required blocking lane ${lane} did not run`);
      }
      continue;
    }
    if (blockingLanes.has(lane)) {
      if (!run.finalized) {
        blockedReasons.push(`Lane ${lane} run ${run.runId} not finalized`);
      }
      if (run.outcome !== 'PASSED') {
        blockedReasons.push(
          `Lane ${lane} produced unacceptable outcome ${run.outcome}`,
        );
      }
      if (run.simulatedOnly) {
        blockedReasons.push(
          `Lane ${lane} is simulated-only (environmentClass=SIMULATED) and cannot authorize release`,
        );
      }
    }
  }
  if (input.evaluation) {
    if (input.evaluation.verdict === 'INSUFFICIENT_EVIDENCE') {
      blockedReasons.push(
        ...input.evaluation.reasons.map((r) => `verdict: ${r}`),
      );
    }
    if (input.evaluation.verdict === 'BLOCKED') {
      blockedReasons.push(
        ...input.evaluation.reasons.map((r) => `verdict: ${r}`),
      );
    }
  }
  return ReleaseGateVerdictSchema.parse({
    schemaVersion: PHASE9_VERSION,
    gateId: randomUUID(),
    capabilityId: input.capabilityId,
    lane: 'RELEASE',
    selection: {
      requiredLanes: input.selection.selectedLanes,
      blockingLanes: input.selection.blockingLanes,
      requiredSuiteIds: input.selection.requiredSuiteIds,
    },
    runResults: input.runResults,
    verdict: input.evaluation,
    passed: blockedReasons.length === 0,
    blockedReasons,
    evaluatedAt: new Date().toISOString(),
  });
}

export class Phase9ReleaseGateCoordinator {
  constructor(
    private readonly selectors: RequiredSuiteSelector[] = [
      new DefaultRequiredSuiteSelector(defaultPhase9Policies()),
    ],
    private readonly evaluator: VerdictAuthority = new DefaultVerdictAuthority(),
  ) {}

  evaluate(input: Phase9ReleaseGateCoordinatorInput): {
    selection: ChangedSurfaceSelectorOutput;
    evaluation: VerdictEvaluation;
    gate: ReleaseGateVerdict;
  } {
    const capability =
      input.capability ??
      input.capabilities.find((c) => c.capabilityId === input.capabilityId) ??
      null;
    if (!capability) {
      throw new Error(
        `Capability ${input.capabilityId} not registered in capability registry`,
      );
    }
    CapabilityRegistryEntrySchema.parse(capability);

    const policy = findPolicy(input.policies, input.riskTier);

    const selector = this.selectors[0];
    const selection = selector.select({
      capabilityId: input.capabilityId,
      changedSurfaces: input.changedSurfaces ?? [],
    });

    const evaluation = buildPhase9Evaluation({
      evaluator: this.evaluator,
      capabilityId: input.capabilityId,
      riskTier: input.riskTier,
      environmentClass: input.environmentClass,
      resolved: input.resolved,
      policy,
      approvals: input.approvals,
      waivers: input.waivers,
      rollbackDrill: input.rollbackDrill,
      capability,
      certificate: input.certificate ?? null,
    });

    const gate = buildReleaseGateVerdict({
      capabilityId: input.capabilityId,
      selection,
      runResults: selection.selectedLanes.map((lane) => ({
        lane,
        runId: '00000000-0000-0000-0000-000000000000',
        outcome: 'UNKNOWN' as const,
        finalized: false,
        simulatedOnly: input.environmentClass === 'SIMULATED',
        reasons: ['no run record present for this lane'],
      })),
      evaluation,
    });

    return { selection, evaluation, gate };
  }
}

// ============================================================
// HELPER: build schedule for archival
// ============================================================

export function buildRequiredSuiteSchedule(input: {
  capabilityId: string;
  policy: RiskTierGatePolicy;
  scheduleId?: string;
  lastRunId?: string | null;
  lastRunAt?: string | null;
  lastOutcome?: RequiredSuiteScheduleEntry['lastOutcome'];
}): RequiredSuiteScheduleEntry[] {
  const scheduleId = input.scheduleId ?? randomUUID();
  return input.policy.requiredSuiteIds.map((suiteId) =>
    RequiredSuiteScheduleEntrySchema.parse({
      schemaVersion: PHASE9_VERSION,
      scheduleId,
      capabilityId: input.capabilityId,
      riskTier: input.policy.riskTier,
      suiteId,
      cadence: input.policy.riskTier === 'CRITICAL' ? 'RELEASE' : 'NIGHTLY',
      requiredForApproval: true,
      minimumSampleSize: input.policy.minimumSampleSize,
      lastRunId: input.lastRunId ?? null,
      lastRunAt: input.lastRunAt ?? null,
      lastOutcome: input.lastOutcome ?? null,
      notes: [],
    }),
  );
}
