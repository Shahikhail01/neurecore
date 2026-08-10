import { PrismaClient, WorkRunStatus } from '@prisma/client';
import { AgentTenantScopeGuard } from '../../agents/agents-tenant-scope.guard';
import { EmployeeResolutionError } from './employee-resolution.errors';
import { EmployeeResolverService } from './employee-resolver.service';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);
const describeDb = HAS_DB ? describe : describe.skip;

describeDb('EmployeeResolverService — real PostgreSQL tenant isolation', () => {
  let prisma: PrismaClient;
  let resolver: EmployeeResolverService;
  let tierId: string;
  let tenantA: string;
  let tenantB: string;
  let employeeId: string;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();

    const tier = await prisma.tier.create({
      data: { name: `resolver-${suffix}`, slug: `resolver-${suffix}` },
    });
    tierId = tier.id;
    const tenants = await Promise.all([
      prisma.tenant.create({
        data: {
          name: `resolver-a-${suffix}`,
          slug: `resolver-a-${suffix}`,
          tierId,
        },
      }),
      prisma.tenant.create({
        data: {
          name: `resolver-b-${suffix}`,
          slug: `resolver-b-${suffix}`,
          tierId,
        },
      }),
    ]);
    tenantA = tenants[0].id;
    tenantB = tenants[1].id;
    const agent = await prisma.agent.create({
      data: {
        tenantId: tenantA,
        name: 'Resolver DB Employee',
        permissions: ['documents:read'],
        capabilities: ['documents.analyze'],
        maxConcurrency: 1,
      },
    });
    employeeId = agent.id;
    resolver = new EmployeeResolverService(
      prisma as never,
      new AgentTenantScopeGuard(),
    );
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.workRun.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.agent.deleteMany({ where: { id: employeeId } });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    });
    await prisma.tier.deleteMany({ where: { id: tierId } });
    await prisma.$disconnect();
  });

  it('resolves only through the owning tenant', async () => {
    await expect(resolver.resolve(tenantA, employeeId)).resolves.toMatchObject({
      id: employeeId,
      tenantId: tenantA,
    });
    await expect(resolver.resolve(tenantB, employeeId)).rejects.toMatchObject<
      Partial<EmployeeResolutionError>
    >({ code: 'EMPLOYEE_NOT_FOUND' });
  });

  it('derives capacity from a persisted non-terminal WorkRun', async () => {
    await prisma.workRun.create({
      data: {
        tenantId: tenantA,
        actorType: 'AI_AGENT',
        actorId: employeeId,
        employeeId,
        request: 'Analyze a tenant document',
        status: WorkRunStatus.RUNNING,
        contextProvenance: {},
      } as never,
    });

    await expect(resolver.resolve(tenantA, employeeId)).rejects.toMatchObject<
      Partial<EmployeeResolutionError>
    >({ code: 'EMPLOYEE_CONCURRENCY_EXCEEDED' });
  });
});
