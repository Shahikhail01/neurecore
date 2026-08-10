import { restClient } from '@/services/api';

export type InitiationStatusValue =
  | 'DRAFT'
  | 'DISCOVERING'
  | 'READY_FOR_CONFIRMATION'
  | 'APPROVED'
  | 'MATERIALIZING'
  | 'COMPLETED'
  | 'NEEDS_INPUT'
  | 'FAILED_RETRYABLE'
  | 'FAILED_FINAL'
  | 'CANCELLED';

export interface EnterpriseInitiationStatus {
  initiationId: string;
  status: InitiationStatusValue;
  projectId: string | null;
  projectStatus: string | null;
  automationStatus: string;
  approvedAt: string | null;
  updatedAt: string;
  correlationId: string;
}

export interface ApproveInitiationResult {
  initiationId: string;
  previousStatus: InitiationStatusValue;
  newStatus: InitiationStatusValue;
  automationRequested: boolean;
}

export interface CreateProjectFromInitiationResult {
  projectId: string;
  initiationId: string;
  automationStatus: string;
  automationRequestId?: string;
  correlationId: string;
}

function unwrap<T>(response: unknown): T {
  const envelope = response as {
    data?: { data?: T } | T;
  };
  const topLevel = envelope?.data;
  if (topLevel && typeof topLevel === 'object' && 'data' in topLevel) {
    return (topLevel as { data: T }).data;
  }
  return topLevel as T;
}

export const enterpriseInitiationService = {
  async getStatus(initiationId: string): Promise<EnterpriseInitiationStatus> {
    const response = await restClient.get(
      `/enterprise-initiation/${initiationId}/status`,
    );
    return unwrap<EnterpriseInitiationStatus>(response);
  },

  async approve(
    initiationId: string,
    approvalComment?: string,
  ): Promise<{ data?: ApproveInitiationResult; deduplicated: boolean }> {
    const response = await restClient.post('/enterprise-initiation/approve', {
      initiationId,
      approvalComment,
    });
    return unwrap<{ data?: ApproveInitiationResult; deduplicated: boolean }>(
      response,
    );
  },

  async createProjectFromInitiation(
    initiationId: string,
    projectName: string,
    projectDescription?: string,
  ): Promise<{ data?: CreateProjectFromInitiationResult; deduplicated: boolean }> {
    const response = await restClient.post(
      '/enterprise-initiation/create-project',
      {
        initiationId,
        projectName,
        projectDescription,
      },
    );
    return unwrap<{
      data?: CreateProjectFromInitiationResult;
      deduplicated: boolean;
    }>(response);
  },
};

export default enterpriseInitiationService;
