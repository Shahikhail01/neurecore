import { WorkRunRepository } from './work-run.repository';

describe('WorkRunRepository Employee idempotency', () => {
  const input = {
    tenantId: 'tenant-a',
    actorId: 'employee-a',
    actorType: 'AI_AGENT' as const,
    employeeId: 'employee-a',
    requestedByActorId: 'human-a',
    triggerType: 'USER',
    idempotencyKey: 'request-a',
    request: 'Create a report',
    contextProvenance: {},
  };

  it('returns the tenant-owned existing row inside the transaction', async () => {
    const existing = {
      id: 'run-existing',
      ...input,
      taskId: null,
      triggerSourceId: null,
    };
    const tx = {
      agent: { findFirst: jest.fn().mockResolvedValue({ id: 'employee-a' }) },
      workRun: {
        findUnique: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) =>
        operation(tx),
      ),
      workRun: { findUnique: jest.fn() },
    };
    const repo = new WorkRunRepository(prisma as never);

    await expect(repo.createOrGetByIdempotencyKey(input)).resolves.toEqual({
      run: existing,
      created: false,
    });
    expect(tx.agent.findFirst).toHaveBeenCalledWith({
      where: { id: 'employee-a', tenantId: 'tenant-a' },
      select: { id: true },
    });
    expect(tx.workRun.findUnique).toHaveBeenCalledWith({
      where: {
        tenantId_idempotencyKey: {
          tenantId: 'tenant-a',
          idempotencyKey: 'request-a',
        },
      },
    });
    expect(tx.workRun.create).not.toHaveBeenCalled();
  });

  it('creates all Employee metadata when the tenant/key is new', async () => {
    const created = { id: 'run-new', ...input };
    const tx = {
      agent: { findFirst: jest.fn().mockResolvedValue({ id: 'employee-a' }) },
      workRun: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) =>
        operation(tx),
      ),
      workRun: { findUnique: jest.fn() },
    };
    const repo = new WorkRunRepository(prisma as never);

    await expect(repo.createOrGetByIdempotencyKey(input)).resolves.toEqual({
      run: created,
      created: true,
    });
    expect(tx.workRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 'employee-a',
        requestedByActorId: 'human-a',
        triggerType: 'USER',
        idempotencyKey: 'request-a',
        status: 'CREATED',
      }),
    });
  });

  it('rejects a foreign-tenant Employee before reading or creating a run', async () => {
    const tx = {
      agent: { findFirst: jest.fn().mockResolvedValue(null) },
      workRun: { findUnique: jest.fn(), create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) =>
        operation(tx),
      ),
      workRun: { findUnique: jest.fn() },
    };
    const repo = new WorkRunRepository(prisma as never);

    await expect(repo.createOrGetByIdempotencyKey(input)).rejects.toThrow(
      /not found for tenant/,
    );
    expect(tx.workRun.findUnique).not.toHaveBeenCalled();
    expect(tx.workRun.create).not.toHaveBeenCalled();
  });

  it('rejects reuse of a key with different request metadata', async () => {
    const tx = {
      agent: { findFirst: jest.fn().mockResolvedValue({ id: 'employee-a' }) },
      workRun: {
        findUnique: jest.fn().mockResolvedValue({
          ...input,
          employeeId: 'employee-a',
          requestedByActorId: 'human-a',
          taskId: null,
          triggerSourceId: null,
          request: 'Different request',
        }),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) =>
        operation(tx),
      ),
      workRun: { findUnique: jest.fn() },
    };
    const repo = new WorkRunRepository(prisma as never);

    await expect(repo.createOrGetByIdempotencyKey(input)).rejects.toThrow(
      /different Employee run metadata/,
    );
    expect(tx.workRun.create).not.toHaveBeenCalled();
  });
});
