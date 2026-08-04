/**
 * Scheduler Runner — unit tests.
 *
 * Asserts:
 *   1. tick() finds every due schedule and executes it.
 *   2. tick() advances nextRunAt for recurring schedules.
 *   3. tick() disables ONE_OFF schedules after first run.
 *   4. tick() never blocks on a failing schedule (errors caught).
 *   5. createSchedule refuses wildcard.
 */

import { ForbiddenException } from '@nestjs/common';
import { SchedulerRunner } from './scheduler-runner';

function mockPrisma() {
  return {
    scheduledGovernanceRun: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    governanceScheduleExecution: {
      create: jest.fn(),
    },
    governanceControl: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    deploymentPipeline: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    studioDeployment: {
      findFirst: jest.fn(),
    },
  } as any;
}

describe('SchedulerRunner', () => {
  let svc: SchedulerRunner;
  let prisma: ReturnType<typeof mockPrisma>;
  beforeEach(() => {
    prisma = mockPrisma();
    svc = new SchedulerRunner(prisma);
  });

  it('tick with no due schedules returns 0', async () => {
    const r = await svc.tick();
    expect(r.governanceRuns).toBe(0);
    expect(r.pipelineRuns).toBe(0);
    expect(r.errors).toEqual([]);
  });

  it('tick executes one due schedule and writes execution row', async () => {
    prisma.scheduledGovernanceRun.findMany.mockResolvedValue([
      { id: 's1', tenantId: 'tenant-a', controlId: 'c1', kind: 'DAILY', cron: '0 2 * * *', enabled: true },
    ]);
    prisma.scheduledGovernanceRun.findUnique.mockResolvedValue({
      id: 's1',
      tenantId: 'tenant-a',
      controlId: 'c1',
      kind: 'DAILY',
      cron: '0 2 * * *',
      enabled: true,
    });
    prisma.governanceControl.findUnique.mockResolvedValue({
      id: 'c1',
      status: 'ACTIVE',
    });
    prisma.governanceScheduleExecution.create.mockResolvedValue({});
    prisma.scheduledGovernanceRun.update.mockResolvedValue({});

    const r = await svc.tick();
    expect(r.governanceRuns).toBe(1);
    expect(r.errors).toEqual([]);
    expect(prisma.governanceScheduleExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          controlId: 'c1',
          outcome: 'PASS',
          ranBy: 'system:scheduler',
        }),
      }),
    );
    expect(prisma.scheduledGovernanceRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastRunAt: expect.any(Date),
          nextRunAt: expect.any(Date),
        }),
      }),
    );
  });

  it('tick continues after a failing schedule', async () => {
    prisma.scheduledGovernanceRun.findMany.mockResolvedValue([
      { id: 's1', tenantId: 'tenant-a', controlId: 'c1', kind: 'ONE_OFF', cron: null, enabled: true },
    ]);
    prisma.scheduledGovernanceRun.findUnique.mockResolvedValue({
      id: 's1',
      tenantId: 'tenant-a',
      controlId: 'c1',
      kind: 'ONE_OFF',
      cron: null,
      enabled: true,
    });
    prisma.governanceControl.findUnique.mockResolvedValue(null); // control missing -> SKIPPED
    prisma.governanceScheduleExecution.create.mockResolvedValue({});
    prisma.scheduledGovernanceRun.update.mockResolvedValue({});

    const r = await svc.tick();
    expect(r.governanceRuns).toBe(1);
    expect(r.errors).toEqual([]);
    // ONE_OFF schedules disable themselves.
    expect(prisma.scheduledGovernanceRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enabled: false }),
      }),
    );
  });

  it('createSchedule refuses wildcard tenant id', async () => {
    await expect(
      svc.createSchedule({
        tenantId: '*',
        controlId: 'c1',
        kind: 'DAILY',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('createSchedule rejects unknown control', async () => {
    prisma.governanceControl.findFirst.mockResolvedValue(null);
    await expect(
      svc.createSchedule({
        tenantId: 'tenant-a',
        controlId: 'unknown',
        kind: 'DAILY',
      }),
    ).rejects.toThrow(/control .* not found/);
  });

  it('createSchedule sets nextRunAt from cron', async () => {
    prisma.governanceControl.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.scheduledGovernanceRun.create.mockResolvedValue({});
    await svc.createSchedule({
      tenantId: 'tenant-a',
      controlId: 'c1',
      kind: 'DAILY',
    });
    expect(prisma.scheduledGovernanceRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nextRunAt: expect.any(Date) }),
      }),
    );
  });
});
