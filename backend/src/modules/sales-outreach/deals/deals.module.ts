/**
 * Deal — Module.
 *
 * SRP: this module mounts the Deals REST surface + provides
 * DealsService for downstream modules (chat, hermes) that need to
 * compute `nc.forecast_pipeline` aggregations.
 *
 * Dependency inversion: DealsService depends on the abstraction
 * DealRepository; the Prisma client is held by the repository only.
 */

import { Module } from '@nestjs/common';
import { DealRepository } from './repositories/deal.repository';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';

@Module({
  controllers: [DealsController],
  providers: [DealRepository, DealsService],
  exports: [DealsService, DealRepository],
})
export class DealsModule {}
