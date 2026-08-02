/**
 * Unit tests for SegregationOfDutiesService (NC-ACCT-IMP-1 §5).
 */

import { ForbiddenException } from '@nestjs/common';
import { SegregationOfDutiesService } from './segregation-of-duties.service';
import { AccountingRole, Prisma } from '@prisma/client';

describe('SegregationOfDutiesService', () => {
  let service: SegregationOfDutiesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      userAccountingRole: {
        findMany: jest.fn(async () => []),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    service = new SegregationOfDutiesService(mockPrisma);
  });

  describe('loadRoles + hasRole', () => {
    it('returns empty array when user has no roles', async () => {
      const roles = await service.loadRoles('t1', 'user-1');
      expect(roles).toEqual([]);
      expect(mockPrisma.userAccountingRole.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 't1',
            userId: 'user-1',
            revokedAt: null,
          }),
        }),
      );
    });

    it('returns the list of non-revoked roles', async () => {
      mockPrisma.userAccountingRole.findMany.mockResolvedValueOnce([
        { role: AccountingRole.POSTING },
        { role: AccountingRole.REVIEWER },
      ]);
      const roles = await service.loadRoles('t1', 'user-1');
      expect(roles).toEqual([AccountingRole.POSTING, AccountingRole.REVIEWER]);
    });

    it('hasRole returns true when the role is present', async () => {
      mockPrisma.userAccountingRole.findMany.mockResolvedValueOnce([
        { role: AccountingRole.CONTROLLER },
      ]);
      expect(await service.hasRole('t1', 'user-1', AccountingRole.CONTROLLER)).toBe(true);
    });

    it('hasRole returns false when the role is absent', async () => {
      expect(await service.hasRole('t1', 'user-1', AccountingRole.CFO)).toBe(false);
    });
  });

  describe('requireAnyRole', () => {
    it('passes when user has one of the required roles', async () => {
      mockPrisma.userAccountingRole.findMany.mockResolvedValueOnce([
        { role: AccountingRole.POSTING },
      ]);
      await expect(
        service.requireAnyRole('t1', 'user-1', [AccountingRole.POSTING, AccountingRole.CFO]),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when user has none of the required roles', async () => {
      mockPrisma.userAccountingRole.findMany.mockResolvedValueOnce([
        { role: AccountingRole.VIEWER },
      ]);
      await expect(
        service.requireAnyRole('t1', 'user-1', [AccountingRole.POSTING, AccountingRole.CFO]),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SoD violation is the most informative error', async () => {
      mockPrisma.userAccountingRole.findMany.mockResolvedValueOnce([
        { role: AccountingRole.REVIEWER },
      ]);
      await expect(
        service.requireAnyRole('t1', 'user-1', [AccountingRole.POSTING]),
      ).rejects.toThrow(/lacks required accounting role/);
    });
  });

  describe('enforceSegregation', () => {
    it('throws when poster == approver (regardless of role)', async () => {
      await expect(
        service.enforceSegregation('t1', 'user-1', 'user-1'),
      ).rejects.toThrow(/cannot approve their own/);
    });

    it('throws when approver lacks REVIEWER/CONTROLLER/CFO', async () => {
      mockPrisma.userAccountingRole.findMany.mockResolvedValueOnce([
        { role: AccountingRole.POSTING },
      ]);
      await expect(
        service.enforceSegregation('t1', 'user-1', 'user-2'),
      ).rejects.toThrow(/lacks required/);
    });

    it('passes when approver is different and has REVIEWER role', async () => {
      mockPrisma.userAccountingRole.findMany.mockResolvedValueOnce([
        { role: AccountingRole.REVIEWER },
      ]);
      await expect(
        service.enforceSegregation('t1', 'user-1', 'user-2'),
      ).resolves.toBeUndefined();
    });

    it('passes when approver has CONTROLLER role', async () => {
      mockPrisma.userAccountingRole.findMany.mockResolvedValueOnce([
        { role: AccountingRole.CONTROLLER },
      ]);
      await expect(
        service.enforceSegregation('t1', 'user-1', 'user-2'),
      ).resolves.toBeUndefined();
    });

    it('passes when approver has CFO role', async () => {
      mockPrisma.userAccountingRole.findMany.mockResolvedValueOnce([
        { role: AccountingRole.CFO },
      ]);
      await expect(
        service.enforceSegregation('t1', 'user-1', 'user-2'),
      ).resolves.toBeUndefined();
    });
  });

  describe('grantRole / revokeRole', () => {
    it('grantRole is idempotent on P2002', async () => {
      // PrismaClientKnownRequestError instances must have `code` set.
      const err: any = new Error('Unique constraint failed');
      err.code = 'P2002';
      err.name = 'PrismaClientKnownRequestError';
      err.constructor = { name: 'PrismaClientKnownRequestError' };
      // Make `instanceof` work via prototype chain manipulation
      Object.setPrototypeOf(err, (Prisma as any).PrismaClientKnownRequestError?.prototype ?? Object.prototype);
      mockPrisma.userAccountingRole.create.mockRejectedValueOnce(err);
      await expect(
        service.grantRole('t1', 'user-1', AccountingRole.POSTING, 'user-admin'),
      ).resolves.toBeUndefined();
    });

    it('grantRole rethrows non-P2002 errors', async () => {
      mockPrisma.userAccountingRole.create.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.grantRole('t1', 'user-1', AccountingRole.POSTING, 'user-admin'),
      ).rejects.toThrow('db down');
    });

    it('revokeRole marks the role revoked with current timestamp', async () => {
      mockPrisma.userAccountingRole.updateMany.mockResolvedValueOnce({ count: 1 });
      await service.revokeRole('t1', 'user-1', AccountingRole.POSTING);
      expect(mockPrisma.userAccountingRole.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 't1',
            userId: 'user-1',
            role: AccountingRole.POSTING,
            revokedAt: null,
          }),
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });
  });
});