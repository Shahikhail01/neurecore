import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TenantDeploymentService } from '../../src/modules/tiers/services/tenant-deployment.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { EventsGateway } from '../../src/modules/events/events.gateway';
import { AssignmentService } from '../../src/modules/tiers/services/assignment.service';
import { TenantResourcePolicyService } from '../../src/modules/tiers/services/tenant-resource-policy.service';

const mockPrisma = {
  agentTemplate: {
    findFirst: jest.fn(),
  },
  agent: {
    count: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  tierAgentPool: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockEvents = {
  emitAgentStatusUpdated: jest.fn(),
};

const mockAssignments = {
  resolveDepartmentAssignment: jest.fn(),
};

const mockPolicy = {
  assertTenantExists: jest.fn(),
  assertTierMatchesTenant: jest.fn(),
  assertNoDuplicateFixedDepartmentTemplateDeployment: jest.fn(),
};

describe('TenantDeploymentService', () => {
  let service: TenantDeploymentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantDeploymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsGateway, useValue: mockEvents },
        { provide: AssignmentService, useValue: mockAssignments },
        { provide: TenantResourcePolicyService, useValue: mockPolicy },
      ],
    }).compile();

    service = module.get(TenantDeploymentService);
  });

  it('blocks template spawn when the tenant has reached the tier agent limit', async () => {
    mockPrisma.agentTemplate.findFirst.mockResolvedValue({
      id: 'template-1',
      isPublic: true,
      tenantId: null,
    });
    mockPolicy.assertTenantExists.mockResolvedValue({
      id: 'tenant-1',
      tier: { maxAgents: 2 },
    });
    mockPrisma.agent.count.mockResolvedValue(2);

    await expect(
      service.spawnFromTemplate(
        'template-1',
        { tenantId: 'tenant-1', name: 'Ops Agent' } as any,
        'actor-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.agent.create).not.toHaveBeenCalled();
  });

  it('provisions only default-selected tier agents and records deployment lineage', async () => {
    mockPolicy.assertTierMatchesTenant.mockResolvedValue({
      id: 'tenant-1',
      slug: 'tenant-one',
      tier: { maxAgents: 10 },
    });
    mockPrisma.tierAgentPool.findMany.mockResolvedValue([
      {
        id: 'slot-fixed',
        isDefaultSelected: true,
        slotType: 'FIXED',
        isRequired: false,
        defaultModel: 'gpt-5.4',
        defaultBudgetPerDay: '25',
        template: {
          id: 'template-1',
          name: 'Core Agent',
          description: 'Core agent',
          type: 'CORE',
          model: 'gpt-4',
          systemPrompt: 'Prompt',
          instructions: 'Instructions',
          permissions: [],
          config: {},
          version: 3,
        },
      },
      {
        id: 'slot-optional',
        isDefaultSelected: false,
        slotType: 'CHOICE',
        isRequired: false,
        defaultModel: null,
        defaultBudgetPerDay: null,
        template: {
          id: 'template-2',
          name: 'Optional Agent',
          description: 'Optional agent',
          type: 'FUNCTIONAL',
          model: 'gpt-4',
          systemPrompt: 'Prompt',
          instructions: 'Instructions',
          permissions: [],
          config: {},
          version: 1,
        },
      },
    ]);
    mockPrisma.agent.findMany.mockResolvedValue([]);
    mockPrisma.agent.count.mockResolvedValue(0);
    mockPrisma.agent.create.mockImplementation(({ data }: { data: any }) => ({
      id: `created-${data.templateId}`,
      ...data,
    }));
    mockPrisma.$transaction.mockImplementation((calls: any[]) =>
      Promise.all(calls),
    );

    const result = await service.provisionAgentsForTier(
      'tenant-1',
      'tier-growth',
      'actor-1',
    );

    expect(mockPrisma.agent.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.agent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        tierAgentPoolId: 'slot-fixed',
        templateId: 'template-1',
        deployedFromTierId: 'tier-growth',
        isFixed: true,
        createdById: 'actor-1',
        model: 'gpt-5.4',
      }),
    });
    expect(result).toEqual({
      tenantId: 'tenant-1',
      tierId: 'tier-growth',
      agentsProvisioned: 1,
      agentIds: ['created-template-1'],
      agentsReused: 0,
    });
  });

  it('returns an empty provisioning result when a tier has no agent pool entries', async () => {
    mockPolicy.assertTierMatchesTenant.mockResolvedValue({
      id: 'tenant-1',
      slug: 'tenant-one',
      tier: { maxAgents: 10 },
    });
    mockPrisma.tierAgentPool.findMany.mockResolvedValue([]);

    await expect(
      service.provisionAgentsForTier('tenant-1', 'tier-growth'),
    ).resolves.toEqual({
      tenantId: 'tenant-1',
      tierId: 'tier-growth',
      agentsProvisioned: 0,
      agentIds: [],
      agentsReused: 0,
    });
    expect(mockPrisma.agent.create).not.toHaveBeenCalled();
  });
});
