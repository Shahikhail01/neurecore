/**
 * Studio Dashboard — unit tests.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StudioDashboardService } from './studio-dashboard.service';

function mockPrisma() {
  return {
    studioDashboard: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    agentExecution: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    aiTwinAuditLog: {
      groupBy: jest.fn(),
    },
    sLAEvent: {
      count: jest.fn(),
    },
  } as any;
}

describe('StudioDashboardService', () => {
  let svc: StudioDashboardService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
    svc = new StudioDashboardService(prisma);
  });

  it('create refuses wildcard', async () => {
    await expect(
      svc.create({ tenantId: '*', slug: 's', displayName: 'd' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateLayout refuses cross-tenant dashboard', async () => {
    prisma.studioDashboard.findUnique.mockResolvedValue({ tenantId: 'tenant-b' });
    await expect(
      svc.updateLayout('tenant-a', 'd1', { tiles: [], columns: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateLayout throws NotFound when missing', async () => {
    prisma.studioDashboard.findUnique.mockResolvedValue(null);
    await expect(
      svc.updateLayout('tenant-a', 'missing', { tiles: [], columns: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('computeTile: agent.executions.success-rate computes ratio', async () => {
    prisma.agentExecution.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(8);
    const r = await svc.computeTile('tenant-a', {
      id: 't', type: 'kpi', title: 'rate', dataSource: 'agent.executions.success-rate',
      filters: {}, options: {},
    });
    expect(r).toMatchObject({ type: 'kpi', value: 0.8, total: 10, success: 8 });
  });

  it('computeTile: success-rate returns null when no executions', async () => {
    prisma.agentExecution.count.mockResolvedValue(0);
    const r = await svc.computeTile('tenant-a', {
      id: 't', type: 'kpi', title: 'rate', dataSource: 'agent.executions.success-rate',
      filters: {}, options: {},
    });
    expect(r).toMatchObject({ type: 'kpi', value: null, total: 0 });
  });

  it('computeTile: sla.events.overdue-count returns count', async () => {
    prisma.sLAEvent.count.mockResolvedValue(7);
    const r = await svc.computeTile('tenant-a', {
      id: 't', type: 'kpi', title: 'sla', dataSource: 'sla.events.overdue-count',
      filters: {}, options: {},
    });
    expect(r).toMatchObject({ type: 'kpi', value: 7, unit: 'count' });
  });

  it('computeTile: unknown data source returns unknown marker', async () => {
    const r = await svc.computeTile('tenant-a', {
      id: 't', type: 'kpi', title: 'x', dataSource: 'unknown.source',
      filters: {}, options: {},
    });
    expect(r).toMatchObject({ type: 'unknown', dataSource: 'unknown.source' });
  });

  it('computeTile refuses wildcard', async () => {
    await expect(
      svc.computeTile('*', {
        id: 't', type: 'kpi', title: 'x', dataSource: 'sla.events.overdue-count',
        filters: {}, options: {},
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
