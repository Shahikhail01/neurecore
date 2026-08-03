import { z } from 'zod';
import { SemverSchema, UuidSchema, IsoDateTimeSchema } from '../contracts';
import type { Phase7RunnerReport, Phase7Counters } from './contracts';

export const PHASE7_CI_LANE_VERSION = '1.0.0';

export const Phase7ChangedSurfaceSchema = z
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
export type Phase7ChangedSurface = z.infer<typeof Phase7ChangedSurfaceSchema>;

export const Phase7LanePolicySchema = z
  .object({
    lane: z.enum([
      'DEVELOPER',
      'PR_FAST',
      'PR_AI',
      'MAINLINE',
      'NIGHTLY',
      'WEEKLY',
      'RELEASE',
    ]),
    name: z.string().min(1),
    description: z.string().min(1),
    requireFinalized: z.boolean().default(true),
    blocking: z.boolean().default(false),
  })
  .strict();
export type Phase7LanePolicy = z.infer<typeof Phase7LanePolicySchema>;

export const PHASE7_DEFAULT_LANES: Phase7LanePolicy[] = [
  Phase7LanePolicySchema.parse({
    lane: 'DEVELOPER',
    name: 'Phase 7 developer',
    description: 'Phase 7 unit + conformance',
    requireFinalized: false,
    blocking: false,
  }),
  Phase7LanePolicySchema.parse({
    lane: 'PR_FAST',
    name: 'Phase 7 PR fast',
    description: 'Security + isolation smoke',
    requireFinalized: true,
    blocking: true,
  }),
  Phase7LanePolicySchema.parse({
    lane: 'NIGHTLY',
    name: 'Phase 7 nightly',
    description: 'Full Phase 7 runner matrix',
    requireFinalized: true,
    blocking: false,
  }),
  Phase7LanePolicySchema.parse({
    lane: 'RELEASE',
    name: 'Phase 7 release',
    description: 'Release-candidate Phase 7 verdict',
    requireFinalized: true,
    blocking: true,
  }),
];

export const Phase7LaneSelectionSchema = z
  .object({
    prId: z.string().min(1),
    changedSurfaces: z.array(Phase7ChangedSurfaceSchema),
    requiredLanes: z.array(Phase7LanePolicySchema.shape.lane),
    blockingLanes: z.array(Phase7LanePolicySchema.shape.lane),
    criticalChanges: z.array(z.string().min(1)),
    evaluatedAt: IsoDateTimeSchema,
  })
  .strict();
export type Phase7LaneSelection = z.infer<typeof Phase7LaneSelectionSchema>;

export interface IPhase7LaneSelector {
  select(input: {
    prId: string;
    surfaces: Phase7ChangedSurface[];
  }): Phase7LaneSelection;
}

const PHASE7_GLOB_PATTERN = /src\/harness\/phase7\//;

export class Phase7LaneSelector implements IPhase7LaneSelector {
  constructor(
    private readonly policies: Phase7LanePolicy[] = PHASE7_DEFAULT_LANES,
  ) {}

  select(input: {
    prId: string;
    surfaces: Phase7ChangedSurface[];
  }): Phase7LaneSelection {
    const affected = input.surfaces.filter((s) =>
      PHASE7_GLOB_PATTERN.test(s.path),
    );
    const required = new Set<Phase7LanePolicy['lane']>(['DEVELOPER']);
    const blocking = new Set<Phase7LanePolicy['lane']>([]);
    if (affected.length > 0) {
      required.add('PR_FAST');
      blocking.add('PR_FAST');
    }
    if (affected.some((s) => s.riskTier === 'CRITICAL')) {
      required.add('RELEASE');
      blocking.add('RELEASE');
    }
    if (affected.some((s) => s.kind === 'PROMPT' || s.kind === 'DATASET')) {
      required.add('PR_AI');
    }
    required.add('NIGHTLY');
    return Phase7LaneSelectionSchema.parse({
      prId: input.prId,
      changedSurfaces: affected,
      requiredLanes: [...required],
      blockingLanes: [...blocking],
      criticalChanges: affected
        .filter((s) => s.riskTier === 'CRITICAL')
        .map((s) => s.path),
      evaluatedAt: new Date().toISOString(),
    });
  }
}

export const Phase7GateVerdictSchema = z
  .object({
    prId: z.string().min(1),
    selection: Phase7LaneSelectionSchema,
    runResults: z.array(
      z
        .object({
          lane: Phase7LanePolicySchema.shape.lane,
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
export type Phase7GateVerdict = z.infer<typeof Phase7GateVerdictSchema>;

export interface IPhase7Gate {
  evaluate(input: {
    prId: string;
    selection: Phase7LaneSelection;
    runs: Array<{
      lane: Phase7LanePolicy['lane'];
      runId: string;
      outcome: string;
      finalized: boolean;
      counters: Phase7Counters;
    }>;
  }): Phase7GateVerdict;
}

const UNACCEPTABLE = new Set([
  'FAILED',
  'BLOCKED',
  'INFRA_ERROR',
  'FLAKY',
  'SKIPPED',
  'UNKNOWN',
  'CANCELLED',
]);

export class Phase7Gate implements IPhase7Gate {
  evaluate(input: {
    prId: string;
    selection: Phase7LaneSelection;
    runs: Array<{
      lane: Phase7LanePolicy['lane'];
      runId: string;
      outcome: string;
      finalized: boolean;
      counters: Phase7Counters;
    }>;
  }): Phase7GateVerdict {
    const reasons: string[] = [];
    const required = new Set(input.selection.requiredLanes);
    const blocking = new Set(input.selection.blockingLanes);
    const runsByLane = new Map(input.runs.map((r) => [r.lane, r]));
    for (const lane of required) {
      const run = runsByLane.get(lane);
      if (!run) {
        reasons.push(`Required lane ${lane} did not run`);
        continue;
      }
      if (blocking.has(lane) || input.selection.criticalChanges.length > 0) {
        if (!run.finalized)
          reasons.push(`Lane ${lane} run ${run.runId} not finalized`);
        if (run.outcome !== 'PASSED') {
          reasons.push(
            UNACCEPTABLE.has(run.outcome)
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
    return Phase7GateVerdictSchema.parse({
      prId: input.prId,
      selection: input.selection,
      runResults: input.runs.map((r) => ({
        lane: r.lane,
        runId: UuidSchema.parse(r.runId),
        outcome:
          r.outcome as Phase7GateVerdict['runResults'][number]['outcome'],
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
  report: Phase7RunnerReport,
  lane: Phase7LanePolicy['lane'],
): {
  lane: Phase7LanePolicy['lane'];
  runId: string;
  outcome: Phase7GateVerdict['runResults'][number]['outcome'];
  finalized: boolean;
  counters: Phase7Counters;
} {
  return {
    lane,
    runId: report.runId,
    outcome: report.outcome,
    finalized: report.status === 'PASS' || report.status === 'INCONCLUSIVE',
    counters: report.counters,
  };
}
