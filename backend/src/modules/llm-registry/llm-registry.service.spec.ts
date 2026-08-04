/**
 * LLM Registry — pure unit tests for the service.
 *
 * No DB, no HTTP — just the service + mocked repository + mocked secret
 * provider. Tests assert:
 *   1. Tenant isolation: wildcard '*' is refused everywhere.
 *   2. Role gates: OWNER cannot call admin methods; PLATFORM_ADMIN can.
 *   3. Cross-tenant binding ops are denied unless caller is platform admin.
 *   4. Audit chain: every audit row carries previousHash → currentHash.
 *   5. Secret resolution: missing secretRef → NotFoundException.
 *   6. Resolution: returns provider+model+apiKey for the active tenant.
 */

import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { LlmProviderKind, LlmProviderStatus, UserRole } from '@prisma/client';
import { LlmRegistryService } from './llm-registry.service';
import { LlmRegistryRepository } from './llm-registry.repository';
import { SecretProviderService } from '../security/providers/secret.provider';
import type { JwtPayload } from '../auth/interfaces/token.interface';

function jwt(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    sub: overrides.sub ?? 'user-1',
    role: overrides.role ?? UserRole.OWNER,
    tenantId: overrides.tenantId ?? 'tenant-a',
    email: 'user@x.test',
  } as JwtPayload;
}

describe('LlmRegistryService', () => {
  let svc: LlmRegistryService;
  let repo: jest.Mocked<LlmRegistryService extends never ? never : LlmRegistryRepository>;
  let secrets: jest.Mocked<Pick<SecretProviderService, 'resolve'>>;

  const baseProvider = {
    id: 'prov-1',
    slug: 'openai-prod',
    displayName: 'OpenAI Production',
    kind: LlmProviderKind.OPENAI_COMPATIBLE,
    status: LlmProviderStatus.ACTIVE,
    baseUrl: 'https://api.openai.com/v1',
    secretRef: 'env:OPENAI_API_KEY',
    orgId: 'org-1',
    metadata: {},
    requestsPerMinuteCap: null,
    maxConcurrent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseModel = {
    id: 'model-1',
    providerId: 'prov-1',
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o mini',
    capabilities: { tools: true },
    contextWindow: 128000,
    costInputPer1k: null,
    costOutputPer1k: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const repoMock: Partial<jest.Mocked<LlmRegistryRepository>> = {
      findAllProviders: jest.fn().mockResolvedValue([]),
      countProviders: jest.fn().mockResolvedValue(0),
      findProviderById: jest.fn(),
      findProviderBySlug: jest.fn(),
      createProvider: jest.fn(),
      updateProvider: jest.fn(),
      deleteProvider: jest.fn(),
      findModelsByProvider: jest.fn().mockResolvedValue([]),
      findModelById: jest.fn(),
      findModelByProviderAndId: jest.fn(),
      createModel: jest.fn(),
      deleteModel: jest.fn(),
      findBindingsByTenant: jest.fn().mockResolvedValue([]),
      findActiveBindingForTenant: jest.fn(),
      findBindingById: jest.fn(),
      createBinding: jest.fn(),
      updateBinding: jest.fn(),
      deleteBinding: jest.fn(),
      appendAudit: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      findLastAuditHash: jest.fn().mockResolvedValue(null),
      listAudits: jest.fn().mockResolvedValue([]),
    };
    const secretsMock = {
      resolve: jest.fn().mockReturnValue({
        value: 'sk-test-1234',
        source: 'env' as const,
        expiresAt: Date.now() + 60_000,
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LlmRegistryService,
        { provide: LlmRegistryRepository, useValue: repoMock },
        { provide: SecretProviderService, useValue: secretsMock },
      ],
    }).compile();

    svc = moduleRef.get(LlmRegistryService);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repo = moduleRef.get(LlmRegistryRepository) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    secrets = moduleRef.get(SecretProviderService) as any;
  });

  describe('role gates', () => {
    it('refuses createProvider for non-platform roles', async () => {
      await expect(
        svc.createProvider(
          {
            slug: 'p1',
            displayName: 'p',
            kind: LlmProviderKind.OPENAI_COMPATIBLE,
            baseUrl: 'https://x.test',
            secretRef: 'env:X',
          },
          jwt({ role: UserRole.OWNER }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows createProvider for SUPER_ADMIN', async () => {
      (repo.findProviderBySlug as jest.Mock).mockResolvedValue(null);
      (repo.createProvider as jest.Mock).mockResolvedValue(baseProvider);
      const out = await svc.createProvider(
        {
          slug: 'p1',
          displayName: 'OpenAI Production',
          kind: LlmProviderKind.OPENAI_COMPATIBLE,
          baseUrl: 'https://api.openai.com/v1',
          secretRef: 'env:OPENAI_API_KEY',
        },
        jwt({ role: UserRole.SUPER_ADMIN, tenantId: null }),
      );
      expect(out.slug).toBe('openai-prod');
      expect(repo.createProvider).toHaveBeenCalled();
    });
  });

  describe('tenant isolation', () => {
    it('refuses wildcard tenant on createBinding', async () => {
      await expect(
        svc.createBinding(
          {
            tenantId: '*',
            providerId: 'prov-1',
            modelId: 'model-1',
          },
          jwt({ role: UserRole.SUPER_ADMIN, tenantId: null }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses cross-tenant binding creation by OWNER', async () => {
      await expect(
        svc.createBinding(
          {
            tenantId: 'tenant-b',
            providerId: 'prov-1',
            modelId: 'model-1',
          },
          jwt({ role: UserRole.OWNER, tenantId: 'tenant-a' }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows same-tenant binding creation by OWNER', async () => {
      (repo.findProviderById as jest.Mock).mockResolvedValue(baseProvider);
      (repo.findModelById as jest.Mock).mockResolvedValue(baseModel);
      (repo.createBinding as jest.Mock).mockResolvedValue({
        id: 'b1',
        tenantId: 'tenant-a',
        providerId: 'prov-1',
        modelId: 'model-1',
        priority: 0,
        status: 'ACTIVE',
        requestsPerMinuteCap: null,
        metadata: {},
        createdByActorId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastRotatedAt: null,
      });
      const out = await svc.createBinding(
        { tenantId: 'tenant-a', providerId: 'prov-1', modelId: 'model-1' },
        jwt({ role: UserRole.OWNER, tenantId: 'tenant-a' }),
      );
      expect(out.tenantId).toBe('tenant-a');
      expect(repo.createBinding).toHaveBeenCalled();
    });

    it('allows platform-admin to create cross-tenant binding', async () => {
      (repo.findProviderById as jest.Mock).mockResolvedValue(baseProvider);
      (repo.findModelById as jest.Mock).mockResolvedValue(baseModel);
      (repo.createBinding as jest.Mock).mockResolvedValue({
        id: 'b2',
        tenantId: 'tenant-b',
        providerId: 'prov-1',
        modelId: 'model-1',
        priority: 0,
        status: 'ACTIVE',
        requestsPerMinuteCap: null,
        metadata: {},
        createdByActorId: 'platform-admin',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastRotatedAt: null,
      });
      const out = await svc.createBinding(
        { tenantId: 'tenant-b', providerId: 'prov-1', modelId: 'model-1' },
        jwt({ role: UserRole.SUPER_ADMIN, tenantId: null }),
      );
      expect(out.tenantId).toBe('tenant-b');
    });
  });

  describe('secret resolution', () => {
    it('throws NotFound when secretRef cannot be resolved', async () => {
      (secrets.resolve as jest.Mock).mockImplementationOnce(() => {
        throw new Error('env var missing');
      });
      await expect(
        svc.createProvider(
          {
            slug: 'p2',
            displayName: 'p',
            kind: LlmProviderKind.OPENAI_COMPATIBLE,
            baseUrl: 'https://x.test',
            secretRef: 'env:NOPE',
          },
          jwt({ role: UserRole.SUPER_ADMIN, tenantId: null }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns null when no active binding exists for tenant', async () => {
      (repo.findActiveBindingForTenant as jest.Mock).mockResolvedValue(null);
      const out = await svc.resolveActiveBindingForTenant('tenant-a');
      expect(out).toBeNull();
    });

    it('returns resolved provider+model+key when active binding exists', async () => {
      (repo.findActiveBindingForTenant as jest.Mock).mockResolvedValue({
        id: 'b1',
        tenantId: 'tenant-a',
        providerId: 'prov-1',
        modelId: 'model-1',
        priority: 0,
        status: 'ACTIVE',
        requestsPerMinuteCap: null,
        metadata: {},
        createdByActorId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastRotatedAt: null,
      });
      (repo.findProviderById as jest.Mock).mockResolvedValue(baseProvider);
      (repo.findModelById as jest.Mock).mockResolvedValue(baseModel);
      const out = await svc.resolveActiveBindingForTenant('tenant-a');
      expect(out).not.toBeNull();
      expect(out!.apiKey).toBe('sk-test-1234');
      expect(out!.model.modelId).toBe('gpt-4o-mini');
    });

    it('refuses wildcard tenant on resolution', async () => {
      await expect(svc.resolveActiveBindingForTenant('*')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('duplicate detection', () => {
    it('throws Conflict when provider slug already exists', async () => {
      (repo.findProviderBySlug as jest.Mock).mockResolvedValue(baseProvider);
      await expect(
        svc.createProvider(
          {
            slug: 'openai-prod',
            displayName: 'dup',
            kind: LlmProviderKind.OPENAI_COMPATIBLE,
            baseUrl: 'https://x.test',
            secretRef: 'env:OPENAI_API_KEY',
          },
          jwt({ role: UserRole.SUPER_ADMIN, tenantId: null }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('audit chain', () => {
    it('records audit on binding creation with previousHash=null', async () => {
      (repo.findProviderById as jest.Mock).mockResolvedValue(baseProvider);
      (repo.findModelById as jest.Mock).mockResolvedValue(baseModel);
      (repo.createBinding as jest.Mock).mockResolvedValue({
        id: 'b3',
        tenantId: 'tenant-a',
        providerId: 'prov-1',
        modelId: 'model-1',
        priority: 0,
        status: 'ACTIVE',
        requestsPerMinuteCap: null,
        metadata: {},
        createdByActorId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastRotatedAt: null,
      });
      await svc.createBinding(
        { tenantId: 'tenant-a', providerId: 'prov-1', modelId: 'model-1' },
        jwt(),
      );
      expect(repo.appendAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-a',
          bindingId: 'b3',
          actorId: 'user-1',
          action: 'CREATED',
          previousHash: null,
        }),
      );
    });

    it('chains audit hashes on rotation', async () => {
      (repo.findBindingById as jest.Mock).mockResolvedValue({
        id: 'b3',
        tenantId: 'tenant-a',
        providerId: 'prov-1',
        modelId: 'model-1',
        priority: 0,
        status: 'ACTIVE',
        requestsPerMinuteCap: null,
        metadata: {},
        createdByActorId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastRotatedAt: null,
      });
      (repo.findLastAuditHash as jest.Mock).mockResolvedValue({
        currentHash: 'abc123',
      });
      (repo.updateBinding as jest.Mock).mockResolvedValue({
        id: 'b3',
        tenantId: 'tenant-a',
        providerId: 'prov-1',
        modelId: 'model-1',
        priority: 0,
        status: 'ACTIVE',
        requestsPerMinuteCap: null,
        metadata: {},
        createdByActorId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastRotatedAt: new Date(),
      });
      await svc.rotateBinding('b3', jwt());
      expect(repo.appendAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ROTATED',
          previousHash: 'abc123',
        }),
      );
    });
  });
});
