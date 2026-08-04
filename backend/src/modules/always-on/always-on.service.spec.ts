/**
 * Always-on CRM — Service unit tests.
 */

import { AlwaysOnService, OOB_ALWAYS_ON_CAPABILITIES } from './always-on.service';

describe('AlwaysOnService', () => {
  let svc: AlwaysOnService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      tenantFeatureFlagOverride: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    svc = new AlwaysOnService(prisma);
  });

  it('ships a catalog with the three surfaces', () => {
    const catalog = svc.listCatalog();
    const byDomain = {
      'freedom-ui': catalog.filter((c) => c.domain === 'freedom-ui').length,
      productivity: catalog.filter((c) => c.domain === 'productivity').length,
      conversational: catalog.filter((c) => c.domain === 'conversational').length,
    };
    expect(byDomain['freedom-ui']).toBeGreaterThan(0);
    expect(byDomain.productivity).toBeGreaterThan(0);
    expect(byDomain.conversational).toBeGreaterThan(0);
  });

  it('every catalog entry has id, label, domain, defaultOn, requiredScopes', () => {
    for (const c of OOB_ALWAYS_ON_CAPABILITIES) {
      expect(c.id).toMatch(/^[a-z][a-z0-9.-]+$/);
      expect(c.label.length).toBeGreaterThan(0);
      expect(['freedom-ui', 'productivity', 'conversational']).toContain(c.domain);
      expect(Array.isArray(c.requiredScopes)).toBe(true);
      expect(typeof c.defaultOn).toBe('boolean');
    }
  });

  it('every id is unique', () => {
    const ids = OOB_ALWAYS_ON_CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getSurface returns default-on capabilities enabled when no overrides exist', async () => {
    const surf = await svc.getSurface('tenant-a');
    const flat = [...surf.freedomUi, ...surf.productivity, ...surf.conversational];
    // At least one capability is enabled (default-on ones).
    expect(flat.some((c) => c.enabled)).toBe(true);
  });

  it('getSurface honours explicit override flags', async () => {
    prisma.tenantFeatureFlagOverride.findMany.mockResolvedValue([
      { flagKey: 'always-on.ui.dashboard', enabled: false },
    ]);
    const surf = await svc.getSurface('tenant-a');
    const dash = surf.freedomUi.find((c) => c.capabilityId === 'ui.dashboard');
    expect(dash?.enabled).toBe(false);
  });

  it('setCapabilityEnabled writes the override row', async () => {
    await svc.setCapabilityEnabled({
      tenantId: 'tenant-a',
      capabilityId: 'ui.dashboard',
      enabled: false,
    });
    expect(prisma.tenantFeatureFlagOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId_flagKey: {
            tenantId: 'tenant-a',
            flagKey: 'always-on.ui.dashboard',
          },
        }),
        update: { enabled: false },
      }),
    );
  });

  it('setCapabilityEnabled rejects unknown capability', async () => {
    await expect(
      svc.setCapabilityEnabled({
        tenantId: 'tenant-a',
        capabilityId: 'unknown.capability',
        enabled: true,
      }),
    ).rejects.toThrow(/unknown capability/);
  });
});
