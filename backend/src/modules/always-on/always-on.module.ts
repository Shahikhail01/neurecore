/**
 * Always-on CRM — Module.
 */

import { Module } from '@nestjs/common';
import { AlwaysOnService } from './always-on.service';
import { AlwaysOnController } from './always-on.controller';

@Module({
  controllers: [AlwaysOnController],
  providers: [AlwaysOnService],
  exports: [AlwaysOnService],
})
export class AlwaysOnModule {}
