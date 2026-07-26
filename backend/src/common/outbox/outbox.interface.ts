// src/common/outbox/outbox.interface.ts
// Backwards-compatible re-export so legacy callers can keep using
// IOutboxService / OutboxEventInput / OutboxEventRecord symbols.
export type {
  IOutboxRepository as IOutboxService,
  OutboxEventInput,
  OutboxEventRecord,
  OutboxStatus,
  OutboxRetryPolicy,
  OutboxBacklogSummary,
  OutboxDeadLetterSummary,
} from './outbox-repository.port';
export { DEFAULT_OUTBOX_RETRY_POLICY } from './outbox-repository.port';
