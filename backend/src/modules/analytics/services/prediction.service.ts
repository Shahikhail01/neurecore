import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { FeatureSnapshotRepository } from './featureSnapshot.repository';
import { CalibratedAnalyticsProvider } from '../providers/calibrated.provider';
import {
  Prediction,
  PredictionInput,
} from '../../service-gateway-v2/interfaces';
import { IPredictionProvider } from '../../service-gateway-v2/interfaces';

export const PREDICTION_QUALITY = {
  MIN_CONFIDENCE: 0.7,
  MAX_STALENESS_HOURS: 24,
  MIN_EVIDENCE_COUNT: 3,
  EXPIRY_HOURS: 24,
} as const;

@Injectable()
export class PredictionService implements IPredictionProvider {
  private readonly logger = new Logger(PredictionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: FeatureSnapshotRepository,
    private readonly calibrated: CalibratedAnalyticsProvider,
  ) {}

  async predict(input: PredictionInput): Promise<Prediction> {
    const { tenantId, subject, predictionType } = input;

    const recent = await this.snapshots.listRecent(
      tenantId,
      subject.type,
      subject.id,
      PREDICTION_QUALITY.MIN_EVIDENCE_COUNT + 2,
    );

    if (recent.length === 0) {
      return this.abstain(input, 'abstain: no feature snapshot available');
    }

    const latest = recent[0];
    const ageHours =
      (Date.now() - latest.recordedAt.getTime()) / (1000 * 60 * 60);
    if (ageHours > PREDICTION_QUALITY.MAX_STALENESS_HOURS) {
      return this.abstain(
        input,
        `abstain: snapshot stale (${ageHours.toFixed(1)}h > ${PREDICTION_QUALITY.MAX_STALENESS_HOURS}h)`,
      );
    }

    if (recent.length < PREDICTION_QUALITY.MIN_EVIDENCE_COUNT) {
      return this.abstain(
        input,
        `abstain: insufficient evidence (${recent.length} snapshots < ${PREDICTION_QUALITY.MIN_EVIDENCE_COUNT})`,
      );
    }

    // Pin a model: prefer the snapshot's modelId, otherwise the
    // first analytics model registered for the tenant.
    let modelId = latest.modelId ?? '';
    let modelVersion = latest.modelVersion ?? 'unknown';
    if (!modelId) {
      const fallback = await this.prisma.analyticsModel.findFirst({
        where: { OR: [{ tenantId }, { tenantId: null }] },
        orderBy: { createdAt: 'desc' },
      });
      if (!fallback) {
        return this.abstain(input, 'abstain: no analytics model registered');
      }
      modelId = fallback.id;
      modelVersion = fallback.version;
    }

    const scored = await this.calibrated.score(
      tenantId,
      modelId,
      latest.featuresJson,
    );

    if (scored.confidence < PREDICTION_QUALITY.MIN_CONFIDENCE) {
      return this.abstain(
        input,
        `abstain: low confidence (${scored.confidence.toFixed(2)} < ${PREDICTION_QUALITY.MIN_CONFIDENCE})`,
      );
    }

    const generatedAt = new Date();
    const expiresAt = new Date(
      generatedAt.getTime() + PREDICTION_QUALITY.EXPIRY_HOURS * 3600 * 1000,
    );

    return {
      id: `pred-${latest.id}-${generatedAt.getTime()}`,
      tenantId,
      subject,
      predictionType,
      value: scored.score,
      confidence: scored.confidence,
      model: { id: modelId, version: modelVersion },
      featureSnapshotId: latest.id,
      generatedAt: generatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      explanation: [
        `calibrated via ${scored.source} scoring`,
        ...scored.basis,
        `evidence: ${recent.length} snapshots, latest ${ageHours.toFixed(1)}h old`,
        `model: ${modelId}@${modelVersion}`,
      ],
      limitations: [
        'confidence derived from feature coverage; not a calibrated probability',
        'snapshot age is computed at prediction time only',
      ],
    };
  }

  private abstain(input: PredictionInput, reason: string): Prediction {
    const now = new Date().toISOString();
    return {
      id: `pred-abstain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tenantId: input.tenantId,
      subject: input.subject,
      predictionType: input.predictionType,
      value: null,
      confidence: 0,
      model: { id: 'abstain', version: '0.0.0' },
      featureSnapshotId: '',
      generatedAt: now,
      expiresAt: now,
      explanation: [reason],
      limitations: ['abstention — insufficient evidence to score'],
    };
  }
}
