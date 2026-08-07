/**
 * Phase 16 — SummaryTemplatesService tests.
 */

import { SummaryTemplatesService } from './summary-templates.service';

function makePrisma(opts: {
  rows?: unknown[];
  defaultFor?: unknown;
}): {
  prisma: {
    meetingSummaryTemplate: {
      findMany: jest.Mock;
      upsert: jest.Mock;
      findFirst: jest.Mock;
    };
  };
} {
  return {
    prisma: {
      meetingSummaryTemplate: {
        findMany: jest.fn(async () => opts.rows ?? []),
        upsert: jest.fn(async (args: { create: unknown }) => args.create),
        findFirst: jest.fn(async () => opts.defaultFor ?? null),
      },
    },
  };
}

describe('Phase 16 — SummaryTemplatesService', () => {
  it('list() returns empty on wildcard tenantId', async () => {
    const svc = new SummaryTemplatesService(makePrisma({}).prisma as never);
    expect(await svc.list('*')).toEqual([]);
  });

  it('list() returns mapped rows', async () => {
    const rows = [
      {
        id: 't-1',
        tenantId: 'tenant-A',
        name: 'Discovery',
        meetingType: 'discovery',
        sections: { decisions: 'x', actions: 'y', risks: 'z', sentiment: 'w' },
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const svc = new SummaryTemplatesService(makePrisma({ rows }).prisma as never);
    const out = await svc.list('tenant-A');
    expect(out).toHaveLength(1);
    expect(out[0]?.sections.decisions).toBe('x');
  });

  it('create() upserts by (tenantId, name)', async () => {
    const { prisma } = makePrisma({});
    prisma.meetingSummaryTemplate.upsert = jest.fn(async (args: { create: { createdAt?: Date; updatedAt?: Date } }) => ({
      ...args.create,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const svc = new SummaryTemplatesService(prisma as never);
    await svc.create('tenant-A', 'Discovery', 'discovery', {
      decisions: '', actions: '', risks: '', sentiment: '',
    }, true);
    expect(prisma.meetingSummaryTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_name: { tenantId: 'tenant-A', name: 'Discovery' } },
      }),
    );
  });

  it('pickFor() returns the tenant default when present', async () => {
    const t = {
      id: 't-1',
      tenantId: 'tenant-A',
      name: 'Discovery',
      meetingType: 'discovery',
      sections: { decisions: '', actions: '', risks: '', sentiment: '' },
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { prisma } = makePrisma({ defaultFor: t });
    const svc = new SummaryTemplatesService(prisma as never);
    const out = await svc.pickFor('tenant-A', 'discovery');
    expect(out.id).toBe('t-1');
  });

  it('pickFor() falls back to system default when no tenant default', async () => {
    const svc = new SummaryTemplatesService(makePrisma({ defaultFor: null }).prisma as never);
    const out = await svc.pickFor('tenant-A', 'discovery');
    expect(out.id).toBe('system-discovery');
    expect(out.sections.decisions).toContain('Scope decisions');
  });

  it('pickFor() refuses wildcard tenantId', async () => {
    const svc = new SummaryTemplatesService(makePrisma({}).prisma as never);
    await expect(svc.pickFor('*', 'discovery')).rejects.toThrow(/tenantId/);
  });

  it('ensureDefaults() upserts the four system defaults', async () => {
    const { prisma } = makePrisma({});
    prisma.meetingSummaryTemplate.upsert = jest.fn(async (args: { create: { createdAt?: Date; updatedAt?: Date } }) => ({
      ...args.create,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const svc = new SummaryTemplatesService(prisma as never);
    const out = await svc.ensureDefaults('tenant-A');
    expect(out).toHaveLength(4);
    expect(out.map((t) => t.name)).toEqual(['1:1', 'Discovery', 'Standup', 'Kickoff']);
  });
});
