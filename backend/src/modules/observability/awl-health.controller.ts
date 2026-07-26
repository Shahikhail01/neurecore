// src/modules/observability/awl-health.controller.ts
import { Controller, Get } from '@nestjs/common';
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
    const outboxBacklog = await this.outbox.getBacklogSize();
    const circuitOpen = this.outboxWorker.isCircuitOpen();

    return {
      status: circuitOpen ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        outbox: {
          backlog: outboxBacklog,
          status: outboxBacklog < 1000 ? 'healthy' : 'backlogged',
        },
        circuit: {
          open: circuitOpen,
          status: circuitOpen ? 'open' : 'closed',
        },
        commands: {
          registered: this.commandRegistry.getRegisteredCount(),
        },
      },
    };
  }

  @Get('outbox')
  async getOutboxHealth() {
    const backlog = await this.outbox.getBacklogSize();
    return {
      backlog,
      status: backlog < 100 ? 'healthy' : backlog < 1000 ? 'warning' : 'critical',
      threshold: { warning: 100, critical: 1000 },
    };
  }
}
