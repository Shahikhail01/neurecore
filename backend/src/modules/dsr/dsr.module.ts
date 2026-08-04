/**
 * DSR (Data Subject Request) — Module.
 */

import { Module } from '@nestjs/common';
import { DsrService } from './dsr.service';
import { DsrController } from './dsr.controller';

@Module({
  controllers: [DsrController],
  providers: [DsrService],
  exports: [DsrService],
})
export class DsrModule {}
