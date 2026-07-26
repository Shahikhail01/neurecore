// src/modules/observability/observability.module.ts
import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { AwlHealthController } from './awl-health.controller';
import { OutboxService } from '../../common/outbox/outbox.service';
import { OutboxWorker } from '../../common/outbox/outbox.worker';
import { CommandRegistry } from '../../common/commands/command.registry';

@Module({
  controllers: [AwlHealthController],
  providers: [MetricsService, OutboxService, OutboxWorker, CommandRegistry],
  exports: [MetricsService],
})
export class ObservabilityModule {}
