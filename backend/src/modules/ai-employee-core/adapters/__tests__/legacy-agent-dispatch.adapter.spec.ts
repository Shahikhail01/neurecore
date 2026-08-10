import { LegacyAgentDispatchAdapter } from '../legacy-agent-dispatch.adapter';
import type { IAIEmployeeCore } from '../../contracts/ai-employee-core.interface';
import type { EmployeeRunView } from '../../contracts/employee-run.types';

describe('LegacyAgentDispatchAdapter (Phase 8.1)', () => {
  const tenantId = 'tenant-1';
  const agentId = 'agent-1';
  const taskId = 'task-1';
  const actorId = 'user-1';

  const runView = (id: string, status: string): EmployeeRunView =>
    ({
      id,
      tenantId,
      employee: { id: agentId, name: 'E', role: null },
      objective: `Execute assigned task ${taskId}`,
      status,
      trigger: { type: 'TASK', sourceId: taskId },
      taskId,
      summary: null,
      failure: null,
      approvalId: null,
      artifacts: [],
      steps: [],
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    }) as EmployeeRunView;

  const coreMock = (overrides: Partial<IAIEmployeeCore> = {}) =>
    ({
      startDurable: jest.fn(),
      executeRun: jest.fn(),
      list: jest.fn(),
      cancel: jest.fn(),
      ...overrides,
    }) as unknown as IAIEmployeeCore;

  it('creates durably, returns workRunId, and executes only on creation', async () => {
    const core = coreMock();
    const adapter = new LegacyAgentDispatchAdapter(core);
    (core.startDurable as jest.Mock).mockResolvedValue({
      run: runView('wr-1', 'CREATED'),
      created: true,
    });
    (core.executeRun as jest.Mock).mockResolvedValue(
      runView('wr-1', 'COMPLETED'),
    );

    const result = await adapter.dispatchTask(
      taskId,
      agentId,
      tenantId,
      actorId,
    );

    expect(result.workRunId).toBe('wr-1');
    expect(result.created).toBe(true);
    expect(core.startDurable).toHaveBeenCalledWith({
      tenantId,
      employeeId: agentId,
      requestedBy: { actorId, actorType: 'HUMAN' },
      objective: `Execute assigned task ${taskId}`,
      context: { taskId },
      trigger: { type: 'TASK', sourceId: taskId },
      idempotencyKey: `legacy-dispatch:${tenantId}:${taskId}:${agentId}`,
    });
    expect(core.executeRun).toHaveBeenCalledWith(tenantId, 'wr-1');
  });

  it('does NOT re-execute an idempotent replay (existing run)', async () => {
    const core = coreMock();
    const adapter = new LegacyAgentDispatchAdapter(core);
    (core.startDurable as jest.Mock).mockResolvedValue({
      run: runView('wr-1', 'RUNNING'),
      created: false,
    });

    const result = await adapter.dispatchTask(
      taskId,
      agentId,
      tenantId,
      actorId,
    );

    expect(result.created).toBe(false);
    expect(result.workRunId).toBe('wr-1');
    expect(core.executeRun).not.toHaveBeenCalled();
  });

  it('cancels only non-terminal WorkRuns for the task', async () => {
    const core = coreMock();
    const adapter = new LegacyAgentDispatchAdapter(core);
    (core.list as jest.Mock).mockResolvedValue([
      runView('wr-run', 'RUNNING'),
      runView('wr-wait', 'WAITING_FOR_APPROVAL'),
      runView('wr-done', 'COMPLETED'),
    ]);
    (core.cancel as jest.Mock).mockResolvedValue(
      runView('wr-run', 'CANCELLED'),
    );

    const result = await adapter.cancelTask(tenantId, taskId);

    expect(result.cancelledRunIds).toEqual(['wr-run', 'wr-wait']);
    expect(core.cancel).toHaveBeenCalledTimes(2);
    expect(core.cancel).toHaveBeenCalledWith(
      tenantId,
      'wr-run',
      expect.any(String),
    );
    expect(core.cancel).toHaveBeenCalledWith(
      tenantId,
      'wr-wait',
      expect.any(String),
    );
  });

  it('propagates startDurable failure honestly (no synthetic success)', async () => {
    const core = coreMock();
    const adapter = new LegacyAgentDispatchAdapter(core);
    (core.startDurable as jest.Mock).mockRejectedValue(
      new Error('EMPLOYEE_NOT_FOUND'),
    );
    await expect(
      adapter.dispatchTask(taskId, agentId, tenantId, actorId),
    ).rejects.toThrow('EMPLOYEE_NOT_FOUND');
    expect(core.executeRun).not.toHaveBeenCalled();
  });

  it('does not execute when startDurable returns a non-CREATED run', async () => {
    const core = coreMock();
    const adapter = new LegacyAgentDispatchAdapter(core);
    (core.startDurable as jest.Mock).mockResolvedValue({
      run: runView('wr-1', 'COMPLETED'),
      created: false,
    });
    const result = await adapter.dispatchTask(
      taskId,
      agentId,
      tenantId,
      actorId,
    );
    expect(result.created).toBe(false);
    expect(core.executeRun).not.toHaveBeenCalled();
  });
});
