import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  default: { defaults: { baseURL: '/api/v1' } },
  restClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { restClient } from '@/services/api';
import {
  enterpriseInitiationService,
  type EnterpriseInitiationStatus,
} from '@/services/enterpriseInitiation.service';
import type { ApiResponse } from '@/types/api.types';

const META = {
  timestamp: '2026-08-09T12:00:00.000Z',
  requestId: 'test-initiation-service',
};

function wrap<T>(data: T): ApiResponse<T> {
  return {
    status: 'success',
    data,
    meta: META,
  };
}

describe('enterpriseInitiationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches initiation status', async () => {
    const payload: EnterpriseInitiationStatus = {
      initiationId: 'init-1',
      status: 'APPROVED',
      projectId: 'proj-1',
      projectStatus: 'ACTIVE',
      automationStatus: 'REQUESTED_OR_COMPLETED',
      approvedAt: '2026-08-09T10:00:00.000Z',
      updatedAt: '2026-08-09T10:05:00.000Z',
      correlationId: 'corr-1',
    };
    vi.mocked(restClient.get).mockResolvedValue(wrap(payload));

    await expect(
      enterpriseInitiationService.getStatus('init-1'),
    ).resolves.toEqual(payload);
    expect(restClient.get).toHaveBeenCalledWith(
      '/enterprise-initiation/init-1/status',
    );
  });

  it('posts approval payload', async () => {
    const payload = {
      initiationId: 'init-1',
      previousStatus: 'READY_FOR_CONFIRMATION',
      newStatus: 'APPROVED',
      automationRequested: true,
      deduplicated: false,
    };
    vi.mocked(restClient.post).mockResolvedValue(wrap(payload));

    await expect(
      enterpriseInitiationService.approve('init-1', 'Looks good'),
    ).resolves.toEqual(payload);
    expect(restClient.post).toHaveBeenCalledWith(
      '/enterprise-initiation/approve',
      {
        initiationId: 'init-1',
        approvalComment: 'Looks good',
      },
    );
  });

  it('posts create-project payload', async () => {
    const payload = {
      projectId: 'proj-1',
      initiationId: 'init-1',
      automationStatus: 'REQUESTED',
      correlationId: 'corr-1',
      deduplicated: false,
    };
    vi.mocked(restClient.post).mockResolvedValue(wrap(payload));

    await expect(
      enterpriseInitiationService.createProjectFromInitiation(
        'init-1',
        'Q3 Close',
        'Accounting rollout',
      ),
    ).resolves.toEqual(payload);
    expect(restClient.post).toHaveBeenCalledWith(
      '/enterprise-initiation/create-project',
      {
        initiationId: 'init-1',
        projectName: 'Q3 Close',
        projectDescription: 'Accounting rollout',
      },
    );
  });
});
