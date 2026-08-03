/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from 'zod';
import {
  type ChangedSurface,
  type ChangedSurfaceSelectorOutput,
  type RequiredSuiteScheduleEntry,
  type ReleaseGateVerdict,
  type RiskTierGatePolicy,
  type VerdictEvaluation,
  ChangedSurfaceSelectorOutputSchema,
  ReleaseGateVerdictSchema,
  RequiredSuiteScheduleEntrySchema,
  Phase9EnvironmentClassSchema,
  type Phase9EnvironmentClass,
} from './contracts';
import {
  DEFAULT_PHASE9_FULL_SUITES,
  DefaultRequiredSuiteSelector,
  DefaultVerdictAuthority,
  type VerdictAuthority,
  type RequiredSuiteSelector,
} from './ports';
import {
  buildReleaseGateVerdict,
  defaultPhase9Policies,
  Phase9ReleaseGateCoordinator,
  type Phase9ReleaseGateCoordinatorInput,
} from './runners';

export const PHASE9_CI_LANE_VERSION = '1.0.0';

export const Phase9LanePolicySchema = z
  .object({
    lane: z.enum([
      'DEVELOPER',
      'PR_FAST',
      'PR_AI',
      'MAINLINE',
      'NIGHTLY',
      'WEEKLY_SOAK',
      'RELEASE',
    ]),
    name: z.string().min(1),
    description: z.string().min(1),
    requireFinalized: z.boolean().default(true),
    blocking: z.boolean().default(false),
    schedule: z.string().min(1).optional(),
  })
  .strict();
export type Phase9LanePolicy = z.infer<typeof Phase9LanePolicySchema>;

export const PHASE9_DEFAULT_LANES: Phase9LanePolicy[] = [
  Phase9LanePolicySchema.parse({
    lane: 'DEVELOPER',
    name: 'Phase 9 developer',
    description: 'Phase 9 unit + conformance',
    requireFinalized: false,
    blocking: false,
  }),
  Phase9LanePolicySchema.parse({
    lane: 'PR_FAST',
    name: 'Phase 9 PR fast',
    description: 'Required-suite selection per riskTier',
    requireFinalized: true,
    blocking: true,
  }),
  Phase9LanePolicySchema.parse({
    lane: 'PR_AI',
    name: 'Phase 9 PR AI',
    description: 'Eval/prompt/dataset regressions',
    requireFinalized: true,
    blocking: true,
  }),
  Phase9LanePolicySchema.parse({
    lane: 'MAINLINE',
    name: 'Phase 9 mainline',
    description: 'Changed-surface dependency selection + isolation lanes',
    requireFinalized: true,
    blocking: true,
  }),
  Phase9LanePolicySchema.parse({
    lane: 'NIGHTLY',
    name: 'Phase 9 nightly',
    description: 'Full required-suite run',
    requireFinalized: true,
    blocking: false,
  }),
  Phase9LanePolicySchema.parse({
    lane: 'WEEKLY_SOAK',
    name: 'Phase 9 weekly soak',
    description: 'Weekly soak lane + rollback drill',
    requireFinalized: true,
    blocking: true,
    schedule: 'weekly',
  }),
  Phase9LanePolicySchema.parse({
    lane: 'RELEASE',
    name: 'Phase 9 release',
    description: 'Release gate verdict',
    requireFinalized: true,
    blocking: true,
  }),
];

export interface Phase9LaneSelectorOptions {
  policies?: Phase9LanePolicy[];
  selector?: RequiredSuiteSelector;
}

export class Phase9LaneSelector {
  constructor(private readonly opts: Phase9LaneSelectorOptions = {}) {}
  select(input: {
    prId: string;
    capabilityId: string;
    riskTier: RiskTierGatePolicy['riskTier'];
    surfaces: ChangedSurface[];
  }): ChangedSurfaceSelectorOutput {
    const selector =
      this.opts.selector ??
      new DefaultRequiredSuiteSelector(defaultPhase9Policies());
    const out = selector.select({
      capabilityId: input.capabilityId,
      changedSurfaces: input.surfaces,
    });
    return ChangedSurfaceSelectorOutputSchema.parse(out);
  }
}

export interface Phase9ReleaseGateOptions {
  policies?: Phase9LanePolicy[];
  phase9Policies?: RiskTierGatePolicy[];
  selector?: RequiredSuiteSelector;
  evaluator?: VerdictAuthority;
}

export class Phase9ReleaseGate {
  constructor(private readonly opts: Phase9ReleaseGateOptions = {}) {}
  evaluate(input: Phase9ReleaseGateCoordinatorInput): ReleaseGateVerdict {
    const selector =
      this.opts.selector ??
      new DefaultRequiredSuiteSelector(
        this.opts.phase9Policies ?? defaultPhase9Policies(),
      );
    const evaluator = this.opts.evaluator ?? new DefaultVerdictAuthority();
    const coordinator = new Phase9ReleaseGateCoordinator([selector], evaluator);
    const result = coordinator.evaluate(input);
    const runResults = (input.changedSurfaces ?? []).map((s) => ({
      lane: 'MAINLINE',
      runId: '00000000-0000-0000-0000-000000000000',
      outcome: 'UNKNOWN' as const,
      finalized: false,
      simulatedOnly: input.environmentClass === 'SIMULATED',
      reasons: [`no run record for surface ${s.path}`],
    }));
    return buildReleaseGateVerdict({
      capabilityId: input.capabilityId,
      selection: result.selection,
      runResults,
      evaluation: result.evaluation,
    });
  }
  weeklySoak(input: Phase9ReleaseGateCoordinatorInput): ReleaseGateVerdict {
    const base = this.evaluate(input);
    if (input.environmentClass === 'SIMULATED') {
      return ReleaseGateVerdictSchema.parse({
        ...base,
        passed: false,
        blockedReasons: [
          ...base.blockedReasons,
          'WEEKLY_SOAK lane cannot produce a release verdict under SIMULATED environmentClass',
        ],
      });
    }
    return base;
  }
}

// ============================================================
// REPORT AGGREGATOR
// ============================================================

export function aggregatePhase9(
  schedule: RequiredSuiteScheduleEntry[],
  selection: ChangedSurfaceSelectorOutput,
  evaluation: VerdictEvaluation,
  gate: ReleaseGateVerdict,
): {
  schedule: RequiredSuiteScheduleEntry[];
  selection: ChangedSurfaceSelectorOutput;
  evaluation: VerdictEvaluation;
  gate: ReleaseGateVerdict;
  generatedAt: string;
} {
  return {
    schedule,
    selection,
    evaluation,
    gate,
    generatedAt: new Date().toISOString(),
  };
}
