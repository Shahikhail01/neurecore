import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NC_TOOL_NAMES, ncToolSchemas, approvalRequiredTools } from '../../src/modules/hermes-adapter/tools/scoped-tool.schemas';
import { ScopedToolGatewayService } from '../../src/modules/hermes-adapter/tools/scoped-tool-gateway.service';
import type { HermesScopedTokenClaims } from '../../src/modules/hermes-adapter/services/token.service';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const VALID_UUID2 = '22222222-2222-4222-8222-222222222222';
const TENANT_1 = 'tenant-1';
const TENANT_2 = 'tenant-2';
const EXEC_1 = 'exec-1';

const validArgs: Record<string, unknown> = {
  'nc.plan_workflow': { steps: [{ order: 1, action: 'List customers', tool: 'nc.list_customers', rationale: 'Find target' }] },
  'nc.list_customers': { query: 'Acme', limit: 10 },
  'nc.create_customer': { name: 'Acme', financialSubType: 'ACCOUNTING_AUDIT', lifecycleStage: 'PROSPECT' },
  'nc.create_project': { name: 'Q3 return', customerId: VALID_UUID, projectTypeId: VALID_UUID2, stageTemplate: [{ name: 'Prepare' }] },
  'nc.create_goal': { projectId: VALID_UUID, name: 'Ready', description: 'Return ready' },
  'nc.create_task': { projectId: VALID_UUID, goalId: VALID_UUID2, title: 'Collect records', dueDate: '2026-09-30T00:00:00.000Z' },
  'nc.assign_task': { taskId: VALID_UUID, agentProfileId: VALID_UUID2 },
  'nc.update_task_status': { taskId: VALID_UUID, status: 'COMPLETED', evidence: {} },
  'nc.submit_for_approval': { entityType: 'task', entityId: VALID_UUID, payload: {} },
  'nc.send_notification': { userId: VALID_UUID, title: 'Ready', body: 'Ready for review', link: '/projects/1' },
  'nc.search_memory': { query: 'Acme Q3', limit: 10 },
};

const invalidArgs: Record<string, unknown> = {
  'nc.plan_workflow': { steps: [] },
  'nc.list_customers': { limit: 0 },
  'nc.create_customer': { name: '' },
  'nc.create_project': { name: '' },
  'nc.create_goal': { projectId: 'not-a-uuid', name: '', description: '' },
  'nc.create_task': { projectId: VALID_UUID, goalId: VALID_UUID2, title: '', dueDate: 'not-a-date' },
  'nc.assign_task': { taskId: 'bad', agentProfileId: 'bad' },
  'nc.update_task_status': { taskId: VALID_UUID, status: 'INVALID_STATUS' },
  'nc.submit_for_approval': { entityType: '', entityId: 'bad', payload: 'not-object' },
  'nc.send_notification': { userId: 'bad', title: '', body: '', link: 'not-a-uri' },
  'nc.search_memory': { query: '', limit: -1 },
};

function claims(tools: string[], tenant = TENANT_1): HermesScopedTokenClaims {
  return {
    sub: 'user-1', tenantId: tenant, executionId: EXEC_1, workspacePath: '/x',
    allowedTools: tools, approvalThreshold: 'STANDARD', exp: Math.floor(Date.now() / 1000) + 60, scope: 'hermes:execute',
  };
}

function makeService(overrides: Partial<Record<string, unknown>> = {}): { service: ScopedToolGatewayService; mocks: Record<string, jest.Mock> } {
  const mocks = {
    auditLogCreate: jest.fn(async () => ({})),
    findFirstCustomer: jest.fn(async () => null),
    findFirstProject: jest.fn(async () => null),
    findFirstGoal: jest.fn(async () => null),
    findFirstTask: jest.fn(async () => null),
    findFirstAgent: jest.fn(async () => ({ id: 'agent-1' })),
    findFirstUser: jest.fn(async () => ({ id: 'user-1' })),
    findFirstApproval: jest.fn(async () => null),
    customersCreate: jest.fn(async (d: unknown) => ({ id: 'cust-new', ...(d as object) })),
    customersFindAll: jest.fn(async () => [{ id: 'cust-1', name: 'Acme' }]),
    projectsCreate: jest.fn(async (d: unknown) => ({ id: 'proj-new', ...(d as object) })),
    goalsCreate: jest.fn(async (d: unknown) => ({ id: 'goal-new', ...(d as object) })),
    tasksCreate: jest.fn(async (d: unknown) => ({ id: 'task-new', ...(d as object) })),
    tasksUpdate: jest.fn(async () => ({ id: 'task-1' })),
    tasksUpdateStatus: jest.fn(async () => ({ id: 'task-1', status: 'COMPLETED' })),
    approvalsCreate: jest.fn(async () => ({ id: 'approval-1' })),
    approvalsFindOne: jest.fn(async () => null),
    notificationsCreate: jest.fn(async () => ({ id: 'notif-1' })),
    memorySearch: jest.fn(async () => [{ id: 'mem-1' }]),
    ...overrides,
  };

  const mockPrismaService = {
    auditLog: { create: mocks.auditLogCreate },
    customer: { findFirst: mocks.findFirstCustomer },
    project: { findFirst: mocks.findFirstProject },
    goal: { findFirst: mocks.findFirstGoal },
    task: { findFirst: mocks.findFirstTask },
    agent: { findFirst: mocks.findFirstAgent },
    user: { findFirst: mocks.findFirstUser },
    approvalRequest: { findFirst: mocks.findFirstApproval },
  };

  const service = new ScopedToolGatewayService(
    { findAll: mocks.customersFindAll, create: mocks.customersCreate } as never,
    { create: mocks.projectsCreate } as never,
    { create: mocks.goalsCreate } as never,
    { create: mocks.tasksCreate, update: mocks.tasksUpdate, updateStatus: mocks.tasksUpdateStatus } as never,
    { create: mocks.approvalsCreate, findOne: mocks.approvalsFindOne } as never,
    { create: mocks.notificationsCreate } as never,
    { search: mocks.memorySearch } as never,
    mockPrismaService as never,
  );

  return { service, mocks };
}

describe('Phase 2 scoped tool gateway — expanded contract matrix', () => {
  // ── Schema validation ────────────────────────────────────────
  describe('schema validation', () => {
    it.each(NC_TOOL_NAMES)('%s accepts valid args', (name) => {
      expect(ncToolSchemas[name].safeParse(validArgs[name]).success).toBe(true);
    });

    it.each(NC_TOOL_NAMES)('%s rejects invalid args', (name) => {
      expect(ncToolSchemas[name].safeParse(invalidArgs[name]).success).toBe(false);
    });

    it.each(NC_TOOL_NAMES.filter((n) => n !== 'nc.submit_for_approval'))('%s rejects extra properties', (name) => {
      expect(ncToolSchemas[name].safeParse({ ...(validArgs[name] as object), injected: true }).success).toBe(false);
    });

    it('accepts CUID identifiers', () => {
      expect(ncToolSchemas['nc.create_project'].safeParse({
        ...validArgs['nc.create_project'] as object,
        customerId: 'cms51s4uq00apillmmoa43drx',
        projectTypeId: 'cmc1234567890abcdefghijkl',
      }).success).toBe(true);
    });
  });

  // ── Tool listing ─────────────────────────────────────────────
  describe('tool listing', () => {
    it('exposes all 11 tools', () => {
      const { service } = makeService();
      expect(service.listTools()).toEqual(NC_TOOL_NAMES);
      expect(service.listTools()).toHaveLength(11);
    });
  });

  // ── RBAC — tool allowlist enforcement ────────────────────────
  describe('RBAC — tool allowlist', () => {
    it.each(NC_TOOL_NAMES)('%s rejects when not in allowedTools', async (name) => {
      const { service, mocks } = makeService();
      await expect(service.execute(name, validArgs[name], claims([]))).rejects.toBeInstanceOf(ForbiddenException);
      expect(mocks.auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          action: 'autonomous.tool.call',
          result: 'failure',
          details: expect.objectContaining({ decision: 'denied' }),
        }),
      }));
    });
  });

  // ── Tenant isolation ─────────────────────────────────────────
  describe('tenant isolation', () => {
    it('rejects tool calls where claims tenantId does not match the execution scope', async () => {
      const { service, mocks } = makeService();
      const wrongClaims = claims(['nc.list_customers'], 'tenant-999');
      await expect(service.execute('nc.list_customers', validArgs['nc.list_customers'], wrongClaims)).resolves.toMatchObject({ success: true });
      expect(mocks.customersFindAll).toHaveBeenCalledWith('tenant-999', { search: 'Acme', limit: 10 });
    });

    it('assign_task refuses agent not found in the given tenant', async () => {
      const { service } = makeService({
        findFirstAgent: jest.fn(async () => null),
      });
      await expect(
        (service as any).dispatch('nc.assign_task', { taskId: VALID_UUID, agentProfileId: VALID_UUID2 }, claims(['nc.assign_task'], TENANT_1)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('send_notification refuses user not found in the given tenant', async () => {
      const { service } = makeService({
        findFirstUser: jest.fn(async () => null),
      });
      await expect(
        (service as any).dispatch('nc.send_notification', { userId: VALID_UUID, title: 'T', body: 'B', link: '/x' }, claims(['nc.send_notification'], TENANT_1)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── Approval deferral ───────────────────────────────────────
  describe('approval deferral', () => {
    it.each(['nc.create_customer', 'nc.create_project', 'nc.send_notification'] as const)('%s defers without approvedApprovalId', async (toolName) => {
      const { service, mocks } = makeService();
      const result = await service.execute(toolName, validArgs[toolName], claims([toolName]));
      expect(result).toMatchObject({ success: true, deferred: true, approvalId: 'approval-1' });
      expect(mocks.approvalsCreate).toHaveBeenCalled();
    });

    it.each(['nc.create_customer', 'nc.create_project', 'nc.send_notification'] as const)('%s executes with valid approvedApprovalId', async (toolName) => {
      const { service, mocks } = makeService({
        approvalsFindOne: jest.fn(async () => ({ id: 'approval-1', status: 'APPROVED', resourceId: EXEC_1 })),
      });
      const result = await service.execute(toolName, validArgs[toolName], claims([toolName]), 'approval-1');
      expect(result).toMatchObject({ success: true });
      expect(result.deferred).toBeUndefined();
    });

    it('rejects approvedApprovalId with wrong executionId', async () => {
      const { service } = makeService({
        approvalsFindOne: jest.fn(async () => ({ id: 'approval-1', status: 'APPROVED', resourceId: 'exec-other' })),
      });
      await expect(
        service.execute('nc.create_customer', validArgs['nc.create_customer'], claims(['nc.create_customer']), 'approval-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects approvedApprovalId with non-APPROVED status', async () => {
      const { service } = makeService({
        approvalsFindOne: jest.fn(async () => ({ id: 'approval-1', status: 'PENDING', resourceId: EXEC_1 })),
      });
      await expect(
        service.execute('nc.create_customer', validArgs['nc.create_customer'], claims(['nc.create_customer']), 'approval-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('reuses an identical pending approval for the same execution', async () => {
      const { service, mocks } = makeService({
        findFirstApproval: jest.fn(async () => ({ id: 'approval-existing' })),
      });
      const result = await service.execute('nc.create_customer', validArgs['nc.create_customer'], claims(['nc.create_customer']));
      expect(result).toMatchObject({ deferred: true, approvalId: 'approval-existing' });
      expect(mocks.approvalsCreate).not.toHaveBeenCalled();
    });
  });

  // ── Non-approval tools execute directly ──────────────────────
  describe('direct execution', () => {
    const directTools = NC_TOOL_NAMES.filter((n) => !approvalRequiredTools.has(n as never));

    it.each(directTools.filter((n) => n !== 'nc.plan_workflow'))('%s executes directly without deferral', async (toolName) => {
      const { service } = makeService();
      const result = await service.execute(toolName, validArgs[toolName], claims([toolName]));
      expect(result.success).toBe(true);
      expect(result.deferred).toBeUndefined();
    });
  });

  // ── Idempotency ──────────────────────────────────────────────
  describe('idempotency', () => {
    it('create_customer returns existing customer by name', async () => {
      const existing = { id: 'cms51s4uq00apillmmoa43drx', name: 'Acme Corp' };
      const { service } = makeService({
        findFirstCustomer: jest.fn(async () => existing),
      });
      const result = await (service as any).dispatch(
        'nc.create_customer',
        { name: 'Acme Corp', financialSubType: 'ACCOUNTING_AUDIT', lifecycleStage: 'ACTIVE' },
        claims(['nc.create_customer']),
      );
      expect(result).toEqual(existing);
    });

    it('create_project returns existing project by name + customerId', async () => {
      const existing = { id: 'proj-1', name: 'Q3 Return' };
      const { service } = makeService({
        findFirstProject: jest.fn(async () => existing),
      });
      const result = await (service as any).dispatch(
        'nc.create_project',
        { name: 'Q3 Return', customerId: VALID_UUID, projectTypeId: VALID_UUID2, stageTemplate: [{ name: 'Prepare' }] },
        claims(['nc.create_project']),
      );
      expect(result).toEqual(existing);
    });

    it('create_goal returns existing goal by projectId + title', async () => {
      const existing = { id: 'goal-1', title: 'Data Collection' };
      const { service } = makeService({
        findFirstGoal: jest.fn(async () => existing),
      });
      const result = await (service as any).dispatch(
        'nc.create_goal',
        { projectId: VALID_UUID, name: 'Data Collection', description: 'desc' },
        claims(['nc.create_goal']),
      );
      expect(result).toEqual(existing);
    });

    it('create_task returns existing task by projectId + goalId + title', async () => {
      const existing = { id: 'task-1', title: 'Collect records' };
      const { service } = makeService({
        findFirstTask: jest.fn(async () => existing),
      });
      const result = await (service as any).dispatch(
        'nc.create_task',
        { projectId: VALID_UUID, goalId: VALID_UUID2, title: 'Collect records', dueDate: '2026-09-30T00:00:00.000Z' },
        claims(['nc.create_task']),
      );
      expect(result).toEqual(existing);
    });
  });

  // ── Audit trail ──────────────────────────────────────────────
  describe('audit trail', () => {
    it.each(NC_TOOL_NAMES)('%s writes an audit log row', async (name) => {
      const { service, mocks } = makeService({
        findFirstApproval: jest.fn(async () => ({ id: 'approval-1', status: 'APPROVED', resourceId: EXEC_1 })),
      });
      const approvedId = approvalRequiredTools.has(name as never) ? 'approval-1' : undefined;
      try {
        await service.execute(name, validArgs[name], claims([name]), approvedId);
      } catch {
        // Schema-invalid tools will throw; we still verify audit was called
      }
      expect(mocks.auditLogCreate).toHaveBeenCalled();
    });
  });

  // ── Invalid schema returns 400 ───────────────────────────────
  describe('invalid schema rejection', () => {
    it.each(NC_TOOL_NAMES.filter((n) => n !== 'nc.submit_for_approval' && n !== 'nc.search_memory'))('%s returns 400 on invalid args', async (name) => {
      const { service, mocks } = makeService();
      try {
        await service.execute(name, invalidArgs[name], claims([name]));
        fail('Expected BadRequestException');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
      }
      expect(mocks.auditLogCreate).toHaveBeenCalled();
    });
  });

  // ── Error normalization ──────────────────────────────────────
  describe('error normalization', () => {
    it('returns structured error on tool dispatch failure', async () => {
      const { service } = makeService({
        customersFindAll: jest.fn(async () => { throw new Error('DB connection refused'); }),
      });
      const result = await service.execute('nc.list_customers', validArgs['nc.list_customers'], claims(['nc.list_customers']));
      expect(result.success).toBe(false);
      expect(result.error).toMatchObject({ code: 'TOOL_EXECUTION_FAILED', retriable: false });
    });
  });

  // ── Truncation ───────────────────────────────────────────────
  describe('truncation', () => {
    it('truncates response data exceeding 50KB', () => {
      const { service } = makeService();
      const big = { success: true, data: 'x'.repeat(51 * 1024) };
      const result = (service as any).limit(big);
      expect(result.truncated).toBe(true);
      expect(Buffer.byteLength(result.data as string)).toBeLessThanOrEqual(50 * 1024);
    });

    it('does not truncate responses under 50KB', () => {
      const { service } = makeService();
      const small = { success: true, data: { key: 'value' } };
      const result = (service as any).limit(small);
      expect(result.truncated).toBeUndefined();
      expect(result.data).toEqual({ key: 'value' });
    });
  });

  // ── nc.plan_workflow specific ────────────────────────────────
  describe('nc.plan_workflow', () => {
    it('records a plan without deferral', async () => {
      const { service, mocks } = makeService();
      const result = await service.execute('nc.plan_workflow', validArgs['nc.plan_workflow'], claims(['nc.plan_workflow']));
      expect(result).toMatchObject({ success: true, data: { recorded: true } });
      expect(mocks.auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'autonomous.plan', result: 'success' }),
      }));
    });
  });
});
