/**
 * ChartOfAccountsService — tenant-scoped COA CRUD.
 *
 * Plan ref: NC-ACCT-IMP-1 §5.
 *
 * Invariants enforced:
 *   - Account code is unique within a tenant.
 *   - Only leaf accounts (isLeaf=true) can accept postings (called from
 *     LedgerRepositoryService).
 *   - Parent must exist and be of the same `type` (Asset/Asset, etc.).
 *   - Deactivating an account with non-zero balance is rejected.
 */

import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, AccountType, AccountNormalBalance, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface CreateAccountInput {
  tenantId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: AccountNormalBalance;
  parentId?: string | null;
  currency?: string;
  isLeaf?: boolean;
  description?: string;
}

export interface UpdateAccountInput {
  name?: string;
  isActive?: boolean;
  description?: string;
}

@Injectable()
export class ChartOfAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAccountInput, tx?: Prisma.TransactionClient | PrismaClient) {
    const client = (tx ?? this.prisma) as Prisma.TransactionClient | PrismaClient;

    // Validate code format: digits + dashes, 1..32 chars.
    if (!/^[0-9A-Za-z_-]{1,32}$/.test(input.code)) {
      throw new BadRequestException(
        `Account code must match /^[0-9A-Za-z_-]{1,32}$/, got: ${input.code}`,
      );
    }

    // Validate parent (if provided): same tenant, same type.
    if (input.parentId) {
      const parent = await client.chartOfAccount.findFirst({
        where: { id: input.parentId, tenantId: input.tenantId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent account ${input.parentId} not found`);
      }
      if (parent.type !== input.type) {
        throw new BadRequestException(
          `Parent type ${parent.type} does not match child type ${input.type}`,
        );
      }
    }

    try {
      return await client.chartOfAccount.create({
        data: {
          tenantId: input.tenantId,
          code: input.code,
          name: input.name,
          type: input.type,
          normalBalance: input.normalBalance,
          parentId: input.parentId ?? null,
          currency: input.currency ?? 'USD',
          isLeaf: input.isLeaf ?? true,
          description: input.description ?? null,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          `Account code ${input.code} already exists for this tenant`,
        );
      }
      throw e;
    }
  }

  async findById(tenantId: string, id: string) {
    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id, tenantId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${id} not found for tenant ${tenantId}`);
    }
    return account;
  }

  async findByCode(tenantId: string, code: string) {
    const account = await this.prisma.chartOfAccount.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    return account;
  }

  async list(tenantId: string, opts?: { type?: AccountType; isActive?: boolean; isLeaf?: boolean }) {
    return this.prisma.chartOfAccount.findMany({
      where: {
        tenantId,
        ...(opts?.type ? { type: opts.type } : {}),
        ...(opts?.isActive !== undefined ? { isActive: opts.isActive } : {}),
        ...(opts?.isLeaf !== undefined ? { isLeaf: opts.isLeaf } : {}),
      },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
  }

  async update(tenantId: string, id: string, input: UpdateAccountInput) {
    const account = await this.findById(tenantId, id);

    // If deactivating, refuse if there are non-zero postings.
    if (input.isActive === false && account.isActive) {
      const agg = await this.prisma.accountingRecord.aggregate({
        where: { tenantId, accountId: id },
        _sum: { amount: true },
      });
      const total = agg._sum.amount;
      if (total && total.toString() !== '0') {
        throw new BadRequestException(
          `Cannot deactivate account ${id}: has non-zero balance (${total.toString()})`,
        );
      }
    }

    return this.prisma.chartOfAccount.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
  }

  /**
   * Returns the IDs of accounts that are valid leaf accounts for postings.
   * Used by LedgerRepositoryService to validate a posting batch.
   */
  async resolveLeafAccountIds(
    tenantId: string,
    codes: string[],
  ): Promise<Map<string, string>> {
    if (codes.length === 0) return new Map();
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: {
        tenantId,
        code: { in: codes },
        isLeaf: true,
        isActive: true,
      },
      select: { id: true, code: true },
    });
    return new Map(accounts.map((a) => [a.code, a.id]));
  }
}