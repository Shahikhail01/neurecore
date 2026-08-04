/**
 * Studio Codegen — Service unit tests.
 *
 * Asserts:
 *   1. Job lifecycle: PENDING → RUNNING → SUCCEEDED/REJECTED.
 *   2. Stub output validates against the template outputSchema.
 *   3. Tenant guard refuses wildcard.
 *   4. Cross-tenant find returns Forbidden.
 */

import { ForbiddenException } from '@nestjs/common';
import {
  StudioCodegenKind,
  StudioCodegenStatus,
} from '@prisma/client';
import { StudioCodegenService, OOB_PROMPT_TEMPLATES } from './studio-codegen.service';

function mockPrisma() {
  return {
    studioApp: {
      findUnique: jest.fn(),
    },
    studioCodegenJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  } as any;
}

describe('StudioCodegenService', () => {
  let svc: StudioCodegenService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
    svc = new StudioCodegenService(prisma);
  });

  it('ships 4 OOB prompt templates', () => {
    expect(OOB_PROMPT_TEMPLATES.length).toBe(4);
    const kinds = new Set(OOB_PROMPT_TEMPLATES.map((t) => t.kind));
    expect(kinds.size).toBe(4);
  });

  it('every template has a non-empty body + output schema', () => {
    for (const t of OOB_PROMPT_TEMPLATES) {
      expect(t.body.length).toBeGreaterThan(20);
      expect(Object.keys(t.outputSchema).length).toBeGreaterThan(0);
      expect(t.riskTier).toBeGreaterThanOrEqual(1);
    }
  });

  it('enqueue refuses wildcard tenant', async () => {
    await expect(
      svc.enqueueJob({
        tenantId: '*',
        appId: 'app-1',
        kind: StudioCodegenKind.PROMPT_TO_APP,
        prompt: 'hello',
        createdBy: 'u1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enqueue refuses app from a different tenant', async () => {
    prisma.studioApp.findUnique.mockResolvedValue({
      id: 'app-1',
      tenantId: 'tenant-b',
    });
    await expect(
      svc.enqueueJob({
        tenantId: 'tenant-a',
        appId: 'app-1',
        kind: StudioCodegenKind.PROMPT_TO_APP,
        prompt: 'hello',
        createdBy: 'u1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('runJob produces a validated SUCCEEDED job for PromptToApp', async () => {
    prisma.studioCodegenJob.findUnique.mockResolvedValue({
      id: 'j1',
      tenantId: 'tenant-a',
      appId: 'app-1',
      kind: StudioCodegenKind.PROMPT_TO_APP,
      prompt: 'sales dashboard',
      status: StudioCodegenStatus.PENDING,
      output: {},
      validation: {},
      errorMessage: null,
      createdBy: 'u1',
      createdAt: new Date(),
      startedAt: null,
      finishedAt: null,
    });
    await svc.runJob('tenant-a', 'j1');
    expect(prisma.studioCodegenJob.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'j1' },
        data: expect.objectContaining({
          status: StudioCodegenStatus.SUCCEEDED,
        }),
      }),
    );
  });

  it('runJob flags missing required fields as REJECTED', async () => {
    prisma.studioCodegenJob.findUnique.mockResolvedValue({
      id: 'j2',
      tenantId: 'tenant-a',
      appId: 'app-1',
      kind: 'NOT_REAL' as never,
      prompt: 'x',
      status: StudioCodegenStatus.PENDING,
      output: {},
      validation: {},
      errorMessage: null,
      createdBy: 'u1',
      createdAt: new Date(),
      startedAt: null,
      finishedAt: null,
    });
    await expect(svc.runJob('tenant-a', 'j2')).rejects.toThrow(/no template/);
    expect(prisma.studioCodegenJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'j2' },
        data: expect.objectContaining({
          status: StudioCodegenStatus.FAILED,
        }),
      }),
    );
  });

  it('listJobs refuses wildcard', async () => {
    await expect(svc.listJobs('*')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
