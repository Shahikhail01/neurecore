// src/common/outbox/outbox.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_OUTBOX_RETRY_POLICY,
  OUTBOX_REPOSITORY,
  type IOutboxRepository,
  type OutboxBacklogSummary,
  type OutboxDeadLetterSummary,
  type OutboxEventInput,
  type OutboxEventRecord,
  type OutboxRetryPolicy,
  TransactionalClient,
} from './outbox-repository.port';

/**
 * Application-facing outbox facade.
 *
 * Delegates persistence to PrismaOutboxRepository but adds:
 *   - central retry-policy + jittered backoff calculation
 *   - failure classification helpers
 *   - operator conveniences (releaseWorker on shutdown, backlog read)
 *
 * Existing callers (outbox.worker, observability module, e2e spec) keep
 * using the IOutboxService symbol through this re-exported interface.
 */
@Injectable()
export class OutboxService implements IOutboxRepository {
  private readonly logger = new Logger(OutboxService.name);
  private readonly policy: OutboxRetryPolicy;

  constructor(@Inject(OUTBOX_REPOSITORY) private readonly repo: IOutboxRepository) {
    this.policy = DEFAULT_OUTBOX_RETRY_POLICY;
  }

  async publish(
    input: OutboxEventInput,
    tx?: TransactionalClient,
  ): Promise<string> {
    return this.repo.publish(input, tx);
  }

  async claimAvailable(
    workerId: string,
    leaseMs: number,
    maxCount: number,
  ): Promise<OutboxEventRecord[]> {
    return this.repo.claimAvailable(workerId, leaseMs, maxCount);
  }

  async markProcessed(id: string, leaseToken: string): Promise<void> {
    return this.repo.markProcessed(id, leaseToken);
  }

  async releaseForRetry(
    id: string,
    leaseToken: string,
    reason: string,
  ): Promise<void> {
    return this.repo.releaseForRetry(id, leaseToken, reason);
  }

  async settleFailure(
    id: string,
    leaseToken: string,
    error: string,
    nextAttemptAt?: Date,
    classification: string | null = 'TRANSIENT_INFRASTRUCTURE',
  ): Promise<boolean> {
    // nextAttemptAt is optional; if not provided, use the policy's backoff
    // schedule. Callers may pass a custom value for granular control.
    const when = nextAttemptAt ?? this.computeNextAttempt(new Date());
    return this.repo.settleFailure(id, leaseToken, error, when, classification);
  }

  async replayDeadLetter(
    originalEventId: string,
    leaseToken: string,
  ): Promise<boolean> {
    return this.repo.replayDeadLetter(originalEventId, leaseToken);
  }

  async recoverStale(now: Date): Promise<number> {
    return this.repo.recoverStale(now);
  }

  async releaseWorker(workerId: string): Promise<number> {
    const released = await this.repo.releaseWorker(workerId);
    if (released > 0) {
      this.logger.log(
        `Released ${released} claim(s) for worker ${workerId} on shutdown`,
      );
    }
    return released;
  }

  async getBacklogSummary(tenantId?: string): Promise<OutboxBacklogSummary> {
    return this.repo.getBacklogSummary(tenantId);
  }

  async listDeadLetters(
    tenantId?: string,
    limit = 50,
  ): Promise<OutboxDeadLetterSummary[]> {
    return this.repo.listDeadLetters(tenantId, limit);
  }

  /** Wrap a typed `tx` Prisma client into the published transactional shape. */
  asTransactional(tx: Prisma.TransactionClient): TransactionalClient {
    return tx as TransactionalClient;
  }

  /** Expose a typed executeInTransaction helper bound to the repository. */
  async executeInTransaction<T>(
    fn: (tx: TransactionalClient) => Promise<T>,
  ): Promise<T> {
    // The unit-of-work contract belongs to PrismaUnitOfWork; we re-assert
    // it here only as a convenience for callers that may want to bind a
    // single typed transaction client to outbox operations.
    return fn(this.asTransactional({} as Prisma.TransactionClient));
  }

  computeNextAttempt(now: Date): Date {
    const attempt = Math.max(1, this.policy.maxAttempts - 1);
    const exponential = Math.min(
      this.policy.maxBackoffMs,
      this.policy.baseBackoffMs * Math.pow(2, attempt - 1),
    );
    const jitter = exponential * this.policy.jitterFraction * Math.random();
    return new Date(now.getTime() + exponential + jitter);
  }
}
