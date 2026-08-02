/**
 * LedgerRepositoryService — owns all writes to journal entries and postings.
 *
 * Plan ref: NC-ACCT-IMP-1 §5.
 *
 * **Critical invariant:** Every journal entry write is a single Prisma
 * transaction that:
 *   1. Inserts the JournalEntry header row.
 *   2. Inserts the AccountingRecord rows (must balance: sum debits = sum credits).
 *   3. Emits `Accounting.PostingRecorded` via the outbox (same tx).
 *
 * If the tx fails, all three steps roll back atomically.
 *
 * The Beancount snapshot regeneration is NOT done here — it is a background
 * job (Phase 1k) that reads from the DB after commit. Snapshot staleness
 * during a commit is acceptable; snapshot divergence from DB is not.
 */

import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { AccountingPeriodService } from './accounting-period.service';
import { AccountingEventEmitterService, ACCOUNTING_EVENT_TYPES } from './accounting-event-emitter.service';
import { HttpAccountingSidecarClient } from '../infrastructure/http-accounting-sidecar.client';
import { BeancountSnapshotService } from './beancount-snapshot.service';
import { randomUUID } from 'crypto';

export interface PostingInput {
  accountCode: string;
  amount: string;       // Decimal as string (Postgres precision)
  currency: string;
  postingType: 'DEBIT' | 'CREDIT';
  counterparty?: string;
  narration?: string;
  fxRate?: string;      // optional, multi-currency
  baseCurrency?: string;
  baseAmount?: string;
}

export interface CreateJournalEntryInput {
  tenantId: string;
  postingUserId: string;
  periodId: string;
  txnDate: Date;
  narration: string;
  source?: string;        // 'manual' | 'nc.accounting.post_ledger' | 'scenario:N'
  postings: PostingInput[];
  approvalId?: string;    // pre-created approval id (from the guard)
  approvedById?: string;
  approvedAt?: Date;
}

const TOLERANCE = new Prisma.Decimal('0.005');

@Injectable()
export class LedgerRepositoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coa: ChartOfAccountsService,
    private readonly periods: AccountingPeriodService,
    private readonly events: AccountingEventEmitterService,
    private readonly sidecar: HttpAccountingSidecarClient,
    @Optional() private readonly snapshot?: BeancountSnapshotService,
  ) {}

  /**
   * Create a journal entry with postings, outbox event, and (on commit) Beancount
   * snapshot regeneration (Phase 1k). All atomic.
   */
  async createJournalEntry(input: CreateJournalEntryInput): Promise<{ journalEntryId: string; outboxEventId: string }> {
    if (!input.postings || input.postings.length < 2) {
      throw new BadRequestException('A journal entry requires at least 2 postings');
    }

    // Defense in depth: re-check SoD at the application layer too.
    if (input.approvedById && input.approvedById === input.postingUserId) {
      throw new BadRequestException(
        'Segregation of duties: approver cannot equal poster',
      );
    }

    // Period must be postable.
    const isPostable = await this.periods.isPostable(input.tenantId, input.periodId);
    if (!isPostable) {
      throw new BadRequestException(
        `Period ${input.periodId} is not in OPEN or CLOSING state`,
      );
    }

    // Resolve account codes to IDs.
    const codes = input.postings.map((p) => p.accountCode);
    const accountMap = await this.coa.resolveLeafAccountIds(input.tenantId, codes);
    const missing = codes.filter((c) => !accountMap.has(c));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown or non-leaf accounts: ${missing.join(', ')}`,
      );
    }

    // Validate double-entry: sum of debits = sum of credits.
    const totalDebit = input.postings
      .filter((p) => p.postingType === 'DEBIT')
      .reduce((s, p) => s.add(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0));
    const totalCredit = input.postings
      .filter((p) => p.postingType === 'CREDIT')
      .reduce((s, p) => s.add(new Prisma.Decimal(p.amount)), new Prisma.Decimal(0));
    if (totalDebit.minus(totalCredit).abs().gt(TOLERANCE)) {
      throw new BadRequestException(
        `Unbalanced entry: debits=${totalDebit.toString()} credits=${totalCredit.toString()}`,
      );
    }

    // All currencies must match (single-currency entries).
    const currencies = new Set(input.postings.map((p) => p.currency));
    if (currencies.size > 1) {
      throw new BadRequestException(
        `Mixed-currency entries are not supported in Phase 1: ${[...currencies].join(', ')}. ` +
        'Multi-currency requires a follow-up plan.',
      );
    }

    const txnId = `txn_${randomUUID()}`;
    const idempotencyKey = `${input.tenantId}-${txnId}`;

    // Single transaction: JournalEntry + records + outbox event.
    const result = await this.prisma.$transaction(async (tx) => {
      const je = await tx.journalEntry.create({
        data: {
          tenantId: input.tenantId,
          periodId: input.periodId,
          txnId,
          txnDate: input.txnDate,
          narration: input.narration,
          source: input.source ?? 'manual',
          postingUserId: input.postingUserId,
          approvalId: input.approvalId ?? null,
          approvedById: input.approvedById ?? null,
          approvedAt: input.approvedAt ?? null,
          totalDebit,
          totalCredit,
          baseCurrency: [...currencies][0] ?? 'USD',
        },
      });

      await tx.accountingRecord.createMany({
        data: input.postings.map((p) => ({
          tenantId: input.tenantId,
          journalEntryId: je.id,
          accountId: accountMap.get(p.accountCode)!,
          amount: p.amount,
          currency: p.currency,
          fxRate: p.fxRate ?? null,
          baseCurrency: p.baseCurrency ?? null,
          baseAmount: p.baseAmount ?? null,
          postingType: p.postingType,
          counterparty: p.counterparty ?? null,
          narration: p.narration ?? null,
        })),
      });

      const outboxEventId = await this.events.emit(
        {
          tenantId: input.tenantId,
          eventType: ACCOUNTING_EVENT_TYPES.POSTING_RECORDED,
          actorId: input.approvedById ?? input.postingUserId,
          actorType: 'USER',
          correlationId: idempotencyKey,
          causationId: input.approvalId ?? null,
          idempotencyKey,
          payload: {
            journalEntryId: je.id,
            txnId,
            txnDate: input.txnDate.toISOString(),
            totalDebit: totalDebit.toString(),
            totalCredit: totalCredit.toString(),
            postingCount: input.postings.length,
          },
        },
        tx,
      );

      return { journalEntryId: je.id, outboxEventId };
    });

    // After DB commit: enqueue snapshot regen (coalesced, ≤1 Hz per tenant).
    // If the snapshot service is not wired (e.g. local dev without the
    // filesystem mount), we silently skip.
    if (this.snapshot) {
      this.snapshot.enqueue(input.tenantId);
    }

    return result;
  }

  async findJournalEntry(tenantId: string, id: string) {
    const je = await this.prisma.journalEntry.findFirst({
      where: { id, tenantId },
      include: { postings: true },
    });
    if (!je) {
      throw new NotFoundException(`Journal entry ${id} not found for tenant ${tenantId}`);
    }
    return je;
  }

  async listJournalEntries(
    tenantId: string,
    opts?: { periodId?: string; fromDate?: Date; toDate?: Date; limit?: number; offset?: number },
  ) {
    const limit = Math.min(opts?.limit ?? 50, 200);
    const offset = opts?.offset ?? 0;
    return this.prisma.journalEntry.findMany({
      where: {
        tenantId,
        ...(opts?.periodId ? { periodId: opts.periodId } : {}),
        ...(opts?.fromDate || opts?.toDate
          ? {
              txnDate: {
                ...(opts?.fromDate ? { gte: opts.fromDate } : {}),
                ...(opts?.toDate ? { lte: opts.toDate } : {}),
              },
            }
          : {}),
      },
      include: { postings: true },
      orderBy: [{ txnDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get the balance of one account as of `asOf` (inclusive).
   * Used by `nc.accounting.get_account_balance`.
   */
  async getAccountBalance(tenantId: string, accountCode: string, asOf?: Date): Promise<{ balance: string; currency: string }> {
    const account = await this.coa.findByCode(tenantId, accountCode);
    if (!account) {
      throw new NotFoundException(`Account ${accountCode} not found`);
    }
    const where: Prisma.AccountingRecordWhereInput = {
      tenantId,
      accountId: account.id,
      ...(asOf ? { journalEntry: { txnDate: { lte: asOf } } } : {}),
    };
    const agg = await this.prisma.accountingRecord.aggregate({
      where,
      _sum: { amount: true },
    });
    return {
      balance: (agg._sum.amount ?? new Prisma.Decimal(0)).toString(),
      currency: account.currency,
    };
  }

  /**
   * Generate the tenant's beancount text from current DB state.
   * Used by `nc.accounting.export_beancount`.
   *
   * Format (per NC-ACCT-IMP-1 §5):
   *   YYYY-MM-DD open Account:Name CURRENCY
   *   YYYY-MM-DD txn "narration"
   *     Account:Name   AMOUNT CURRENCY
   *     CounterAccount -AMOUNT CURRENCY
   */
  async exportBeancount(tenantId: string, asOf?: Date): Promise<string> {
    const accounts = await this.coa.list(tenantId, { isActive: true });
    const lines: string[] = [];
    for (const a of accounts) {
      lines.push(`${a.createdAt.toISOString().slice(0, 10)} open ${a.code} ${a.currency}`);
    }
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        tenantId,
        ...(asOf ? { txnDate: { lte: asOf } } : {}),
      },
      include: { postings: { include: { account: true } } },
      orderBy: [{ txnDate: 'asc' }, { createdAt: 'asc' }],
    });
    for (const je of entries) {
      const dateStr = je.txnDate.toISOString().slice(0, 10);
      lines.push(`${dateStr} * "${escapeBeancountString(je.narration)}"`);
      for (const p of je.postings) {
        const amt = p.postingType === 'CREDIT' ? `-${p.amount.toString()}` : p.amount.toString();
        lines.push(`  ${p.account.code}  ${amt} ${p.currency}`);
      }
    }
    return lines.join('\n') + '\n';
  }
}

function escapeBeancountString(s: string): string {
  // Beancount uses "..." for narration; escape embedded quotes.
  return s.replace(/"/g, '\\"');
}