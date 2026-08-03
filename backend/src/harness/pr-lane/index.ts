/**
 * NeureCore Harness - PR Lane (Phase 3)
 *
 * Implements §10 Phase 3 GATE:
 *   "mandatory PR lane enabled for changed critical surfaces."
 *
 * And §11 CI/CD policy lane definitions:
 *   - Developer, PR fast, PR AI, Mainline, Nightly, Weekly, Release, Production probe
 *
 * SOLID alignment:
 *   - SRP: surface mapping + lane selection only; no execution logic.
 *   - OCP: lane policies and rule sets are data.
 *   - DIP: catalog input via port.
 *
 * Document ID: NC-HARNESS-PR-LANE-001
 * Version: 1.0
 * Status: PHASE_3_IMPLEMENTED
 */

import { z } from 'zod';
import {
  UuidSchema,
  IsoDateTimeSchema,
  type AuthorizationContext,
} from '../contracts';

export const PR_LANE_VERSION = '1.0.0';

// ============================================================
// CHANGED-SURFACE MAPPING
// ============================================================

export const SurfaceChangeKindSchema = z.enum([
  'SOURCE',
  'TEST',
  'CONTRACT',
  'PROMPT',
  'DATASET',
  'CONFIG',
  'DOCS',
  'INFRA',
]);
export type SurfaceChangeKind = z.infer<typeof SurfaceChangeKindSchema>;

export const SurfaceChangeSchema = z
  .object({
    changeId: UuidSchema,
    path: z.string().min(1),
    kind: SurfaceChangeKindSchema,
    capabilityId: z.string().min(1).optional(),
    riskTier: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    addedLines: z.number().int().nonnegative().default(0),
    removedLines: z.number().int().nonnegative().default(0),
  })
  .strict();
export type SurfaceChange = z.infer<typeof SurfaceChangeSchema>;

export const ChangedSurfaceSchema = z
  .object({
    prId: z.string().min(1),
    baseSha: z.string().min(1),
    headSha: z.string().min(1),
    changes: z.array(SurfaceChangeSchema).default([]),
    detectedAt: IsoDateTimeSchema,
  })
  .strict();
export type ChangedSurface = z.infer<typeof ChangedSurfaceSchema>;

// ============================================================
// LANE DEFINITIONS (§11)
// ============================================================

export const LaneKindSchema = z.enum([
  'DEVELOPER',
  'PR_FAST',
  'PR_AI',
  'MAINLINE',
  'NIGHTLY',
  'WEEKLY',
  'RELEASE',
  'PRODUCTION_PROBE',
]);
export type LaneKind = z.infer<typeof LaneKindSchema>;

export const RequiredSuiteRefSchema = z.object({
  suiteId: z.string().min(1),
  /** Critical risks have zero tolerance for failure. */
  critical: z.boolean().default(false),
});
export type RequiredSuiteRef = z.infer<typeof RequiredSuiteRefSchema>;

export const LanePolicySchema = z
  .object({
    lane: LaneKindSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    trigger: z.string().min(1),
    blocking: z.boolean().default(false),
    requiredSuites: z.array(RequiredSuiteRefSchema).default([]),
    /** When true, requires all required suites to be FINALIZED. */
    requireFinalizedRuns: z.boolean().default(true),
    /** When true, a CRITICAL capability change forces this lane. */
    appliesOnCriticalChange: z.boolean().default(false),
    /** When true, an AI-related change forces the PR AI lane. */
    appliesOnAiChange: z.boolean().default(false),
    /** When true, prompts/datasets changes force PR AI lane. */
    appliesOnPromptOrDatasetChange: z.boolean().default(false),
  })
  .strict();
export type LanePolicy = z.infer<typeof LanePolicySchema>;

// ============================================================
// DEFAULT LANE SET (§11 CI/CD policy)
// ============================================================

export const DEFAULT_LANE_POLICIES: LanePolicy[] = [
  LanePolicySchema.parse({
    lane: 'DEVELOPER',
    name: 'Developer',
    description:
      'Local / pre-push: affected unit, contract, prompt/data validation',
    trigger: 'local / pre-push',
    blocking: false,
    requiredSuites: [],
    requireFinalizedRuns: false,
  }),
  LanePolicySchema.parse({
    lane: 'PR_FAST',
    name: 'PR Fast',
    description:
      'Every PR: changed-surface deterministic, security, isolation smoke',
    trigger: 'every PR',
    blocking: true,
    requiredSuites: [],
    requireFinalizedRuns: true,
    appliesOnCriticalChange: true,
  }),
  LanePolicySchema.parse({
    lane: 'PR_AI',
    name: 'PR AI',
    description:
      'AI/prompt/RAG/agent/tool changes: focused eval with baseline comparison',
    trigger: 'AI/prompt/RAG/agent/tool changes',
    blocking: true,
    requiredSuites: [],
    requireFinalizedRuns: true,
    appliesOnAiChange: true,
    appliesOnPromptOrDatasetChange: true,
  }),
  LanePolicySchema.parse({
    lane: 'MAINLINE',
    name: 'Mainline',
    description: 'On merge: integration, workflow, regression, browser smoke',
    trigger: 'merge',
    blocking: true,
    requiredSuites: [],
    requireFinalizedRuns: true,
  }),
  LanePolicySchema.parse({
    lane: 'NIGHTLY',
    name: 'Nightly',
    description:
      'Scheduled: broad eval, adversarial, browser matrix, replay corpus',
    trigger: 'scheduled',
    blocking: false,
    requiredSuites: [],
    requireFinalizedRuns: true,
  }),
  LanePolicySchema.parse({
    lane: 'WEEKLY',
    name: 'Weekly',
    description: 'Scheduled: load, soak, full isolation and full SIM matrix',
    trigger: 'scheduled',
    blocking: false,
    requiredSuites: [],
    requireFinalizedRuns: true,
  }),
  LanePolicySchema.parse({
    lane: 'RELEASE',
    name: 'Release',
    description:
      'Candidate: all required risk-tier suites + rollback drill status',
    trigger: 'release candidate',
    blocking: true,
    requiredSuites: [],
    requireFinalizedRuns: true,
  }),
  LanePolicySchema.parse({
    lane: 'PRODUCTION_PROBE',
    name: 'Production Probe',
    description: 'Post-deploy read-only/synthetic canaries',
    trigger: 'post-deploy',
    blocking: false,
    requiredSuites: [],
    requireFinalizedRuns: false,
  }),
];

// ============================================================
// PR LANE SELECTOR
// ============================================================

export const LaneSelectionSchema = z
  .object({
    prId: z.string().min(1),
    selectedLanes: z.array(LaneKindSchema).default([]),
    criticalChanges: z.array(z.string().min(1)).default([]),
    aiChanges: z.array(z.string().min(1)).default([]),
    promptOrDatasetChanges: z.array(z.string().min(1)).default([]),
    mandatoryCriticalLaneForced: z.boolean().default(false),
    blockingLanes: z.array(LaneKindSchema).default([]),
    evaluatedAt: IsoDateTimeSchema,
  })
  .strict();
export type LaneSelection = z.infer<typeof LaneSelectionSchema>;

export interface ILaneSelector {
  select(input: { prId: string; surface: ChangedSurface }): LaneSelection;
}

export class LaneSelector implements ILaneSelector {
  private readonly policies: LanePolicy[];

  constructor(policies: LanePolicy[] = DEFAULT_LANE_POLICIES) {
    this.policies = policies.map((p) => LanePolicySchema.parse(p));
  }

  select(input: { prId: string; surface: ChangedSurface }): LaneSelection {
    const criticalChanges = input.surface.changes
      .filter((c) => c.riskTier === 'CRITICAL')
      .map((c) => c.path);
    const aiChanges = input.surface.changes
      .filter((c) => c.kind === 'PROMPT' || c.kind === 'DATASET')
      .map((c) => c.path);
    const promptOrDatasetChanges = aiChanges;

    const selected = new Set<LaneKind>();
    const blocking = new Set<LaneKind>();
    let criticalLaneForced = false;

    // Always run PR_FAST on a PR.
    selected.add('PR_FAST');
    blocking.add('PR_FAST');

    // AI / prompt / dataset change forces PR_AI.
    const hasAiChange = input.surface.changes.some(
      (c) =>
        c.kind === 'PROMPT' ||
        c.kind === 'DATASET' ||
        c.capabilityId?.startsWith('AI_'),
    );
    if (hasAiChange) {
      selected.add('PR_AI');
      blocking.add('PR_AI');
    }

    // Critical-surface change forces PR_FAST (already selected) AND
    // marks the lane as blocking on critical risk.
    if (criticalChanges.length > 0) {
      criticalLaneForced = true;
    }

    // Mainline always follows a merge; include here for completeness.
    selected.add('MAINLINE');
    blocking.add('MAINLINE');

    return LaneSelectionSchema.parse({
      prId: input.prId,
      selectedLanes: [...selected],
      criticalChanges,
      aiChanges,
      promptOrDatasetChanges,
      mandatoryCriticalLaneForced: criticalLaneForced,
      blockingLanes: [...blocking],
      evaluatedAt: new Date().toISOString(),
    });
  }
}

// ============================================================
// MANDATORY GATE FOR CHANGED CRITICAL SURFACES (§10 Phase 3 gate)
// ============================================================

export const CriticalGateVerdictSchema = z
  .object({
    prId: z.string().min(1),
    criticalChanges: z.array(z.string().min(1)).default([]),
    requiredLanes: z.array(LaneKindSchema).default([]),
    runResults: z
      .array(
        z.object({
          lane: LaneKindSchema,
          runId: z.string().min(1),
          outcome: z.enum([
            'PASSED',
            'FAILED',
            'BLOCKED',
            'INFRA_ERROR',
            'FLAKY',
            'SKIPPED',
            'UNKNOWN',
            'CANCELLED',
          ]),
          finalized: z.boolean(),
        }),
      )
      .default([]),
    passed: z.boolean(),
    reasons: z.array(z.string()).default([]),
    evaluatedAt: IsoDateTimeSchema,
  })
  .strict();
export type CriticalGateVerdict = z.infer<typeof CriticalGateVerdictSchema>;

export interface ICriticalSurfaceGate {
  evaluate(input: {
    prId: string;
    selection: LaneSelection;
    runs: Array<{
      lane: LaneKind;
      runId: string;
      outcome: string;
      finalized: boolean;
    }>;
  }): CriticalGateVerdict;
}

const UNACCEPTABLE_OUTCOMES = new Set([
  'FAILED',
  'BLOCKED',
  'INFRA_ERROR',
  'FLAKY',
  'SKIPPED',
  'UNKNOWN',
  'CANCELLED',
]);

export class CriticalSurfaceGate implements ICriticalSurfaceGate {
  evaluate(input: {
    prId: string;
    selection: LaneSelection;
    runs: Array<{
      lane: LaneKind;
      runId: string;
      outcome: string;
      finalized: boolean;
    }>;
  }): CriticalGateVerdict {
    const reasons: string[] = [];
    const runResults = input.runs.map((r) => ({
      lane: r.lane,
      runId: r.runId,
      outcome: r.outcome as
        | 'PASSED'
        | 'FAILED'
        | 'BLOCKED'
        | 'INFRA_ERROR'
        | 'FLAKY'
        | 'SKIPPED'
        | 'UNKNOWN'
        | 'CANCELLED',
      finalized: r.finalized,
    }));
    const blockingLanes = new Set(input.selection.blockingLanes);

    if (!input.selection.mandatoryCriticalLaneForced) {
      // No critical changes: gate trivially passes.
      return CriticalGateVerdictSchema.parse({
        prId: input.prId,
        criticalChanges: [],
        requiredLanes: [],
        runResults,
        passed: true,
        reasons: [],
        evaluatedAt: new Date().toISOString(),
      });
    }

    const requiredLanes = input.selection.blockingLanes;
    const runsByLane = new Map(input.runs.map((r) => [r.lane, r]));

    for (const lane of requiredLanes) {
      const run = runsByLane.get(lane);
      if (!run) {
        reasons.push(`Required lane ${lane} did not run`);
        continue;
      }
      if (blockingLanes.has(lane)) {
        if (!run.finalized)
          reasons.push(`Lane ${lane} run ${run.runId} not finalized`);
        if (run.outcome !== 'PASSED') {
          reasons.push(
            UNACCEPTABLE_OUTCOMES.has(run.outcome)
              ? `Lane ${lane} produced unacceptable outcome ${run.outcome} on critical change`
              : `Lane ${lane} did not pass`,
          );
        }
      }
    }

    return CriticalGateVerdictSchema.parse({
      prId: input.prId,
      criticalChanges: input.selection.criticalChanges,
      requiredLanes,
      runResults,
      passed: reasons.length === 0,
      reasons,
      evaluatedAt: new Date().toISOString(),
    });
  }
}

// ============================================================
// CAPABILITY RISK LOOKUP PORT
// ============================================================

export interface ICapabilityRiskLookup {
  riskTier(capabilityId: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
}

export function attachRiskTiers(
  changes: SurfaceChange[],
  lookup: ICapabilityRiskLookup,
): SurfaceChange[] {
  return changes.map((c) => {
    const tier = c.capabilityId ? lookup.riskTier(c.capabilityId) : null;
    return {
      ...c,
      riskTier: tier ?? c.riskTier,
    };
  });
}

// ============================================================
// AUTHORIZATION
// ============================================================

export function requireLaneSelectorAuth(
  ctx: AuthorizationContext | undefined,
): void {
  if (!ctx) throw new Error('Lane selector requires authorization context');
  // Lane selection / gate evaluation is an evidence-plane operation
  // (it gates runs in CI), so the actor must hold evidence:read at minimum.
  if (!ctx.permissions?.includes('evidence:read')) {
    throw new Error('Actor lacks evidence:read permission');
  }
}
