// services/__tests__/compliance.service.spec.ts — Unit tests for complianceService.

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
import complianceService from '@/services/compliance.service';
import type { ApiResponse } from '@/types/api.types';

const META = { timestamp: '2026-07-23T12:00:00Z', requestId: 'test-req-compliance' };
function wrap<T>(data: T): ApiResponse<T> {
  return { status: 'success', data, meta: META };
}

describe('complianceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get() returns the current acceptance state', async () => {
    vi.mocked(restClient.get).mockResolvedValue(
      wrap({
        dataResidency: 'eu',
        retentionDays: 365,
        aupAcceptedAt: '2026-07-22T10:00:00Z',
        dpaAcceptedAt: null,
        aupRequiredBy: 'v2026.07',
        dpaRequiredBy: 'v2026.07',
      }),
    );
    const r = await complianceService.get();
    expect(r.dataResidency).toBe('eu');
    expect(r.retentionDays).toBe(365);
  });

  it('get() returns defaults when response is missing', async () => {
    vi.mocked(restClient.get).mockResolvedValue({
      status: 'error',
      meta: META,
    });
    const r = await complianceService.get();
    expect(r.dataResidency).toBe('auto');
    expect(r.retentionDays).toBe(90);
    expect(r.aupAcceptedAt).toBeNull();
  });

  it('acceptAup() posts to the AUP endpoint', async () => {
    vi.mocked(restClient.post).mockResolvedValue(
      wrap({ aupAcceptedAt: '2026-07-22T10:00:00Z' }),
    );
    await complianceService.acceptAup();
    expect(restClient.post).toHaveBeenCalledWith('/compliance/acceptance/aup', {});
  });

  it('acceptDpa() posts to the DPA endpoint', async () => {
    vi.mocked(restClient.post).mockResolvedValue(
      wrap({ dpaAcceptedAt: '2026-07-22T10:05:00Z' }),
    );
    await complianceService.acceptDpa();
    expect(restClient.post).toHaveBeenCalledWith('/compliance/acceptance/dpa', {});
  });

  it('setResidency() patches with the chosen region', async () => {
    vi.mocked(restClient.patch).mockResolvedValue(
      wrap({ dataResidency: 'eu' }),
    );
    await complianceService.setResidency('eu');
    expect(restClient.patch).toHaveBeenCalledWith('/compliance/acceptance/residency', {
      dataResidency: 'eu',
    });
  });

  it('setRetention() patches with the chosen days (0 = indefinite)', async () => {
    vi.mocked(restClient.patch).mockResolvedValue(
      wrap({ retentionDays: 0 }),
    );
    await complianceService.setRetention(0);
    expect(restClient.patch).toHaveBeenCalledWith('/compliance/acceptance/retention', {
      retentionDays: 0,
    });
  });

  it('handles network errors (returns empty defaults)', async () => {
    vi.mocked(restClient.get).mockRejectedValue(new Error('Network error'));
    const r = await complianceService.get();
    expect(r.dataResidency).toBe('auto');
  });
});
