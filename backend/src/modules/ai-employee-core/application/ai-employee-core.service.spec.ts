import { AIEmployeeCoreService } from './ai-employee-core.service';
import { EmployeeRunViewMapper } from '../projections/employee-run-view.mapper';

const resolvedEmployee = {
  id: 'employee-a',
  tenantId: 'tenant-a',
  name: 'Analyst',
  role: 'ANALYST',
  departmentId: null,
  instructions: null,
  systemPrompt: null,
  capabilityNames: [],
  permissionNames: [],
  authorityInputs: { dataClassification: 'INTERNAL', budgetPerDay: null },
  lifecycle: {
    status: 'IDLE',
    availability: 'AVAILABLE',
    maxConcurrency: 2,
    activeWorkRuns: 0,
  },
  modelPreference: { model: 'model', advisory: true },
} as const;

const run = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-a',
  tenantId: 'tenant-a',
  actorId: 'employee-a',
  actorType: 'AI_AGENT' as const,
  employeeId: 'employee-a',
  requestedByActorId: 'human-a',
  taskId: null,
  triggerType: 'USER',
  triggerSourceId: null,
  parentRunId: null,
  status: 'CREATED' as const,
  request: 'Create a report',
  currentStepIndex: 0,
  planVersion: 0,
  summary: null,
  failureCode: null,
  failureReason: null,
  createdAt: '2026-08-10T00:00:00.000Z',
  startedAt: null,
  completedAt: null,
  ...overrides,
});

function build() {
  const employees = { resolve: jest.fn().mockResolvedValue(resolvedEmployee) };
  const identities = {
    find: jest.fn().mockResolvedValue({
      id: 'employee-a',
      tenantId: 'tenant-a',
      name: 'Analyst',
      role: 'ANALYST',
    }),
  };
  const runtime = {
    createRun: jest.fn().mockResolvedValue(run()),
    execute: jest.fn().mockResolvedValue(run({ status: 'COMPLETED' })),
    getRun: jest.fn().mockResolvedValue(run({ status: 'RUNNING' })),
    listRuns: jest.fn().mockResolvedValue([run({ status: 'COMPLETED' })]),
    getSteps: jest.fn().mockResolvedValue([]),
    getStepResults: jest.fn().mockResolvedValue([]),
    resume: jest.fn().mockResolvedValue(run({ status: 'COMPLETED' })),
    cancel: jest.fn().mockResolvedValue(run({ status: 'CANCELLED' })),
  };
  const service = new AIEmployeeCoreService(
    employees as never,
    runtime as never,
    identities as never,
    new EmployeeRunViewMapper(),
  );
  return { service, employees, identities, runtime };
}

const input = {
  tenantId: 'tenant-a',
  employeeId: 'employee-a',
  requestedBy: { actorId: 'human-a', actorType: 'HUMAN' as const },
  objective: ' Create a report ',
  context: { fileIds: ['file-a'], taskId: 'task-a' },
  trigger: { type: 'TASK' as const, sourceId: 'task-a' },
  idempotencyKey: 'request-key-a',
};

describe('AIEmployeeCoreService', () => {
  it('resolves, creates, executes once, and returns the stable view', async () => {
    const { service, employees, runtime } = build();
    const result = await service.start(input);

    expect(employees.resolve).toHaveBeenCalledWith('tenant-a', 'employee-a');
    expect(runtime.createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'employee-a',
        actorType: 'AI_AGENT',
        requestedByActorId: 'human-a',
        taskId: 'task-a',
        request: 'Create a report',
        scope: expect.objectContaining({ fileIds: ['file-a'] }),
      }),
    );
    expect(runtime.execute).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      id: 'run-a',
      employee: { id: 'employee-a' },
    });
    expect(result).not.toHaveProperty('idempotencyKey');
  });

  it('never executes an idempotent replay', async () => {
    const { service, runtime } = build();
    runtime.createRun.mockResolvedValue(run({ isReplay: true }));

    await service.start(input);
    expect(runtime.execute).not.toHaveBeenCalled();
  });

  it('uses identity-only reads for active run retrieval', async () => {
    const { service, employees, identities } = build();
    await expect(service.get('tenant-a', 'run-a')).resolves.toMatchObject({
      status: 'RUNNING',
    });
    expect(identities.find).toHaveBeenCalledWith('tenant-a', 'employee-a');
    expect(employees.resolve).not.toHaveBeenCalled();
  });

  it('rejects a mismatched runtime tenant defensively', async () => {
    const { service, runtime, identities } = build();
    runtime.getRun.mockResolvedValue(run({ tenantId: 'tenant-b' }));
    await expect(service.get('tenant-a', 'run-a')).resolves.toBeNull();
    expect(identities.find).not.toHaveBeenCalled();
  });

  it('keeps list tenant-scoped and rejects blank cancellation', async () => {
    const { service, runtime } = build();
    await service.list('tenant-a', { employeeId: 'employee-a' });
    expect(runtime.listRuns).toHaveBeenCalledWith('tenant-a', {
      employeeId: 'employee-a',
    });
    await expect(service.cancel('tenant-a', 'run-a', '  ')).rejects.toThrow(
      /reason is required/,
    );
  });
});
