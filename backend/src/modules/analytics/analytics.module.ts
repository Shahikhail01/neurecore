import { Module } from '@nestjs/common';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { MaturityService } from './services/maturity.service';
import { NlReportService } from './services/nl-report.service';
import { PrismaFeatureStore } from './services/featureStore.prisma';
import { HttpModelRunner } from './services/modelRunner.http';
import { CsvExportService } from '../../shared/services/csv-export.service';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    MaturityService,
    NlReportService,
    PrismaFeatureStore,
    HttpModelRunner,
    CsvExportService,
  ],
  exports: [
    AnalyticsService,
    MaturityService,
    NlReportService,
    CsvExportService,
  ],
})
export class AnalyticsModule {}
