// src/modules/execution/execution.controller.ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExecutionOrchestrator } from './application/execution-orchestrator';
import { CorrelationService } from '../../common/correlation/correlation.service';

@Controller('execution')
@UseGuards(JwtAuthGuard)
export class ExecutionController {
  constructor(
    private readonly orchestrator: ExecutionOrchestrator,
    private readonly correlation: CorrelationService,
  ) {}

  @Post('request')
  async requestExecution(
    @Body() body: { taskId: string; agentId: string; executionRequestId: string },
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    const context = this.correlation.createContext({
      tenantId: user.tenantId,
      actorId: user.id,
      actorType: 'HUMAN',
    });
    const metadata = this.correlation.buildMetadata(
      context,
      `request-execution:${body.taskId}:${body.executionRequestId}`,
    );

    return this.orchestrator.requestExecution(
      body.taskId,
      body.agentId,
      body.executionRequestId,
      metadata,
    );
  }

  @Post('cancel/:attemptId')
  async cancel(
    @Body() body: { attemptId: string },
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    const context = this.correlation.createContext({
      tenantId: user.tenantId,
      actorId: user.id,
      actorType: 'HUMAN',
    });
    const metadata = this.correlation.buildMetadata(
      context,
      `cancel-execution:${body.attemptId}`,
    );

    await this.orchestrator.cancel(body.attemptId, metadata);
    return { cancelled: true };
  }
}
