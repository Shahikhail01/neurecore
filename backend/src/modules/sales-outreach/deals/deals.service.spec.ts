/**
 * DealsService — unit tests.
 *
 * No Prisma. Service ops validated through a stubbed PrismaService and
 * DealRepository. Covers:
 *   - create / update / softDelete (with audit row)
 *   - transition matrix (LEAD→QUALIFIED✓, QUALIFIED→WON✗, LEAD→LOST✓, etc.)
 *   - tenant wildcard rejection
 *   - customer / contact scope enforcement
 *   - expectedCloseDate required for stages ≥ PROPOSAL
 *   - forecastForTenant: weighted total, committed, best case
 *   - probability auto-defaults per stage
 */

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { DealsService, INVALID_DEAL_TRANSITION } from './deals.service';

const TENANT = 'tenant-abc';
const ACTOR: { sub: string; tenantId: string; role: UserRole } = {
  sub: 'user-1',
  tenantId: TENANT,
  role: UserRole.OWNER,
};

function makePrismaStub(opts: {
  customer?: unknown;
  customerContact?: unknown;
  deals?: unknown[];
} = {}) {
  const customerResult =
    opts.customer === undefined ? { id: 'cust-1' } : opts.customer;
  const contactResult =
    opts.customerContact === undefined ? { id: 'contact-1' } : opts.customerContact;
  return {
    customer: {
      findFirst: jest.fn(async () => customerResult),
    },
    customerContact: {
      findFirst: jest.fn(async () => contactResult),
    },
    auditLog: { create: jest.fn(async () => ({})) },
    deal: {
      findMany: jest.fn(async () => opts.deals ?? []),
      groupBy: jest.fn(async () => []),
    },
  };
}

function makeRepo() {
  const store = new Map<string, Record<string, unknown>>();
  let nextId = 1;
  return {
    _store: store,
    create: jest.fn(async (input: Record<string, unknown>) => {
      const id = `deal-${nextId++}`;
      store.set(id, { id, ...input });
      return { id, ...input };
    }),
    update: jest.fn(async (_tenantId: string, id: string, input: Record<string, unknown>) => {
      const cur = store.get(id) ?? { id };
      const next = { ...cur, ...input };
      store.set(id, next);
      return next;
    }),
    softDelete: jest.fn(async (tenantId: string, id: string) => {
      const cur = store.get(id) ?? { id };
      const next = { ...cur, tenantId, deletedAt: new Date() };
      store.set(id, next);
      return next;
    }),
    findById: jest.fn(async (tenantId: string, id: string) => {
      const row = store.get(id);
      return row && (row as Record<string, unknown>).tenantId === tenantId && !(row as Record<string, unknown>).deletedAt ? row : null;
    }),
    findAll: jest.fn(async () => ({ rows: [], total: 0 })),
    aggregateForecast: jest.fn(async () => []),
  };
}

function build(opts: { prisma?: ReturnType<typeof makePrismaStub>; repo?: ReturnType<typeof makeRepo> } = {}) {
  const prisma = (opts.prisma ?? makePrismaStub()) as never;
  const repo = (opts.repo ?? makeRepo()) as never;
  const svc = new DealsService(prisma, repo);
  return { svc, prisma, repo };
}

/**
 * Find the LAST create-call whose input.name === name and return its id.
 * jest's async mock makes results[i].value a Promise; we await it.
 */
async function lastCreatedId(repo: ReturnType<typeof makeRepo>, name: string): Promise<string> {
  const calls = (repo.create as jest.Mock).mock.calls;
  for (let i = calls.length - 1; i >= 0; i -= 1) {
    const input = calls[i][0] as Record<string, unknown>;
    if (input?.name === name) {
      const result = (repo.create as jest.Mock).mock.results[i];
      // async mock results return a Promise; await it.
      const value = await (result.value as Promise<Record<string, unknown>>);
      return value.id as string;
    }
  }
  throw new Error(`no create call found with name=${name}`);
}

describe('DealsService — list / get', () => {
  it('list delegates to repository with actor.tenantId', async () => {
    const { svc, repo } = build();
    await svc.list(ACTOR, {}, 1, 25, 'updatedAt', 'desc');
    expect((repo.findAll as jest.Mock)).toHaveBeenCalledWith(
      TENANT, {}, 1, 25, 'updatedAt', 'desc',
    );
  });

  it('get throws NotFoundException when deal not in tenant', async () => {
    const { svc } = build();
    await expect(svc.get(ACTOR, 'no-such')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DealsService — create', () => {
  it('creates a LEAD deal with probability=0.10', async () => {
    const { svc, repo, prisma } = build();
    const created = await svc.create(ACTOR, {
      tenantId: TENANT,
      name: 'Acme renewal',
      amount: 100,
    } as never);
    expect((repo.create as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({ probability: 0.1 }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(created).toBeDefined();
  });

  it('rejects when tenantId is "*"', async () => {
    const { svc } = build();
    await expect(
      svc.create({ ...ACTOR, tenantId: '*' }, { tenantId: '*', name: 'x', amount: 0 } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses non-OWNER/ADMIN', async () => {
    const { svc } = build();
    await expect(
      svc.create(
        { ...ACTOR, role: UserRole.USER },
        { tenantId: TENANT, name: 'x', amount: 0 } as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires expectedCloseDate when stage ≥ PROPOSAL', async () => {
    const { svc } = build();
    await expect(
      svc.create(ACTOR, {
        tenantId: TENANT,
        name: 'Pre-prop',
        amount: 100,
        stage: 'PROPOSAL',
        // expectedCloseDate: undefined
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects customer from another tenant', async () => {
    const prisma = makePrismaStub({ customer: null });
    const { svc } = build({ prisma });
    await expect(
      svc.create(ACTOR, {
        tenantId: TENANT,
        name: 'cross-tenant',
        amount: 1,
        customerId: 'cust-other-tenant',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('DealsService — update', () => {
  it('PATCH that changes stage is rejected — must use transitions endpoint', async () => {
    const { svc, repo } = build();
    // Seed a deal; filter create-call results by 'name' field.
    await svc.create(ACTOR, { tenantId: TENANT, name: 'X', amount: 10 } as never);
    const id = await lastCreatedId(repo, 'X');

    await expect(
      svc.update(ACTOR, id, { stage: 'QUALIFIED' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PATCH that only updates metadata is allowed', async () => {
    const { svc, repo } = build();
    await svc.create(ACTOR, { tenantId: TENANT, name: 'X-meta', amount: 10 } as never);
    const id = await lastCreatedId(repo, 'X-meta');

    const result = await svc.update(ACTOR, id, { name: 'Y' } as never);
    expect((result as Record<string, unknown>).name).toBe('Y');
  });
});

describe('DealsService — transitions', () => {
  async function seedStage(svc: DealsService, repo: ReturnType<typeof makeRepo>, stage: 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST') {
    const name = `seed-${stage}-${Date.now()}-${Math.random()}`;
    await svc.create(ACTOR, {
      tenantId: TENANT,
      name,
      amount: 100,
      stage,
      expectedCloseDate:
        stage === 'PROPOSAL' || stage === 'NEGOTIATION' || stage === 'WON'
          ? new Date(Date.now() + 30 * 86400_000).toISOString()
          : undefined,
    } as never);
    return lastCreatedId(repo, name);
  }

  it('LEAD → QUALIFIED is allowed', async () => {
    const { svc, repo } = build();
    const id = await seedStage(svc, repo, 'LEAD');
    await expect(
      svc.transitionTo(ACTOR, id, 'QUALIFIED'),
    ).resolves.toBeDefined();
  });

  it('LEAD → WON is NOT allowed (skip stages)', async () => {
    const { svc, repo } = build();
    const id = await seedStage(svc, repo, 'LEAD');
    await expect(
      svc.transitionTo(ACTOR, id, 'WON'),
    ).rejects.toThrow(/cannot transition deal from LEAD to WON/);
  });

  it('any → LOST is allowed', async () => {
    const { svc, repo } = build();
    const id = await seedStage(svc, repo, 'NEGOTIATION');
    await expect(
      svc.transitionTo(ACTOR, id, 'LOST', 'lost to competitor'),
    ).resolves.toBeDefined();
  });

  it('WON → anything is NOT allowed (terminal state)', async () => {
    const { svc, repo } = build();
    const id = await seedStage(svc, repo, 'WON');
    await expect(
      svc.transitionTo(ACTOR, id, 'NEGOTIATION'),
    ).rejects.toThrow(/cannot transition/);
  });

  it('probability auto-defaults per stage on transition', async () => {
    const { svc, repo } = build();
    const id = await seedStage(svc, repo, 'LEAD');
    await svc.transitionTo(ACTOR, id, 'QUALIFIED');
    // Find the most recent update call.
    const calls = (repo.update as jest.Mock).mock.calls;
    const last = calls[calls.length - 1][2];
    expect(last).toEqual(expect.objectContaining({ stage: 'QUALIFIED', probability: 0.25 }));
  });

  it('transitionTo writes an audit row with from/to', async () => {
    const { svc, repo, prisma } = build();
    const id = await seedStage(svc, repo, 'LEAD');
    (prisma.auditLog.create as jest.Mock).mockClear();
    await svc.transitionTo(ACTOR, id, 'QUALIFIED');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'deal.transitioned',
          resource: 'deal',
          resourceId: id,
        }),
      }),
    );
  });
});

describe('DealsService — forecast', () => {
  it('forecastForTenant rejects wildcard', async () => {
    const { svc } = build();
    await expect(svc.forecastForTenant('*')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('weighted total + committed + best case computed correctly', async () => {
    const rows = [
      { stage: 'LEAD',        amount: 100, probability: 0.1 },
      { stage: 'QUALIFIED',   amount: 200, probability: 0.25 },
      { stage: 'PROPOSAL',    amount: 400, probability: 0.5 },
      { stage: 'NEGOTIATION', amount: 800, probability: 0.75 },
      { stage: 'WON',         amount: 1600, probability: 1.0 },
      { stage: 'LOST',        amount: 50,  probability: 0.0 },
    ];
    const prisma = makePrismaStub({
      deals: rows.map((r) => ({
        amount: { toString: () => String(r.amount) },
        probability: { toString: () => String(r.probability) },
        stage: r.stage,
      })),
    });
    const { svc } = build({ prisma });
    const out = await svc.forecastForTenant(TENANT);

    // weighted = sum(amount * prob)
    const expectedWeighted = 100*0.1 + 200*0.25 + 400*0.5 + 800*0.75 + 1600*1.0 + 50*0.0;
    expect(out.weightedTotal).toBeCloseTo(expectedWeighted, 4);

    // committed = NEGOTIATION + WON
    expect(out.committedTotal).toBe(800 + 1600);

    // best case = everything except LOST
    expect(out.bestCaseTotal).toBe(100 + 200 + 400 + 800 + 1600);

    // total
    expect(out.totalAmount).toBe(100 + 200 + 400 + 800 + 1600 + 50);
    expect(out.dealsCount).toBe(6);
  });

  it('returns zeroed forecast when tenant has no deals', async () => {
    const { svc } = build();
    const out = await svc.forecastForTenant(TENANT);
    expect(out.weightedTotal).toBe(0);
    expect(out.committedTotal).toBe(0);
    expect(out.bestCaseTotal).toBe(0);
    expect(out.dealsCount).toBe(0);
  });
});

describe('DealsService — soft delete', () => {
  it('softDelete delegates and audits', async () => {
    const { svc, repo, prisma } = build();
    await svc.create(ACTOR, { tenantId: TENANT, name: 'del-1', amount: 10 } as never);
    const id = await lastCreatedId(repo, 'del-1');
    (prisma.auditLog.create as jest.Mock).mockClear();
    await svc.softDelete(ACTOR, id);
    expect(repo.softDelete).toHaveBeenCalledWith(TENANT, id);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'deal.deleted' }),
      }),
    );
  });
});
