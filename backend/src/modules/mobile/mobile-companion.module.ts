/**
 * Mobile Companion — Module.
 */

import { Module } from '@nestjs/common';
import { MobileCompanionService } from './mobile-companion.service';
import { MobileCompanionController } from './mobile-companion.controller';

@Module({
  controllers: [MobileCompanionController],
  providers: [MobileCompanionService],
  exports: [MobileCompanionService],
})
export class MobileCompanionModule {}
