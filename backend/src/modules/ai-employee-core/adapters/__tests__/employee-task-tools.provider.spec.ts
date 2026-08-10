import { AgentClassification } from '@prisma/client';
import type { RuntimeTool } from '../../../work-runtime/contracts/work-runtime.interface';
import { EmployeeTaskToolsProvider } from '../employee-task-tools.provider';
import { EmployeeEligibilityError } from '../../eligibility/employee-eligibility.errors';

describe('EmployeeTaskToolsProvider', () => {
  let registry: { register: jest.Mock; has: jest.Mock };
  let eligibility: {
    findEligible: jest.Mock;
    assertEligible: jest.Mock;
  };
  let tasks: { assignToEmployee: jest.Mock };
  let provider: EmployeeTaskToolsProvider;

  beforeEach(() => {
    registry = { register: jest.fn(), has: jest.fn().mockReturnValue(false) };
    eligibility = {
      findEligible: jest.fn(),
      assertEligible: jest.fn(),
    };
    tasks = { assignToEmployee: jest.fn() };
    provider = new EmployeeTaskToolsProvider(
      registry as never,
      eligibility as never,
      tasks as never,
    );
  });

  const registered = (name: string): RuntimeTool => {
    provider.onApplicationBootstrap();
    const calls = registry.register.mock.calls as unknown as RuntimeTool[][];
    const found = calls.map((c) => c[0]).find((t) => t && t.name === name);
    if (!found) throw new Error(`tool not registered: ${name}`);
    return found;
  };

  it('registers employees.find_eligible and tasks.assign on bootstrap', () => {
    provider.onApplicationBootstrap();
    const calls = registry.register.mock.calls as unknown as RuntimeTool[][];
    const names = calls.map((c) => c[0].name);
    expect(names).toContain('employees.find_eligible');
    expect(names).toContain('tasks.assign');
  });

  describe('employees.find_eligible', () => {
    const tool = () => registered('employees.find_eligible');

    it('declares READ, authority 10, no approval, bounded timeout', () => {
      const t = tool();
      expect(t.effect).toBe('READ');
      expect(t.requiredAuthority).toBe(10);
      expect(t.approvalSensitive).toBe(false);
      expect(t.maxRetries).toBe(1);
    });

    it('calls the eligibility port with tenant scope and returns ranked employees', async () => {
      const t = tool();
      eligibility.findEligible.mockResolvedValue([
        {
          employeeId: 'e1',
          name: 'A',
          role: 'ANALYST',
          departmentId: 'd1',
          capabilityCoverage: 2,
          capabilityComplete: true,
          roleMatch: true,
          departmentMatch: true,
          dataClassification: AgentClassification.CONFIDENTIAL,
          activeWorkRuns: 0,
          maxConcurrency: 3,
          score: 100,
          reasons: ['ok'],
        },
      ]);

      const result = await t.execute(
        { requiredCapabilities: ['x', 'y'], limit: 5 },
        {
          tenantId: 'tenant-a',
          actorId: 'actor',
          actorType: 'HUMAN',
          runId: 'r1',
          stepId: 's1',
        },
      );

      expect(eligibility.findEligible).toHaveBeenCalledWith('tenant-a', {
        requiredCapabilities: ['x', 'y'],
        requiredRole: undefined,
        departmentId: undefined,
        dataClassification: undefined,
        limit: 5,
      });
      expect(result.ok).toBe(true);
      expect(result.data?.count).toBe(1);
      expect((result.data?.employees as unknown[])[0]).toMatchObject({
        employeeId: 'e1',
        score: 100,
      });
    });

    it('propagates failures honestly (no synthetic success)', async () => {
      const t = tool();
      eligibility.findEligible.mockRejectedValue(
        new EmployeeEligibilityError(
          'TASK_ASSIGNMENT_INELIGIBLE',
          'nope',
          'e1',
        ),
      );
      const result = await t.execute(
        {},
        {
          tenantId: 't',
          actorId: 'a',
          actorType: 'HUMAN',
          runId: 'r',
          stepId: 's',
        },
      );
      expect(result.ok).toBe(false);
      expect(result.errorCode).toBe('EMPLOYEE_ELIGIBILITY_FAILED');
    });
  });

  describe('tasks.assign', () => {
    const tool = () => registered('tasks.assign');

    it('declares INTERNAL_WRITE, authority 50', () => {
      const t = tool();
      expect(t.effect).toBe('INTERNAL_WRITE');
      expect(t.requiredAuthority).toBe(50);
      expect(t.approvalSensitive).toBe(false);
    });

    it('requires taskId and employeeId', () => {
      const t = tool();
      expect(() => t.validateInput({ employeeId: 'e1' })).toThrow();
      expect(() => t.validateInput({ taskId: 't1' })).toThrow();
      expect(() =>
        t.validateInput({ taskId: 't1', employeeId: 'e1' }),
      ).not.toThrow();
    });

    it('re-validates eligibility inside the tool before assigning', async () => {
      const t = tool();
      eligibility.assertEligible.mockResolvedValue({ employeeId: 'e1' });
      tasks.assignToEmployee.mockResolvedValue({
        id: 't1',
        status: 'ASSIGNED',
      });

      const result = await t.execute(
        { taskId: 't1', employeeId: 'e1', requiredCapabilities: ['x'] },
        {
          tenantId: 'tenant-a',
          actorId: 'actor',
          actorType: 'AI_AGENT',
          runId: 'r1',
          stepId: 's1',
        },
      );

      expect(eligibility.assertEligible).toHaveBeenCalledWith(
        'tenant-a',
        'e1',
        {
          requiredCapabilities: ['x'],
          requiredRole: undefined,
          departmentId: undefined,
          dataClassification: undefined,
        },
      );
      expect(tasks.assignToEmployee).toHaveBeenCalledWith('t1', 'tenant-a', {
        agentId: 'e1',
        workRunId: 'r1',
        rationale: undefined,
        assignedById: 'actor',
      });
      expect(result.ok).toBe(true);
      expect(result.data).toMatchObject({
        taskId: 't1',
        employeeId: 'e1',
        workRunId: 'r1',
      });
    });

    it('rejects a fabricated or foreign Employee ID before any write', async () => {
      const t = tool();
      eligibility.assertEligible.mockRejectedValue(
        new EmployeeEligibilityError('EMPLOYEE_NOT_FOUND', 'not found', 'fab'),
      );

      const result = await t.execute(
        { taskId: 't1', employeeId: 'fab' },
        {
          tenantId: 't',
          actorId: 'a',
          actorType: 'AI_AGENT',
          runId: 'r',
          stepId: 's',
        },
      );

      expect(result.ok).toBe(false);
      expect(tasks.assignToEmployee).not.toHaveBeenCalled();
    });
  });
});
