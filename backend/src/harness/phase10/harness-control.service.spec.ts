import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '../../modules/auth/interfaces/token.interface';
import { HarnessControlService } from './harness-control.service';

const actor = (sub: string): JwtPayload => ({
  sub,
  email: `${sub}@example.com`,
  role: UserRole.SUPER_ADMIN,
  tenantId: null,
  jti: 'jti',
});

describe('HarnessControlService', () => {
  it('denies self-approval of a run', async () => {
    const prisma = {
      harnessRun: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'run',
          requestedBy: 'requester',
          state: 'REQUESTED',
        }),
      },
    } as never;
    const service = new HarnessControlService(prisma);
    await expect(
      service.approveRun(actor('requester'), 'run'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies destructive production runs even under production policy', async () => {
    const prisma = {
      harnessRunPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'policy',
          deprecatedAt: null,
          approvedAt: new Date(),
          approvedBy: 'reviewer',
          environment: 'PRODUCTION',
          maxBudgetUsd: 10,
          allowedCapabilityIds: [],
          destructiveAllowed: true,
          productionAllowed: true,
          requiresApproval: true,
          maxConcurrency: 1,
        }),
      },
      harnessRun: { count: jest.fn().mockResolvedValue(0) },
    } as never;
    const service = new HarnessControlService(prisma);
    await expect(
      service.requestRun(actor('requester'), {
        capabilityId: 'CAP-1',
        scenarioId: 'SCN-1',
        environment: 'PRODUCTION',
        runPolicyId: 'fb718de5-ae0b-45be-bba4-eca4d9b68e32',
        destructive: true,
        budgetUsd: 1,
        idempotencyKey: 'request-123',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found rather than cross-tenant evidence', async () => {
    const prisma = {
      harnessEvidence: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'ev', tenantId: 'tenant-b', run: {} }),
      },
    } as never;
    const service = new HarnessControlService(prisma);
    const tenantActor = { ...actor('reader'), tenantId: 'tenant-a' } as never;
    await expect(service.getEvidence(tenantActor, 'ev')).rejects.toThrow(
      'Evidence not found',
    );
  });
});
