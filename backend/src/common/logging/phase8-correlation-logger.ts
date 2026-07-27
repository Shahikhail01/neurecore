// src/common/logging/phase8-correlation-logger.ts
import { Injectable } from '@nestjs/common';
import { CorrelationLogger, LogLevel } from './correlation-logger.service';
import { CorrelationContext } from '../correlation/correlation.interface';

/**
 * Phase 8 — §10.3 Correlated Logging.
 *
 * The plan requires that every golden-path operation be searchable
 * by: Tenant ID, Correlation ID, Initiation ID, Project ID, Task ID,
 * Execution Attempt ID, Event/Job ID. This service extends the
 * `CorrelationLogger` to attach those identifiers as first-class
 * `searchableBy` keys while keeping the same log shape.
 */
export interface GoldenPathEntityIds {
  initiationId?: string;
  projectId?: string;
  goalId?: string;
  taskId?: string;
  assignmentId?: string;
  executionAttemptId?: string;
  reviewId?: string;
  outboxEventId?: string;
}

@Injectable()
export class Phase8CorrelationLogger {
  constructor(private readonly inner: CorrelationLogger) {}

  log(
    level: LogLevel,
    message: string,
    correlation: CorrelationContext,
    entityIds: GoldenPathEntityIds = {},
    extra?: Record<string, unknown>,
  ): void {
    this.inner.logWithCorrelation(level, message, correlation, {
      entityIds,
      searchableBy: [
        correlation.tenantId,
        correlation.correlationId,
        correlation.actorId,
        correlation.causationId ?? undefined,
        entityIds.initiationId,
        entityIds.projectId,
        entityIds.goalId,
        entityIds.taskId,
        entityIds.assignmentId,
        entityIds.executionAttemptId,
        entityIds.reviewId,
        entityIds.outboxEventId,
      ].filter((v): v is string => Boolean(v)),
      ...extra,
    });
  }
}
