/**
 * SLA Timer — Service unit tests.
 */

import { SlaTimerService, SLA_POLICIES } from './sla-timer.service';

function mockPrisma() {
  return {
    sLAEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  } as any;
}

describe('SlaTimerService', () => {
  let svc: SlaTimerService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
    svc = new SlaTimerService(prisma);
  });

  it('ships the OOB SLA policies', () => {
    expect(Object.keys(SLA_POLICIES)).toContain('gdpr-art12-3');
    expect(Object.keys(SLA_POLICIES)).toContain('case-first-response');
    expect(Object.keys(SLA_POLICIES)).toContain('case-resolution');
    expect(SLA_POLICIES['gdpr-art12-3'].durationDays).toBe(30);
  });

  it('open creates an SLAEvent with the correct dueAt', async () => {
    prisma.sLAEvent.create.mockResolvedValue({});
    const openedAt = new Date(Date.UTC(2026, 7, 1));
    await svc.open({
      tenantId: 'tenant-a',
      subjectId: 'dsr-1',
      subjectKind: 'dsr-request',
      policy: 'gdpr-art12-3',
      openedAt,
    });
    const call = prisma.sLAEvent.create.mock.calls[0][0];
    expect(call.data.policy).toBe('gdpr-art12-3');
    const dueAt = call.data.dueAt as Date;
    expect(dueAt.getUTCDate()).toBe(31); // 30 days later
  });

  it('open rejects unknown policy', async () => {
    await expect(
      svc.open({
        tenantId: 'tenant-a',
        subjectId: 'x',
        subjectKind: 'dsr-request',
        policy: 'not-a-policy',
      }),
    ).rejects.toThrow(/unknown SLA policy/);
  });

  it('open rejects wildcard', async () => {
    await expect(
      svc.open({
        tenantId: '*',
        subjectId: 'x',
        subjectKind: 'dsr-request',
        policy: 'gdpr-art12-3',
      }),
    ).rejects.toThrow(/tenantId "\*" is forbidden/);
  });

  it('escalateOverdue flags OPEN events past due', async () => {
    prisma.sLAEvent.findMany.mockResolvedValue([
      { id: 's1', subjectId: 'x', policy: 'gdpr-art12-3' },
    ]);
    prisma.sLAEvent.updateMany.mockResolvedValue({ count: 1 });
    const escalated = await svc.escalateOverdue();
    expect(escalated.length).toBe(1);
    expect(escalated[0].id).toBe('s1');
    expect(prisma.sLAEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['s1'] }, status: 'OPEN' },
        data: expect.objectContaining({ status: 'ESCALATED' }),
      }),
    );
  });

  it('escalateOverdue is a no-op when no events are overdue', async () => {
    prisma.sLAEvent.findMany.mockResolvedValue([]);
    const escalated = await svc.escalateOverdue();
    expect(escalated).toEqual([]);
    expect(prisma.sLAEvent.updateMany).not.toHaveBeenCalled();
  });

  it('resolve refuses cross-tenant', async () => {
    prisma.sLAEvent.findUnique.mockResolvedValue({ tenantId: 'tenant-b', status: 'OPEN' });
    await expect(
      svc.resolve({ tenantId: 'tenant-a', id: 's1', resolution: 'met' }),
    ).rejects.toThrow(/different tenant/);
  });

  it('resolve marks event MET', async () => {
    prisma.sLAEvent.findUnique.mockResolvedValue({ tenantId: 'tenant-a', status: 'OPEN' });
    prisma.sLAEvent.update.mockResolvedValue({});
    await svc.resolve({ tenantId: 'tenant-a', id: 's1', resolution: 'exported' });
    expect(prisma.sLAEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'MET' }),
      }),
    );
  });
});
