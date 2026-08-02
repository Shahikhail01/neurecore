/**
 * Unit tests for ChartOfAccountsService (NC-ACCT-IMP-1 §5).
 *
 * Verifies the core invariants without a real DB by mocking the Prisma
 * client.
 */

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { AccountType, AccountNormalBalance, Prisma } from '@prisma/client';

describe('ChartOfAccountsService', () => {
  let service: ChartOfAccountsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      chartOfAccount: {
        create: jest.fn(async ({ data }: any) => ({ id: 'acc-1', ...data })),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(async () => []),
        update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
      },
      accountingRecord: {
        aggregate: jest.fn(async () => ({ _sum: { amount: null } })),
      },
    };
    service = new ChartOfAccountsService(mockPrisma);
  });

  describe('create', () => {
    it('rejects invalid code formats', async () => {
      await expect(
        service.create({
          tenantId: 't1',
          code: 'has spaces',
          name: 'X',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts valid code formats (digits, letters, dash, underscore)', async () => {
      for (const code of ['1000', '1100-100', 'a_b_c', 'Cash-2026']) {
        mockPrisma.chartOfAccount.create.mockResolvedValueOnce({ id: 'x', code });
        const acc = await service.create({
          tenantId: 't1',
          code,
          name: 'X',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
        });
        expect(acc.code).toBe(code);
      }
    });

    it('rejects codes longer than 32 chars', async () => {
      await expect(
        service.create({
          tenantId: 't1',
          code: 'a'.repeat(33),
          name: 'X',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when parent does not exist', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.create({
          tenantId: 't1',
          code: '1100',
          name: 'X',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
          parentId: 'nonexistent',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when parent type does not match child type', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValueOnce({
        id: 'parent',
        type: AccountType.LIABILITY,
      });
      await expect(
        service.create({
          tenantId: 't1',
          code: '1100',
          name: 'X',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
          parentId: 'parent',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('passes when parent type matches child type', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValueOnce({
        id: 'parent',
        type: AccountType.ASSET,
      });
      await expect(
        service.create({
          tenantId: 't1',
          code: '1100',
          name: 'X',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
          parentId: 'parent',
        }),
      ).resolves.toBeDefined();
    });

    it('maps P2002 to ConflictException', async () => {
      const err: any = new Error('Unique constraint failed');
      err.code = 'P2002';
      err.name = 'PrismaClientKnownRequestError';
      Object.setPrototypeOf(err, (Prisma as any).PrismaClientKnownRequestError?.prototype ?? Object.prototype);
      mockPrisma.chartOfAccount.create.mockRejectedValueOnce(err);
      await expect(
        service.create({
          tenantId: 't1',
          code: '1100',
          name: 'X',
          type: AccountType.ASSET,
          normalBalance: AccountNormalBalance.DEBIT,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('defaults isLeaf to true', async () => {
      await service.create({
        tenantId: 't1',
        code: '1100',
        name: 'X',
        type: AccountType.ASSET,
        normalBalance: AccountNormalBalance.DEBIT,
      });
      expect(mockPrisma.chartOfAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isLeaf: true, currency: 'USD' }),
        }),
      );
    });
  });

  describe('resolveLeafAccountIds', () => {
    it('returns empty map for empty input', async () => {
      const result = await service.resolveLeafAccountIds('t1', []);
      expect(result.size).toBe(0);
    });

    it('filters to leaf + active accounts only', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValueOnce([
        { id: 'a1', code: '1000' },
        { id: 'a2', code: '2000' },
      ]);
      const result = await service.resolveLeafAccountIds('t1', ['1000', '2000']);
      expect(result.size).toBe(2);
      expect(result.get('1000')).toBe('a1');
      expect(mockPrisma.chartOfAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isLeaf: true,
            isActive: true,
          }),
        }),
      );
    });

    it('drops codes that have no matching leaf account', async () => {
      mockPrisma.chartOfAccount.findMany.mockResolvedValueOnce([
        { id: 'a1', code: '1000' },
      ]);
      const result = await service.resolveLeafAccountIds('t1', ['1000', '9999']);
      expect(result.size).toBe(1);
      expect(result.has('9999')).toBe(false);
    });
  });

  describe('update with deactivation', () => {
    it('refuses deactivation of account with non-zero balance', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValueOnce({
        id: 'acc-1',
        tenantId: 't1',
        isActive: true,
      });
      mockPrisma.accountingRecord.aggregate.mockResolvedValueOnce({
        _sum: { amount: '100.00' },
      });
      await expect(
        service.update('t1', 'acc-1', { isActive: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows deactivation of zero-balance account', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValueOnce({
        id: 'acc-1',
        tenantId: 't1',
        isActive: true,
      });
      mockPrisma.accountingRecord.aggregate.mockResolvedValueOnce({
        _sum: { amount: null },
      });
      mockPrisma.chartOfAccount.update.mockResolvedValueOnce({
        id: 'acc-1', isActive: false,
      });
      const result = await service.update('t1', 'acc-1', { isActive: false });
      expect(result.isActive).toBe(false);
    });

    it('allows deactivation when balance is exactly zero', async () => {
      mockPrisma.chartOfAccount.findFirst.mockResolvedValueOnce({
        id: 'acc-1',
        tenantId: 't1',
        isActive: true,
      });
      mockPrisma.accountingRecord.aggregate.mockResolvedValueOnce({
        _sum: { amount: '0' },
      });
      mockPrisma.chartOfAccount.update.mockResolvedValueOnce({
        id: 'acc-1', isActive: false,
      });
      await expect(
        service.update('t1', 'acc-1', { isActive: false }),
      ).resolves.toBeDefined();
    });
  });
});