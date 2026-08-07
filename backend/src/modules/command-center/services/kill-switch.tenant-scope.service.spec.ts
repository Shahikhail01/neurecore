/**
 * Phase 14 — KillSwitchTenantScope tests.
 */

import { KillSwitchTenantScopeService, KillSwitchTenantScopeError } from './kill-switch.tenant-scope.service';

function makeInnerStub() {
  return {
    list: jest.fn(async () => ({ entries: [], fetchedAt: new Date().toISOString() })),
    set: jest.fn(async () => undefined),
  };
}

function makeService(): {
  svc: KillSwitchTenantScopeService;
  inner: ReturnType<typeof makeInnerStub>;
} {
  const inner = makeInnerStub();
  return { svc: new KillSwitchTenantScopeService(inner as never), inner };
}

describe('Phase 14 — KillSwitchTenantScopeService', () => {
  it('rejects empty tenantId', async () => {
    const { svc } = makeService();
    await expect(svc.list('')).rejects.toBeInstanceOf(KillSwitchTenantScopeError);
  });

  it('rejects wildcard tenantId', async () => {
    const { svc } = makeService();
    await expect(svc.list('*')).rejects.toBeInstanceOf(KillSwitchTenantScopeError);
  });

  it('rejects empty tenantId on set()', async () => {
    const { svc } = makeService();
    await expect(svc.set('', {}, {})).rejects.toBeInstanceOf(KillSwitchTenantScopeError);
  });

  it('passes through list() for a valid tenantId', async () => {
    const { svc, inner } = makeService();
    const out = await svc.list('tenant-A');
    expect(Array.isArray(out.entries)).toBe(true);
    expect(inner.list).toHaveBeenCalledWith('tenant-A');
  });

  it('passes through set() for a valid tenantId', async () => {
    const { svc, inner } = makeService();
    await svc.set('tenant-A', { sub: 'u1' }, { enabled: true, scope: 'phase', target: 'p1', reason: 'r' });
    expect(inner.set).toHaveBeenCalledWith('tenant-A', { sub: 'u1' }, expect.objectContaining({ enabled: true }));
  });
});
