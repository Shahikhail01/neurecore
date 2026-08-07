/**
 * Phase 18 — AgentTenantScopeGuard tests.
 */

import {
  AgentTenantScopeGuard,
  AgentTenantScopeError,
} from './agents-tenant-scope.guard';

describe('Phase 18 — AgentTenantScopeGuard', () => {
  const g = new AgentTenantScopeGuard();

  it('accepts a real UUID-like tenantId', () => {
    expect(g.assert('op', 'tenant-xyz')).toBe('tenant-xyz');
  });

  it('throws on wildcard "*"', () => {
    expect(() => g.assert('findAll', '*')).toThrow(AgentTenantScopeError);
    try {
      g.assert('findAll', '*');
    } catch (e) {
      expect((e as AgentTenantScopeError).reason).toBe('CROSS_TENANT');
      expect((e as AgentTenantScopeError).op).toBe('findAll');
    }
  });

  it('throws on empty string', () => {
    try {
      g.assert('op', '');
    } catch (e) {
      expect((e as AgentTenantScopeError).reason).toBe('MISSING_TENANT');
    }
  });

  it('throws on null / undefined / non-string', () => {
    for (const bad of [null, undefined, 0, false, [], {}]) {
      try {
        g.assert('op', bad as unknown);
        fail(`expected throw for ${JSON.stringify(bad)}`);
      } catch (e) {
        expect((e as AgentTenantScopeError).reason).toBe('MISSING_TENANT');
      }
    }
  });

  it('isAcceptable is the non-throwing probe', () => {
    expect(g.isAcceptable('tenant-A')).toBe(true);
    expect(g.isAcceptable('*')).toBe(false);
    expect(g.isAcceptable('')).toBe(false);
    expect(g.isAcceptable(null)).toBe(false);
    expect(g.isAcceptable(undefined)).toBe(false);
  });

  it('every op tag surfaces in the error', () => {
    for (const op of ['findAll', 'findOne', 'create', 'update', 'remove']) {
      try {
        g.assert(op, '*');
      } catch (e) {
        expect((e as AgentTenantScopeError).op).toBe(op);
      }
    }
  });
});
