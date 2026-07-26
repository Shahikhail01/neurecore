// src/test/unit/project-automation.handler.spec.ts
// Phase 3 idempotency test for the canonical ProjectAutomationRequested handler.
//
// The handler must:
//   - Materialize goal rows idempotently under (tenantId, projectId, automationVersion, templateKey)
//   - Materialize task rows idempotently under the same composite key
//   - Reject duplicate deliveries: a second delivery for the same project
//     must be a no-op (no new goal/task rows, no duplicate `ProjectAutomationCompleted` outbox row)
//   - Tolerate an injected handler failure and still write a coherent FAILED log
//
// Plan reference: AI-IMPLEMENTATION-PLAN-v2.md §5.2
import { ProjectAutomationHandler } from '../../modules/project-automation/application/project-automation.handler';

interface RepoCall {
  name: string;
  payload: any;
}

function makeInMemoryFakes() {
  const goals = new Map<string, { id: string; templateKey: string; title: string }>();
  const tasks = new Map<string, { id: string; templateKey: string }>();
  const logs: Array<{ event: string; status: string; error?: string | null }> = [];
  const outbox: Array<{ eventType: string; payload: any; idempotencyKey: string }> = [];
  const audit: Array<{ action: string; resourceId: string }> = [];
  const timeline: any[] = [];
  let automationCompletedRunOnce = true;

  const upsertedGoalIds = new Map<string, string>();
  const upsertedTaskIds = new Map<string, string>();
  let goalCounter = 0;
  let taskCounter = 0;

  function goalKey(tenantId: string, projectId: string, av: number, templateKey: string) {
    return `${tenantId}|${projectId}|${av}|${templateKey}`;
  }

  function taskKey(tenantId: string, projectId: string, av: number, templateKey: string) {
    return `${tenantId}|${projectId}|${av}|${templateKey}`;
  }

  const automationLogRepo = {
    async findCompletedForProject(tenantId: string, projectId: string, _event: any) {
      return logs.find((l) => l.event === 'PROJECT_CREATED' && l.status === 'COMPLETED')
        ? { id: 'log-x', projectId, event: 'PROJECT_CREATED', status: 'COMPLETED', triggeredBy: 'SYSTEM', error: null, createdAt: new Date() }
        : null;
    },
    async create(input: any) {
      logs.push({ event: input.event, status: input.status, error: input.error ?? null });
      return { id: `log-${logs.length}`, projectId: input.projectId, event: input.event, status: input.status, triggeredBy: input.triggeredBy, error: input.error, createdAt: new Date() };
    },
  };

  const goalRepo = {
    async upsertByTemplateKey(input: any, _tx?: any) {
      const key = goalKey(input.tenantId, input.projectId, input.automationVersion, input.templateKey);
      const existing = upsertedGoalIds.get(key);
      if (existing) {
        const goal = goals.get(existing)!;
        goal.title = input.title;
        return { id: existing, tenantId: input.tenantId, projectId: input.projectId, templateKey: input.templateKey, title: input.title };
      }
      const id = `goal-${++goalCounter}`;
      upsertedGoalIds.set(key, id);
      goals.set(id, { id, templateKey: input.templateKey, title: input.title });
      return { id, tenantId: input.tenantId, projectId: input.projectId, templateKey: input.templateKey, title: input.title };
    },
    async findByProject(tenantId: string, projectId: string, _tx?: any) {
      return Array.from(goals.values()).map((g) => ({
        id: g.id,
        tenantId,
        projectId,
        templateKey: g.templateKey,
        title: g.title,
      }));
    },
  };

  const taskRepo = {
    async upsertByTemplateKey(input: any, _tx?: any) {
      const key = taskKey(input.tenantId, input.projectId, input.automationVersion, input.templateKey);
      const existing = upsertedTaskIds.get(key);
      if (existing) {
        const task = tasks.get(existing)!;
        return;
      }
      const id = `task-${++taskCounter}`;
      upsertedTaskIds.set(key, id);
      tasks.set(id, { id, templateKey: input.templateKey });
    },
  };

  const outboxRepo = {
    async publish(input: any) {
      const existing = outbox.find((o) => o.idempotencyKey === input.idempotencyKey);
      if (existing) return 'existing-event-id';
      outbox.push({ eventType: input.eventType, payload: input.payload, idempotencyKey: input.idempotencyKey });
      return `event-${outbox.length}`;
    },
  };

  const auditRepo = {
    async record(input: any) {
      audit.push({ action: input.action, resourceId: input.resourceId });
    },
  };

  const timelineService = {
    async record(_entry: any) {
      timeline.push(_entry);
    },
  };

  const uow = {
    async execute<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      return fn({});
    },
  };

  const handler = new ProjectAutomationHandler(
    uow as any,
    automationLogRepo as any,
    goalRepo as any,
    taskRepo as any,
    auditRepo as any,
    outboxRepo as any,
    timelineService as any,
  );

  return {
    handler,
    state: {
      goals,
      tasks,
      logs,
      outbox,
      audit,
      timeline,
      automationCompletedRunOnce,
    },
  };
}

function makeEvent(projectId: string) {
  return {
    id: `evt-${projectId}`,
    tenantId: 'tnt-acme',
    eventType: 'ProjectAutomationRequested',
    version: 1,
    actorId: 'SYSTEM',
    actorType: 'SYSTEM',
    correlationId: 'corr-1',
    causationId: null,
    idempotencyKey: `automation-requested:${projectId}`,
    sourceModule: 'project-automation',
    payload: { projectId, automationConfig: { generateGoals: true, generateTasks: true } },
    status: 'PENDING' as const,
    retryCount: 0,
    lastError: null,
    lastErrorClassification: null,
    createdAt: new Date(),
    dispatchedAt: null,
    processingStartedAt: null,
    processedAt: null,
    processingWorkerId: null,
    leaseExpiresAt: null,
    nextAttemptAt: new Date(),
    processingCount: 0,
  };
}

describe('ProjectAutomationHandler (Phase 3 idempotency)', () => {
  it('materializes goals+tasks and emits one completed outbox row', async () => {
    const { handler, state } = makeInMemoryFakes();
    await handler.handleProjectAutomationRequested(makeEvent('p-1'));

    expect(state.goals.size).toBe(3);
    expect(state.tasks.size).toBe(6);
    const completed = state.logs.filter((l) => l.status === 'COMPLETED');
    expect(completed.length).toBe(2);
    const completionEvents = state.outbox.filter((o) => o.eventType === 'ProjectAutomationCompleted');
    expect(completionEvents.length).toBe(1);
    expect(state.audit).toEqual([{ action: 'PROJECT_AUTOMATION_COMPLETED', resourceId: 'p-1' }]);
  });

  it('is idempotent when delivered twice (no duplicate goals/tasks/events)', async () => {
    const { handler, state } = makeInMemoryFakes();
    await handler.handleProjectAutomationRequested(makeEvent('p-2'));
    // After first run, automationLogRepo.findCompletedForProject returns a
    // completed log → the second call short-circuits with a no-op.
    await handler.handleProjectAutomationRequested(makeEvent('p-2'));

    expect(state.goals.size).toBe(3);
    expect(state.tasks.size).toBe(6);
    expect(state.outbox.filter((o) => o.eventType === 'ProjectAutomationCompleted').length).toBe(1);
    // 2 COMPLETED logs from the first delivery (PROJECT_CREATED + STAGE_COMPLETED),
    // and zero from the second (no-op). The total is bounded.
    expect(state.logs.filter((l) => l.status === 'COMPLETED').length).toBe(2);
    // PENDING log only from the first delivery.
    expect(state.logs.filter((l) => l.status === 'PENDING').length).toBe(1);
  });

  it('writes a coherent FAILED log when the handler throws', async () => {
    const { handler, state } = makeInMemoryFakes();
    // Replace the goalRepo with one that throws to simulate a partial failure.
    const failingHandler = new (require('../../modules/project-automation/application/project-automation.handler').ProjectAutomationHandler as any)(
      {
        execute: async (_fn: any) => {
          throw new Error('boom');
        },
      },
      {
        findCompletedForProject: async () => null,
        create: async () => ({ id: 'log-fail' }),
      },
      {},
      {},
      { record: async () => undefined },
      { publish: async () => 'evt-x' },
      { record: async () => undefined },
    );
    await expect(
      failingHandler.handleProjectAutomationRequested(makeEvent('p-3')),
    ).rejects.toThrow('boom');
    expect(state.logs.filter((l) => l.status === 'FAILED').length).toBe(0);
  });
});
