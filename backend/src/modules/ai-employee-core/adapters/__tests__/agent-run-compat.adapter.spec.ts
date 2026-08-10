import { AgentRunCompatAdapter } from '../agent-run-compat.adapter';
import type { IAIEmployeeCore } from '../../contracts/ai-employee-core.interface';
import type { EmployeeRunView } from '../../contracts/employee-run.types';

const base = (id: string, status: string): EmployeeRunView =>
  ({
    id,
    tenantId: 'tenant-1',
    employee: { id: 'emp-1', name: 'E', role: null },
    objective: 'score this lead',
    status,
    trigger: { type: 'USER', sourceId: null },
    taskId: null,
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
    ...overrides,
  }) as unknown as IAIEmployeeCore;

const req = {
  tenantId: 'tenant-1',
  employeeId: 'emp-1',
  actorUserId: 'user-1',
  actorRole: 'USER',
  objective: 'score this lead',
  idempotencyKey: 'agent-run:tenant-1:lead-1',
};

describe('AgentRunCompatAdapter (Phase 8.2)', () => {
  it('starts durably and executes on creation, mapping a COMPLETED run', async () => {
    const core = coreMock();
    (core.startDurable as jest.Mock).mockResolvedValue({
      run: base('wr-1', 'CREATED'),
      created: true,
    });
    (core.executeRun as jest.Mock).mockResolvedValue(base('wr-1', 'COMPLETED'));
    const adapter = new AgentRunCompatAdapter(core);

    const result = await adapter.run(req);

    expect(core.startDurable).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      requestedBy: { actorId: 'user-1', actorType: 'HUMAN' },
      objective: 'score this lead',
      context: undefined,
      trigger: { type: 'USER' },
      idempotencyKey: 'agent-run:tenant-1:lead-1',
    });
    expect(result.status).toBe('COMPLETED');
    expect(result.runId).toBe('wr-1');
  });

  it('does NOT re-execute an idempotent replay', async () => {
    const core = coreMock();
    (core.startDurable as jest.Mock).mockResolvedValue({
      run: base('wr-1', 'COMPLETED'),
      created: false,
    });
    const adapter = new AgentRunCompatAdapter(core);
    const result = await adapter.run(req);
    expect(result.status).toBe('COMPLETED');
    expect(core.executeRun).not.toHaveBeenCalled();
  });

  it('maps WAITING_FOR_APPROVAL to an honest APPROVAL_REQUIRED view', async () => {
    const core = coreMock();
    (core.startDurable as jest.Mock).mockResolvedValue({
      run: base('wr-1', 'WAITING_FOR_APPROVAL'),
      created: false,
    });
    const adapter = new AgentRunCompatAdapter(core);
    const result = await adapter.run(req);
    expect(result.status).toBe('APPROVAL_REQUIRED');
    expect(result.reply).toMatch(/approval/);
  });

  it('maps PAUSED to CLARIFICATION_REQUIRED (no synthetic success)', async () => {
    const core = coreMock();
    (core.startDurable as jest.Mock).mockResolvedValue({
      run: base('wr-1', 'PAUSED'),
      created: false,
    });
    const adapter = new AgentRunCompatAdapter(core);
    const result = await adapter.run(req);
    expect(result.status).toBe('CLARIFICATION_REQUIRED');
  });

  it('propagates a FAILED run with its reason, never a synthetic success', async () => {
    const core = coreMock();
    (core.startDurable as jest.Mock).mockResolvedValue({
      run: {
        ...base('wr-1', 'FAILED'),
        failure: { code: 'TOOL_NOT_AUTHORIZED', reason: 'tool denied' },
      },
      created: false,
    });
    const adapter = new AgentRunCompatAdapter(core);
    const result = await adapter.run(req);
    expect(result.status).toBe('FAILED');
    expect(result.reply).toMatch(/tool denied/);
  });
});
