import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AgentTemplatesController } from '../../src/modules/agent-templates/agent-templates.controller';
import { DepartmentTemplatesController } from '../../src/modules/department-templates/department-templates.controller';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator';

const mockAgentTemplatesService = {
  findAllPlatform: jest.fn(),
  findAll: jest.fn(),
  cloneToTenant: jest.fn(),
  create: jest.fn(),
};

const mockPacksService = {
  listPacks: jest.fn(),
  getPack: jest.fn(),
  installPack: jest.fn(),
};

const mockDepartmentTemplatesService = {
  findAll: jest.fn(),
};

describe('Template controllers', () => {
  let agentTemplatesController: AgentTemplatesController;
  let departmentTemplatesController: DepartmentTemplatesController;

  beforeEach(() => {
    jest.clearAllMocks();
    agentTemplatesController = new AgentTemplatesController(
      mockAgentTemplatesService as any,
      mockPacksService as any,
    );
    departmentTemplatesController = new DepartmentTemplatesController(
      mockDepartmentTemplatesService as any,
    );
  });

  it('forces super admins onto the platform template listing route', async () => {
    expect(() =>
      agentTemplatesController.findAll(
        {
          role: UserRole.SUPER_ADMIN,
          tenantId: null,
          sub: 'super-admin',
        } as any,
        undefined,
        '1',
        '20',
      ),
    ).toThrow(BadRequestException);
    expect(mockAgentTemplatesService.findAll).not.toHaveBeenCalled();
  });

  it('requires tenant context for tenant-scoped agent template operations', async () => {
    expect(() =>
      agentTemplatesController.create(
        { name: 'Ops Template' } as any,
        {
          role: UserRole.OWNER,
          tenantId: null,
          sub: 'owner-1',
        } as any,
      ),
    ).toThrow(ForbiddenException);
    expect(mockAgentTemplatesService.create).not.toHaveBeenCalled();
  });

  it('binds tenant-scoped template creation to the authenticated tenant', async () => {
    mockAgentTemplatesService.create.mockResolvedValue({ id: 'template-1' });

    await agentTemplatesController.create(
      { name: 'Ops Template' } as any,
      {
        role: UserRole.OWNER,
        tenantId: 'tenant-1',
        sub: 'owner-1',
      } as any,
    );

    expect(mockAgentTemplatesService.create).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ name: 'Ops Template' }),
    );
  });

  it('documents platform definition mutation as super-admin only on template controllers', () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        AgentTemplatesController.prototype.createPlatform,
      ),
    ).toEqual([UserRole.SUPER_ADMIN]);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        AgentTemplatesController.prototype.updatePlatform,
      ),
    ).toEqual([UserRole.SUPER_ADMIN]);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        AgentTemplatesController.prototype.removePlatform,
      ),
    ).toEqual([UserRole.SUPER_ADMIN]);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        DepartmentTemplatesController.prototype.create,
      ),
    ).toEqual([UserRole.SUPER_ADMIN]);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        DepartmentTemplatesController.prototype.update,
      ),
    ).toEqual([UserRole.SUPER_ADMIN]);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        DepartmentTemplatesController.prototype.remove,
      ),
    ).toEqual([UserRole.SUPER_ADMIN]);
  });

  it('keeps department template listing wired through the existing service contract', async () => {
    mockDepartmentTemplatesService.findAll.mockResolvedValue({
      items: [],
      total: 0,
    });

    await departmentTemplatesController.findAll('operations', '2', '15');

    expect(mockDepartmentTemplatesService.findAll).toHaveBeenCalledWith({
      category: 'operations',
      page: 2,
      limit: 15,
    });
  });
});
