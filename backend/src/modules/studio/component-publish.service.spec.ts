/**
 * Component Publish — unit tests.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ComponentPublishStatus } from '@prisma/client';
import { ComponentPublishService } from './component-publish.service';

function mockPrisma() {
  return {
    studioComponent: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    componentPublishRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  } as any;
}

describe('ComponentPublishService', () => {
  let svc: ComponentPublishService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new ComponentPublishService(prisma);
  });

  it('submit refuses wildcard tenant', async () => {
    await expect(
      svc.submit({ tenantId: '*', componentId: 'c1', submittedBy: 'u1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('submit refuses non-existent component', async () => {
    prisma.studioComponent.findUnique.mockResolvedValue(null);
    await expect(
      svc.submit({ tenantId: 'tenant-a', componentId: 'c1', submittedBy: 'u1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('submit refuses component from a different tenant', async () => {
    prisma.studioComponent.findUnique.mockResolvedValue({ tenantId: 'tenant-b' });
    await expect(
      svc.submit({ tenantId: 'tenant-a', componentId: 'c1', submittedBy: 'u1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('decide ACTIVE flips origin to COMMUNITY', async () => {
    prisma.componentPublishRequest.findUnique.mockResolvedValue({
      id: 'r1',
      componentId: 'c1',
      status: ComponentPublishStatus.PENDING_REVIEW,
    });
    prisma.componentPublishRequest.update.mockResolvedValue({});
    prisma.studioComponent.findUnique.mockResolvedValue({ tenantId: 'tenant-a' });
    prisma.studioComponent.update.mockResolvedValue({});
    await svc.decide({
      requestId: 'r1',
      reviewerId: 'admin-1',
      decision: 'ACTIVE',
      decisionNotes: 'looks good',
    });
    expect(prisma.componentPublishRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(prisma.studioComponent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ origin: 'COMMUNITY' }),
      }),
    );
  });

  it('decide REJECTED does not flip origin', async () => {
    prisma.componentPublishRequest.findUnique.mockResolvedValue({
      id: 'r2',
      componentId: 'c2',
      status: ComponentPublishStatus.PENDING_REVIEW,
    });
    prisma.componentPublishRequest.update.mockResolvedValue({});
    await svc.decide({
      requestId: 'r2',
      reviewerId: 'admin-1',
      decision: 'REJECTED',
    });
    expect(prisma.studioComponent.update).not.toHaveBeenCalled();
  });

  it('decide refuses a request already decided', async () => {
    prisma.componentPublishRequest.findUnique.mockResolvedValue({
      id: 'r3',
      componentId: 'c3',
      status: ComponentPublishStatus.ACTIVE,
    });
    await expect(
      svc.decide({ requestId: 'r3', reviewerId: 'admin-1', decision: 'ACTIVE' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
