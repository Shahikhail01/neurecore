/**
 * Approval Service
 * Approval workflow operations
 * Calls Phase 1 endpoints: /api/v1/tenants/:tenantId/approvals
 */

import { apiClient } from "@/lib/axiosInterceptor";

export interface Approval {
  id: string;
  taskId: string;
  requestedBy: string;
  approver: string;
  status: "pending" | "approved" | "rejected";
  reason?: string;
  comments?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApproveRequest {
  comments?: string;
}

export interface RejectRequest {
  reason: string;
  comments?: string;
}

class ApprovalService {
  /**
   * Get all approvals for a tenant
   */
  async getApprovals(
    tenantId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Approval[]> {
    try {
      const response = await apiClient.get(
        `/api/v1/tenants/${tenantId}/approvals`,
        {
          params: { limit, offset },
        },
      );
      return response.data.approvals || response.data;
    } catch (error) {
      console.error("Failed to fetch approvals:", error);
      throw error;
    }
  }

  /**
   * Get pending approvals for current user
   */
  async getPendingApprovals(tenantId: string): Promise<Approval[]> {
    try {
      const response = await apiClient.get(
        `/api/v1/tenants/${tenantId}/approvals`,
        {
          params: { status: "pending" },
        },
      );
      return response.data.approvals || response.data;
    } catch (error) {
      console.error("Failed to fetch pending approvals:", error);
      throw error;
    }
  }

  /**
   * Get single approval
   */
  async getApproval(tenantId: string, approvalId: string): Promise<Approval> {
    try {
      const response = await apiClient.get(
        `/api/v1/tenants/${tenantId}/approvals/${approvalId}`,
      );
      return response.data;
    } catch (error) {
      console.error("Failed to fetch approval:", error);
      throw error;
    }
  }

  /**
   * Approve request
   */
  async approve(
    tenantId: string,
    approvalId: string,
    request: ApproveRequest,
  ): Promise<Approval> {
    try {
      const response = await apiClient.patch(
        `/api/v1/tenants/${tenantId}/approvals/${approvalId}`,
        {
          status: "approved",
          ...request,
        },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to approve:", error);
      throw error;
    }
  }

  /**
   * Reject request
   */
  async reject(
    tenantId: string,
    approvalId: string,
    request: RejectRequest,
  ): Promise<Approval> {
    try {
      const response = await apiClient.patch(
        `/api/v1/tenants/${tenantId}/approvals/${approvalId}`,
        {
          status: "rejected",
          ...request,
        },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to reject:", error);
      throw error;
    }
  }

  /**
   * Request changes (back to requester)
   */
  async requestChanges(
    tenantId: string,
    approvalId: string,
    comments: string,
  ): Promise<Approval> {
    try {
      const response = await apiClient.patch(
        `/api/v1/tenants/${tenantId}/approvals/${approvalId}`,
        {
          status: "pending",
          comments,
        },
      );
      return response.data;
    } catch (error) {
      console.error("Failed to request changes:", error);
      throw error;
    }
  }
}

export default new ApprovalService();
