import {
  AgentClassification,
  AgentStatus,
  AwlAgentAvailability,
  WorkRunStatus,
} from '@prisma/client';
import {
  AgentTenantScopeError,
  AgentTenantScopeGuard,
} from '../../agents/agents-tenant-scope.guard';
import { EmployeeResolutionError } from './employee-resolution.errors';
import {
  EMPLOYEE_RESOLUTION_SELECT,
  EmployeeResolverService,
} from './employee-resolver.service';

const employee = (overrides: Record<string, unknown> = {}) => ({
  id: 'employee-a',
  tenantId: 'tenant-a',
  name: 'Analyst',
  role: 'ANALYST',
  departmentId: 'department-a',
  instructions: 'Analyze evidence.',
  systemPrompt: 'Be precise.',
  capabilities: ['documents.analyze'],
  permissions: ['documents:read'],
  dataClassification: AgentClassification.CONFIDENTIAL,
  budgetPerDay: null,
  status: AgentStatus.IDLE,
  availability: AwlAgentAvailability.AVAILABLE,
  isActive: true,
  isSelected: true,
  archived: false,
  maxConcurrency: 2,
  model: 'advisory-model',
  ...overrides,
});

describe('EmployeeResolverService', () => {
  let prisma: {
    agent: { findFirst: jest.Mock };
    workRun: { count: jest.Mock };
  };
  let resolver: EmployeeResolverService;

  beforeEach(() => {
    prisma = {
      agent: { findFirst: jest.fn().mockResolvedValue(employee()) },
      workRun: { count: jest.fn().mockResolvedValue(0) },
    };
    resolver = new EmployeeResolverService(
      prisma as never,
      new AgentTenantScopeGuard(),
    );
  });

  it('uses tenant-scoped narrow reads and returns an immutable projection', async () => {
    const result = await resolver.resolve('tenant-a', 'employee-a');

    expect(prisma.agent.findFirst).toHaveBeenCalledWith({
      where: { id: 'employee-a', tenantId: 'tenant-a' },
      select: EMPLOYEE_RESOLUTION_SELECT,
    });
    expect(prisma.workRun.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-a',
        status: {
          in: [
            WorkRunStatus.CREATED,
            WorkRunStatus.PLANNING,
            WorkRunStatus.PLANNED,
            WorkRunStatus.RUNNING,
            WorkRunStatus.WAITING_FOR_APPROVAL,
            WorkRunStatus.PAUSED,
          ],
        },
        employeeId: 'employee-a',
      },
    });
    expect(result).toMatchObject({
      id: 'employee-a',
      tenantId: 'tenant-a',
      capabilityNames: ['documents.analyze'],
      permissionNames: ['documents:read'],
      modelPreference: { model: 'advisory-model', advisory: true },
      lifecycle: { maxConcurrency: 2, activeWorkRuns: 0 },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.capabilityNames)).toBe(true);
    expect(Object.isFrozen(result.permissionNames)).toBe(true);
    expect(Object.isFrozen(result.authorityInputs)).toBe(true);
    expect(Object.isFrozen(result.lifecycle)).toBe(true);
    expect(Object.isFrozen(result.modelPreference)).toBe(true);
    expect(result).not.toHaveProperty('config');
    expect(result).not.toHaveProperty('metadata');
  });

  it.each([undefined, '', '*'])(
    'rejects unsafe tenant scope %p before querying',
    async (tenantId) => {
      await expect(
        resolver.resolve(tenantId as string, 'employee-a'),
      ).rejects.toBeInstanceOf(AgentTenantScopeError);
      expect(prisma.agent.findFirst).not.toHaveBeenCalled();
      expect(prisma.workRun.count).not.toHaveBeenCalled();
    },
  );

  it('uses the same not-found result for missing and foreign-tenant employees', async () => {
    prisma.agent.findFirst.mockResolvedValue(null);

    await expectCode(
      resolver.resolve('tenant-b', 'employee-a'),
      'EMPLOYEE_NOT_FOUND',
    );
    expect(prisma.agent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'employee-a', tenantId: 'tenant-b' },
      }),
    );
  });

  it.each([
    [{ isActive: false }, 'EMPLOYEE_INACTIVE'],
    [{ isSelected: false }, 'EMPLOYEE_NOT_SELECTED'],
    [{ archived: true }, 'EMPLOYEE_ARCHIVED'],
    [{ status: AgentStatus.ARCHIVED }, 'EMPLOYEE_ARCHIVED'],
    [{ availability: AwlAgentAvailability.OFFLINE }, 'EMPLOYEE_UNAVAILABLE'],
    [{ availability: AwlAgentAvailability.ARCHIVED }, 'EMPLOYEE_UNAVAILABLE'],
    [{ status: AgentStatus.PAUSED }, 'EMPLOYEE_UNAVAILABLE'],
    [{ status: AgentStatus.ERROR }, 'EMPLOYEE_UNAVAILABLE'],
    [{ status: AgentStatus.TERMINATED }, 'EMPLOYEE_UNAVAILABLE'],
    [{ status: AgentStatus.DEPRECATED }, 'EMPLOYEE_UNAVAILABLE'],
  ])('rejects lifecycle state %p with %s', async (overrides, code) => {
    prisma.agent.findFirst.mockResolvedValue(employee(overrides));

    await expectCode(resolver.resolve('tenant-a', 'employee-a'), code);
    expect(prisma.workRun.count).not.toHaveBeenCalled();
  });

  it('allows a busy/running employee when derived capacity remains', async () => {
    prisma.agent.findFirst.mockResolvedValue(
      employee({
        status: AgentStatus.RUNNING,
        availability: AwlAgentAvailability.BUSY,
      }),
    );
    prisma.workRun.count.mockResolvedValue(1);

    await expect(
      resolver.resolve('tenant-a', 'employee-a'),
    ).resolves.toMatchObject({
      lifecycle: { activeWorkRuns: 1, maxConcurrency: 2 },
    });
  });

  it.each([
    [2, 2],
    [3, 2],
    [0, 0],
  ])('rejects exhausted capacity (%i active, max %i)', async (active, max) => {
    prisma.agent.findFirst.mockResolvedValue(employee({ maxConcurrency: max }));
    prisma.workRun.count.mockResolvedValue(active);

    await expectCode(
      resolver.resolve('tenant-a', 'employee-a'),
      'EMPLOYEE_CONCURRENCY_EXCEEDED',
    );
  });

  it('fails closed when permissions are malformed', async () => {
    prisma.agent.findFirst.mockResolvedValue(
      employee({ permissions: { allow: '*' } }),
    );

    await expectCode(
      resolver.resolve('tenant-a', 'employee-a'),
      'EMPLOYEE_CONFIGURATION_INVALID',
    );
    expect(prisma.workRun.count).not.toHaveBeenCalled();
  });
});

async function expectCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected EmployeeResolutionError ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(EmployeeResolutionError);
    expect((error as EmployeeResolutionError).code).toBe(code);
  }
}
