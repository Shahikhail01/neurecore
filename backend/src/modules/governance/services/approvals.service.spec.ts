import { ForbiddenException } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';

describe('ApprovalsService.review() — Phase 7 self-approval prohibition', () => {
  let prisma: {
    approvalRequest: { findFirst: jest.Mock; update: jest.Mock };
  };
  let service: ApprovalsService;

  beforeEach(() => {
    prisma = {
      approvalRequest: { findFirst: jest.fn(), update: jest.fn() },
    };
    service = new ApprovalsService(prisma as never);
  });

  it('rejects a reviewer who is also the requester', async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'appr_1',
      tenantId: 'tenant-a',
      status: 'PENDING',
      requestedById: 'employee-a',
      resourceType: 'WORK_RUN_STEP',
    });

    await expect(
      service.review('appr_1', 'tenant-a', 'employee-a', {
        status: 'APPROVED',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.approvalRequest.update).not.toHaveBeenCalled();
  });

  it('rejects a missing reviewer identity', async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'appr_2',
      tenantId: 'tenant-a',
      status: 'PENDING',
      requestedById: 'employee-a',
    });

    await expect(
      service.review('appr_2', 'tenant-a', '', { status: 'APPROVED' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a distinct HUMAN reviewer', async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'appr_3',
      tenantId: 'tenant-a',
      status: 'PENDING',
      requestedById: 'employee-a',
    });
    prisma.approvalRequest.update.mockResolvedValue({
      id: 'appr_3',
      status: 'APPROVED',
    });

    const result = await service.review('appr_3', 'tenant-a', 'human-1', {
      status: 'APPROVED',
    });
    expect(prisma.approvalRequest.update).toHaveBeenCalled();
    expect(result.status).toBe('APPROVED');
  });
});
