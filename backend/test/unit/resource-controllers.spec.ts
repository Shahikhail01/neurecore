import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AgentsController } from '../../src/modules/agents/agents.controller';
import { DepartmentsController } from '../../src/modules/departments/departments.controller';

const mockAgentsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findOneForPlatform: jest.fn(),
};

const mockDepartmentsService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findOneForPlatform: jest.fn(),
  assignTierSlot: jest.fn(),
};

const mockAssignmentService = {
  assignAgentToTierSlot: jest.fn(),
};

const mockTenantPolicy = {
  assertAllowedTenantAgentUpdate: jest.fn((value) => value),
  assertAllowedTenantDepartmentUpdate: jest.fn((value) => value),
};

describe('Live resource controllers', () => {
  let agentsController: AgentsController;
  let departmentsController: DepartmentsController;

  beforeEach(() => {
    jest.clearAllMocks();
    agentsController = new AgentsController(
      mockAgentsService as any,
      {} as any,
      {} as any,
      {} as any,
      mockAssignmentService as any,
      mockTenantPolicy as any,
    );
    departmentsController = new DepartmentsController(
      mockDepartmentsService as any,
      mockTenantPolicy as any,
    );
  });

  it('requires explicit platform scope for platform agent listings', async () => {
    expect(() =>
      agentsController.findAll(
        {
          role: UserRole.PLATFORM_ADMIN,
          tenantId: null,
          sub: 'platform-1',
        } as any,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '1',
        '20',
      ),
    ).toThrow(BadRequestException);
    expect(mockAgentsService.findAll).not.toHaveBeenCalled();
  });

  it('uses platform reads for agent lookup when scope=platform is explicit', async () => {
    mockAgentsService.findOneForPlatform.mockResolvedValue({ id: 'agent-1' });

    await agentsController.findOne(
      '11111111-1111-1111-1111-111111111111',
      {
        role: UserRole.PLATFORM_ADMIN,
        tenantId: null,
        sub: 'platform-1',
      } as any,
      undefined,
      'platform',
    );

    expect(mockAgentsService.findOneForPlatform).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(mockAgentsService.findOne).not.toHaveBeenCalled();
  });

  it('forces tenant-admin agent tier-slot assignment to stay in the authenticated tenant', async () => {
    mockAssignmentService.assignAgentToTierSlot.mockResolvedValue({
      id: 'agent-1',
    });

    await agentsController.assignTierSlot(
      '11111111-1111-1111-1111-111111111111',
      { slotId: 'slot-1' } as any,
      {
        role: UserRole.OWNER,
        tenantId: 'tenant-1',
        sub: 'owner-1',
      } as any,
      'tenant-foreign',
    );

    expect(mockAssignmentService.assignAgentToTierSlot).toHaveBeenCalledWith(
      'tenant-1',
      '11111111-1111-1111-1111-111111111111',
      'slot-1',
    );
  });

  it('requires explicit platform scope for platform department listings', async () => {
    expect(() =>
      departmentsController.findAll(
        {
          role: UserRole.PLATFORM_ADMIN,
          tenantId: null,
          sub: 'platform-1',
        } as any,
        undefined,
        undefined,
      ),
    ).toThrow(BadRequestException);
    expect(mockDepartmentsService.findAll).not.toHaveBeenCalled();
  });

  it('resolves department tier-slot assignment tenant ownership from the stored record for platform roles', async () => {
    mockDepartmentsService.findOneForPlatform.mockResolvedValue({
      id: 'department-1',
      tenantId: 'tenant-1',
    });
    mockDepartmentsService.assignTierSlot.mockResolvedValue({
      id: 'department-1',
    });

    await departmentsController.assignTierSlot(
      '22222222-2222-2222-2222-222222222222',
      { slotId: 'slot-7' } as any,
      {
        role: UserRole.PLATFORM_ADMIN,
        tenantId: null,
        sub: 'platform-1',
      } as any,
      'tenant-foreign',
    );

    expect(mockDepartmentsService.assignTierSlot).toHaveBeenCalledWith(
      '22222222-2222-2222-2222-222222222222',
      'tenant-1',
      'slot-7',
    );
  });
});
