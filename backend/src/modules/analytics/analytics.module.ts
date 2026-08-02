import { Module } from '@nestjs/common';
import { AnalyticsController } from './controllers/analytics.controller';
import { ModelLifecycleController } from './controllers/model-lifecycle.controller';
import { AnalyticsService } from './services/analytics.service';
import { PrismaFeatureStore } from './services/featureStore.prisma';
import { HttpModelRunner } from './services/modelRunner.http';
import { FeatureSnapshotRepository } from './services/featureSnapshot.repository';
import { CalibratedAnalyticsProvider } from './providers/calibrated.provider';
import { PredictionService } from './services/prediction.service';
import { RecommendationService } from './services/recommendation.service';
import { WorkRuntimeModule } from '../work-runtime/work-runtime.module';
import { MODEL_RUNNER } from './interfaces/IAnalyticsProvider';
import { LeadScoreProvider } from './providers/lead-score.provider';
import { OpportunityWinProvider } from './providers/opportunity-win.provider';
import { ForecastProvider } from './providers/forecast.provider';
import { ForecastBacktest } from './providers/forecast.backtest';
import { PipelineHealthProvider } from './providers/pipeline-health.provider';
import { CaseClassifyProvider } from './providers/case-classify.provider';
import { ModelLifecycleService } from './services/model-lifecycle.service';
import { ModelCardService } from './services/model-card.service';
import { DriftMonitorService } from './services/drift-monitor.service';

/**
 * AnalyticsModule — Phase 5 P5
 *
 * Registers the full analytics stack:
 *   - PrismaFeatureStore + HttpModelRunner (Phase 4.1, retained)
 *   - FeatureSnapshotRepository
 *   - CalibratedAnalyticsProvider
 *   - PredictionService (P5 — refuse to score on non-ACTIVE lifecycle)
 *   - RecommendationService
 *   - P5 typed prediction providers:
 *       • LeadScoreProvider
 *       • OpportunityWinProvider
 *       • ForecastProvider (+ ForecastBacktest)
 *       • PipelineHealthProvider
 *       • CaseClassifyProvider
 *   - ModelLifecycleService, ModelCardService, DriftMonitorService
 *   - ModelLifecycleController (REST endpoints)
 */
@Module({
  imports: [WorkRuntimeModule],
  controllers: [AnalyticsController, ModelLifecycleController],
  providers: [
    AnalyticsService,
    PrismaFeatureStore,
    HttpModelRunner,
    { provide: MODEL_RUNNER, useExisting: HttpModelRunner },
    FeatureSnapshotRepository,
    CalibratedAnalyticsProvider,
    PredictionService,
    RecommendationService,
    LeadScoreProvider,
    OpportunityWinProvider,
    ForecastProvider,
    ForecastBacktest,
    PipelineHealthProvider,
    CaseClassifyProvider,
    ModelLifecycleService,
    ModelCardService,
    DriftMonitorService,
  ],
  exports: [
    AnalyticsService,
    FeatureSnapshotRepository,
    CalibratedAnalyticsProvider,
    PredictionService,
    RecommendationService,
    LeadScoreProvider,
    OpportunityWinProvider,
    ForecastProvider,
    ForecastBacktest,
    PipelineHealthProvider,
    CaseClassifyProvider,
    ModelLifecycleService,
    ModelCardService,
    DriftMonitorService,
  ],
})
export class AnalyticsModule {}
