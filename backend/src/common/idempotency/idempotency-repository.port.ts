// src/common/idempotency/idempotency-repository.port.ts
export interface IdempotencyCheckInput {
  tenantId: string;
  scope: string;
  idempotencyKey: string;
  requestHash: string;
}

export interface IdempotencyCheckResult {
  existing: any | null;
  reserved: boolean;
  replayed: boolean;
}

export interface IdempotencyCompleteInput {
  tenantId: string;
  scope: string;
  idempotencyKey: string;
  resultData?: unknown;
  resultId?: string;
  resultEntityType?: string;
  resultEntityId?: string;
  correlationId: string;
  responseStatus?: number;
}

/**
 * Port for command idempotency persistence.
 *
 * Durable business records (status=COMPLETED) MUST persist indefinitely
 * to honor "no automatic expiry" requirement. Transient coordination
 * (status=IN_FLIGHT) may use expiresAt for stale lock cleanup.
 *
 * The `responseBody` (cached response) may be evicted under a retention
 * policy while preserving `resultEntityId` (durable business reference).
 */
export interface IIdempotencyRepository {
  checkAndReserve(input: IdempotencyCheckInput): Promise<IdempotencyCheckResult>;
  complete(input: IdempotencyCompleteInput): Promise<void>;
  fail(
    tenantId: string,
    scope: string,
    idempotencyKey: string,
    errorCode: string,
    errorMessage: string,
  ): Promise<void>;
  purgeOldFailedRecords(olderThanDays: number): Promise<number>;
}
