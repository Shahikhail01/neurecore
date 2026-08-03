/**
 * TenantsService.getUsageSummary — SUPER_ADMIN read-only aggregate.
 *
 * Covers:
 *   - returns counts across all child delegates
 *   - derives utilization as a percentage of tier limits
 *   - returns tierDefaults with null limits when tier is missing
 *   - handles missing columns gracefully (best-effort count)
 */

import { TenantsService } from '../tenants.service';

function makeMockService(opts: {
  tenant: Record<string, unknown>;
  tier: Record<string, unknown> | null;
  counts: Record<string, number>;
} = {
  tenant: { id: 't1', name: 'Acme', slug: 'acme', status: 'ACTIVE' },
  tier: {
    id: 'tier-pro',
    slug: 'pro',
    name: 'Pro',
    maxUsers: 10,
    maxAgents: 5,
    maxDepartments: 12,
    maxStorageGB: 50,
    maxApiCalls: 10000,
    maxConversationMessages: 500,
    maxFileSizeMB: 25,
  },
  counts: {
    users: 4,
    agents: 2,
    departments: 3,
    projects: 1,
    conversations: 7,
    invoices: 2,
  },
}) {
  const findOne = jest.fn().mockResolvedValue({
    ...opts.tenant,
    tier: opts.tier,
    tierId: opts.tier?.id ?? null,
  });

  const findUnique = jest.fn().mockResolvedValue(opts.tier);

  const counts = opts.counts;
  const safeCount = jest.fn().mockImplementation(async () => {
    return undefined;
  });

  const makeDelegate = () => ({
    count: jest.fn().mockImplementation(async () => 0),
  });

  const prismaMock = {
    tenant: { findUnique: findOne },
    tier: { findUnique: findUnique },
    user: makeDelegate(),
    agent: makeDelegate(),
    department: makeDelegate(),
    project: makeDelegate(),
    chatSession: makeDelegate(),
    invoice: makeDelegate(),
  };

  // After construction, intercept the count methods to return our
  // canned counts. We monkey-patch the delegates to map by the
  // `where` argument's table name.
  const tableCounts: Record<string, number> = {
    user: counts.users,
    agent: counts.agents,
    department: counts.departments,
    project: counts.projects,
    chatSession: counts.conversations,
    invoice: counts.invoices,
  };

  for (const [table, delegate] of Object.entries(prismaMock) as Array<
    [string, { count?: jest.Mock }]
  >) {
    if (table === 'tenant' || table === 'tier') continue;
    delegate.count = jest.fn().mockImplementation((args: { where?: { tenantId?: string } }) => {
      if (args?.where?.tenantId !== 't1') return Promise.resolve(0);
      return Promise.resolve(tableCounts[table] ?? 0);
    });
  }

  const service = new TenantsService(prismaMock as never, {
    resolveIndustryGroup: jest.fn().mockResolvedValue(null),
  } as never);

  return { service, prismaMock, findOne, safeCount };
}

describe('TenantsService.getUsageSummary', () => {
  it('returns counts and derived utilization for a fully-instrumented tenant', async () => {
    const { service } = makeMockService();

    const result = await service.getUsageSummary('t1');

    expect(result.tenantId).toBe('t1');
    expect(result.tenantName).toBe('Acme');
    expect(result.tenantSlug).toBe('acme');
    expect(result.status).toBe('ACTIVE');
    expect(result.tier).toEqual({ id: 'tier-pro', slug: 'pro', name: 'Pro' });

    expect(result.counts.users).toBe(4);
    expect(result.counts.agents).toBe(2);
    expect(result.counts.departments).toBe(3);
    expect(result.counts.projects).toBe(1);
    expect(result.counts.conversations).toBe(7);
    expect(result.counts.invoices).toBe(2);

    expect(result.tierLimits.maxUsers).toBe(10);
    expect(result.tierLimits.maxAgents).toBe(5);
    expect(result.tierLimits.maxDepartments).toBe(12);

    expect(result.utilization.users).toBe(40); // 4 / 10
    expect(result.utilization.agents).toBe(40); // 2 / 5
    expect(result.utilization.departments).toBe(25); // 3 / 12
  });

  it('returns null tier limits when the tenant has no tier', async () => {
    const { service } = makeMockService({
      tenant: { id: 't2', name: 'Bare', slug: 'bare', status: 'TRIAL' },
      tier: null,
      counts: { users: 0, agents: 0, departments: 0, projects: 0, conversations: 0, invoices: 0 },
    });

    const result = await service.getUsageSummary('t2');

    expect(result.tier).toBeNull();
    expect(result.tierLimits.maxUsers).toBeNull();
    expect(result.utilization.users).toBeNull();
    expect(result.counts.users).toBe(0);
  });

  it('contains a generatedAt ISO timestamp', async () => {
    const { service } = makeMockService();
    const result = await service.getUsageSummary('t1');
    expect(new Date(result.generatedAt).toString()).not.toBe('Invalid Date');
  });
});
