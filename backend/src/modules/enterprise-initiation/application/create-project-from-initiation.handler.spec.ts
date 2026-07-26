jest.mock('@prisma/client', () => ({
  AwlExecutionEngine: { canonical: 'canonical' },
  PrismaClient: class {},
}));

import { CreateProjectFromInitiationHandler } from './create-project-from-initiation.handler';
import type { CommandMetadata } from '../../../common/correlation/correlation.interface';
import { InitiationStatus } from '../domain/initiation-states';
import { AwlExecutionEngine } from '@prisma/client';

describe('CreateProjectFromInitiationHandler', () => {
  const metadata: CommandMetadata = {
    tenantId: 'tenant-1',
    actorId: 'user-1',
    actorType: 'HUMAN',
    correlationId: 'corr-1',
    causationId: null,
    idempotencyKey: 'idem-1',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
  };

  const initiation = {
    id: 'init-1',
    tenantId: 'tenant-1',
    customerId: null,
    status: InitiationStatus.APPROVED,
    projectName: 'Canonical Project',
    projectDescription: 'From initiation',
    targetDate: null,
    approvedByActorId: 'user-1',
    approvedAt: new Date(),
    approvalComment: null,
    projectId: null,
    version: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function makeHandler(overrides: Record<string, unknown> = {}) {
    const tx = { tx: true };
    const uow = {
      execute: jest.fn(async (fn: (tx: unknown) => unknown) => fn(tx)),
    };
    const initiationRepo = {
      findApprovedForUpdate: jest.fn().mockResolvedValue(initiation),
      markMaterializing: jest.fn().mockResolvedValue({ ...initiation, projectId: 'project-1' }),
    };
    const projectRepo = {
      findByInitiationId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'project-1',
        tenantId: 'tenant-1',
        name: 'Canonical Project',
        description: 'From initiation',
        customerId: null,
        targetDate: null,
        status: 'ACTIVE',
        executionEngineVersion: AwlExecutionEngine.canonical,
        initiationId: 'init-1',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };
    const auditRepo = { record: jest.fn().mockResolvedValue(undefined) };
    const outboxRepo = { publish: jest.fn().mockResolvedValue('outbox-1') };
    const tenantFlags = { isEnabled: jest.fn().mockResolvedValue(true) };

    const deps = {
      uow,
      initiationRepo,
      projectRepo,
      auditRepo,
      outboxRepo,
      tenantFlags,
      ...overrides,
    };

    const handler = new CreateProjectFromInitiationHandler(
      deps.uow as never,
      deps.initiationRepo as never,
      deps.projectRepo as never,
      deps.auditRepo as never,
      deps.outboxRepo as never,
      deps.tenantFlags as never,
    );

    return { handler, tx, ...deps };
  }

  it('creates project, marks initiation, audits, and publishes outbox in one unit of work', async () => {
    const ctx = makeHandler();

    const result = await ctx.handler.handle(
      {
        initiationId: 'init-1',
        projectName: 'Canonical Project',
      },
      metadata,
    );

    expect(ctx.projectRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        initiationId: 'init-1',
        executionEngineVersion: AwlExecutionEngine.canonical,
      }),
      ctx.tx,
    );
    expect(ctx.initiationRepo.markMaterializing).toHaveBeenCalledWith(
      'tenant-1',
      'init-1',
      'project-1',
      3,
      ctx.tx,
    );
    expect(ctx.auditRepo.record).toHaveBeenCalledWith(expect.any(Object), ctx.tx);
    expect(ctx.outboxRepo.publish).toHaveBeenCalledWith(expect.any(Object), ctx.tx);
    expect(result.data?.automationRequestId).toBe('outbox-1');
  });

  it('deduplicates when the initiation already has a project result', async () => {
    const ctx = makeHandler({
      projectRepo: {
        findByInitiationId: jest.fn().mockResolvedValue({
          id: 'project-existing',
          status: 'ACTIVE',
        }),
        create: jest.fn(),
      },
    });

    const result = await ctx.handler.handle(
      {
        initiationId: 'init-1',
        projectName: 'Canonical Project',
      },
      metadata,
    );

    expect(ctx.projectRepo.create).not.toHaveBeenCalled();
    expect(ctx.outboxRepo.publish).not.toHaveBeenCalled();
    expect(result.deduplicated).toBe(true);
    expect(result.data?.projectId).toBe('project-existing');
  });
});
