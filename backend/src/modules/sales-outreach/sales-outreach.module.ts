/**
 * Sales Outreach — Module.
 */

import { Module } from '@nestjs/common';
import { SalesOutreachOrchestrator } from './sales-outreach-orchestrator.service';
import { SalesOutreachController } from './sales-outreach.controller';
import { DealsController } from './deals/deals.controller';
import { DealsService } from './deals/deals.service';
import { DealRepository } from './deals/repositories/deal.repository';

@Module({
  controllers: [SalesOutreachController, DealsController],
  providers: [SalesOutreachOrchestrator, DealsService, DealRepository],
  exports: [SalesOutreachOrchestrator, DealsService, DealRepository],
})
export class SalesOutreachModule {}
