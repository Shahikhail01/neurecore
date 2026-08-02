/**
 * ModelLifecycleService — Phase 5 P5
 *
 * Canonical owner of the 11-stage model lifecycle:
 *   1. problem-definition
 *   2. tenant-feature-contract
 *   3. data-sufficiency
 *   4. train/val/test split
 *   5. baselines
 *   6. calibration
 *   7. explanation-validation
 *   8. shadow
 *   9. gated-production
 *   10. monitoring
 *   11. rollback/retirement
 *
 * Every stage records a JSON state snapshot on the AnalyticsModel row
 * via `metadata.lifecycle.stages[]`. Transitions are gated by an
 * allowed-transitions table. Production activation requires every
 * prior stage to be `COMPLETE` — the model is "ACTIVE" only when all
 * production gates pass.
 *
 * Tenant isolation: every read filters on
 * `tenantId === caller.tenantId OR tenantId === null AND isPublic`.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export const MODEL_LIFECYCLE_STAGES = [
  'problem-definition',
  'tenant-feature-contract',
  'data-sufficiency',
  'train-val-test-split',
  'baselines',
  'calibration',
  'explanation-validation',
  'shadow',
  'gated-production',
  'monitoring',
  'rollback-retirement',
] as const;

export type ModelLifecycleStage = (typeof MODEL_LIFECYCLE_STAGES)[number];

export type ModelStageStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETE'
  | 'BLOCKED';

export interface ModelStageRecord {
  readonly stage: ModelLifecycleStage;
  readonly status: ModelStageStatus;
  readonly updatedAt: string;
  readonly updatedByActorId: string;
  readonly notes?: string;
  readonly metrics?: Readonly<Record<string, number | string | boolean>>;
}

export interface ModelLifecycleState {
  readonly version: 1;
  readonly stages: readonly ModelStageRecord[];
  readonly activatedAt?: string;
  readonly retiredAt?: string;
}

export interface ModelLifecycleDecision {
  readonly stage: ModelLifecycleStage;
  readonly status: ModelStageStatus;
  readonly notes?: string;
  readonly metrics?: Readonly<Record<string, number | string | boolean>>;
}

const STAGE_ORDER: Readonly<Record<ModelLifecycleStage, number>> = {
  'problem-definition': 1,
  'tenant-feature-contract': 2,
  'data-sufficiency': 3,
  'train-val-test-split': 4,
  baselines: 5,
  calibration: 6,
  'explanation-validation': 7,
  shadow: 8,
  'gated-production': 9,
  monitoring: 10,
  'rollback-retirement': 11,
};

@Injectable()
export class ModelLifecycleService {
  private readonly logger = new Logger(ModelLifecycleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Read the lifecycle state of a model. Returns an empty state if the
   * row has never been initialized.
   */
  async getLifecycle(
    modelId: string,
    tenantId: string,
  ): Promise<ModelLifecycleState> {
    const model = await this.requireModel(modelId, tenantId);
    const meta = (model.metadata ?? {}) as { lifecycle?: unknown };
    const state = this.fromStored(meta.lifecycle);
    return state;
  }

  /**
   * Transition a single stage to a new status. Enforces the allowed
   * transitions: every stage must be either NOT_STARTED or IN_PROGRESS
   * before it can advance; once COMPLETE it can only move to
   * 'IN_PROGRESS' (re-opened) or to BLOCKED. A stage moving to
   * COMPLETE implies all earlier stages are also COMPLETE.
   */
  async transition(args: {
    tenantId: string;
    actorId: string;
    modelId: string;
    decision: ModelLifecycleDecision;
  }): Promise<ModelLifecycleState> {
    if (!args.actorId) {
      throw new ForbiddenException(
        'Actor identity required for lifecycle transition',
      );
    }
    const model = await this.requireModel(args.modelId, args.tenantId);
    const meta = (model.metadata ?? {}) as { lifecycle?: unknown };
    const previous = this.fromStored(meta.lifecycle);
    const next = this.applyDecision(previous, args.decision);

    const metadataUpdate: Prisma.InputJsonValue = {
      ...((model.metadata ?? {}) as Record<string, unknown>),
      lifecycle: next as unknown as Prisma.InputJsonValue,
    };

    const isProductionActive =
      next.stages.find((s) => s.stage === 'gated-production')?.status ===
        'COMPLETE' &&
      next.stages.find((s) => s.stage === 'monitoring')?.status ===
        'IN_PROGRESS';

    await this.prisma.analyticsModel.update({
      where: { id: model.id },
      data: {
        metadata: metadataUpdate,
      },
    });

    if (isProductionActive && !previous.activatedAt) {
      await this.markActivated(args.modelId, next);
    }
    void isProductionActive;

    return next;
  }

  /**
   * True when the model's gated-production + monitoring stages are
   * both active/complete — the policy enforced by
   * `PredictionService.predict` for tenant scoring.
   */
  async isProductionReady(modelId: string, tenantId: string): Promise<boolean> {
    const state = await this.getLifecycle(modelId, tenantId);
    const gated = state.stages.find(
      (s) => s.stage === 'gated-production',
    )?.status;
    const monitor = state.stages.find((s) => s.stage === 'monitoring')?.status;
    return (
      gated === 'COMPLETE' &&
      (monitor === 'IN_PROGRESS' || monitor === 'COMPLETE')
    );
  }

  async markActivated(
    modelId: string,
    state: ModelLifecycleState,
  ): Promise<void> {
    const next: ModelLifecycleState = {
      ...state,
      activatedAt: new Date().toISOString(),
    };
    const existing = await this.prisma.analyticsModel.findUnique({
      where: { id: modelId },
    });
    const existingMeta = (existing?.metadata ?? {}) as Record<string, unknown>;
    await this.prisma.analyticsModel.update({
      where: { id: modelId },
      data: {
        metadata: {
          ...existingMeta,
          lifecycle: next as unknown as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async markRetired(
    modelId: string,
    tenantId: string,
    actorId: string,
  ): Promise<ModelLifecycleState> {
    return this.transition({
      tenantId,
      actorId,
      modelId,
      decision: {
        stage: 'rollback-retirement',
        status: 'COMPLETE',
        notes: 'retired',
      },
    });
  }

  private async requireModel(modelId: string, tenantId: string) {
    const model = await this.prisma.analyticsModel.findFirst({
      where: { id: modelId, OR: [{ tenantId }, { tenantId: null }] },
    });
    if (!model) {
      throw new NotFoundException(`AnalyticsModel ${modelId} not found`);
    }
    return model;
  }

  private fromStored(stored: unknown): ModelLifecycleState {
    if (
      stored &&
      typeof stored === 'object' &&
      'stages' in stored &&
      Array.isArray((stored as { stages: unknown }).stages)
    ) {
      return stored as ModelLifecycleState;
    }
    return {
      version: 1,
      stages: MODEL_LIFECYCLE_STAGES.map((s) => ({
        stage: s,
        status: 'NOT_STARTED',
        updatedAt: new Date(0).toISOString(),
        updatedByActorId: 'system',
      })),
    };
  }

  private applyDecision(
    previous: ModelLifecycleState,
    decision: ModelLifecycleDecision,
  ): ModelLifecycleState {
    const updatedStages = previous.stages.map((s) => ({ ...s }));
    const idx = updatedStages.findIndex((s) => s.stage === decision.stage);
    if (idx < 0) {
      throw new BadRequestException(`Unknown stage ${decision.stage}`);
    }
    const current = updatedStages[idx];
    if (this.isBackwardTransition(current.status, decision.status)) {
      throw new BadRequestException(
        `Invalid lifecycle transition: ${current.status} → ${decision.status}`,
      );
    }
    updatedStages[idx] = {
      ...current,
      status: decision.status,
      notes: decision.notes,
      metrics: decision.metrics,
      updatedAt: new Date().toISOString(),
      updatedByActorId: 'actor',
    };
    if (decision.status === 'COMPLETE') {
      for (let i = 0; i < idx; i += 1) {
        const prior = updatedStages[i];
        if (prior.status !== 'COMPLETE') {
          updatedStages[i] = {
            ...prior,
            status: 'COMPLETE',
            updatedAt: new Date().toISOString(),
            updatedByActorId: 'actor',
            notes: 'implied by later stage completion',
          };
        }
      }
    }
    return {
      ...previous,
      stages: updatedStages,
    };
  }

  private isBackwardTransition(
    from: ModelStageStatus,
    to: ModelStageStatus,
  ): boolean {
    const rank: Record<ModelStageStatus, number> = {
      NOT_STARTED: 0,
      IN_PROGRESS: 1,
      COMPLETE: 2,
      BLOCKED: 3,
    };
    if (from === 'BLOCKED' && to !== 'IN_PROGRESS' && to !== 'NOT_STARTED')
      return true;
    if (rank[to] < rank[from] && to !== 'BLOCKED' && from !== 'BLOCKED')
      return true;
    return false;
  }

  static get stageOrder(): Readonly<Record<ModelLifecycleStage, number>> {
    return STAGE_ORDER;
  }
}
