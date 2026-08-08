/**
 * Mobile Controller — Phase 28 (P28) — CR-AI-1107.
 *
 * Wires the mobile companion + the support-matrix controller so
 * the FE has both surfaces available.
 */
import { Module } from '@nestjs/common';
import { MobileCompanionService } from './mobile-companion.service';
import { MobileCompanionController } from './mobile-companion.controller';
import { MobileSupportMatrixController } from './mobile-support-matrix.controller';

@Module({
  controllers: [MobileCompanionController, MobileSupportMatrixController],
  providers: [MobileCompanionService],
  exports: [MobileCompanionService],
})
export class MobileCompanionModule {}
