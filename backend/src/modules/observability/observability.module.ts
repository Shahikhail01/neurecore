// src/modules/observability/observability.module.ts
import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { AwlHealthController } from './awl-health.controller';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './services/observability.service';
import { OutboxService } from '../../common/outbox/outbox.service';
import { OutboxWorker } from '../../common/outbox/outbox.worker';
import { CommandRegistry } from '../../common/commands/command.registry';
import { TelemetryService } from './services/telemetry.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Module({
  controllers: [AwlHealthController, ObservabilityController],
  providers: [
    MetricsService,
    ObservabilityService,
    OutboxService,
    OutboxWorker,
    CommandRegistry,
    TelemetryService,
    PrismaService,
  ],
  exports: [MetricsService, ObservabilityService, TelemetryService],
})
export class ObservabilityModule {}
