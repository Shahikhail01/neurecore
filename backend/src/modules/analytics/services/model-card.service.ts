/**
 * ModelCardService — Phase 5 P5
 *
 * Renders the canonical model-card document for an AnalyticsModel
 * (id, version, scope, features, baselines, calibration metrics,
 * limitations, monitoring, owner, lastEvaluatedAt). Used by:
 *   - The agent-template registry's evaluation metadata;
 *   - The dashboard's "model card" panel in Command Center;
 *   - The seed scripts that publish P5 model cards.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ModelLifecycleState } from './model-lifecycle.service';

export interface ModelCard {
  readonly modelId: string;
  readonly modelName: string;
  readonly version: string;
  readonly scope: ReadonlyArray<string>;
  readonly tenantScope: 'TENANT' | 'PLATFORM';
  readonly features: ReadonlyArray<{
    name: string;
    dtype: string;
    role: 'feature' | 'weight' | 'bias';
  }>;
  readonly baselines: ReadonlyArray<{ name: string; score: number | null }>;
  readonly calibration: Readonly<Record<string, number | string>>;
  readonly limitations: readonly string[];
  readonly monitoring: Readonly<Record<string, number | string>>;
  readonly owner: string;
  readonly lifecycle: ModelLifecycleState;
  readonly lastEvaluatedAt: string | null;
}

@Injectable()
export class ModelCardService {
  private readonly logger = new Logger(ModelCardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async forModel(modelId: string, tenantId: string): Promise<ModelCard> {
    const model = await this.prisma.analyticsModel.findFirst({
      where: { id: modelId, OR: [{ tenantId }, { tenantId: null }] },
    });
    if (!model) {
      throw new NotFoundException(`AnalyticsModel ${modelId} not found`);
    }
    return this.fromRow(model);
  }

  forRow(row: {
    id: string;
    name: string;
    version: string;
    description: string | null;
    metadata: unknown;
    tenantId: string | null;
    updatedAt: Date;
  }): ModelCard {
    return this.fromRow(row);
  }

  private fromRow(row: {
    id: string;
    name: string;
    version: string;
    description: string | null;
    metadata: unknown;
    tenantId: string | null;
    updatedAt: Date;
  }): ModelCard {
    const meta = (row.metadata ?? {}) as {
      weights?: Record<string, number>;
      stageProbabilities?: Record<string, number>;
      keywords?: Record<string, number>;
      lifecycle?: ModelLifecycleState;
      baselines?: Array<{ name: string; score: number | null }>;
      calibration?: Record<string, number | string>;
      limitations?: string[];
      monitoring?: Record<string, number | string>;
      owner?: string;
    };
    const weights = meta.weights ?? {};
    const features = Object.entries(weights).map(([name]) => ({
      name,
      dtype: 'numeric',
      role: 'weight' as const,
    }));
    const scope = row.description ? [row.description] : [];
    return {
      modelId: row.id,
      modelName: row.name,
      version: row.version,
      scope,
      tenantScope: row.tenantId === null ? 'PLATFORM' : 'TENANT',
      features,
      baselines: (meta.baselines ?? []).map((b) => ({
        name: b.name,
        score: typeof b.score === 'number' ? b.score : null,
      })),
      calibration: meta.calibration ?? {},
      limitations: meta.limitations ?? [
        'logistic regression — linear assumptions may not capture interactions',
        'no temporal cross-validation by default',
      ],
      monitoring: meta.monitoring ?? {
        driftCheckCadence: 'daily',
        lastDriftScore: 'n/a',
      },
      owner: meta.owner ?? 'analytics-team',
      lifecycle: meta.lifecycle ?? {
        version: 1,
        stages: [],
      },
      lastEvaluatedAt: row.updatedAt.toISOString(),
    };
  }
}
