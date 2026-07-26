// src/modules/assignments/assignments.module.ts
import { Module } from '@nestjs/common';
import { AssignmentService } from './application/assignment.service';
import { AssignmentController } from './assignment.controller';
import { PrismaAgentRepository } from './infrastructure/prisma-agent.repository';
import { PrismaTaskAssignmentRepository } from './infrastructure/prisma-task-assignment.repository';
import { PrismaTaskRepository } from '../../common/persistence/prisma-task.repository';
import { AGENT_REPOSITORY } from './domain/ports/agent-repository.port';
import { TASK_ASSIGNMENT_REPOSITORY } from './domain/ports/task-assignment-repository.port';
import { TASK_REPOSITORY } from '../../common/ports/task-repository.port';

@Module({
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
export class AssignmentsModule {}
