import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { TenantsService } from '../../src/modules/tenants/tenants.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { TenantDeploymentService } from '../../src/modules/tiers/services/tenant-deployment.service';

const mockPrisma = {
  tenant: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  agent: {
    update: jest.fn(),
  },
  department: {
    update: jest.fn(),
  },
};

const mockTenantDeploymentService = {
  previewTierBootstrap: jest.fn(),
  bootstrapTenantTier: jest.fn(),
};

describe('TenantsService', () => {
  let service: TenantsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: TenantDeploymentService,
          useValue: mockTenantDeploymentService,
        },
      ],
    }).compile();

    service = module.get(TenantsService);
  });

  it('builds a blocking tier-change preview with required provisioning and policy drift details', async () => {
    mockTenantDeploymentService.previewTierBootstrap.mockResolvedValue({
      id: 'tenant-1',
      name: 'Tenant One',
      tenantId: 'tenant-1',
      tenantName: 'Tenant One',
      currentTier: {
        id: 'tier-starter',
        name: 'Starter',
        slug: 'starter',
        maxAgents: 5,
      },
      targetTier: {
        id: 'tier-growth',
        name: 'Growth',
        slug: 'growth',
        maxAgents: 3,
      },
      usage: {
        selectedAgents: 4,
        selectedDepartments: 1,
      },
      compatibility: {
        canChange: false,
        blockingReasons: [
          'Tenant has 4 selected agents but target tier allows only 3',
        ],
      },
      impact: {
        agentsToProvision: [
          {
            templateId: 'tmpl-growth-required',
            templateName: 'Growth Required Agent',
            slotType: 'FIXED',
          },
        ],
        departmentsToProvision: [
          {
            templateId: 'dept-growth-required',
            templateName: 'Growth Required Department',
            slotType: 'FIXED',
          },
        ],
        reusableAgents: [],
        reusableDepartments: [],
        tierLinkedAgentsOutsideTargetPolicy: [
          {
            id: 'agent-2',
            name: 'Legacy Agent',
            templateId: 'tmpl-legacy',
          },
        ],
        tierLinkedDepartmentsOutsideTargetPolicy: [
          {
            id: 'dept-1',
            name: 'Legacy Department',
            templateId: 'dept-legacy',
          },
        ],
      },
    });

    const preview = await service.previewTierChange('tenant-1', 'tier-growth');

    expect(preview.compatibility.canChange).toBe(false);
    expect(preview.compatibility.blockingReasons).toEqual([
      'Tenant has 4 selected agents but target tier allows only 3',
    ]);
    expect(preview.impact.agentsToProvision).toEqual([
      {
        templateId: 'tmpl-growth-required',
        templateName: 'Growth Required Agent',
        slotType: 'FIXED',
      },
    ]);
    expect(preview.impact.departmentsToProvision).toEqual([
      {
        templateId: 'dept-growth-required',
        templateName: 'Growth Required Department',
        slotType: 'FIXED',
      },
    ]);
    expect(preview.impact.tierLinkedAgentsOutsideTargetPolicy).toEqual([
      {
        id: 'agent-2',
        name: 'Legacy Agent',
        templateId: 'tmpl-legacy',
      },
    ]);
    expect(preview.impact.tierLinkedDepartmentsOutsideTargetPolicy).toEqual([
      {
        id: 'dept-1',
        name: 'Legacy Department',
        templateId: 'dept-legacy',
      },
    ]);
  });

  it('changes tier when the preview is compatible', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      name: 'Tenant One',
      slug: 'tenant-one',
      tierId: 'tier-starter',
      tier: {
        id: 'tier-starter',
        name: 'Starter',
        slug: 'starter',
        maxAgents: 5,
      },
    });
    mockTenantDeploymentService.previewTierBootstrap.mockResolvedValue({
      tenantId: 'tenant-1',
      tenantName: 'Tenant One',
      currentTier: {
        id: 'tier-starter',
        name: 'Starter',
        slug: 'starter',
        maxAgents: 5,
      },
      targetTier: {
        id: 'tier-growth',
        name: 'Growth',
        slug: 'growth',
        maxAgents: 10,
      },
      usage: {
        selectedAgents: 1,
        selectedDepartments: 0,
      },
      compatibility: {
        canChange: true,
        blockingReasons: [],
      },
      impact: {
        agentsToProvision: [],
        departmentsToProvision: [],
        reusableAgents: [],
        reusableDepartments: [],
        tierLinkedAgentsOutsideTargetPolicy: [],
        tierLinkedDepartmentsOutsideTargetPolicy: [],
      },
    });
    mockPrisma.tenant.update.mockResolvedValue({
      id: 'tenant-1',
      tierId: 'tier-growth',
      tier: {
        id: 'tier-growth',
        name: 'Growth',
        slug: 'growth',
        maxAgents: 10,
      },
    });
    mockTenantDeploymentService.bootstrapTenantTier.mockResolvedValue({
      tenantId: 'tenant-1',
      tierId: 'tier-growth',
      departmentsProvisioned: 0,
      departmentIds: [],
      departmentsReused: 0,
      agentsProvisioned: 0,
      agentIds: [],
      agentsReused: 0,
    });

    const result = await service.changeTier('tenant-1', 'tier-growth');

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { tierId: 'tier-growth' },
      include: { tier: true },
    });
    expect(
      mockTenantDeploymentService.bootstrapTenantTier,
    ).toHaveBeenCalledWith('tenant-1', 'tier-growth', undefined);
    expect(result.tierId).toBe('tier-growth');
  });

  it('rejects tier changes when the preview is incompatible', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      name: 'Tenant One',
      slug: 'tenant-one',
      tier: {
        id: 'tier-starter',
        name: 'Starter',
        slug: 'starter',
        maxAgents: 5,
      },
    });
    mockTenantDeploymentService.previewTierBootstrap.mockResolvedValue({
      tenantId: 'tenant-1',
      tenantName: 'Tenant One',
      currentTier: {
        id: 'tier-starter',
        name: 'Starter',
        slug: 'starter',
        maxAgents: 5,
      },
      targetTier: {
        id: 'tier-growth',
        name: 'Growth',
        slug: 'growth',
        maxAgents: 0,
      },
      usage: {
        selectedAgents: 1,
        selectedDepartments: 0,
      },
      compatibility: {
        canChange: false,
        blockingReasons: ['Target tier is incompatible'],
      },
      impact: {
        agentsToProvision: [],
        departmentsToProvision: [],
        reusableAgents: [],
        reusableDepartments: [],
        tierLinkedAgentsOutsideTargetPolicy: [],
        tierLinkedDepartmentsOutsideTargetPolicy: [],
      },
    });

    await expect(service.changeTier('tenant-1', 'tier-growth')).rejects.toThrow(
      ConflictException,
    );
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
  });
});
