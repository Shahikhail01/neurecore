import { CorrelationLogger, LogLevel } from './correlation-logger.service';
import { Phase8CorrelationLogger } from './phase8-correlation-logger';

describe('Phase8CorrelationLogger (Phase 8 — §10.3 correlated logging)', () => {
  it('attaches golden-path entity ids as searchable keys', () => {
    const calls: { level: string; message: string; ctx: Record<string, unknown> }[] = [];
    const inner: CorrelationLogger = {
      logWithCorrelation: (
        level: LogLevel,
        message: string,
        correlation: { tenantId: string; correlationId: string; actorId: string; actorType: string; causationId: string | null },
        extra?: Record<string, unknown>,
      ) => {
        calls.push({ level, message, ctx: { ...correlation, ...(extra ?? {}) } });
      },
    } as unknown as CorrelationLogger;

    const logger = new Phase8CorrelationLogger(inner);
    logger.log(
      LogLevel.INFO,
      'TaskAssigned',
      {
        tenantId: 'tnt-1',
        correlationId: 'corr-1',
        actorId: 'agent-1',
        actorType: 'AI_AGENT',
        causationId: 'corr-0',
      },
      {
        taskId: 'task-1',
        projectId: 'proj-1',
        executionAttemptId: 'att-1',
      },
      { note: 'human override' },
    );

    expect(calls).toHaveLength(1);
    const ctx = calls[0].ctx;
    const searchable = ctx.searchableBy as string[];
    expect(searchable).toEqual(
      expect.arrayContaining([
        'tnt-1',
        'corr-1',
        'agent-1',
        'corr-0',
        'task-1',
        'proj-1',
        'att-1',
      ]),
    );
    expect(ctx.entityIds).toEqual({
      taskId: 'task-1',
      projectId: 'proj-1',
      executionAttemptId: 'att-1',
    });
    expect(ctx.note).toBe('human override');
  });

  it('omits undefined entity ids from the searchable list', () => {
    const calls: { ctx: Record<string, unknown> }[] = [];
    const inner: CorrelationLogger = {
      logWithCorrelation: (_level, _message, correlation, extra) => {
        calls.push({ ctx: { ...correlation, ...(extra ?? {}) } });
      },
    } as unknown as CorrelationLogger;

    const logger = new Phase8CorrelationLogger(inner);
    logger.log(
      LogLevel.INFO,
      'InitiationApproved',
      {
        tenantId: 'tnt-1',
        correlationId: 'corr-1',
        actorId: 'user-1',
        actorType: 'HUMAN',
        causationId: null,
      },
      { initiationId: 'init-1' },
    );

    const searchable = calls[0].ctx.searchableBy as string[];
    expect(searchable).toContain('init-1');
    // causationId was null and should not appear in the searchable list
    expect(searchable).not.toContain(null);
    expect(searchable).not.toContain(undefined);
  });
});
