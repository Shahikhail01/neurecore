// src/modules/execution/execution.module.ts
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { PersistenceModule } from '../../common/persistence/persistence.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { ExecutionOrchestrator } from './application/execution-orchestrator';
import { ExecutionController } from './execution.controller';
import { ExecutionWorker } from './execution.worker';
import { OutboxWorker } from '../../common/outbox/outbox.worker';
import { PrismaExecutionAttemptRepository } from './infrastructure/prisma-execution-attempt.repository';
import { EXECUTION_ATTEMPT_REPOSITORY } from './domain/ports/execution-attempt-repository.port';
import { PrismaEvidenceArtifactRepository } from './infrastructure/prisma-evidence-artifact.repository';
import { PiiRedactor } from './application/pii-redactor';
import { ExecutionPolicyEnforcer } from './application/execution-policy-enforcer';
import { ExecutionConcurrencyService } from './infrastructure/prisma-execution-concurrency.service';
import { ExecutionSweeper } from './infrastructure/execution.sweeper';

@Module({
  imports: [PersistenceModule, ReviewsModule],
  controllers: [ExecutionController],
  providers: [
    ExecutionOrchestrator,
    ExecutionWorker,
    PrismaExecutionAttemptRepository,
    PrismaEvidenceArtifactRepository,
    PiiRedactor,
    ExecutionPolicyEnforcer,
    ExecutionConcurrencyService,
    ExecutionSweeper,
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
    this.outboxWorker.registerHandler('TaskExecutionRequested', async (event) =>
      this.executionWorker.handleTaskExecutionRequested(event),
    );
  }
}
