// src/modules/assignments/assignment.controller.ts
import { Body, Controller, Get, Param, Post, UseGuards, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssignmentService } from './application/assignment.service';
import type { ITaskRepository } from '../../common/ports/task-repository.port';
import { TASK_REPOSITORY } from '../../common/ports/task-repository.port';

@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentController {
  constructor(
    private readonly service: AssignmentService,
    @Inject(TASK_REPOSITORY) private readonly taskRepo: ITaskRepository,
  ) {}

  @Get('eligible-agents/:taskId')
  async findEligible(
    @Param('taskId') taskId: string,
    @CurrentUser() user: { tenantId: string },
  ) {
    const task = await this.taskRepo.findById(user.tenantId, taskId);
    if (!task) {
      throw new Error('TASK_NOT_FOUND');
    }
    return this.service.findEligibleAgents({
      tenantId: user.tenantId,
      taskId,
      requiredRole: '',
      requiredCapabilities: [],
    });
  }

  @Post('assign')
  async assign(
    @Body() body: {
      taskId: string;
      agentId: string;
      assignmentGeneration: number;
      rationale: string;
    },
    @CurrentUser() user: { tenantId: string },
  ) {
    return this.service.assignTask(
      body.taskId,
      body.agentId,
      body.assignmentGeneration,
      body.rationale,
      user.tenantId,
    );
  }
}
