// src/modules/execution/execution.module.ts
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { PersistenceModule } from '../../common/persistence/persistence.module';
import { ExecutionOrchestrator } from './application/execution-orchestrator';
import { ExecutionController } from './execution.controller';
import { ExecutionWorker } from './execution.worker';
import { OutboxWorker } from '../../common/outbox/outbox.worker';
import { PrismaExecutionAttemptRepository } from './infrastructure/prisma-execution-attempt.repository';
import { EXECUTION_ATTEMPT_REPOSITORY } from './domain/ports/execution-attempt-repository.port';

@Module({
  imports: [PersistenceModule],
  controllers: [ExecutionController],
  providers: [
    ExecutionOrchestrator,
    ExecutionWorker,
    PrismaExecutionAttemptRepository,
    {
      provide: EXECUTION_ATTEMPT_REPOSITORY,
      useExisting: PrismaExecutionAttemptRepository,
    },
  ],
  exports: [ExecutionOrchestrator],
})
export class ExecutionModule implements OnApplicationBootstrap {
  constructor(
    private readonly outboxWorker: OutboxWorker,
    private readonly executionWorker: ExecutionWorker,
  ) {}

  onApplicationBootstrap() {
    this.outboxWorker.registerHandler(
      'TaskExecutionRequested',
      async (event) => this.executionWorker.handleTaskExecutionRequested(event),
    );
  }
}
