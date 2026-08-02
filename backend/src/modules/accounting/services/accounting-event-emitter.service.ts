/**
 * AccountingEventEmitterService — emits Accounting.* events to the outbox
 * in the same Prisma transaction as the ledger write.
 *
 * Plan ref: NC-ACCT-IMP-1 §5, §6.
 *
 * Critical invariant: the outbox row MUST be written in the same DB
 * transaction as the ledger rows. If the tx is not passed, we throw —
 * we never silently drop the atomicity guarantee.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { randomUUID } from 'crypto';

export const ACCOUNTING_EVENT_TYPES = {
  POSTING_RECORDED: 'Accounting.PostingRecorded',
  PERIOD_OPENED: 'Accounting.PeriodOpened',
  PERIOD_CLOSED: 'Accounting.PeriodClosed',
  PERIOD_LOCKED: 'Accounting.PeriodLocked',
  ACCOUNT_CREATED: 'Accounting.AccountCreated',
  ACCOUNT_DEACTIVATED: 'Accounting.AccountDeactivated',
  REPORT_GENERATED: 'Accounting.ReportGenerated',
  FINDING_RECORDED: 'Accounting.FindingRecorded',
} as const;

export type AccountingEventType = typeof ACCOUNTING_EVENT_TYPES[keyof typeof ACCOUNTING_EVENT_TYPES];

@Injectable()
export class AccountingEventEmitterService {
  private readonly logger = new Logger(AccountingEventEmitterService.name);
  private readonly sourceModule = 'accounting';

  constructor(private readonly outbox: OutboxService) {}

  /**
   * Emit an Accounting.* event in the same transaction as the caller.
   * Throws if no transaction is provided.
   */
  async emit(
    input: {
      tenantId: string;
      eventType: AccountingEventType;
      actorId: string;
      actorType?: 'USER' | 'SYSTEM' | 'AGENT';
      correlationId?: string;
      causationId?: string | null;
      payload: Record<string, unknown>;
      // Deterministic idempotency key — caller should derive from input.
      // We fall back to a UUID only if the caller has no better source.
      idempotencyKey?: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    if (!tx) {
      throw new Error(
        'AccountingEventEmitterService.emit requires a Prisma transaction; ' +
        'atomicity between ledger write and outbox row is mandatory.',
      );
    }
    const idemKey = input.idempotencyKey ?? `${input.eventType}-${randomUUID()}`;
    return this.outbox.publish(
      {
        tenantId: input.tenantId,
        eventType: input.eventType,
        sourceModule: this.sourceModule,
        correlationId: input.correlationId ?? randomUUID(),
        causationId: input.causationId ?? null,
        idempotencyKey: idemKey,
        actorId: input.actorId,
        actorType: input.actorType ?? 'USER',
        payload: input.payload,
      },
      tx,
    );
  }
}