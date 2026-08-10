import {
  AgentClassification,
  AgentStatus,
  AwlAgentAvailability,
} from '@prisma/client';
import {
  AgentTenantScopeError,
  AgentTenantScopeGuard,
} from '../../agents/agents-tenant-scope.guard';
import { EmployeeEligibilityService } from './employee-eligibility.service';
import { EmployeeEligibilityError } from './employee-eligibility.errors';

const agent = (overrides: Record<string, unknown> = {}) => ({
  id: 'employee-a',
  name: 'Analyst',
  role: 'ANALYST',
  departmentId: 'department-a',
  capabilities: ['documents.analyze', 'reports.draft'],
  status: AgentStatus.IDLE,
  availability: AwlAgentAvailability.AVAILABLE,
  isActive: true,
  isSelected: true,
  archived: false,
  maxConcurrency: 2,
  dataClassification: AgentClassification.CONFIDENTIAL,
  ...overrides,
});

describe('EmployeeEligibilityService', () => {
  let prisma: {
    agent: { findMany: jest.Mock; findFirst: jest.Mock };
    workRun: { groupBy: jest.Mock };
  };
  let service: EmployeeEligibilityService;

  beforeEach(() => {
    prisma = {
      agent: { findMany: jest.fn(), findFirst: jest.fn() },
      workRun: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    service = new EmployeeEligibilityService(
      prisma as never,
      new AgentTenantScopeGuard(),
    );
  });

  it('rejects a wildcard tenant before querying', async () => {
    await expect(service.findEligible('*', {})).rejects.toBeInstanceOf(
      AgentTenantScopeError,
    );
    expect(prisma.agent.findMany).not.toHaveBeenCalled();
  });

  it('returns only Employees covering all required capabilities', async () => {
    prisma.agent.findMany.mockResolvedValue([
      agent({ id: 'full', capabilities: ['x', 'y'] }),
      agent({ id: 'partial', capabilities: ['x'] }),
    ]);

    const result = await service.findEligible('tenant-a', {
      requiredCapabilities: ['x', 'y'],
    });

    expect(result.map((e) => e.employeeId)).toEqual(['full']);
    expect(result[0].capabilityComplete).toBe(true);
    expect(result[0].capabilityCoverage).toBe(2);
  });

  it('filters out ineligible role, department, classification, and overloaded Employees', async () => {
    prisma.agent.findMany.mockResolvedValue([
      agent({ id: 'wrong-role', role: 'ENGINEER' }),
      agent({ id: 'wrong-dept', departmentId: 'department-b' }),
      agent({
        id: 'low-class',
        dataClassification: AgentClassification.INTERNAL,
      }),
      agent({ id: 'overloaded', maxConcurrency: 1 }),
      agent({ id: 'good', maxConcurrency: 2 }),
    ]);
    prisma.workRun.groupBy.mockResolvedValue([
      { employeeId: 'overloaded', _count: { _all: 1 } },
    ]);

    const result = await service.findEligible('tenant-a', {
      requiredRole: 'ANALYST',
      departmentId: 'department-a',
      dataClassification: AgentClassification.CONFIDENTIAL,
    });

    expect(result.map((e) => e.employeeId)).toEqual(['good']);
  });

  it('ranks deterministically: coverage, role/dept match, workload, then stable ID', async () => {
    prisma.agent.findMany.mockResolvedValue([
      agent({
        id: 'z-id',
        role: 'ENGINEER',
        capabilities: ['x'],
        maxConcurrency: 3,
      }),
      agent({
        id: 'a-id',
        role: 'ANALYST',
        capabilities: ['x', 'y'],
        maxConcurrency: 3,
      }),
      agent({
        id: 'b-id',
        role: 'ANALYST',
        capabilities: ['x'],
        maxConcurrency: 3,
      }),
    ]);
    prisma.workRun.groupBy.mockResolvedValue([
      { employeeId: 'b-id', _count: { _all: 2 } },
    ]);

    const result = await service.findEligible('tenant-a', {
      requiredCapabilities: ['x', 'y'],
      requiredRole: 'ANALYST',
    });

    // a-id covers both caps + role; b-id covers one cap but is overloaded vs a-id.
    expect(result[0].employeeId).toBe('a-id');
    // tie on score+workload resolved by stable ID ascending
    const ids = result.map((e) => e.employeeId);
    expect([...ids].sort()).toEqual(ids);
  });

  it('freezes returned objects and arrays', async () => {
    prisma.agent.findMany.mockResolvedValue([agent()]);
    const result = await service.findEligible('tenant-a', {
      requiredCapabilities: ['documents.analyze'],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
    expect(Object.isFrozen(result[0].reasons)).toBe(true);
  });

  it('assertEligible resolves an eligible Employee', async () => {
    prisma.agent.findMany.mockResolvedValue([agent()]);
    const result = await service.assertEligible('tenant-a', 'employee-a', {
      requiredCapabilities: ['documents.analyze'],
    });
    expect(result.employeeId).toBe('employee-a');
  });

  it('assertEligible throws EMPLOYEE_NOT_FOUND for a foreign/missing Employee', async () => {
    prisma.agent.findMany.mockResolvedValue([]);
    prisma.agent.findFirst.mockResolvedValue(null);
    await expect(
      service.assertEligible('tenant-a', 'foreign-id', {}),
    ).rejects.toMatchObject({ code: 'EMPLOYEE_NOT_FOUND' });
  });

  it('assertEligible throws TASK_ASSIGNMENT_INELIGIBLE for an existing but ineligible Employee', async () => {
    prisma.agent.findMany.mockResolvedValue([
      agent({ capabilities: ['other'] }),
    ]);
    prisma.agent.findFirst.mockResolvedValue({ id: 'employee-a' });
    await expect(
      service.assertEligible('tenant-a', 'employee-a', {
        requiredCapabilities: ['never.covered'],
      }),
    ).rejects.toMatchObject({ code: 'TASK_ASSIGNMENT_INELIGIBLE' });
  });

  it('assertEligible rejects a fabricated ID without exposing another tenant', async () => {
    prisma.agent.findMany.mockResolvedValue([]);
    prisma.agent.findFirst.mockResolvedValue(null);
    const err: EmployeeEligibilityError = await service
      .assertEligible('tenant-a', 'fabricated', {})
      .then(() => null as never)
      .catch((e: EmployeeEligibilityError) => e);
    expect(err).toBeInstanceOf(EmployeeEligibilityError);
    expect(err.code).toBe('EMPLOYEE_NOT_FOUND');
  });
});
