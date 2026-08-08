import { Module } from '@nestjs/common';
import { AnalyticsController } from './controllers/analytics.controller';
import { ModelLifecycleController } from './controllers/model-lifecycle.controller';
import { AnalyticsService } from './services/analytics.service';
import { PrismaFeatureStore } from './services/featureStore.prisma';
import { HttpModelRunner } from './services/modelRunner.http';
import { InProcessMockModelRunner } from './services/in-process-mock-model-runner';
import { LeadScoringCalibration } from './services/lead-scoring-calibration';
import { LeadScoringCalibrationController } from './controllers/lead-scoring-calibration.controller';
import { FeatureSnapshotRepository } from './services/featureSnapshot.repository';
import { CalibratedAnalyticsProvider } from './providers/calibrated.provider';
import { PredictionService } from './services/prediction.service';
import { RecommendationService } from './services/recommendation.service';
import { WorkRuntimeModule } from '../work-runtime/work-runtime.module';
// Phase 30 — cost ceiling enforcement on the LLM spend hook
import { CostCeilingModule } from '../cost-ceiling/cost-ceiling.module';
import { MODEL_RUNNER } from './interfaces/IAnalyticsProvider';
import { LeadScoreProvider } from './providers/lead-score.provider';
import { OpportunityWinProvider } from './providers/opportunity-win.provider';
import { ForecastProvider } from './providers/forecast.provider';
import { ForecastBacktest } from './providers/forecast.backtest';
import { PipelineHealthProvider } from './providers/pipeline-health.provider';
import { LlmModelRunner } from './services/model-runner/llm-model-runner';
import { LlmFeatureFlagService } from './services/model-runner/llm-feature-flag.service';
import { CaseClassifyProvider } from './providers/case-classify.provider';
import { ModelLifecycleService } from './services/model-lifecycle.service';
import { ModelCardService } from './services/model-card.service';
import { DriftMonitorService } from './services/drift-monitor.service';
// Phase 26 — forecast source registry + orchestrator
import { DealPipelineSource } from './sources/deal-pipeline.source';
import { QuoteAggregateSource } from './sources/quote-aggregate.source';
import { ForecastSourceRegistry } from './orchestrator/forecast-source.registry';
import { ForecastOrchestrator } from './orchestrator/forecast.orchestrator';
import { FORECAST_SOURCE } from './interfaces/IForecastSource';

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
  imports: [WorkRuntimeModule, CostCeilingModule],
  controllers: [
    AnalyticsController,
    ModelLifecycleController,
    LeadScoringCalibrationController,
  ],
  providers: [
    AnalyticsService,
    PrismaFeatureStore,
    InProcessMockModelRunner, // Phase 3 P-5: default model runner (deterministic, in-process)
    HttpModelRunner, // secondary; kept for environments that opt in via env
    { provide: MODEL_RUNNER, useExisting: InProcessMockModelRunner },
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
    LeadScoringCalibration, // Phase 3 P-5: certification gate
    // Phase 21 — LLM runner (off by default; per-tenant opt-in).
    LlmModelRunner,
    LlmFeatureFlagService,
    // Phase 26 — forecast source registry + orchestrator
    DealPipelineSource,
    QuoteAggregateSource,
    {
      provide: FORECAST_SOURCE,
      useFactory: (deal: DealPipelineSource, quote: QuoteAggregateSource) => [deal, quote],
      inject: [DealPipelineSource, QuoteAggregateSource],
    },
    ForecastSourceRegistry,
    ForecastOrchestrator,
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
    LeadScoringCalibration,
    // Phase 21 — exported so chat dispatcher / agent templates can
    // opt specific tenants in.
    LlmModelRunner,
    LlmFeatureFlagService,
    // Phase 26 — exported so the deals / chat surfaces can compose
    // the weighted forecast through the registry.
    DealPipelineSource,
    QuoteAggregateSource,
    ForecastSourceRegistry,
    ForecastOrchestrator,
  ],
})
export class AnalyticsModule {}
