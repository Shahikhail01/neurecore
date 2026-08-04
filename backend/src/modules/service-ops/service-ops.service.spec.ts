/**
 * Service Ops — Landing page + Field work order + Root-cause tests.
 */

import {
  LandingPageService,
  FieldWorkOrderService,
  RootCauseAnalysisService,
} from './service-ops.service';
import {
  FieldWorkOrderStatus,
  LandingPageStatus,
} from '@prisma/client';

function mockPrisma() {
  return {
    landingPage: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    fieldWorkOrder: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    rootCauseAnalysis: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;
}

describe('LandingPageService', () => {
  let svc: LandingPageService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new LandingPageService(prisma);
  });

  it('create refuses wildcard', async () => {
    await expect(
      svc.create({ tenantId: '*', slug: 's', displayName: 'd' }),
    ).rejects.toThrow(/tenantId "\*" is forbidden/);
  });

  it('publish marks the page PUBLISHED', async () => {
    prisma.landingPage.findUnique.mockResolvedValue({ tenantId: 'tenant-a' });
    prisma.landingPage.update.mockResolvedValue({});
    await svc.publish('tenant-a', 'p1');
    expect(prisma.landingPage.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { status: LandingPageStatus.PUBLISHED, publishedAt: expect.any(Date) },
    });
  });

  it('publish refuses cross-tenant', async () => {
    prisma.landingPage.findUnique.mockResolvedValue({ tenantId: 'tenant-b' });
    await expect(svc.publish('tenant-a', 'p1')).rejects.toThrow(/different tenant/);
  });
});

describe('FieldWorkOrderService', () => {
  let svc: FieldWorkOrderService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new FieldWorkOrderService(prisma);
  });

  it('create refuses wildcard', async () => {
    await expect(
      svc.create({ tenantId: '*' }),
    ).rejects.toThrow(/tenantId "\*" is forbidden/);
  });

  it('dispatch sets assignee + DISPATCHED status', async () => {
    prisma.fieldWorkOrder.findUnique.mockResolvedValue({ tenantId: 'tenant-a' });
    prisma.fieldWorkOrder.update.mockResolvedValue({});
    await svc.dispatch('tenant-a', 'w1', 'tech-1');
    expect(prisma.fieldWorkOrder.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { assigneeId: 'tech-1', status: FieldWorkOrderStatus.DISPATCHED },
    });
  });

  it('dispatch refuses cross-tenant', async () => {
    prisma.fieldWorkOrder.findUnique.mockResolvedValue({ tenantId: 'tenant-b' });
    await expect(svc.dispatch('tenant-a', 'w1', 'tech-1')).rejects.toThrow(/different tenant/);
  });
});

describe('RootCauseAnalysisService', () => {
  let svc: RootCauseAnalysisService;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new RootCauseAnalysisService(prisma);
  });

  it('record refuses confidence outside [0, 1]', async () => {
    await expect(
      svc.record({
        tenantId: 'tenant-a',
        triggerId: 't',
        cause: 'c',
        confidence: 1.5,
      }),
    ).rejects.toThrow(/confidence must be in \[0, 1\]/);
  });

  it('record refuses wildcard', async () => {
    await expect(
      svc.record({
        tenantId: '*',
        triggerId: 't',
        cause: 'c',
        confidence: 0.5,
      }),
    ).rejects.toThrow(/tenantId "\*" is forbidden/);
  });

  it('record persists the row', async () => {
    prisma.rootCauseAnalysis.create.mockResolvedValue({});
    await svc.record({
      tenantId: 'tenant-a',
      triggerId: 't',
      cause: 'c',
      confidence: 0.7,
      caseIds: ['c1'],
    });
    expect(prisma.rootCauseAnalysis.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-a',
          cause: 'c',
          confidence: 0.7,
          caseIds: ['c1'],
        }),
      }),
    );
  });
});
