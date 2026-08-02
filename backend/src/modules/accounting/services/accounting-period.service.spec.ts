/**
 * Unit tests for AccountingPeriodService (NC-ACCT-IMP-1 §5).
 */

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AccountingPeriodService } from './accounting-period.service';
import { AccountingPeriodStatus, Prisma } from '@prisma/client';

describe('AccountingPeriodService', () => {
  let service: AccountingPeriodService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      accountingPeriod: {
        create: jest.fn(async ({ data }: any) => ({ id: 'p1', ...data })),
        findFirst: jest.fn(),
        findMany: jest.fn(async () => []),
        update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
      },
    };
    service = new AccountingPeriodService(mockPrisma);
  });

  describe('create', () => {
    it('rejects when endDate <= startDate', async () => {
      await expect(
        service.create({
          tenantId: 't1',
          code: '2027-01',
          name: 'Jan 2027',
          startDate: new Date('2027-01-31'),
          endDate: new Date('2027-01-01'),
          fiscalYear: 2027,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when endDate equals startDate', async () => {
      const d = new Date('2027-01-01');
      await expect(
        service.create({
          tenantId: 't1',
          code: '2027-01',
          name: 'Jan 2027',
          startDate: d,
          endDate: d,
          fiscalYear: 2027,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid code formats', async () => {
      await expect(
        service.create({
          tenantId: 't1',
          code: 'has spaces',
          name: 'X',
          startDate: new Date('2027-01-01'),
          endDate: new Date('2027-01-31'),
          fiscalYear: 2027,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a new period with status=OPEN by default', async () => {
      const result = await service.create({
        tenantId: 't1',
        code: '2027-01',
        name: 'Jan 2027',
        startDate: new Date('2027-01-01'),
        endDate: new Date('2027-01-31'),
        fiscalYear: 2027,
      });
      expect(mockPrisma.accountingPeriod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: AccountingPeriodStatus.OPEN }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('maps P2002 to ConflictException', async () => {
      const err: any = new Error('Unique constraint failed');
      err.code = 'P2002';
      err.name = 'PrismaClientKnownRequestError';
      Object.setPrototypeOf(err, (Prisma as any).PrismaClientKnownRequestError?.prototype ?? Object.prototype);
      mockPrisma.accountingPeriod.create.mockRejectedValueOnce(err);
      await expect(
        service.create({
          tenantId: 't1',
          code: '2027-01',
          name: 'Jan 2027',
          startDate: new Date('2027-01-01'),
          endDate: new Date('2027-01-31'),
          fiscalYear: 2027,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('transition state machine', () => {
    it('OPEN → CLOSING is allowed', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValueOnce({
        id: 'p1', status: AccountingPeriodStatus.OPEN,
      });
      mockPrisma.accountingPeriod.update.mockResolvedValueOnce({
        id: 'p1', status: AccountingPeriodStatus.CLOSING,
      });
      await expect(
        service.transition('t1', 'p1', AccountingPeriodStatus.CLOSING, 'user-1'),
      ).resolves.toBeDefined();
    });

    it('OPEN → LOCKED is rejected (must go through CLOSING → CLOSED → LOCKED)', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValueOnce({
        id: 'p1', status: AccountingPeriodStatus.OPEN,
      });
      await expect(
        service.transition('t1', 'p1', AccountingPeriodStatus.LOCKED, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('CLOSED → CLOSING is allowed (reopen)', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValueOnce({
        id: 'p1', status: AccountingPeriodStatus.CLOSED,
      });
      mockPrisma.accountingPeriod.update.mockResolvedValueOnce({
        id: 'p1', status: AccountingPeriodStatus.CLOSING,
      });
      await expect(
        service.transition('t1', 'p1', AccountingPeriodStatus.CLOSING, 'user-1'),
      ).resolves.toBeDefined();
    });

    it('LOCKED → anything is rejected (terminal state)', async () => {
      // The implementation calls findFirst before checking valid transitions;
      // we must mock findFirst for EACH iteration of the loop.
      mockPrisma.accountingPeriod.findFirst.mockImplementation(async () => ({
        id: 'p1', status: AccountingPeriodStatus.LOCKED,
      }));
      for (const target of [
        AccountingPeriodStatus.OPEN,
        AccountingPeriodStatus.CLOSING,
        AccountingPeriodStatus.CLOSED,
      ]) {
        await expect(
          service.transition('t1', 'p1', target, 'user-1'),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('CLOSING → CLOSED records closedAt + closedById', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValueOnce({
        id: 'p1', status: AccountingPeriodStatus.CLOSING,
      });
      mockPrisma.accountingPeriod.update.mockResolvedValueOnce({
        id: 'p1', status: AccountingPeriodStatus.CLOSED,
      });
      await service.transition('t1', 'p1', AccountingPeriodStatus.CLOSED, 'user-99');
      expect(mockPrisma.accountingPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            closedAt: expect.any(Date),
            closedById: 'user-99',
          }),
        }),
      );
    });

    it('CLOSED → LOCKED records lockedAt + lockedById', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValueOnce({
        id: 'p1', status: AccountingPeriodStatus.CLOSED,
      });
      mockPrisma.accountingPeriod.update.mockResolvedValueOnce({
        id: 'p1', status: AccountingPeriodStatus.LOCKED,
      });
      await service.transition('t1', 'p1', AccountingPeriodStatus.LOCKED, 'user-99');
      expect(mockPrisma.accountingPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lockedAt: expect.any(Date),
            lockedById: 'user-99',
          }),
        }),
      );
    });
  });

  describe('isPostable', () => {
    it('OPEN is postable', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValueOnce({
        id: 'p1', status: AccountingPeriodStatus.OPEN,
      });
      expect(await service.isPostable('t1', 'p1')).toBe(true);
    });

    it('CLOSING is postable', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValueOnce({
        id: 'p1', status: AccountingPeriodStatus.CLOSING,
      });
      expect(await service.isPostable('t1', 'p1')).toBe(true);
    });

    it('CLOSED is NOT postable', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValueOnce({
        id: 'p1', status: AccountingPeriodStatus.CLOSED,
      });
      expect(await service.isPostable('t1', 'p1')).toBe(false);
    });

    it('LOCKED is NOT postable', async () => {
      mockPrisma.accountingPeriod.findFirst.mockResolvedValueOnce({
        id: 'p1', status: AccountingPeriodStatus.LOCKED,
      });
      expect(await service.isPostable('t1', 'p1')).toBe(false);
    });
  });
});