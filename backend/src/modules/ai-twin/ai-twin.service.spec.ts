/**
 * AI Twin Service — Deploy Gate (Phase 8.1, §5.3.5).
 *
 * Asserts:
 *   1. Deploy refuses when wizardStep < 4.
 *   2. Deploy refuses a non-CERTIFIED template version.
 *   3. Deploy refuses a retired template version.
 *   4. Deploy refuses when twin's allowed scopes don't cover the
 *      template's composedSkills.
 *   5. Deploy succeeds when all gates pass.
 */

import { ForbiddenException } from '@nestjs/common';
import { AiTwinService } from './ai-twin.service';
import { AiTwinRepository } from './ai-twin.repository';
import { TwinPermissionMirrorGuard } from './ai-twin.runtime-contract';
import type { JwtPayload } from '@/modules/auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';

function mockRepo() {
  return {
    findByOwnerAndSlug: jest.fn(),
    findById: jest.fn(),
    findAllForOwner: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setStatus: jest.fn(),
    appendAudit: jest.fn(),
    listAudits: jest.fn(),
  } as unknown as jest.Mocked<AiTwinRepository>;
}

function mockGuard() {
  return {} as unknown as TwinPermissionMirrorGuard;
}

function mockPrisma() {
  return {
    agentTemplateVersion: {
      findUnique: jest.fn(),
    },
  } as any;
}

const OWNER: JwtPayload = {
  sub: 'user-1',
  role: UserRole.OWNER,
  tenantId: 'tenant-a',
  email: 'u@x.test',
};

function makeTwin(overrides: Partial<{ wizardStep: number; allowedReadScopes: string[]; allowedWriteScopes: string[] }> = {}) {
  return {
    id: 'twin-1',
    tenantId: 'tenant-a',
    ownerUserId: 'user-1',
    slug: 'my-twin',
    displayName: 'My Twin',
    description: null,
    status: 'DRAFT' as const,
    wizardStep: 4,
    step1Goal: { goal: 'help' },
    step2Iteration: null,
    step3Test: null,
    step4Deploy: null,
    agentTemplateId: null,
    agentTemplateVersionId: null,
    allowedReadScopes: [],
    allowedWriteScopes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    activatedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

describe('AiTwinService.deploy', () => {
  let svc: AiTwinService;
  let repo: ReturnType<typeof mockRepo>;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    repo = mockRepo();
    prisma = mockPrisma();
    svc = new AiTwinService(repo, mockGuard(), prisma);
  });

  it('refuses deploy when wizardStep < 4', async () => {
    (repo.findById as jest.Mock).mockResolvedValue(makeTwin({ wizardStep: 3 }));
    await expect(
      svc.deploy({
        twinId: 'twin-1',
        agentTemplateId: 'tpl-1',
        agentTemplateVersionId: 'v1',
        actor: OWNER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.agentTemplateVersion.findUnique).not.toHaveBeenCalled();
  });

  it('refuses a non-CERTIFIED template version', async () => {
    (repo.findById as jest.Mock).mockResolvedValue(makeTwin());
    prisma.agentTemplateVersion.findUnique.mockResolvedValue({
      id: 'v1',
      agentTemplateId: 'tpl-1',
      lifecycleStatus: 'DRAFT',
      definition: { composedSkills: [] },
      certifications: [],
    });
    await expect(
      svc.deploy({
        twinId: 'twin-1',
        agentTemplateId: 'tpl-1',
        agentTemplateVersionId: 'v1',
        actor: OWNER,
      }),
    ).rejects.toThrow(/must be CERTIFIED/);
  });

  it('refuses a RETIRED template version (even if certified)', async () => {
    (repo.findById as jest.Mock).mockResolvedValue(makeTwin());
    prisma.agentTemplateVersion.findUnique.mockResolvedValue({
      id: 'v1',
      agentTemplateId: 'tpl-1',
      lifecycleStatus: 'RETIRED',
      definition: { composedSkills: [] },
      certifications: [{ expiredAt: null }],
    });
    await expect(
      svc.deploy({
        twinId: 'twin-1',
        agentTemplateId: 'tpl-1',
        agentTemplateVersionId: 'v1',
        actor: OWNER,
      }),
    ).rejects.toThrow(/retired/);
  });

  it('refuses when twin is missing required scopes', async () => {
    (repo.findById as jest.Mock).mockResolvedValue(makeTwin({ allowedReadScopes: [], allowedWriteScopes: [] }));
    prisma.agentTemplateVersion.findUnique.mockResolvedValue({
      id: 'v1',
      agentTemplateId: 'tpl-1',
      lifecycleStatus: 'DRAFT',
      definition: { composedSkills: ['crm.read.contacts', 'crm.write.deals'] },
      certifications: [{ expiredAt: null }],
    });
    await expect(
      svc.deploy({
        twinId: 'twin-1',
        agentTemplateId: 'tpl-1',
        agentTemplateVersionId: 'v1',
        actor: OWNER,
      }),
    ).rejects.toThrow(/missing required scopes/);
  });

  it('succeeds when all gates pass', async () => {
    (repo.findById as jest.Mock).mockResolvedValue(
      makeTwin({ allowedReadScopes: ['crm.read.contacts'], allowedWriteScopes: ['crm.write.deals'] }),
    );
    prisma.agentTemplateVersion.findUnique.mockResolvedValue({
      id: 'v1',
      agentTemplateId: 'tpl-1',
      lifecycleStatus: 'DRAFT',
      definition: { composedSkills: ['crm.read.contacts', 'crm.write.deals'] },
      certifications: [{ expiredAt: null }],
    });
    (repo.update as jest.Mock).mockResolvedValue({});
    (repo.setStatus as jest.Mock).mockResolvedValue({ id: 'twin-1', status: 'ACTIVE' });
    (repo.appendAudit as jest.Mock).mockResolvedValue({});
    const out = await svc.deploy({
      twinId: 'twin-1',
      agentTemplateId: 'tpl-1',
      agentTemplateVersionId: 'v1',
      actor: OWNER,
    });
    expect(out.status).toBe('ACTIVE');
    expect(repo.update).toHaveBeenCalledWith('twin-1', {
      agentTemplateId: 'tpl-1',
      agentTemplateVersionId: 'v1',
    });
    expect(repo.appendAudit).toHaveBeenCalled();
  });

  it('refuses when template id does not match the version', async () => {
    (repo.findById as jest.Mock).mockResolvedValue(makeTwin());
    prisma.agentTemplateVersion.findUnique.mockResolvedValue({
      id: 'v1',
      agentTemplateId: 'other-tpl',
      lifecycleStatus: 'DRAFT',
      definition: { composedSkills: [] },
      certifications: [{ expiredAt: null }],
    });
    await expect(
      svc.deploy({
        twinId: 'twin-1',
        agentTemplateId: 'tpl-1',
        agentTemplateVersionId: 'v1',
        actor: OWNER,
      }),
    ).rejects.toThrow(/does not match/);
  });
});
