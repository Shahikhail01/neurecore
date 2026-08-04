/**
 * Residency + Drift — Module.
 */

import { Module } from '@nestjs/common';
import { ResidencyService, DriftService } from './residency-drift.service';
import { ResidencyController } from './residency-drift.controller';

@Module({
  controllers: [ResidencyController],
  providers: [ResidencyService, DriftService],
  exports: [ResidencyService, DriftService],
})
export class ResidencyModule {}
