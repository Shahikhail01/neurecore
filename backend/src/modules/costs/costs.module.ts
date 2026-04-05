import { Module } from '@nestjs/common';
import { CostsController } from './costs.controller';
import { CostsService } from './services/costs.service';
import { LangSmithCostProvider } from './providers/langsmith-cost-provider';
import { PrismaCostRecordRepository } from './repositories/prisma-cost.repository';
import {
  PrismaBudgetPolicyRepository,
  PrismaBudgetIncidentRepository,
} from './repositories/prisma-budget.repository';
import { AgentsModule } from '../agents/agents.module';
import { CsvExportService } from '../../shared/services/csv-export.service';

@Module({
  imports: [AgentsModule],
  controllers: [CostsController],
  providers: [
    CostsService,
    LangSmithCostProvider,
    PrismaCostRecordRepository,
    PrismaBudgetPolicyRepository,
    PrismaBudgetIncidentRepository,
    CsvExportService,
  ],
  exports: [CostsService, CsvExportService],
})
export class CostsModule {}
