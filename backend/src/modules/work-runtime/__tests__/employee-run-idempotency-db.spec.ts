import { PrismaClient } from '@prisma/client';
import { WorkRunRepository } from '../repository/work-run.repository';

const HAS_DB = Boolean(process.env.DATABASE_TEST_URL);
const describeDb = HAS_DB ? describe : describe.skip;

describeDb('Employee WorkRun idempotency — real PostgreSQL', () => {
  let prisma: PrismaClient;
  let repo: WorkRunRepository;
  let tierId: string;
  let tenantA: string;
  let tenantB: string;
  let employeeA: string;
  let employeeB: string;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_TEST_URL! } },
    });
    await prisma.$connect();
    const tier = await prisma.tier.create({
      data: { name: `run-idem-${suffix}`, slug: `run-idem-${suffix}` },
    });
    tierId = tier.id;
    const [a, b] = await Promise.all([
      prisma.tenant.create({
        data: { name: `run-a-${suffix}`, slug: `run-a-${suffix}`, tierId },
      }),
      prisma.tenant.create({
        data: { name: `run-b-${suffix}`, slug: `run-b-${suffix}`, tierId },
      }),
    ]);
    tenantA = a.id;
    tenantB = b.id;
    const [agentA, agentB] = await Promise.all([
      prisma.agent.create({ data: { name: 'Employee A', tenantId: tenantA } }),
      prisma.agent.create({ data: { name: 'Employee B', tenantId: tenantB } }),
    ]);
    employeeA = agentA.id;
    employeeB = agentB.id;
    repo = new WorkRunRepository(prisma as never);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.workRunStep.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.workRun.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } },
    });
    await prisma.agent.deleteMany({
      where: { id: { in: [employeeA, employeeB] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    });
    await prisma.tier.deleteMany({ where: { id: tierId } });
    await prisma.$disconnect();
  });

  const input = (tenantId: string, employeeId: string) => ({
    tenantId,
    actorId: employeeId,
    actorType: 'AI_AGENT' as const,
    employeeId,
    requestedByActorId: `requester-${tenantId}`,
    triggerType: 'USER',
    idempotencyKey: 'same-request-key',
    request: 'Create a report',
    contextProvenance: {},
  });

  it('creates one row and one winner-owned effect set under concurrent requests', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        repo.createOrGetByIdempotencyKey(input(tenantA, employeeA)),
      ),
    );
    const runIds = new Set(results.map((result) => result.run.id));
    expect(runIds.size).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);

    const winner = results.find((result) => result.created)!;
    await repo.createStep({
      runId: winner.run.id,
      tenantId: tenantA,
      sequence: 1,
      toolName: 'report.create',
      capability: 'reports',
      operationType: 'INTERNAL_WRITE',
      input: {},
      idempotencyKey: `${tenantA}:${winner.run.id}:effect-1`,
    });

    expect(
      await prisma.workRun.count({
        where: {
          tenantId: tenantA,
          idempotencyKey: 'same-request-key',
        } as never,
      }),
    ).toBe(1);
    expect(
      await prisma.workRunStep.count({ where: { runId: winner.run.id } }),
    ).toBe(1);
  });

  it('allows the same key in another tenant and keeps reads isolated', async () => {
    const result = await repo.createOrGetByIdempotencyKey(
      input(tenantB, employeeB),
    );
    expect(result.created).toBe(true);
    expect(await repo.findRun(result.run.id, tenantA)).toBeNull();
    expect(await repo.findRun(result.run.id, tenantB)).not.toBeNull();
  });

  it('rejects a foreign-tenant Employee before creating a WorkRun', async () => {
    await expect(
      repo.createOrGetByIdempotencyKey({
        ...input(tenantA, employeeB),
        idempotencyKey: 'foreign-employee-key',
      }),
    ).rejects.toThrow(/not found for tenant/);
    expect(
      await prisma.workRun.count({
        where: {
          tenantId: tenantA,
          idempotencyKey: 'foreign-employee-key',
        } as never,
      }),
    ).toBe(0);
  });

  it('keeps legacy rows readable with nullable Employee metadata', async () => {
    const legacy = await repo.createRun({
      tenantId: tenantA,
      actorId: `legacy-${suffix}`,
      actorType: 'HUMAN',
      request: 'Legacy request',
      contextProvenance: {},
    });
    const reloaded = await repo.findRun(legacy.id, tenantA);
    expect(reloaded).toMatchObject({
      employeeId: null,
      requestedByActorId: null,
      idempotencyKey: null,
      triggerType: 'USER',
    });
  });
});
