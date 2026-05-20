import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentService } from '../../src/modules/tiers/services/assignment.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { TenantResourcePolicyService } from '../../src/modules/tiers/services/tenant-resource-policy.service';

const mockPrisma = {
  agent: {
    update: jest.fn(),
  },
};

const mockPolicy = {
  assertDepartmentBelongsToTenant: jest.fn(),
  assertAgentBelongsToTenant: jest.fn(),
  assertTierAgentPoolBelongsToTenant: jest.fn(),
};

describe('AssignmentService', () => {
  let service: AssignmentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TenantResourcePolicyService, useValue: mockPolicy },
      ],
    }).compile();

    service = module.get(AssignmentService);
  });

  it('assigns an agent to a tenant-owned department after policy validation', async () => {
    mockPolicy.assertDepartmentBelongsToTenant.mockResolvedValue({
      id: 'dept-1',
    });
    mockPrisma.agent.update.mockResolvedValue({
      id: 'agent-1',
      departmentId: 'dept-1',
    });

    await service.assignAgentToDepartment('tenant-1', 'agent-1', 'dept-1');

    expect(mockPolicy.assertAgentBelongsToTenant).toHaveBeenCalledWith(
      'tenant-1',
      'agent-1',
    );
    expect(mockPolicy.assertDepartmentBelongsToTenant).toHaveBeenCalledWith(
      'tenant-1',
      'dept-1',
    );
    expect(mockPrisma.agent.update).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: { departmentId: 'dept-1' },
    });
  });

  it('clears department assignment when no department is provided', async () => {
    mockPrisma.agent.update.mockResolvedValue({
      id: 'agent-1',
      departmentId: null,
    });

    await service.assignAgentToDepartment('tenant-1', 'agent-1', null);

    expect(mockPolicy.assertDepartmentBelongsToTenant).not.toHaveBeenCalled();
    expect(mockPrisma.agent.update).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: { departmentId: null },
    });
  });

  it('assigns a tier slot with deployment lineage and fixed-resource flags', async () => {
    mockPolicy.assertTierAgentPoolBelongsToTenant.mockResolvedValue({
      tenant: { tierId: 'tier-growth' },
      poolSlot: { id: 'slot-1', slotType: 'CHOICE', isRequired: true },
    });
    mockPrisma.agent.update.mockResolvedValue({
      id: 'agent-1',
      tierAgentPoolId: 'slot-1',
    });

    await service.assignAgentToTierSlot('tenant-1', 'agent-1', 'slot-1');

    expect(mockPrisma.agent.update).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: {
        tierAgentPoolId: 'slot-1',
        deployedFromTierId: 'tier-growth',
        isFixed: true,
        isSelected: true,
      },
    });
  });
});
