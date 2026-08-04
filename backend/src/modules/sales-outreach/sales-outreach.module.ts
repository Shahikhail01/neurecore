/**
 * Sales Outreach — Module.
 */

import { Module } from '@nestjs/common';
import { SalesOutreachOrchestrator } from './sales-outreach-orchestrator.service';
import { SalesOutreachController } from './sales-outreach.controller';

@Module({
  controllers: [SalesOutreachController],
  providers: [SalesOutreachOrchestrator],
  exports: [SalesOutreachOrchestrator],
})
export class SalesOutreachModule {}
