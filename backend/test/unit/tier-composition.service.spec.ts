import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TierCompositionService } from '../../src/modules/tiers/services/tier-composition.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

const mockPrisma = {
  tier: {
    findUnique: jest.fn(),
  },
  agentTemplate: {
    findUnique: jest.fn(),
  },
  departmentTemplate: {
    findUnique: jest.fn(),
  },
  tierAgentPool: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  tierDepartmentPool: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  agent: {
    count: jest.fn(),
  },
  department: {
    count: jest.fn(),
  },
};

describe('TierCompositionService', () => {
  let service: TierCompositionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TierCompositionService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(TierCompositionService);
  });

  it('rejects adding a duplicate agent template to the same tier', async () => {
    mockPrisma.tier.findUnique.mockResolvedValue({
      id: 'tier-1',
      name: 'Growth',
    });
    mockPrisma.agentTemplate.findUnique.mockResolvedValue({
      id: 'template-1',
      name: 'Ops Agent',
    });
    mockPrisma.tierAgentPool.findUnique.mockResolvedValue({ id: 'pool-1' });

    await expect(
      service.addAgentTemplateToTier({
        tierId: 'tier-1',
        templateId: 'template-1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.tierAgentPool.create).not.toHaveBeenCalled();
  });

  it('defaults department slot and required flags from tier policy inputs', async () => {
    mockPrisma.tier.findUnique.mockResolvedValue({
      id: 'tier-1',
      name: 'Growth',
    });
    mockPrisma.departmentTemplate.findUnique.mockResolvedValue({
      id: 'dept-template-1',
      name: 'Operations',
    });
    mockPrisma.tierDepartmentPool.findUnique.mockResolvedValue(null);
    mockPrisma.tierDepartmentPool.findFirst.mockResolvedValue({ slot: 4 });
    mockPrisma.tierDepartmentPool.create.mockResolvedValue({
      id: 'dept-pool-1',
      slot: 5,
      slotType: 'FIXED',
      isRequired: true,
    });

    await service.addDepartmentTemplateToTier({
      tierId: 'tier-1',
      departmentTemplateId: 'dept-template-1',
      slotType: 'FIXED',
    });

    expect(mockPrisma.tierDepartmentPool.create).toHaveBeenCalledWith({
      data: {
        tierId: 'tier-1',
        departmentTemplateId: 'dept-template-1',
        slot: 5,
        slotType: 'FIXED',
        isRequired: true,
        isDefaultSelected: true,
      },
      include: { departmentTemplate: true },
    });
  });

  it('blocks removing an agent pool entry that still has active tenant usage', async () => {
    mockPrisma.tierAgentPool.findUnique.mockResolvedValue({
      id: 'pool-1',
      template: { name: 'Ops Agent' },
      tier: { name: 'Growth' },
    });
    mockPrisma.agent.count.mockResolvedValue(2);

    await expect(service.removeAgentTemplateFromTier('pool-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.tierAgentPool.delete).not.toHaveBeenCalled();
  });
});
