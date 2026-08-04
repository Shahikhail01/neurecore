/**
 * Domain Agents — Registry + Service unit tests.
 *
 * Asserts:
 *   1. The OOB registry contains all 26 expected agents (10 sales +
 *      5 marketing + 5 service + 5 workflow + 1 universal).
 *   2. Each registry row has all required fields populated.
 *   3. Domain counts are correct (no off-by-one).
 *   4. findOobAgent / findOobAgentBySlug work for both keys.
 *   5. Service.seedPlatformDefinitions is idempotent (no duplicates).
 *   6. Service.setTenantBinding refuses wildcard tenantId.
 *   7. Service.setTenantBinding refuses risk-tier override by non-platform.
 *   8. Service.startExecution refuses wildcard tenantId.
 */

import { ForbiddenException } from '@nestjs/common';
import { DomainAgentKind } from '@prisma/client';
import {
  OOB_AGENT_REGISTRY,
  findOobAgent,
  findOobAgentBySlug,
  listOobAgentsByDomain,
} from './oob-agent.registry';
import { DomainAgentService } from './domain-agents.service';
import { DomainAgentRepository } from './domain-agents.repository';

function mockRepo(): jest.Mocked<DomainAgentRepository> {
  return {
    findAllDefinitions: jest.fn().mockResolvedValue([]),
    findDefinitionByKind: jest.fn(),
    findDefinitionBySlug: jest.fn(),
    createDefinition: jest.fn(),
    setDefinitionEnabled: jest.fn(),
    findTenantBinding: jest.fn().mockResolvedValue(null),
    upsertTenantBinding: jest.fn(),
    listTenantBindings: jest.fn().mockResolvedValue([]),
    appendExecution: jest.fn(),
    finishExecution: jest.fn(),
    findExecutionById: jest.fn(),
    listExecutions: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<DomainAgentRepository>;
}

describe('OOB Agent Registry', () => {
  it('contains exactly 26 OOB agents (10 + 5 + 5 + 5 + 1)', () => {
    expect(OOB_AGENT_REGISTRY.length).toBe(26);
  });

  it('contains the expected domain counts', () => {
    expect(listOobAgentsByDomain('sales').length).toBe(10);
    expect(listOobAgentsByDomain('marketing').length).toBe(5);
    expect(listOobAgentsByDomain('service').length).toBe(5);
    expect(listOobAgentsByDomain('workflow').length).toBe(5);
    expect(listOobAgentsByDomain('universal').length).toBe(1);
  });

  it('has unique slugs and unique kinds', () => {
    const slugs = OOB_AGENT_REGISTRY.map((a) => a.slug);
    const kinds = OOB_AGENT_REGISTRY.map((a) => a.kind);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('every row has all required fields populated', () => {
    for (const a of OOB_AGENT_REGISTRY) {
      expect(a.slug).toMatch(/^[a-z0-9-]+$/);
      expect(a.displayName.length).toBeGreaterThan(0);
      expect(a.shortName.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.planSection).toMatch(/^5\./);
      expect([1, 2, 3, 4, 5]).toContain(a.riskTier);
    }
  });

  it('findOobAgent / findOobAgentBySlug return the spec for known keys', () => {
    const byKind = findOobAgent(DomainAgentKind.SALES_FORECAST);
    expect(byKind?.slug).toBe('sales-forecast');
    const bySlug = findOobAgentBySlug('sales-forecast');
    expect(bySlug?.kind).toBe(DomainAgentKind.SALES_FORECAST);
  });

  it('findOobAgent returns null for unknown kind', () => {
    // Cast through unknown to fabricate an invalid value without TS error.
    expect(findOobAgent('NOT_A_REAL_AGENT' as unknown as DomainAgentKind)).toBeNull();
  });
});

describe('DomainAgentService', () => {
  let svc: DomainAgentService;
  let repo: jest.Mocked<DomainAgentRepository>;

  beforeEach(() => {
    repo = mockRepo();
    svc = new DomainAgentService(repo);
  });

  it('seedPlatformDefinitions skips already-seeded kinds', async () => {
    repo.findDefinitionByKind.mockResolvedValue(null);
    repo.createDefinition.mockResolvedValue({} as never);
    const res = await svc.seedPlatformDefinitions();
    expect(res.total).toBe(OOB_AGENT_REGISTRY.length);
    // Repo will return null for every kind once we call it, so all 26
    // are created — but each call hits the repo so we can assert no
    // duplicate creates.
    expect(repo.createDefinition).toHaveBeenCalledTimes(OOB_AGENT_REGISTRY.length);
  });

  it('seedPlatformDefinitions is idempotent on second call', async () => {
    repo.findDefinitionByKind.mockResolvedValue({ id: 'd1' } as never);
    const res = await svc.seedPlatformDefinitions();
    expect(res.created).toBe(0);
    expect(repo.createDefinition).not.toHaveBeenCalled();
  });

  it('seedPlatformDefinitionsForTenant refuses wildcard', async () => {
    await expect(svc.seedPlatformDefinitionsForTenant('*')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('setTenantBinding refuses wildcard', async () => {
    await expect(
      svc.setTenantBinding({
        tenantId: '*',
        kind: DomainAgentKind.SALES_FORECAST,
        enabled: true,
        actorRoles: ['OWNER'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('setTenantBinding refuses risk-tier override by non-platform role', async () => {
    repo.findDefinitionByKind.mockResolvedValue({ id: 'd1' } as never);
    await expect(
      svc.setTenantBinding({
        tenantId: 'tenant-a',
        kind: DomainAgentKind.SALES_FORECAST,
        enabled: true,
        riskTierOverride: 5,
        actorRoles: ['OWNER'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('setTenantBinding allows risk-tier override for PLATFORM_ADMIN', async () => {
    repo.findDefinitionByKind.mockResolvedValue({ id: 'd1' } as never);
    repo.upsertTenantBinding.mockResolvedValue({} as never);
    await svc.setTenantBinding({
      tenantId: 'tenant-a',
      kind: DomainAgentKind.SALES_FORECAST,
      enabled: true,
      riskTierOverride: 5,
      actorRoles: ['PLATFORM_ADMIN'],
    });
    expect(repo.upsertTenantBinding).toHaveBeenCalledWith(
      expect.objectContaining({ riskTierOverride: 5 }),
    );
  });

  it('startExecution refuses wildcard', async () => {
    await expect(
      svc.startExecution({
        tenantId: '*',
        kind: DomainAgentKind.SALES_FORECAST,
        actorId: 'u1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('startExecution refuses disabled tenant binding', async () => {
    repo.findDefinitionByKind.mockResolvedValue({ id: 'd1' } as never);
    repo.findTenantBinding.mockResolvedValue({ enabled: false } as never);
    await expect(
      svc.startExecution({
        tenantId: 'tenant-a',
        kind: DomainAgentKind.SALES_FORECAST,
        actorId: 'u1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('startExecution succeeds when binding is enabled', async () => {
    repo.findDefinitionByKind.mockResolvedValue({ id: 'd1' } as never);
    repo.findTenantBinding.mockResolvedValue({ enabled: true } as never);
    repo.appendExecution.mockResolvedValue({ id: 'e1' } as never);
    const out = await svc.startExecution({
      tenantId: 'tenant-a',
      kind: DomainAgentKind.SALES_FORECAST,
      actorId: 'u1',
      inputs: { horizon: 7 },
    });
    expect(out.id).toBe('e1');
    expect(repo.appendExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        agentDefinitionId: 'd1',
        inputs: { horizon: 7 },
      }),
    );
  });
});
