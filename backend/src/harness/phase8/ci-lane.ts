import { z } from 'zod';
import { SemverSchema, UuidSchema, IsoDateTimeSchema } from '../contracts';
import {
  PHASE8_VERSION,
  type Phase8Counters,
  type Phase8RunnerReport,
  type Phase8EnvironmentClass,
} from './contracts';
import {
  evaluateCapacityGate,
  isSloPolicyEnforceable,
  type CapacityGateInput,
} from './runners';
import type { SloPolicy } from './contracts';

export const PHASE8_CI_LANE_VERSION = '1.1.0';

export const Phase8ChangedSurfaceSchema = z
  .object({
    changeId: UuidSchema,
    path: z.string().min(1),
    kind: z.enum([
      'SOURCE',
      'TEST',
      'CONTRACT',
      'PROMPT',
      'DATASET',
      'CONFIG',
      'DOCS',
      'INFRA',
    ]),
    capabilityId: z.string().min(1).optional(),
    riskTier: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  })
  .strict();
export type Phase8ChangedSurface = z.infer<typeof Phase8ChangedSurfaceSchema>;

export const Phase8LanePolicySchema = z
  .object({
    lane: z.enum([
      'DEVELOPER',
      'PR_FAST',
      'PR_AI',
      'MAINLINE',
      'NIGHTLY',
      'WEEKLY_SOAK',
      'RELEASE_CAPACITY',
      'RELEASE',
    ]),
    name: z.string().min(1),
    description: z.string().min(1),
    requireFinalized: z.boolean().default(true),
    blocking: z.boolean().default(false),
    schedule: z.string().min(1).optional(),
  })
  .strict();
export type Phase8LanePolicy = z.infer<typeof Phase8LanePolicySchema>;

export const PHASE8_DEFAULT_LANES: Phase8LanePolicy[] = [
  Phase8LanePolicySchema.parse({
    lane: 'DEVELOPER',
    name: 'Phase 8 developer',
    description: 'Phase 8 unit + conformance',
    requireFinalized: false,
    blocking: false,
  }),
  Phase8LanePolicySchema.parse({
    lane: 'PR_FAST',
    name: 'Phase 8 PR fast',
    description: 'Baseline cold/warm and correctness smoke under load',
    requireFinalized: true,
    blocking: true,
  }),
  Phase8LanePolicySchema.parse({
    lane: 'MAINLINE',
    name: 'Phase 8 mainline',
    description: 'Spike + stress + provider-throttle + queue/db/cache pressure',
    requireFinalized: true,
    blocking: true,
  }),
  Phase8LanePolicySchema.parse({
    lane: 'NIGHTLY',
    name: 'Phase 8 nightly',
    description: 'Concurrent tenants/agents + recovery + regression verdicts',
    requireFinalized: true,
    blocking: false,
  }),
  Phase8LanePolicySchema.parse({
    lane: 'WEEKLY_SOAK',
    name: 'Phase 8 weekly soak',
    description: 'Soak profile plus full capacity report',
    requireFinalized: true,
    blocking: true,
    schedule: 'weekly',
  }),
  Phase8LanePolicySchema.parse({
    lane: 'RELEASE_CAPACITY',
    name: 'Phase 8 release capacity',
    description: 'Capacity report gates release promotion',
    requireFinalized: true,
    blocking: true,
  }),
];

export const Phase8LaneSelectionSchema = z
  .object({
    prId: z.string().min(1),
    changedSurfaces: z.array(Phase8ChangedSurfaceSchema),
    requiredLanes: z.array(Phase8LanePolicySchema.shape.lane),
    blockingLanes: z.array(Phase8LanePolicySchema.shape.lane),
    criticalChanges: z.array(z.string().min(1)),
    weeklySoakDue: z.boolean(),
    releaseCandidate: z.boolean(),
    evaluatedAt: IsoDateTimeSchema,
  })
  .strict();
export type Phase8LaneSelection = z.infer<typeof Phase8LaneSelectionSchema>;

export interface IPhase8LaneSelector {
  select(input: {
    prId: string;
    surfaces: Phase8ChangedSurface[];
    weeklySoakDue?: boolean;
    releaseCandidate?: boolean;
  }): Phase8LaneSelection;
}

const PHASE8_GLOB_PATTERN = /src\/harness\/phase8\//;
const PERFORMANCE_GLOB_PATTERN = /(performance|load|capacity)/i;

export class Phase8LaneSelector implements IPhase8LaneSelector {
  constructor(
    private readonly policies: Phase8LanePolicy[] = PHASE8_DEFAULT_LANES,
  ) {}

  select(input: {
    prId: string;
    surfaces: Phase8ChangedSurface[];
    weeklySoakDue?: boolean;
    releaseCandidate?: boolean;
  }): Phase8LaneSelection {
    const affected = input.surfaces.filter(
      (s) =>
        PHASE8_GLOB_PATTERN.test(s.path) ||
        PERFORMANCE_GLOB_PATTERN.test(s.path),
    );
    const required = new Set<Phase8LanePolicy['lane']>(['DEVELOPER']);
    const blocking = new Set<Phase8LanePolicy['lane']>([]);
    if (affected.length > 0) {
      required.add('PR_FAST');
      blocking.add('PR_FAST');
    }
    const performanceAffect = affected.some((s) =>
      PERFORMANCE_GLOB_PATTERN.test(s.path),
    );
    if (performanceAffect) {
      required.add('MAINLINE');
      blocking.add('MAINLINE');
      required.add('NIGHTLY');
    }
    if (affected.some((s) => s.riskTier === 'CRITICAL')) {
      required.add('RELEASE_CAPACITY');
      blocking.add('RELEASE_CAPACITY');
    }
    if (input.weeklySoakDue ?? false) {
      required.add('WEEKLY_SOAK');
      blocking.add('WEEKLY_SOAK');
    }
    if (input.releaseCandidate ?? false) {
      required.add('RELEASE_CAPACITY');
      blocking.add('RELEASE_CAPACITY');
    }
    return Phase8LaneSelectionSchema.parse({
      prId: input.prId,
      changedSurfaces: affected,
      requiredLanes: [...required],
      blockingLanes: [...blocking],
      criticalChanges: affected
        .filter((s) => s.riskTier === 'CRITICAL')
        .map((s) => s.path),
      weeklySoakDue: input.weeklySoakDue ?? false,
      releaseCandidate: input.releaseCandidate ?? false,
      evaluatedAt: new Date().toISOString(),
    });
  }
}

export const Phase8GateVerdictSchema = z
  .object({
    prId: z.string().min(1),
    selection: Phase8LaneSelectionSchema,
    runResults: z.array(
      z
        .object({
          lane: Phase8LanePolicySchema.shape.lane,
          runId: UuidSchema,
          outcome: z.enum([
            'PASSED',
            'FAILED',
            'BLOCKED',
            'CANCELLED',
            'INFRA_ERROR',
            'FLAKY',
            'SKIPPED',
            'UNKNOWN',
          ]),
          finalized: z.boolean(),
          counters: z
            .object({
              total: z.number().int().nonnegative(),
              passed: z.number().int().nonnegative(),
              failed: z.number().int().nonnegative(),
              inconclusive: z.number().int().nonnegative(),
              criticalFailures: z.number().int().nonnegative(),
            })
            .strict(),
          reportChecksum: SemverSchema.optional(),
        })
        .strict(),
    ),
    passed: z.boolean(),
    reasons: z.array(z.string()),
    evaluatedAt: IsoDateTimeSchema,
  })
  .strict();
export type Phase8GateVerdict = z.infer<typeof Phase8GateVerdictSchema>;

export interface IPhase8Gate {
  evaluate(input: {
    prId: string;
    selection: Phase8LaneSelection;
    runs: Array<{
      lane: Phase8LanePolicy['lane'];
      runId: string;
      outcome: string;
      finalized: boolean;
      counters: Phase8Counters;
    }>;
  }): Phase8GateVerdict;
}

const PHASE8_UNACCEPTABLE = new Set([
  'FAILED',
  'BLOCKED',
  'INFRA_ERROR',
  'FLAKY',
  'SKIPPED',
  'UNKNOWN',
  'CANCELLED',
]);

export class Phase8Gate implements IPhase8Gate {
  evaluate(input: {
    prId: string;
    selection: Phase8LaneSelection;
    runs: Array<{
      lane: Phase8LanePolicy['lane'];
      runId: string;
      outcome: string;
      finalized: boolean;
      counters: Phase8Counters;
    }>;
  }): Phase8GateVerdict {
    const reasons: string[] = [];
    const required = new Set(input.selection.requiredLanes);
    const blocking = new Set(input.selection.blockingLanes);
    const runsByLane = new Map(input.runs.map((r) => [r.lane, r]));
    for (const lane of required) {
      const run = runsByLane.get(lane);
      if (!run) {
        if (blocking.has(lane) || input.selection.criticalChanges.length > 0) {
          reasons.push(`Required blocking lane ${lane} did not run`);
        }
        continue;
      }
      if (blocking.has(lane) || input.selection.criticalChanges.length > 0) {
        if (!run.finalized)
          reasons.push(`Lane ${lane} run ${run.runId} not finalized`);
        if (run.outcome !== 'PASSED') {
          reasons.push(
            PHASE8_UNACCEPTABLE.has(run.outcome)
              ? `Lane ${lane} produced unacceptable outcome ${run.outcome}`
              : `Lane ${lane} did not pass`,
          );
        }
        if (run.counters.criticalFailures > 0) {
          reasons.push(
            `Lane ${lane} reported ${run.counters.criticalFailures} critical failure(s)`,
          );
        }
      }
    }
    return Phase8GateVerdictSchema.parse({
      prId: input.prId,
      selection: input.selection,
      runResults: input.runs.map((r) => ({
        lane: r.lane,
        runId: UuidSchema.parse(r.runId),
        outcome:
          r.outcome as Phase8GateVerdict['runResults'][number]['outcome'],
        finalized: r.finalized,
        counters: r.counters,
      })),
      passed: reasons.length === 0,
      reasons,
      evaluatedAt: new Date().toISOString(),
    });
  }
}

export function reportToGateRun(
  report: Phase8RunnerReport,
  lane: Phase8LanePolicy['lane'],
): {
  lane: Phase8LanePolicy['lane'];
  runId: string;
  outcome: Phase8GateVerdict['runResults'][number]['outcome'];
  finalized: boolean;
  counters: Phase8Counters;
} {
  return {
    lane,
    runId: report.runId,
    outcome: report.outcome,
    finalized: report.status === 'PASS' || report.status === 'INCONCLUSIVE',
    counters: report.counters,
  };
}

export interface Phase8CapacityGateInput {
  report: Phase8RunnerReport;
  policy: SloPolicy | null | undefined;
  releaseCandidate: boolean;
  weeklySoakDue: boolean;
}

export interface Phase8ReleaseCapacityGate {
  evaluate(input: Phase8CapacityGateInput): {
    passed: boolean;
    reasons: string[];
    requiresApprovedPolicy: boolean;
    requiresRealEnvironment: boolean;
    policyEnforceable: boolean;
    sloEvaluationStatus: string | null;
  };
}

export const PHASE8_RELEASE_CAPACITY_GATE_VERSION = PHASE8_VERSION;

export class ReleaseCapacityGate implements Phase8ReleaseCapacityGate {
  evaluate(input: Phase8CapacityGateInput): {
    passed: boolean;
    reasons: string[];
    requiresApprovedPolicy: boolean;
    requiresRealEnvironment: boolean;
    policyEnforceable: boolean;
    sloEvaluationStatus: string | null;
  } {
    const reasons: string[] = [];
    const policyEnforceable = isSloPolicyEnforceable(input.policy);
    const realEnv: Phase8EnvironmentClass[] = [
      'STAGING',
      'PRODUCTION_PROBE',
      'PRODUCTION',
    ];
    const requiresRealEnvironment =
      input.releaseCandidate &&
      !realEnv.includes(input.report.environmentClass);
    if (requiresRealEnvironment) {
      reasons.push(
        `release capacity requires real environment evidence; got ${input.report.environmentClass}`,
      );
    }
    if (input.releaseCandidate && !policyEnforceable) {
      reasons.push(
        input.policy
          ? `SLO policy ${input.policy.policyId} is not approved (missing approvedBy/approvedAt/approvedEnvironment)`
          : 'no SLO policy registered; release capacity blocked',
      );
    }
    const capacity = evaluateCapacityGate({
      report: input.report,
      policy: input.policy,
      releaseCandidate: input.releaseCandidate,
      weeklySoakDue: input.weeklySoakDue,
    } satisfies CapacityGateInput);
    reasons.push(...capacity.reasons);
    return {
      passed: reasons.length === 0,
      reasons,
      requiresApprovedPolicy: input.releaseCandidate,
      requiresRealEnvironment,
      policyEnforceable,
      sloEvaluationStatus: input.report.sloEvaluation?.status ?? null,
    };
  }
}

export function evaluateReleaseCapacityGate(input: Phase8CapacityGateInput): {
  passed: boolean;
  reasons: string[];
  requiresApprovedPolicy: boolean;
  requiresRealEnvironment: boolean;
  policyEnforceable: boolean;
  sloEvaluationStatus: string | null;
} {
  return new ReleaseCapacityGate().evaluate(input);
}
