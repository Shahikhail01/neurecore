import { Module } from '@nestjs/common';
import { HarnessControlController } from './harness-control.controller';
import { HarnessControlService } from './harness-control.service';

@Module({
  controllers: [HarnessControlController],
  providers: [HarnessControlService],
})
export class HarnessControlModule {}
