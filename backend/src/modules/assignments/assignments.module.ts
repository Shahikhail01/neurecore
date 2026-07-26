// src/modules/assignments/assignments.module.ts
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { AssignmentService } from './application/assignment.service';
import { AssignmentController } from './assignment.controller';
import { PrismaAgentRepository } from './infrastructure/prisma-agent.repository';
import { PrismaTaskAssignmentRepository } from './infrastructure/prisma-task-assignment.repository';
import { PrismaTaskRepository } from '../../common/persistence/prisma-task.repository';
import { AGENT_REPOSITORY } from './domain/ports/agent-repository.port';
import { TASK_ASSIGNMENT_REPOSITORY } from './domain/ports/task-assignment-repository.port';
import { TASK_REPOSITORY } from '../../common/ports/task-repository.port';
import { CommandRegistry } from '../../common/commands/command.registry';
import { PersistenceModule } from '../../common/persistence/persistence.module';
import { CommandModule } from '../../common/commands/command.module';
import { TenantFlagsModule } from '../tenant-flags/tenant-flags.module';
import {
  ASSIGN_TASK_COMMAND,
  ASSIGN_TASK_VERSION,
} from './commands/assign-task.command';
import {
  RELEASE_ASSIGNMENT_COMMAND,
  RELEASE_ASSIGNMENT_VERSION,
} from './commands/release-assignment.command';

@Module({
  imports: [PersistenceModule, CommandModule, TenantFlagsModule],
  controllers: [AssignmentController],
  providers: [
    AssignmentService,
    PrismaAgentRepository,
    PrismaTaskAssignmentRepository,
    PrismaTaskRepository,
    { provide: AGENT_REPOSITORY, useExisting: PrismaAgentRepository },
    {
      provide: TASK_ASSIGNMENT_REPOSITORY,
      useExisting: PrismaTaskAssignmentRepository,
    },
    { provide: TASK_REPOSITORY, useExisting: PrismaTaskRepository },
  ],
  exports: [AssignmentService],
})
export class AssignmentsModule implements OnApplicationBootstrap {
  constructor(
    private readonly commandRegistry: CommandRegistry,
    private readonly assignmentService: AssignmentService,
  ) {}

  onApplicationBootstrap() {
    this.commandRegistry.register({
      commandType: ASSIGN_TASK_COMMAND,
      version: ASSIGN_TASK_VERSION,
      handler: (input, metadata) =>
        this.assignmentService.executeAssign(input, metadata),
      buildIdempotencyKey: (input: any) =>
        `assign-task:${input.tenantId}:${input.taskId}:${input.agentId ?? 'auto'}:${input.expiresInSeconds ?? 'default'}`,
      buildRequestHash: (input: any) => JSON.stringify(input),
    });

    this.commandRegistry.register({
      commandType: RELEASE_ASSIGNMENT_COMMAND,
      version: RELEASE_ASSIGNMENT_VERSION,
      handler: (input, metadata) =>
        this.assignmentService.executeRelease(input, metadata),
      buildIdempotencyKey: (input: any) =>
        `release-assignment:${input.tenantId}:${input.taskId}:${input.reason}`,
      buildRequestHash: (input: any) => JSON.stringify(input),
    });
  }
}