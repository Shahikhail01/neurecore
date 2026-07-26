// src/modules/observability/observability.module.ts
import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { AwlHealthController } from './awl-health.controller';
import { OutboxService } from '../../common/outbox/outbox.service';
import { OutboxWorker } from '../../common/outbox/outbox.worker';
import { CommandRegistry } from '../../common/commands/command.registry';
import { TelemetryService } from './services/telemetry.service';

@Module({
  controllers: [AwlHealthController],
  providers: [MetricsService, OutboxService, OutboxWorker, CommandRegistry, TelemetryService],
  exports: [MetricsService, TelemetryService],
})
export class ObservabilityModule {}
