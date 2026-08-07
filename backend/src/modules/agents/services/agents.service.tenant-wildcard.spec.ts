import { AgentsService } from './agents.service';

interface FakePrisma {
  agent: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  $transaction: jest.Mock;
}

function makeService(): {
  service: AgentsService;
  prisma: FakePrisma;
} {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const $transaction = jest
    .fn()
    .mockImplementation(() => Promise.resolve([[], 0]));
  const prisma: FakePrisma = {
    agent: { findMany, count },
    $transaction,
  };
  const events = { emit: jest.fn() } as never;
  const service = new AgentsService(prisma as never, events);
  return { service, prisma };
}

describe('AgentsService.findAll — tenant isolation (P0-001, closed by Phase 18)', () => {
  it('throws AgentTenantScopeError(CROSS_TENANT) when tenantId is "*"', async () => {
    const { service, prisma } = makeService();
    await expect(
      service.findAll({ page: 1, limit: 20 }, '*'),
    ).rejects.toMatchObject({
      name: 'AgentTenantScopeError',
      reason: 'CROSS_TENANT',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws AgentTenantScopeError(MISSING_TENANT) when tenantId is undefined', async () => {
    const { service, prisma } = makeService();
    await expect(
      service.findAll({ page: 1, limit: 20 }, undefined),
    ).rejects.toMatchObject({
      name: 'AgentTenantScopeError',
      reason: 'MISSING_TENANT',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws AgentTenantScopeError(MISSING_TENANT) when tenantId is empty string', async () => {
    const { service, prisma } = makeService();
    await expect(
      service.findAll({ page: 1, limit: 20 }, ''),
    ).rejects.toMatchObject({
      name: 'AgentTenantScopeError',
      reason: 'MISSING_TENANT',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('always includes tenantId in the WHERE clause for real tenants', async () => {
    const { service, prisma } = makeService();
    prisma.$transaction.mockResolvedValueOnce([[], 0]);
    await service.findAll({ page: 1, limit: 20 }, 'tenant-real-001');
    const findManyArgs = prisma.agent.findMany.mock.calls[0] as Array<{
      where: Record<string, unknown>;
    }>;
    expect(findManyArgs[0].where.tenantId).toBe('tenant-real-001');
  });

  it('does NOT emit a query with no tenantId key under any circumstance', async () => {
    const { service, prisma } = makeService();
    prisma.$transaction.mockResolvedValueOnce([[], 0]);
    await service.findAll({ page: 1, limit: 20 }, 'tenant-real-002');
    const findManyArgs = prisma.agent.findMany.mock.calls[0] as Array<{
      where: Record<string, unknown>;
    }>;
    expect('tenantId' in findManyArgs[0].where).toBe(true);
  });
});
