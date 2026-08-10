import { ExecutionOrchestrator } from './execution-orchestrator';
import type {
  ExecutionContext,
  ExecutionRuntimeResult,
} from './execution-orchestrator';
import type { ExecutionPolicy } from '../domain/execution-policy';
import type { IAIEmployeeCore } from '../../ai-employee-core/contracts/ai-employee-core.interface';
import type { EmployeeRunView } from '../../ai-employee-core/contracts/employee-run.types';

const policy: ExecutionPolicy = {
  taskId: 'task-1',
  policyVersion: 'canonical-v1',
  autonomyLevel: 1,
  allowedTools: [],
  deniedTools: [],
  maxToolCalls: 10,
  maxTokens: 100000,
  maxCost: 1000,
  timeoutMs: 300000,
  requiresHumanApproval: false,
  externalSideEffectApproval: false,
  inputSources: [],
  promptVersion: 'draft-v1',
  graphVersion: 'canonical-v1',
  modelVersion: 'configured-runtime',
  toolVersion: 'canonical-v1',
  redactionPolicy: 'STRICT',
  sideEffectAllowList: [],
};

const runView = (
  id: string,
  status: string,
  overrides: Partial<EmployeeRunView> = {},
): EmployeeRunView =>
  ({
    id,
    tenantId: 'tenant-1',
    employee: { id: 'agent-1', name: 'E', role: null },
    objective: 'task instructions',
    status,
    trigger: { type: 'TASK', sourceId: 'task-1' },
    taskId: 'task-1',
    summary: 'Completed the report',
    failure: null,
    approvalId: null,
    artifacts: [],
    steps: [],
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  }) as EmployeeRunView;

const ctx = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  attemptId: 'attempt-1',
  taskId: 'task-1',
  agentId: 'agent-1',
  tenantId: 'tenant-1',
  policy,
  taskInstructions: 'task instructions',
  projectContext: {},
  approvedInputs: [],
  toolPolicy: {},
  resourceLimits: {},
  ...overrides,
});

function build() {
  const uow = { execute: jest.fn((fn: (tx: any) => Promise<any>) => fn(null)) };
  const attemptRepo = {
    findById: jest.fn(),
    findByRequestId: jest.fn(),
    findLastAttemptNumber: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    claimForExecution: jest.fn(),
    updateHeartbeat: jest.fn(),
    findStaleAttempts: jest.fn(),
    cancelAtomic: jest.fn(),
    reclaimOrphan: jest.fn(),
    claimFromStale: jest.fn(),
  };
  const taskRepo = { findById: jest.fn(), updateStatus: jest.fn() };
  const outboxRepo = { publish: jest.fn() };
  const policyEnforcer = { validate: jest.fn(), assertBudget: jest.fn() };
  const core = {
    start: jest.fn(),
    startDurable: jest.fn(),
    executeRun: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
    resume: jest.fn(),
    cancel: jest.fn(),
  } as unknown as IAIEmployeeCore;

  const orchestrator = new ExecutionOrchestrator(
    uow as never,
    attemptRepo as never,
    taskRepo as never,
    outboxRepo as never,
    policyEnforcer as never,
    core,
  );
  return { orchestrator, core, policyEnforcer };
}

describe('ExecutionOrchestrator.runExecution (Phase 8.4)', () => {
  it('delegates business execution to AIEmployeeCore and maps a completed run', async () => {
    const { orchestrator, core } = build();
    (core.start as jest.Mock).mockResolvedValue(runView('wr-9', 'COMPLETED'));

    const result: ExecutionRuntimeResult =
      await orchestrator.executeTask(ctx());

    expect(core.start).toHaveBeenCalledTimes(1);
    expect(core.start).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      employeeId: 'agent-1',
      requestedBy: { actorId: 'agent-1', actorType: 'AI_AGENT' },
      objective: 'task instructions',
      context: { taskId: 'task-1' },
      trigger: { type: 'TASK', sourceId: 'task-1' },
      idempotencyKey: 'execution-attempt:attempt-1',
    });
    expect(result.workRunId).toBe('wr-9');
    expect(result.output.summary).toBe('Completed the report');
  });

  it('does NOT report completion when the canonical run did not complete', async () => {
    const { orchestrator, core } = build();
    (core.start as jest.Mock).mockResolvedValue(
      runView('wr-9', 'WAITING_FOR_APPROVAL', {
        failure: null,
      }),
    );
    await expect(orchestrator.executeTask(ctx())).rejects.toThrow(
      /EXECUTION_NOT_COMPLETED/,
    );
  });

  it('rejects missing task instructions (no synthetic success)', async () => {
    const { orchestrator, core } = build();
    await expect(
      orchestrator.executeTask(ctx({ taskInstructions: '   ' })),
    ).rejects.toThrow(/INVALID_INPUT_MISSING_TASK_INSTRUCTIONS/);
    expect(core.start).not.toHaveBeenCalled();
  });

  it('maps run artifacts into evidence and includes workRunId', async () => {
    const { orchestrator, core } = build();
    (core.start as jest.Mock).mockResolvedValue(
      runView('wr-9', 'COMPLETED', {
        summary: 'Report ready',
        artifacts: [{ id: 'art-1', type: 'REPORT', name: 'Q3 Report' }],
        steps: [{ id: 's1', name: 'skill.draft_report', status: 'SUCCEEDED' }],
      }),
    );
    const result: ExecutionRuntimeResult =
      await orchestrator.executeTask(ctx());
    expect(result.workRunId).toBe('wr-9');
    expect(result.toolCallCount).toBe(1);
    expect(result.evidence[0].artifactType).toBe('REPORT');
  });
});
