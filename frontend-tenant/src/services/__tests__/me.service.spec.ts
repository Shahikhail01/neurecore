// services/__tests__/me.service.spec.ts — Unit tests for meService.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  default: { defaults: { baseURL: '/api/v1' } },
  restClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { restClient } from '@/services/api';
import meService from '@/services/me.service';
import type { ApiResponse } from '@/types/api.types';

const META = { timestamp: '2026-07-23T12:00:00Z', requestId: 'test-req-me' };
function wrap<T>(data: T): ApiResponse<T> {
  return { status: 'success', data, meta: META };
}

describe('meService.profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get() returns the profile data', async () => {
    const profile = {
      id: 'user-1', email: 'jane@acme.com', firstName: 'Jane', lastName: 'Smith',
      role: 'OWNER', tenantId: 'tenant-1', phone: '+1', jobTitle: 'CEO',
      timezone: 'UTC', primaryDepartmentId: 'dept-X', avatarUrl: null,
      locale: null, language: 'en', theme: 'dark', defaultLanding: '/home',
      railCollapsedDefault: false, notificationPrefs: null,
    };
    vi.mocked(restClient.get).mockResolvedValue(wrap(profile));

    const result = await meService.profile.get();
    expect(restClient.get).toHaveBeenCalledWith('/me/profile');
    expect(result).toEqual(profile);
  });

  it('get() returns null when response is missing', async () => {
    vi.mocked(restClient.get).mockResolvedValue({
      status: 'error',
      meta: META,
    });
    const result = await meService.profile.get();
    expect(result).toBeNull();
  });

  it('update() calls PATCH and returns the updated profile', async () => {
    const updated = {
      id: 'user-1', email: 'jane@acme.com', firstName: 'Janet', lastName: 'Smith',
      role: 'OWNER', tenantId: 'tenant-1', phone: '+1', jobTitle: 'CTO',
      timezone: 'UTC', primaryDepartmentId: null, avatarUrl: null,
      locale: null, language: 'en', theme: 'dark', defaultLanding: '/home',
      railCollapsedDefault: false, notificationPrefs: null,
    };
    vi.mocked(restClient.patch).mockResolvedValue(wrap(updated));

    const result = await meService.profile.update({ firstName: 'Janet', jobTitle: 'CTO' });
    expect(restClient.patch).toHaveBeenCalledWith('/me/profile', {
      firstName: 'Janet', jobTitle: 'CTO',
    });
    expect(result?.firstName).toBe('Janet');
    expect(result?.jobTitle).toBe('CTO');
  });
});

describe('meService.security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('status() returns enabled status + sessionTimeoutMinutes', async () => {
    vi.mocked(restClient.get).mockResolvedValue(
      wrap({
        twoFactor: { enabled: true, hasSecret: true, lastChallengeAt: null },
        sessionTimeoutMinutes: 240,
      }),
    );
    const result = await meService.security.status();
    expect(result.twoFactor.enabled).toBe(true);
    expect(result.sessionTimeoutMinutes).toBe(240);
  });

  it('update() persists sessionTimeoutMinutes via PATCH', async () => {
    vi.mocked(restClient.patch).mockResolvedValue(
      wrap({ sessionTimeoutMinutes: 240 }),
    );
    const r = await meService.security.update({ sessionTimeoutMinutes: 240 });
    expect(restClient.patch).toHaveBeenCalledWith('/me/security', {
      sessionTimeoutMinutes: 240,
    });
    expect(r.sessionTimeoutMinutes).toBe(240);
  });

  it('changePassword() posts with currentPassword + newPassword', async () => {
    vi.mocked(restClient.post).mockResolvedValue(wrap({ message: 'OK' }));
    await meService.security.changePassword('old-pass', 'new-pass-1');
    expect(restClient.post).toHaveBeenCalledWith('/me/security/password', {
      currentPassword: 'old-pass',
      newPassword: 'new-pass-1',
    });
  });

  it('init2fa() unwraps to { secret, otpauthUri }', async () => {
    vi.mocked(restClient.post).mockResolvedValue(
      wrap({ secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://...' }),
    );
    const r = await meService.security.init2fa();
    expect(r.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(r.otpauthUri).toContain('otpauth://');
  });

  it('enable2fa() unwraps to { enabled }', async () => {
    vi.mocked(restClient.post).mockResolvedValue(wrap({ enabled: true }));
    const r = await meService.security.enable2fa('123456');
    expect(restClient.post).toHaveBeenCalledWith('/me/security/2fa/enable', { code: '123456' });
    expect(r.enabled).toBe(true);
  });

  it('disable2fa() posts with password', async () => {
    vi.mocked(restClient.post).mockResolvedValue(wrap({ enabled: false }));
    const r = await meService.security.disable2fa('my-pw');
    expect(restClient.post).toHaveBeenCalledWith('/me/security/2fa/disable', { password: 'my-pw' });
    expect(r.enabled).toBe(false);
  });
});

describe('meService — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('catches network errors gracefully', async () => {
    vi.mocked(restClient.get).mockRejectedValue(new Error('Network error'));
    const result = await meService.profile.get();
    expect(result).toBeNull();
  });

  it('returns empty profile fallback for update errors', async () => {
    vi.mocked(restClient.patch).mockRejectedValue(new Error('Server error'));
    const result = await meService.profile.update({ firstName: 'X' });
    expect(result.firstName).toBe('');
  });
});
