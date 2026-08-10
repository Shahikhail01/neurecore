import type { WorkRunStatus } from '@prisma/client';
import {
  EmployeeRunProjectionSource,
  EmployeeRunViewMapper,
} from './employee-run-view.mapper';

const run = (
  overrides: Partial<EmployeeRunProjectionSource> = {},
): EmployeeRunProjectionSource =>
  ({
    id: 'run-1',
    tenantId: 'tenant-a',
    workspaceId: null,
    threadId: null,
    actorType: 'AI_AGENT',
    actorId: 'employee-a',
    hermesAgentId: null,
    employeeId: 'employee-a',
    requestedByActorId: 'human-a',
    taskId: 'task-a',
    triggerType: 'TASK',
    triggerSourceId: 'task-a',
    idempotencyKey: 'key-a',
    parentRunId: null,
    request: 'Analyze the document',
    status: 'COMPLETED' as WorkRunStatus,
    currentStepIndex: 1,
    contextProvenance: {},
    planVersion: 1,
    plan: null,
    summary: 'Analysis complete',
    failureCode: null,
    failureReason: null,
    version: 3,
    createdAt: new Date('2026-08-10T00:00:00.000Z'),
    startedAt: new Date('2026-08-10T00:00:01.000Z'),
    pausedAt: null,
    completedAt: new Date('2026-08-10T00:00:02.000Z'),
    cancelledAt: null,
    failedAt: null,
    ...overrides,
  }) as EmployeeRunProjectionSource;

describe('EmployeeRunViewMapper', () => {
  const mapper = new EmployeeRunViewMapper();
  const employee = { id: 'employee-a', name: 'Analyst', role: 'ANALYST' };

  it('maps only the stable, redacted Employee Run view', () => {
    const result = mapper.map(run(), employee, [
      { id: 'a1', type: 'REPORT', name: 'Report' },
    ]);

    expect(result).toMatchObject({
      id: 'run-1',
      tenantId: 'tenant-a',
      employee,
      objective: 'Analyze the document',
      trigger: { type: 'TASK', sourceId: 'task-a' },
      taskId: 'task-a',
      summary: 'Analysis complete',
      status: 'COMPLETED',
    });
    expect(result).not.toHaveProperty('contextProvenance');
    expect(result).not.toHaveProperty('plan');
    expect(Object.isFrozen(result.employee)).toBe(true);
    expect(Object.isFrozen(result.artifacts)).toBe(true);
    expect(Object.isFrozen(result.steps)).toBe(true);
  });

  it('normalizes short-lived PLANNED and maps typed failure details', () => {
    const result = mapper.map(
      run({ status: 'PLANNED', failureCode: 'X', failureReason: 'reason' }),
      employee,
    );
    expect(result.status).toBe('PLANNING');
    expect(result.failure).toEqual({ code: 'X', reason: 'reason' });
  });

  it('rejects a mismatched or legacy Employee identity', () => {
    expect(() => mapper.map(run({ employeeId: null }), employee)).toThrow(
      /persisted executing employee/,
    );
    expect(() => mapper.map(run(), { ...employee, id: 'employee-b' })).toThrow(
      /persisted executing employee/,
    );
  });
});
