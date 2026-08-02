import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  IAnalyticsProvider,
  IModelRunner,
} from '../interfaces/IAnalyticsProvider';
import { MODEL_RUNNER } from '../interfaces/IAnalyticsProvider';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface CalibratedScore {
  score: number;
  confidence: number;
  modelId: string;
  modelVersion: string;
  featureCount: number;
  source: 'http' | 'linear' | 'baseline';
  basis: string[];
  [key: string]: unknown;
}

interface LinearConfig {
  kind: 'linear';
  weights: Record<string, number>;
  bias: number;
  scaleToUnitInterval?: boolean;
}

type ModelConfig = LinearConfig | { kind: 'http' } | Record<string, unknown>;

@Injectable()
export class CalibratedAnalyticsProvider implements IAnalyticsProvider {
  private readonly logger = new Logger(CalibratedAnalyticsProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MODEL_RUNNER) private readonly httpRunner: IModelRunner,
  ) {}

  async getModels(tenantId: string) {
    const rows = await this.prisma.analyticsModel.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((m) => ({ id: m.id, name: m.name, version: m.version }));
  }

  async score(
    tenantId: string,
    modelId: string,
    features: Record<string, unknown>,
  ): Promise<CalibratedScore> {
    const model = await this.prisma.analyticsModel.findFirst({
      where: { id: modelId, OR: [{ tenantId }, { tenantId: null }] },
    });

    const featureKeys = Object.keys(features);
    if (!model) {
      // Honest baseline: deterministic, no dummy 0.5 unless genuinely
      // there are no features.
      if (featureKeys.length === 0) {
        return {
          score: 0.5,
          confidence: 0,
          modelId,
          modelVersion: 'unknown',
          featureCount: 0,
          source: 'baseline',
          basis: ['no model registered, no features available'],
        };
      }
      const fallback = this.linearScore(
        { kind: 'linear', weights: {}, bias: 0.5, scaleToUnitInterval: true },
        features,
      );
      return {
        score: fallback.score,
        confidence: Math.min(0.5, fallback.confidence),
        modelId,
        modelVersion: 'unregistered',
        featureCount: featureKeys.length,
        source: 'linear',
        basis: ['no model registered, applied neutral 0.5 bias'],
      };
    }

    const config = (model.metadata ?? {}) as ModelConfig;
    if ((config as { kind?: string }).kind === 'linear') {
      const linear = this.linearScore(config as LinearConfig, features);
      return {
        score: linear.score,
        confidence: linear.confidence,
        modelId: model.id,
        modelVersion: model.version,
        featureCount: featureKeys.length,
        source: 'linear',
        basis: linear.basis,
      };
    }

    // Default: HTTP-backed scoring via the model runner.
    try {
      const result = await this.httpRunner.runModel(model.id, features);
      const score = this.coerceScore(result);
      return {
        score,
        confidence: this.coerceConfidence(result, featureKeys.length),
        modelId: model.id,
        modelVersion: model.version,
        featureCount: featureKeys.length,
        source: 'http',
        basis: ['http model runner response'],
      };
    } catch (err) {
      this.logger.warn(
        `HTTP scoring failed for model ${model.id}; falling back to linear: ${(err as Error).message}`,
      );
      const fallback = this.linearScore(
        { kind: 'linear', weights: {}, bias: 0.5, scaleToUnitInterval: true },
        features,
      );
      return {
        score: fallback.score,
        confidence: Math.min(0.4, fallback.confidence),
        modelId: model.id,
        modelVersion: model.version,
        featureCount: featureKeys.length,
        source: 'linear',
        basis: ['http runner unavailable, neutral fallback applied'],
      };
    }
  }

  private linearScore(
    config: LinearConfig,
    features: Record<string, unknown>,
  ): { score: number; confidence: number; basis: string[] } {
    const weights = config.weights ?? {};
    const bias = typeof config.bias === 'number' ? config.bias : 0;
    const matched: string[] = [];
    let z = bias;
    for (const [k, w] of Object.entries(weights)) {
      const v = features[k];
      if (typeof v === 'number' && Number.isFinite(v)) {
        z += v * w;
        matched.push(k);
      }
    }
    const score = config.scaleToUnitInterval ? 1 / (1 + Math.exp(-z)) : z;
    // Confidence rises with matched weighted features.
    const matchedCount = matched.length;
    const totalWeights = Object.keys(weights).length || 1;
    const coverage = matchedCount / totalWeights;
    const confidence = Math.min(0.99, 0.4 + coverage * 0.5);
    const basis =
      matchedCount > 0
        ? [
            `linear model matched ${matchedCount} of ${totalWeights} weighted features`,
          ]
        : ['linear model had no weighted features matched; defaulted to bias'];
    return { score, confidence, basis };
  }

  private coerceScore(result: Record<string, unknown>): number {
    const candidate =
      typeof result['score'] === 'number'
        ? result['score']
        : typeof result['result'] === 'object' && result['result'] !== null
          ? ((result['result'] as Record<string, unknown>)['score'] as number)
          : Number.NaN;
    if (!Number.isFinite(candidate)) return 0.5;
    return Math.max(0, Math.min(1, candidate));
  }

  private coerceConfidence(
    result: Record<string, unknown>,
    featureCount: number,
  ): number {
    const raw = result['confidence'];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return Math.max(0, Math.min(1, raw));
    }
    return Math.min(0.95, 0.5 + featureCount * 0.05);
  }
}
