// src/common/idempotency/idempotency.interface.ts
export interface IdempotencyCheckInput {
  tenantId: string;
  scope: string;
  idempotencyKey: string;
  requestHash: string;
}

export interface IdempotencyRecord {
  tenantId: string;
  scope: string;
  idempotencyKey: string;
  requestHash: string;
  status: 'RESERVED' | 'COMPLETED' | 'FAILED';
  resultType?: string;
  resultId?: string;
  resultData?: unknown;
  correlationId: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface IdempotencyCheckResult {
  existing: IdempotencyRecord | null;
  reserved: boolean;
}

export interface IdempotencyCompleteInput {
  tenantId: string;
  scope: string;
  idempotencyKey: string;
  resultData?: unknown;
  resultId?: string;
  correlationId: string;
}
