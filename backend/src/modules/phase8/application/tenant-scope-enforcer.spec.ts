import { TenantScopeEnforcer } from './tenant-scope-enforcer';

describe('TenantScopeEnforcer (Phase 8 — §10.1 cross-tenant identifier policy)', () => {
  let svc: TenantScopeEnforcer;

  beforeEach(() => {
    svc = new TenantScopeEnforcer();
  });

  it('passes when the actor and record share a tenant', () => {
    const result = svc.check({
      actorTenantId: 'tnt-1',
      recordTenantId: 'tnt-1',
      entityType: 'Project',
      entityId: 'p-1',
    });
    expect(result.sameTenant).toBe(true);
    expect(result.denyReason).toBeNull();
  });

  it('flags cross-tenant lookups as not-found rather than 403', () => {
    const result = svc.check({
      actorTenantId: 'tnt-1',
      recordTenantId: 'tnt-2',
      entityType: 'Task',
      entityId: 't-1',
    });
    expect(result.sameTenant).toBe(false);
    expect(result.denyReason).toBe('CROSS_TENANT_NOT_FOUND');
  });

  it('flags missing actor tenant context as missing context', () => {
    const result = svc.check({
      actorTenantId: null,
      recordTenantId: 'tnt-1',
      entityType: 'Project',
      entityId: 'p-1',
    });
    expect(result.sameTenant).toBe(false);
    expect(result.denyReason).toBe('MISSING_TENANT_CONTEXT');
  });

  it('assertSameTenant throws a domain error with the X_TENANT_NOT_FOUND code', () => {
    let caught: { message: string; code?: string } | null = null;
    try {
      svc.assertSameTenant({
        actorTenantId: 'tnt-1',
        recordTenantId: 'tnt-2',
        entityType: 'Review',
        entityId: 'r-1',
      });
    } catch (e) {
      caught = e as { message: string; code?: string };
    }
    expect(caught).not.toBeNull();
    expect(caught?.code).toBe('X_TENANT_NOT_FOUND');
    expect(caught?.message).toContain('entityType=Review');
    expect(caught?.message).toContain('entityId=r-1');
  });

  it('does not throw when the tenant matches', () => {
    expect(() =>
      svc.assertSameTenant({
        actorTenantId: 'tnt-1',
        recordTenantId: 'tnt-1',
        entityType: 'Project',
        entityId: 'p-1',
      }),
    ).not.toThrow();
  });
});
