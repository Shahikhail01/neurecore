/**
 * AccountingPeriodService — period lifecycle (open/close/lock).
 *
 * Plan ref: NC-ACCT-IMP-1 §5.
 *
 * Lifecycle:
 *   OPEN  → CLOSING → CLOSED → LOCKED
 *
 * Rules:
 *   - Period codes are unique per tenant (e.g. "2027-Q1", "2027-01").
 *   - Once CLOSED, no further journal entries can be posted to it.
 *   - LOCKED is irreversible: it's the audit-state for a closed year.
 *   - Only the user who closed/locked the period can re-open it (admin
 *     override is out of scope here — handled via platform ops).
 */

import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { AccountingPeriodStatus, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface CreatePeriodInput {
  tenantId: string;
  code: string;
  name: string;
  startDate: Date;
  endDate: Date;
  fiscalYear: number;
}

@Injectable()
export class AccountingPeriodService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreatePeriodInput, tx?: Prisma.TransactionClient | PrismaClient) {
    const client = (tx ?? this.prisma) as Prisma.TransactionClient | PrismaClient;
    if (input.endDate <= input.startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }
    if (!/^[0-9A-Za-z_-]{1,32}$/.test(input.code)) {
      throw new BadRequestException(`Period code must match /^[0-9A-Za-z_-]{1,32}$/, got: ${input.code}`);
    }
    try {
      return await client.accountingPeriod.create({
        data: {
          tenantId: input.tenantId,
          code: input.code,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          fiscalYear: input.fiscalYear,
          status: AccountingPeriodStatus.OPEN,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          `Period code ${input.code} already exists for this tenant`,
        );
      }
      throw e;
    }
  }

  async findById(tenantId: string, id: string) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id, tenantId },
    });
    if (!period) {
      throw new NotFoundException(`Period ${id} not found for tenant ${tenantId}`);
    }
    return period;
  }

  async list(tenantId: string, opts?: { fiscalYear?: number; status?: AccountingPeriodStatus }) {
    return this.prisma.accountingPeriod.findMany({
      where: {
        tenantId,
        ...(opts?.fiscalYear !== undefined ? { fiscalYear: opts.fiscalYear } : {}),
        ...(opts?.status ? { status: opts.status } : {}),
      },
      orderBy: [{ fiscalYear: 'asc' }, { startDate: 'asc' }],
    });
  }

  async transition(
    tenantId: string,
    id: string,
    to: AccountingPeriodStatus,
    actorId: string,
  ) {
    const period = await this.findById(tenantId, id);
    const from = period.status;

    // Allowed transitions
    const valid: Record<AccountingPeriodStatus, AccountingPeriodStatus[]> = {
      [AccountingPeriodStatus.OPEN]: [AccountingPeriodStatus.CLOSING],
      [AccountingPeriodStatus.CLOSING]: [AccountingPeriodStatus.CLOSED, AccountingPeriodStatus.OPEN],
      [AccountingPeriodStatus.CLOSED]: [AccountingPeriodStatus.LOCKED, AccountingPeriodStatus.CLOSING],
      [AccountingPeriodStatus.LOCKED]: [],
    };
    if (!valid[from].includes(to)) {
      throw new BadRequestException(`Invalid period transition: ${from} → ${to}`);
    }

    return this.prisma.accountingPeriod.update({
      where: { id },
      data: {
        status: to,
        ...(to === AccountingPeriodStatus.CLOSED ? { closedAt: new Date(), closedById: actorId } : {}),
        ...(to === AccountingPeriodStatus.LOCKED ? { lockedAt: new Date(), lockedById: actorId } : {}),
      },
    });
  }

  /**
   * Returns true if a journal entry may be posted to the given period.
   * OPEN and CLOSING both accept postings; CLOSED and LOCKED do not.
   */
  async isPostable(tenantId: string, periodId: string): Promise<boolean> {
    const period = await this.findById(tenantId, periodId);
    return (
      period.status === AccountingPeriodStatus.OPEN ||
      period.status === AccountingPeriodStatus.CLOSING
    );
  }
}