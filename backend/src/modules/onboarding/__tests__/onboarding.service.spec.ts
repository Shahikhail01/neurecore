/**
 * OnboardingService — unit tests for the orchestrator.
 * Verifies the 4-phase idempotent post-completion pipeline:
 *   Phase 1: ProjectType allocation
 *   Phase 2: Tenant templates seeding
 *   Phase 3: Department auto-creation
 *   Phase 4: Checklist seeding (13 entries)
 *
 * Uses a partially-mocked PrismaService. Other services (allocator,
 * seeder, departments, checklist) are mocked as Optional injections.
 */

import { NotFoundException } from '@nestjs/common';
import { OnboardingService } from '../onboarding.service';
import { IndustryGroupsService } from '../../industry/industry-groups.service';

describe('OnboardingService — orchestrator', () => {
  let prismaMock: any;
  let checklistMock: any;
  let allocatorMock: any;
  let templateSeederMock: any;
  let departmentsServiceMock: any;
  let service: OnboardingService;

  beforeEach(() => {
      prismaMock = {
      tenant: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      industry: { findUnique: jest.fn() },
      tier: { findUnique: jest.fn() },
      agent: { count: jest.fn(), create: jest.fn() },
      department: {
        count: jest.fn(),
        create: jest.fn(),
        // Part 9 N9 — headAgentId pinning in selectTemplate().
        update: jest.fn(),
      },
      departmentTemplate: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      onboardingInvitation: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn(), create: jest.fn() },
    };

    checklistMock = { seed: jest.fn().mockResolvedValue({ created: 13, existing: 0 }) };
    allocatorMock = { allocateForTenant: jest.fn().mockResolvedValue({ allocated: 5, skipped: 0 }) };
    templateSeederMock = { seedForTenant: jest.fn().mockResolvedValue(8) };
    departmentsServiceMock = { autoCreateFromTemplate: jest.fn().mockResolvedValue({ created: 0, skipped: 0 }) };
    // Phase 0 G1: industryGroupsMock required by the new OnboardingService ctor.
    const industryGroupsMock = {
      resolveIndustryGroup: jest.fn().mockResolvedValue('finance'),
    } as unknown as IndustryGroupsService;

    service = new OnboardingService(
      prismaMock,
      checklistMock,
      industryGroupsMock,
      allocatorMock,
      templateSeederMock,
      departmentsServiceMock,
    );
  });

  describe('getState()', () => {
    it('returns the tenant onboarding state with company fields', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1', name: 'Acme', logoUrl: 'logo.png', industry: 'accounting',
        industryGroup: 'finance', tierId: 'tier-X',
        onboardingStep: 'plan',
        timezone: 'UTC', currency: 'USD',
        tier: { name: 'Pro' },
      });
      prismaMock.agent.count.mockResolvedValue(7);
      prismaMock.department.count.mockResolvedValue(3);

      const state = await service.getState('tenant-1');

      expect(state.step).toBe('plan');
      expect(state.company?.name).toBe('Acme');
      expect(state.timezone).toBe('UTC');
      expect(state.currency).toBe('USD');
      expect(state.tierId).toBe('tier-X');
    });

    it('defaults step to "company" when not set', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1', name: 'Acme', logoUrl: null, industry: null,
        industryGroup: null, tierId: null,
        onboardingStep: null,
        timezone: null, currency: null,
        tier: null,
      });
      prismaMock.agent.count.mockResolvedValue(0);
      prismaMock.department.count.mockResolvedValue(0);

      const state = await service.getState('tenant-1');
      expect(state.step).toBe('company');
    });

    it('throws NotFoundException when tenant does not exist', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue(null);
      await expect(service.getState('tenant-X')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateState()', () => {
    it('persists name/logoUrl/industry/timezone/currency', async () => {
      // Phase 0 G1: industryGroup is resolved via IndustryGroupsService.
      const industryMock = (service as any).industryGroups;
      industryMock.resolveIndustryGroup.mockResolvedValue('finance');

      prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });
      // getState called at the end:
      prismaMock.tenant.findUnique.mockResolvedValueOnce({ id: 'tenant-1' });
      prismaMock.tenant.update.mockResolvedValue({});
      prismaMock.agent.count.mockResolvedValue(0);
      prismaMock.department.count.mockResolvedValue(0);
      prismaMock.tenant.findUnique.mockResolvedValueOnce({
        id: 'tenant-1', name: 'NewName', logoUrl: null, industry: 'accounting',
        industryGroup: 'finance', tierId: null,
        onboardingStep: null, timezone: 'UTC', currency: 'USD', tier: null,
      });

      await service.updateState('tenant-1', {
        company: { name: 'NewName', industry: 'accounting' },
        timezone: 'UTC',
        currency: 'USD',
      });

      expect(prismaMock.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'NewName',
            industry: 'accounting',
            industryGroup: 'finance',
            timezone: 'UTC',
            currency: 'USD',
          }),
        }),
      );
    });
  });

  describe('selectTier()', () => {
    it('sets tier and advances step to template', async () => {
      prismaMock.tier.findUnique.mockResolvedValue({ id: 't1', name: 'Pro', slug: 'pro', isActive: true });
      prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', tierId: null });

      const result = await service.selectTier('tenant-1', 't1');

      expect(prismaMock.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { tierId: 't1', onboardingStep: 'template' },
        }),
      );
      expect(result.tier).toEqual({ id: 't1', name: 'Pro', slug: 'pro' });
    });

    it('rejects inactive tier', async () => {
      prismaMock.tier.findUnique.mockResolvedValue({ isActive: false });
      await expect(service.selectTier('tenant-1', 't1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('selectTemplate()', () => {
    it('creates departments from structure', async () => {
      prismaMock.departmentTemplate.findUnique.mockResolvedValue({
        slug: 'starter', structure: [{ name: 'Sales', headAgentType: 'FUNCTIONAL' }],
      });
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1', tierId: 't1',
        tier: { maxDepartments: 5, maxAgents: 10, tierAgentPools: [] },
      });
      prismaMock.agent.count.mockResolvedValue(0);
      prismaMock.department.create.mockResolvedValue({ id: 'd1', name: 'Sales' });

      const result = await service.selectTemplate('tenant-1', 'starter');

      expect(result.departmentsCreated).toBe(1);
      expect(prismaMock.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { onboardingStep: 'review' },
        }),
      );
    });

    it('rejects template exceeding tier maxDepartments', async () => {
      prismaMock.departmentTemplate.findUnique.mockResolvedValue({
        slug: 'big', structure: Array(20).fill({ name: 'X' }),
      });
      prismaMock.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1', tierId: 't1',
        tier: { id: 't1', slug: 'basic', maxDepartments: 5, maxAgents: 10, tierAgentPools: [] },
      });

      // COMPREHENSIVE-FIX P0-B: should throw a typed TierLimitExceededException
      // whose reason mentions the department overage. The exception's name
      // is "TierLimitExceededException" and the user-facing message starts
      // with the template slug.
      await expect(service.selectTemplate('tenant-1', 'big')).rejects.toMatchObject({
        name: 'TierLimitExceededException',
        getStatus: expect.any(Function),
      });
      await expect(service.selectTemplate('tenant-1', 'big')).rejects.toThrow(/requires 20 departments/);
    });

    // Part 9 N9 — FIX-048 regression guard: agents MUST be round-robined
    // across departments, not all bunched into the first one.
    it('distributes agents of same type across departments (round-robin, N9 regression)', async () => {
      const d1 = { id: 'd1', headAgentType: 'CORE' };
      const d2 = { id: 'd2', headAgentType: 'CORE' };
      const d3 = { id: 'd3', headAgentType: 'CORE' };
      prismaMock.departmentTemplate.findUnique.mockResolvedValue({
        slug: 'starter',
        structure: [
          { name: 'A', headAgentType: 'CORE' },
          { name: 'B', headAgentType: 'CORE' },
          { name: 'C', headAgentType: 'CORE' },
        ],
      });
      prismaMock.department.create
        .mockResolvedValueOnce(d1)
        .mockResolvedValueOnce(d2)
        .mockResolvedValueOnce(d3);
      prismaMock.department.update.mockResolvedValue({});
      const pool = (s: number) => ({ id: `p${s}`, slot: s, isDefaultSelected: true, template: { id: `t${s}`, name: `A${s}`, type: 'CORE', model: 'gpt-4o', systemPrompt: null, instructions: null, permissions: [], config: {}, version: 1 } });
      prismaMock.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', tierId: 't1', tier: { maxDepartments: 10, maxAgents: 10, tierAgentPools: [pool(1), pool(2), pool(3), pool(4), pool(5), pool(6)] } });
      prismaMock.agent.count.mockResolvedValue(0);
      prismaMock.agent.create.mockResolvedValue({ id: 'ax', type: 'CORE', departmentId: 'd1' });
      await service.selectTemplate('tenant-1', 'starter');
      expect(prismaMock.agent.create).toHaveBeenCalledTimes(6);
      const deptIds = prismaMock.agent.create.mock.calls.map((c: any) => c[0].data.departmentId as string);
      expect(deptIds).toEqual(['d1', 'd2', 'd3', 'd1', 'd2', 'd3']);
    });
  });

  describe('complete() — 4-phase idempotent pipeline', () => {
    let baseTenant: any;
    beforeEach(() => {
      baseTenant = {
        id: 'tenant-1', name: 'Acme', industry: 'accounting', industryGroup: 'finance',
        onboardingStep: 'template',
        onboardingCompletedAt: null, tierId: 't1', tier: { maxDepartments: 5, maxAgents: 10 },
      };
      prismaMock.tenant.findUnique.mockResolvedValue(baseTenant);
      prismaMock.tenant.update.mockResolvedValue({});
    });

    it('sets onboardingCompletedAt and onboardingStep=complete', async () => {
      const result = await service.complete('tenant-1');

      expect(result.completedAt).toBeInstanceOf(Date);
      expect(prismaMock.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            onboardingCompletedAt: expect.any(Date),
            onboardingStep: 'complete',
          }),
        }),
      );
    });

    it('calls all 4 post-completion phases', async () => {
      await service.complete('tenant-1');

      expect(allocatorMock.allocateForTenant).toHaveBeenCalledWith('tenant-1', 'accounting');
      expect(templateSeederMock.seedForTenant).toHaveBeenCalledWith('tenant-1', 'accounting');
      expect(departmentsServiceMock.autoCreateFromTemplate).toHaveBeenCalledWith('tenant-1');
      expect(checklistMock.seed).toHaveBeenCalledWith('tenant-1');
    });

    it('continues even if a phase fails (try/catch per phase)', async () => {
      allocatorMock.allocateForTenant.mockRejectedValue(new Error('Allocator boom'));
      templateSeederMock.seedForTenant.mockResolvedValue(0);
      departmentsServiceMock.autoCreateFromTemplate.mockResolvedValue({ created: 0, skipped: 0 });
      checklistMock.seed.mockResolvedValue({ created: 13, existing: 0 });

      // Should NOT throw even though allocator failed
      const result = await service.complete('tenant-1');
      expect(result.completedAt).toBeTruthy();

      // Subsequent phases still ran
      expect(templateSeederMock.seedForTenant).toHaveBeenCalled();
      expect(checklistMock.seed).toHaveBeenCalled();
    });

    it('continues even if checklist seed fails', async () => {
      allocatorMock.allocateForTenant.mockResolvedValue({ allocated: 0, skipped: 0 });
      templateSeederMock.seedForTenant.mockResolvedValue(0);
      departmentsServiceMock.autoCreateFromTemplate.mockResolvedValue({ created: 0, skipped: 0 });
      checklistMock.seed.mockRejectedValue(new Error('Checklist boom'));

      // Should NOT throw even though checklist seed failed
      const result = await service.complete('tenant-1');
      expect(result.completedAt).toBeTruthy();
    });

    it('skips template seeding if industry is null', async () => {
      baseTenant.industry = null;
      await service.complete('tenant-1');

      expect(templateSeederMock.seedForTenant).not.toHaveBeenCalled();
    });
  });
});
