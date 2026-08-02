import { Module } from '@nestjs/common';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { PrismaFeatureStore } from './services/featureStore.prisma';
import { HttpModelRunner } from './services/modelRunner.http';
import { FeatureSnapshotRepository } from './services/featureSnapshot.repository';
import { CalibratedAnalyticsProvider } from './providers/calibrated.provider';
import { PredictionService } from './services/prediction.service';
import { RecommendationService } from './services/recommendation.service';
import { WorkRuntimeModule } from '../work-runtime/work-runtime.module';
import { IModelRunner, MODEL_RUNNER } from './interfaces/IAnalyticsProvider';

/**
 * AnalyticsModule — Phase 5
 *
 * Registers the full analytics stack:
 *   - PrismaFeatureStore + HttpModelRunner (Phase 4.1, retained)
 *   - FeatureSnapshotRepository (Phase 5, new — tenant-isolated snapshots)
 *   - CalibratedAnalyticsProvider (Phase 5, replaces DummyAnalyticsProvider)
 *   - PredictionService (Phase 5, abstain-aware)
 *   - RecommendationService (Phase 5, ranks + WorkRuntime handoff)
 */
@Module({
  imports: [WorkRuntimeModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    PrismaFeatureStore,
    HttpModelRunner,
    { provide: MODEL_RUNNER, useExisting: HttpModelRunner },
    FeatureSnapshotRepository,
    CalibratedAnalyticsProvider,
    PredictionService,
    RecommendationService,
  ],
  exports: [
    AnalyticsService,
    FeatureSnapshotRepository,
    CalibratedAnalyticsProvider,
    PredictionService,
    RecommendationService,
  ],
})
export class AnalyticsModule {}
