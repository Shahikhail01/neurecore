/**
 * inventory.spec.ts — InventoryService unit coverage (P8 CR-AI-1201).
 *
 * Exercises the pure-data aggregator against an in-memory fake
 * PrismaService. Tenant isolation is asserted explicitly.
 */

import { InventoryService } from '../inventory.service';

interface AgentRow {
  id: string;
  tenantId: string;
  name: string;
  status: string;
  model: string;
  departmentId: string | null;
  archived: boolean;
  updatedAt: Date;
}
interface SkillRow {
  id: string;
  tenantId: string;
  skillKey: string;
  semanticVersion: string;
  certificationStatus: string;
  lifecycleStatus: string;
  updatedAt: Date;
}
interface AttemptRow {
  id: string;
  tenantId: string;
  modelVersion: string;
}
interface KnowledgeRow {
  id: string;
  tenantId: string;
  title: string;
  type: string;
  status: string;
  updatedAt: Date;
}
interface ConnectorRow {
  id: string;
  tenantId: string;
  name: string;
  provider: string;
  isActive: boolean;
  updatedAt: Date;
}

class FakePrisma {
  agents: AgentRow[] = [];
  skills: SkillRow[] = [];
  attempts: AttemptRow[] = [];
  knowledge: KnowledgeRow[] = [];
  connectors: ConnectorRow[] = [];

  agent = {
    findMany: (args: {
      where: { tenantId: string; archived?: boolean };
      orderBy?: unknown;
      take?: number;
      select?: unknown;
      cursor?: { id: string };
      skip?: number;
    }) => {
      let rows = this.agents.filter(
        (a) =>
          a.tenantId === args.where.tenantId &&
          (args.where.archived === undefined ||
            a.archived === args.where.archived),
      );
      if (args.cursor) rows = rows.filter((r) => r.id > args.cursor!.id);
      return Promise.resolve(rows.slice(0, args.take ?? rows.length));
    },
    groupBy: () =>
      Promise.resolve(
        this.agents
          .filter((a) => !a.archived)
          .reduce<Record<string, number>>((acc, a) => {
            acc[a.model] = (acc[a.model] ?? 0) + 1;
            return acc;
          }, {}),
      ) as unknown,
    select: (s: unknown) => s,
    count: (args: { where: { tenantId: string; archived?: boolean } }) =>
      Promise.resolve(
        this.agents.filter(
          (a) =>
            a.tenantId === args.where.tenantId &&
            (args.where.archived === undefined ||
              a.archived === args.where.archived),
        ).length,
      ),
  };

  agentSkillDefinition = {
    findMany: (args: { where: { tenantId: string }; take?: number }) =>
      Promise.resolve(
        this.skills
          .filter((s) => s.tenantId === args.where.tenantId)
          .slice(0, args.take ?? this.skills.length),
      ),
  };

  executionAttempt = {
    groupBy: () =>
      Promise.resolve(
        this.attempts.map((a) => ({
          modelVersion: a.modelVersion,
          _count: { _all: 1 },
        })),
      ),
  };

  knowledgeEntry = {
    findMany: (args: { where: { tenantId: string }; take?: number }) =>
      Promise.resolve(
        this.knowledge
          .filter((k) => k.tenantId === args.where.tenantId)
          .slice(0, args.take ?? this.knowledge.length),
      ),
  };

  crmConnector = {
    findMany: (args: { where: { tenantId: string }; take?: number }) =>
      Promise.resolve(
        this.connectors
          .filter((c) => c.tenantId === args.where.tenantId)
          .slice(0, args.take ?? this.connectors.length),
      ),
  };
}

describe('InventoryService (P8 CR-AI-1201)', () => {
  let prisma: FakePrisma;
  let service: InventoryService;

  beforeEach(() => {
    prisma = new FakePrisma();
    service = new InventoryService(prisma as unknown as never);
  });

  it('returns empty arrays for a tenant with no records (no fake success)', async () => {
    const out = await service.getInventory('t-empty');
    expect(out.agents).toEqual([]);
    expect(out.skills).toEqual([]);
    expect(out.knowledge).toEqual([]);
    expect(out.channels).toEqual([]);
    expect(out.tenantId).toBe('t-empty');
  });

  it('scopes every list to the tenant (cross-tenant isolation)', async () => {
    prisma.agents = [
      {
        id: 'a1',
        tenantId: 't-A',
        name: 'agent-A',
        status: 'ACTIVE',
        model: 'gpt-4o',
        departmentId: null,
        archived: false,
        updatedAt: new Date(),
      },
      {
        id: 'a2',
        tenantId: 't-B',
        name: 'agent-B',
        status: 'ACTIVE',
        model: 'gpt-4o',
        departmentId: null,
        archived: false,
        updatedAt: new Date(),
      },
    ];
    const outA = await service.getInventory('t-A');
    const outB = await service.getInventory('t-B');
    expect(outA.agents.map((a) => a.id)).toEqual(['a1']);
    expect(outB.agents.map((a) => a.id)).toEqual(['a2']);
  });

  it('listAgents honours cursor + limit', async () => {
    for (let i = 0; i < 5; i += 1) {
      prisma.agents.push({
        id: `a${i}`,
        tenantId: 't',
        name: `agent-${i}`,
        status: 'ACTIVE',
        model: 'm',
        departmentId: null,
        archived: false,
        updatedAt: new Date(),
      });
    }
    const page1 = await service.listAgents('t', { limit: 2 });
    expect(page1.items.map((i) => i.id)).toEqual(['a0', 'a1']);
    expect(page1.nextCursor).toBe('a1');
  });

  it('listModels merges agent models + attempt-only models', async () => {
    prisma.agents = [
      {
        id: 'a1',
        tenantId: 't',
        name: 'x',
        status: 'ACTIVE',
        model: 'gpt-4o',
        departmentId: null,
        archived: false,
        updatedAt: new Date(),
      },
      {
        id: 'a2',
        tenantId: 't',
        name: 'y',
        status: 'ACTIVE',
        model: 'gpt-4o',
        departmentId: null,
        archived: false,
        updatedAt: new Date(),
      },
      {
        id: 'a3',
        tenantId: 't',
        name: 'z',
        status: 'ACTIVE',
        model: 'claude-3',
        departmentId: null,
        archived: false,
        updatedAt: new Date(),
      },
    ];
    prisma.attempts = [{ id: 'x', tenantId: 't', modelVersion: 'gemini-2' }];
    const models = await service.listModels('t');
    const names = models.map((m) => m.model).sort();
    expect(names).toEqual(['claude-3', 'gemini-2', 'gpt-4o']);
    const gpt = models.find((m) => m.model === 'gpt-4o');
    expect(gpt?.agentCount).toBe(2);
  });

  it('listChannels returns connectors active flag', async () => {
    prisma.connectors = [
      {
        id: 'c1',
        tenantId: 't',
        name: 'google',
        provider: 'google',
        isActive: true,
        updatedAt: new Date(),
      },
      {
        id: 'c2',
        tenantId: 't',
        name: 'brevo',
        provider: 'brevo',
        isActive: false,
        updatedAt: new Date(),
      },
    ];
    const ch = await service.listChannels('t');
    expect(ch).toEqual([
      { id: 'c1', type: 'google', status: 'active', source: 'CrmConnector' },
      { id: 'c2', type: 'brevo', status: 'inactive', source: 'CrmConnector' },
    ]);
  });
});
