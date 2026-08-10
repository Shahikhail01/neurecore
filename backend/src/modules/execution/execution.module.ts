// src/modules/execution/execution.module.ts
import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { PersistenceModule } from '../../common/persistence/persistence.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AiEmployeeCoreModule } from '../ai-employee-core/ai-employee-core.module';
import { ExecutionOrchestrator } from './application/execution-orchestrator';
import { ExecutionController } from './execution.controller';
import { ExecutionWorker } from './execution.worker';
import { OutboxWorker } from '../../common/outbox/outbox.worker';
import {
  EVENT_TRANSPORT,
  type IEnterpriseEventTransport,
} from '../enterprise-events/contracts/enterprise-event-transport.interface';
import type { EnterpriseEvent } from '../enterprise-events/contracts/enterprise-event.interface';
import { PrismaExecutionAttemptRepository } from './infrastructure/prisma-execution-attempt.repository';
import { EXECUTION_ATTEMPT_REPOSITORY } from './domain/ports/execution-attempt-repository.port';
import { PrismaEvidenceArtifactRepository } from './infrastructure/prisma-evidence-artifact.repository';
import { PiiRedactor } from './application/pii-redactor';
import { ExecutionPolicyEnforcer } from './application/execution-policy-enforcer';
import { ExecutionConcurrencyService } from './infrastructure/prisma-execution-concurrency.service';
import { ExecutionSweeper } from './infrastructure/execution.sweeper';

export const EXECUTION_CONSUMER_ID = 'execution-task-execution';

@Module({
  imports: [PersistenceModule, ReviewsModule, AiEmployeeCoreModule],
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
// FIX-OUTBOX-RACE: register BOTH:
//   1. Legacy OutboxWorker handler (kept for back-compat — events emitted
//      before the transport exists still get processed).
//   2. EnterpriseEventTransport consumer — this is the canonical path
//      for events emitted by ExecutionOrchestrator (which writes to the
//      shared outbox; the transport then dispatches them to per-consumer
//      inbox rows). Without the consumer registration, the events are
//      marked DISPATCHED but never executed — the entire autonomous path
//      was silently broken.
export class ExecutionModule implements OnModuleInit {
  constructor(
    private readonly outboxWorker: OutboxWorker,
    private readonly executionWorker: ExecutionWorker,
    @Inject(EVENT_TRANSPORT)
    private readonly transport: IEnterpriseEventTransport,
  ) {}

  onModuleInit() {
    // Back-compat: register on the OutboxWorker in case any caller bypasses
    // the transport and writes directly to the outbox (e.g. legacy paths).
    this.outboxWorker.registerHandler('TaskExecutionRequested', async (event) =>
      this.executionWorker.handleTaskExecutionRequested(event),
    );
    // Canonical path: the EnterpriseEventTransport fans events out to a
    // per-consumer inbox row. Register here so TaskExecutionRequested
    // reaches ExecutionWorker via the inbox.
    this.transport.registerConsumer({
      consumerId: EXECUTION_CONSUMER_ID,
      eventTypes: ['TaskExecutionRequested'],
      handler: (event: EnterpriseEvent) => this.handleInboxEvent(event),
    });
  }

  /**
   * Bridge between the inbox-payload shape and ExecutionWorker's
   * OutboxEventRecord shape. The transport's inbox payload contains the
   * same `taskId`/`attemptId`/`agentId` keys the worker expects.
   */
  private async handleInboxEvent(event: EnterpriseEvent): Promise<void> {
    const payload = (event.payload ?? {}) as {
      taskId?: string;
      attemptId?: string;
      agentId?: string;
      attemptNumber?: number;
    };
    if (!payload.taskId || !payload.attemptId) {
      this.executionWorker['logger']?.warn?.(
        `EXECUTION consumer received ${event.eventType} without taskId/attemptId — skipping`,
      );
      return;
    }
    // Reconstruct the OutboxEventRecord shape that handleTaskExecutionRequested expects.
    const fakeRecord = {
      id: event.eventId,
      tenantId: event.tenantId,
      eventType: event.eventType,
      version: event.version ?? 1,
      actorId: event.actorId ?? null,
      actorType: event.actorType,
      correlationId: event.correlationId,
      causationId: event.causationId ?? null,
      idempotencyKey: event.idempotencyKey,
      sourceModule: event.sourceModule,
      payload,
      status: 'PENDING' as const,
      retryCount: 0,
      lastError: null,
      lastErrorClassification: null,
      createdAt: event.timestamp ? new Date(event.timestamp) : new Date(),
      dispatchedAt: new Date(),
      processingStartedAt: null,
      processedAt: null,
      processingWorkerId: null,
      leaseExpiresAt: null,
      nextAttemptAt: null,
      processingCount: 0,
    };
    await this.executionWorker.handleTaskExecutionRequested(
      fakeRecord as unknown as Parameters<
        ExecutionWorker['handleTaskExecutionRequested']
      >[0],
    );
  }
}
