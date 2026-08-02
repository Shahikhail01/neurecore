import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { FeatureSnapshotRepository } from './featureSnapshot.repository';
import { CalibratedAnalyticsProvider } from '../providers/calibrated.provider';
import {
  IRecommendationProvider,
  Recommendation,
  RecommendationInput,
  SupportingEvidence,
} from '../../service-gateway-v2/interfaces';
import { WORK_RUNTIME } from '../../work-runtime/contracts/work-runtime.interface';
import type {
  IWorkRuntime,
  WorkRunView,
} from '../../work-runtime/contracts/work-runtime.interface';

export type Evidence = SupportingEvidence;
type _UseSupportingEvidence = SupportingEvidence;

interface RecommendationTemplate {
  title: string;
  capability: string;
  reasoning: string[];
  expectedBenefit: string;
  risk: string;
  goal: string;
  registeredMutationCapability: string;
}

const TEMPLATES: RecommendationTemplate[] = [
  {
    title: 'Refresh stale features for this subject',
    capability: 'analytics.refreshFeatureSnapshot',
    reasoning: [
      'Most recent feature snapshot is older than the freshness window',
      'Refreshing will let predictions resume at full confidence',
    ],
    expectedBenefit: 'restores prediction quality and enables recommendations',
    risk: 'low — internal write, no external effect',
    goal: 'restore prediction confidence',
    registeredMutationCapability: 'analytics.refreshFeatureSnapshot',
  },
  {
    title: 'Schedule a re-evaluation against the canonical model',
    capability: 'analytics.reEvaluate',
    reasoning: [
      'Evidence indicates the subject is a good fit for re-evaluation',
      'Re-running the canonical model may surface new ranked actions',
    ],
    expectedBenefit: 'improves coverage of the ranked-action list',
    risk: 'low — internal write, no external effect',
    goal: 're-evaluate against canonical model',
    registeredMutationCapability: 'analytics.reEvaluate',
  },
];

@Injectable()
export class RecommendationService implements IRecommendationProvider {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: FeatureSnapshotRepository,
    private readonly calibrated: CalibratedAnalyticsProvider,
    @Inject(WORK_RUNTIME) private readonly workRuntime: IWorkRuntime,
  ) {}

  async recommend(input: RecommendationInput): Promise<Recommendation[]> {
    const ctx = input.context ?? {};
    const subjectType =
      typeof ctx['subjectType'] === 'string' ? ctx['subjectType'] : '';
    const subjectId =
      typeof ctx['subjectId'] === 'string' ? ctx['subjectId'] : '';
    if (!subjectType || !subjectId) return [];

    const recent = await this.snapshots.listRecent(
      input.tenantId,
      subjectType,
      subjectId,
      5,
    );
    if (recent.length === 0) return [];

    const model = await this.prisma.analyticsModel.findFirst({
      where: { OR: [{ tenantId: input.tenantId }, { tenantId: null }] },
      orderBy: { createdAt: 'desc' },
    });
    if (!model) return [];

    const scored = await this.calibrated.score(
      input.tenantId,
      model.id,
      recent[0].featuresJson,
    );

    const ranked = [...TEMPLATES]
      .map((t) => ({
        tpl: t,
        score: this.scoreTemplate(t, scored, recent),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    return ranked.map(({ tpl, score }, idx) => {
      const evidence: Evidence[] = recent.slice(0, 3).map((r) => ({
        sourceType: 'feature_snapshot',
        sourceId: r.id,
        tenantId: r.tenantId,
        observedAt: r.recordedAt.toISOString(),
        excerptHash: r.snapshotHash,
      }));
      return {
        id: `rec-${tpl.capability}-${idx}-${Date.now()}`,
        tenantId: input.tenantId,
        title: tpl.title,
        confidence: Math.max(0, Math.min(1, score)),
        reasoning: [
          ...tpl.reasoning,
          `scored ${scored.score.toFixed(2)} by model ${model.id}@${model.version}`,
        ],
        expiresAt,
        goal: tpl.goal,
        rankedAction: {
          capability: tpl.capability,
          effect: 'INTERNAL_WRITE' as const,
        },
        expectedBenefit: tpl.expectedBenefit,
        risk: tpl.risk,
        supportingEvidence: evidence,
        policyRequirements: ['tenant.context.snapshot'],
        registeredMutationCapability: tpl.registeredMutationCapability,
      } satisfies Recommendation;
    });
  }

  async selectAndStart(
    recommendation: Recommendation,
    actorId: string,
  ): Promise<WorkRunView> {
    return this.workRuntime.createRun({
      tenantId: recommendation.tenantId,
      actorId,
      actorType: 'HUMAN',
      request: `Execute recommendation: ${recommendation.title}`,
      scope: {
        includeCapabilities: recommendation.registeredMutationCapability
          ? [recommendation.registeredMutationCapability]
          : undefined,
      },
    });
  }

  private scoreTemplate(
    tpl: RecommendationTemplate,
    scored: { score: number; confidence: number },
    recent: { recordedAt: Date }[],
  ): number {
    const ageHours =
      (Date.now() - recent[0].recordedAt.getTime()) / (1000 * 60 * 60);
    const freshness = Math.max(0, 1 - ageHours / 24);
    return Math.min(0.99, 0.4 + scored.confidence * 0.3 + freshness * 0.2);
  }
}
