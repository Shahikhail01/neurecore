import { createHash } from 'node:crypto';
import { WorkRuntimeService } from './work-runtime.service';
import type {
  RuntimeTool,
  WorkPlan,
} from '../contracts/work-runtime.interface';

const tool: RuntimeTool = {
  name: 'test.read',
  capability: 'test',
  description: 'test',
  effect: 'READ',
  requiredAuthority: 1,
  approvalSensitive: false,
  timeoutMs: 1000,
  maxRetries: 1,
  validateInput: () => undefined,
  execute: async () => ({ ok: true }),
};

const plan: WorkPlan = {
  objective: 'test',
  assumptions: [],
  requiredContextCapabilities: [],
  steps: [
    {
      id: 'step-plan-id',
      sequence: 1,
      description: 'test',
      toolName: tool.name,
      capability: tool.capability,
      input: { b: 2, a: 1 },
      dependsOn: [],
      effect: tool.effect,
      expectedOutput: 'done',
    },
  ],
  completionCriteria: ['done'],
};

function build() {
  const run = {
    id: 'run-1',
    tenantId: 'tenant-1',
    actorId: 'actor-1',
    actorType: 'HUMAN',
    status: 'CREATED',
    request: 'test',
    currentStepIndex: 0,
    planVersion: 0,
    summary: null,
    failureCode: null,
    failureReason: null,
    version: 0,
    createdAt: new Date(),
  };
  const steps: Array<Record<string, unknown>> = [];
  const repo = {
    createRun: jest.fn(async () => run),
    createOrGetByIdempotencyKey: jest.fn(
      async (input: Record<string, unknown>) => {
        Object.assign(run, input);
        return { run, created: true };
      },
    ),
    findRun: jest.fn(async (id: string, tenantId: string) =>
      id === run.id && tenantId === run.tenantId ? run : null,
    ),
    updateRun: jest.fn(
      async (_id: string, _tenantId: string, version: number, data: any) => {
        Object.assign(run, data, { version: version + 1 });
        return true;
      },
    ),
    createStep: jest.fn(async (input: Record<string, unknown>) => {
      const step = {
        id: 'step-1',
        ...input,
        status: 'PENDING',
        attemptCount: 0,
        approvalId: null,
        governanceDecision: null,
        governanceReason: null,
        policySource: null,
        errorCode: null,
      };
      steps.push(step);
      return step;
    }),
    listSteps: jest.fn(async () => steps),
    updateStep: jest.fn(
      async (id: string, _tenantId: string, data: Record<string, unknown>) => {
        const step = steps.find((item) => item.id === id);
        if (step) Object.assign(step, data);
      },
    ),
    claimStep: jest.fn(async (id: string) => {
      const step = steps.find((item) => item.id === id);
      if (step) Object.assign(step, { status: 'RUNNING' });
      return true;
    }),
    findSucceededByIdempotencyKey: jest.fn(async () => null),
  };
  const snapshot = {
    workRunId: run.id,
    tenantId: run.tenantId,
    actorType: run.actorType,
    actorId: run.actorId,
    authority: 100,
    governanceBlocked: false,
    organizationSummary: { test: true },
    policySource: 'context-plane:test',
    planVersion: '1.0.0',
    toolRegistrationsVersion: 'registrations-v1',
  };
  const contextRepo = {
    save: jest.fn(async (input: Record<string, unknown>) => ({
      id: 'snapshot-1',
      ...input,
    })),
    loadByRunId: jest.fn(async () => snapshot),
  };
  const contextPlane = {
    assemble: jest.fn(async () => ({
      authContext: { effectiveAuthority: 100, governanceBlocked: false },
      capabilities: {
        test: {
          provider: 'test-provider',
          authorization: { access: 'FULL', policySource: 'context-plane:test' },
          data: { value: true },
          fetchedAt: new Date().toISOString(),
        },
      },
    })),
  };
  const registry = {
    list: jest.fn(() => [{ ...tool }]),
    listForAuthority: jest.fn(() => [{ ...tool }]),
    get: jest.fn(() => tool),
  };
  const planner = { plan: jest.fn(async () => plan) };
  const governance = {
    evaluateStep: jest.fn(async () => ({
      outcome: 'ALLOW',
      reason: 'allowed',
      policySource: 'runtime:test',
      policyVersion: '1.0.0',
      toolRegistrationsVersion: 'registrations-v1',
      actorId: run.actorId,
      scope: {
        tenantId: run.tenantId,
        capability: tool.capability,
        toolName: tool.name,
      },
      decidedAt: new Date().toISOString(),
    })),
  };
  const executor = { execute: jest.fn(async () => ({ ok: true })) };
  const approvals = { create: jest.fn(), findOne: jest.fn() };
  const transport = { publish: jest.fn(async () => ({ eventId: 'event-1' })) };
  const service = new WorkRuntimeService(
    repo as never,
    contextRepo as never,
    contextPlane as never,
    planner as never,
    registry as never,
    governance as never,
    executor as never,
    approvals as never,
    transport as never,
  );
  return {
    service,
    run,
    steps,
    repo,
    contextRepo,
    approvals,
    transport,
    planner,
  };
}

describe('WorkRuntimeService context persistence', () => {
  it('persists and audits the snapshot on createRun', async () => {
    const { service, contextRepo, transport } = build();
    await service.createRun({
      tenantId: 'tenant-1',
      actorId: 'actor-1',
      actorType: 'HUMAN',
      request: 'test',
    });
    expect(contextRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ workRunId: 'run-1', authority: 100 }),
    );
    expect(transport.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'enterprise.workrun.context.snapshotted',
      }),
    );
  });

  it('reloads the snapshot when running steps', async () => {
    const { service, contextRepo } = build();
    await service.execute('run-1', 'tenant-1');
    expect(contextRepo.loadByRunId).toHaveBeenCalledWith('tenant-1', 'run-1');
    expect(contextRepo.loadByRunId.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('pauses with a typed restart-persistence breach when snapshot is missing', async () => {
    const { service, contextRepo } = build();
    contextRepo.loadByRunId.mockResolvedValueOnce(null as never);
    const result = await service.execute('run-1', 'tenant-1');
    expect(result.status).toBe('PAUSED');
    expect(result.failureCode).toBe('WORK_RUN_CONTEXT_SNAPSHOT_MISSING');
    expect(result.failureReason).toBe(
      'context snapshot missing; restart-persistence breach',
    );
  });

  it('revalidates an approval with the by-id lookup', async () => {
    const { service, run, steps, approvals } = build();
    run.status = 'WAITING_FOR_APPROVAL';
    steps.push({
      id: 'step-1',
      runId: run.id,
      tenantId: run.tenantId,
      sequence: 1,
      toolName: tool.name,
      capability: tool.capability,
      operationType: tool.effect,
      input: { b: 2, a: 1 },
      status: 'WAITING_FOR_APPROVAL',
      approvalId: 'approval-1',
      idempotencyKey: 'stable',
      attemptCount: 0,
    });
    const hash = createHash('sha256')
      .update(JSON.stringify({ a: 1, b: 2 }))
      .digest('hex');
    approvals.findOne.mockResolvedValue({
      id: 'approval-1',
      tenantId: run.tenantId,
      status: 'APPROVED',
      expiresAt: new Date(Date.now() + 60000),
      payload: {
        toolName: tool.name,
        canonicalInputHash: hash,
        policyVersion: '1.0.0',
        toolRegistrationsVersion: 'registrations-v1',
      },
    });
    const result = await service.resume(run.id, run.tenantId);
    expect(approvals.findOne).toHaveBeenCalledWith('approval-1', 'tenant-1');
    expect(result.status).toBe('COMPLETED');
  });

  it('uses stable step idempotency keys across replays', async () => {
    const first = build();
    const second = build();
    await first.service.execute('run-1', 'tenant-1');
    await second.service.execute('run-1', 'tenant-1');
    expect(first.repo.createStep.mock.calls[0][0].idempotencyKey).toBe(
      'tenant-1:run-1:step-plan-id:0',
    );
    expect(second.repo.createStep.mock.calls[0][0].idempotencyKey).toBe(
      first.repo.createStep.mock.calls[0][0].idempotencyKey,
    );
  });

  it('persists Employee identity separately from the requesting actor', async () => {
    const { service, repo, transport } = build();

    const result = await service.createRun({
      tenantId: 'tenant-1',
      actorId: 'employee-1',
      actorType: 'AI_AGENT',
      employeeId: 'employee-1',
      requestedByActorId: 'human-1',
      taskId: 'task-1',
      triggerType: 'TASK',
      triggerSourceId: 'task-1',
      idempotencyKey: 'employee-run-1',
      request: 'Analyze the document',
    });

    expect(repo.createOrGetByIdempotencyKey).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'employee-1',
        employeeId: 'employee-1',
        requestedByActorId: 'human-1',
        taskId: 'task-1',
        triggerType: 'TASK',
        idempotencyKey: 'employee-run-1',
      }),
    );
    expect(repo.createRun).not.toHaveBeenCalled();
    expect(result.employeeId).toBe('employee-1');
    expect(transport.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ employeeId: 'employee-1' }),
      }),
    );
  });

  it('returns an idempotent replay without duplicating snapshot or events', async () => {
    const { service, repo, contextRepo, transport, planner } = build();
    repo.createOrGetByIdempotencyKey.mockResolvedValue({
      run: { ...build().run, id: 'existing-run', employeeId: 'employee-1' },
      created: false,
    } as never);

    const result = await service.createRun({
      tenantId: 'tenant-1',
      actorId: 'employee-1',
      actorType: 'AI_AGENT',
      employeeId: 'employee-1',
      requestedByActorId: 'human-1',
      triggerType: 'USER',
      idempotencyKey: 'same-key',
      request: 'Analyze the document',
    });

    expect(result.id).toBe('existing-run');
    expect(contextRepo.save).not.toHaveBeenCalled();
    expect(transport.publish).not.toHaveBeenCalled();
    expect(planner.plan).not.toHaveBeenCalled();
  });

  it('keeps legacy rows readable with explicit null Employee metadata', async () => {
    const { service } = build();
    await expect(service.getRun('run-1', 'tenant-1')).resolves.toMatchObject({
      id: 'run-1',
      employeeId: null,
      requestedByActorId: null,
      taskId: null,
      triggerType: 'USER',
      triggerSourceId: null,
      parentRunId: null,
    });
  });

  it('includes Employee ID in every lifecycle event for an Employee run', async () => {
    const { service, transport } = build();
    await service.createRun({
      tenantId: 'tenant-1',
      actorId: 'employee-1',
      actorType: 'AI_AGENT',
      employeeId: 'employee-1',
      requestedByActorId: 'human-1',
      idempotencyKey: 'event-key',
      triggerType: 'USER',
      request: 'Analyze the document',
    });
    await service.execute('run-1', 'tenant-1');

    expect(transport.publish).toHaveBeenCalled();
    const published = transport.publish.mock.calls as unknown as Array<
      [{ payload: Record<string, unknown> }]
    >;
    for (const [event] of published) {
      expect(event.payload).toEqual(
        expect.objectContaining({ employeeId: 'employee-1' }),
      );
    }
  });

  it.each([
    [{ employeeId: 'employee-1' }, /requestedByActorId/],
    [
      {
        employeeId: 'employee-1',
        requestedByActorId: 'human-1',
        idempotencyKey: 'key',
        actorId: 'human-1',
      },
      /execute as the selected AI employee/,
    ],
    [
      {
        employeeId: 'employee-1',
        requestedByActorId: 'human-1',
        idempotencyKey: 'key',
        actorId: 'employee-1',
        actorType: 'AI_AGENT',
        triggerType: 'INVALID',
      },
      /unsupported Employee run trigger/,
    ],
  ])(
    'fails closed on incomplete Employee metadata %p',
    async (extra, message) => {
      const { service, repo } = build();
      await expect(
        service.createRun({
          tenantId: 'tenant-1',
          actorId: 'actor-1',
          actorType: 'HUMAN',
          request: 'test',
          ...extra,
        } as never),
      ).rejects.toThrow(message);
      expect(repo.createRun).not.toHaveBeenCalled();
      expect(repo.createOrGetByIdempotencyKey).not.toHaveBeenCalled();
    },
  );
});
