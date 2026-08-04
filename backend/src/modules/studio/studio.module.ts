/**
 * Business Studio — Module.
 *
 * Phase 5 of the Creatio AI parity program. Source plan: §5.13.
 */

import { Module } from '@nestjs/common';
import { StudioService } from './studio.service';
import { StudioController } from './studio.controller';

@Module({
  controllers: [StudioController],
  providers: [StudioService],
  exports: [StudioService],
})
export class StudioModule {}
