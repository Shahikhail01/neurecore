// src/common/idempotency/command-idempotency.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import type {
  IIdempotencyRepository,
  IdempotencyCheckInput,
  IdempotencyCheckResult,
  IdempotencyCompleteInput,
} from './idempotency-repository.port';
import { IDEMPOTENCY_REPOSITORY } from '../ports/di-tokens';

/**
 * CommandIdempotencyService — application-facing wrapper around the
 * idempotency repository port.
 *
 * Separates three classes of state per NC-AWL-IMP-1 §3.3 (corrected):
 *
 *   1. Business idempotency key (durable):
 *      - Persists indefinitely
 *      - expiresAt = NULL
 *      - Database unique constraint is permanently authoritative
 *   2. Worker lease (transient):
 *      - See OutboxService
 *      - expires in seconds/minutes
 *   3. Cached response body:
 *      - Tied to durable record
 *      - May be retention-policy-evicted without losing durable reference
 *
 * This service never sets expiresAt; the repository enforces the
 * no-expiry semantics. The expiresAt column in the database is
 * reserved for transient coordination records (separate table).
 */
@Injectable()
export class CommandIdempotencyService {
  private readonly logger = new Logger(CommandIdempotencyService.name);

  constructor(@Inject(IDEMPOTENCY_REPOSITORY) private readonly repo: IIdempotencyRepository) {}

  async checkAndReserve(input: IdempotencyCheckInput): Promise<IdempotencyCheckResult> {
    return this.repo.checkAndReserve(input);
  }

  async complete(input: IdempotencyCompleteInput): Promise<void> {
    return this.repo.complete(input);
  }

  async fail(
    tenantId: string,
    scope: string,
    idempotencyKey: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void> {
    return this.repo.fail(tenantId, scope, idempotencyKey, errorCode, errorMessage);
  }

  async purgeOldFailedRecords(olderThanDays: number): Promise<number> {
    return this.repo.purgeOldFailedRecords(olderThanDays);
  }
}
