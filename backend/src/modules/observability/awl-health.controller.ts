// src/modules/observability/awl-health.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { Public } from '../../common/decorators/roles.decorator';
import { OutboxService } from '../../common/outbox/outbox.service';
import { OutboxWorker } from '../../common/outbox/outbox.worker';
import { CommandRegistry } from '../../common/commands/command.registry';

@Controller({ path: 'awl-health', version: '1' })
@ApiCommon('awl-health')
@Public()
export class AwlHealthController {
  constructor(
    private readonly outbox: OutboxService,
    private readonly outboxWorker: OutboxWorker,
    private readonly commandRegistry: CommandRegistry,
  ) {}

  @Get()
  async getHealth() {
    const summary = await this.outbox.getBacklogSummary();
    const deadLetters = await this.outbox.listDeadLetters(undefined, 10);
    const circuitOpen = this.outboxWorker.isCircuitOpen();

    return {
      status: circuitOpen || summary.deadLetter > 0 ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        outbox: {
          backlog: summary.pending,
          processing: summary.processing,
          processed: summary.processed,
          deadLetter: summary.deadLetter,
          oldestPendingAt: summary.oldestPendingAt,
          oldestStuckAt: summary.oldestStuckAt,
          workerId: this.outboxWorker.getWorkerId(),
          status:
            summary.pending < 1000 && summary.deadLetter === 0
              ? 'healthy'
              : 'backlogged',
        },
        circuit: {
          open: circuitOpen,
          status: circuitOpen ? 'open' : 'closed',
        },
        deadLetters: {
          count: deadLetters.length,
          recent: deadLetters.map((row) => ({
            eventId: row.originalEventId,
            eventType: row.eventType,
            tenantId: row.tenantId,
            retryCount: row.retryCount,
            lastError: row.lastError,
            createdAt: row.createdAt,
          })),
        },
        commands: {
          registered: this.commandRegistry.getRegisteredCount(),
        },
      },
    };
  }

  @Get('outbox')
  async getOutboxHealth(@Query('tenantId') tenantId?: string) {
    const summary = await this.outbox.getBacklogSummary(tenantId);
    return {
      backlog: summary,
      status:
        summary.pending < 100
          ? 'healthy'
          : summary.pending < 1000
            ? 'warning'
            : 'critical',
      threshold: { warning: 100, critical: 1000 },
    };
  }

  @Get('dead-letters')
  async getDeadLetters(@Query('tenantId') tenantId?: string) {
    const rows = await this.outbox.listDeadLetters(tenantId, 50);
    return {
      count: rows.length,
      rows,
    };
  }
}
