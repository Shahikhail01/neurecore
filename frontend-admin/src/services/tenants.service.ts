import api from './api';
import { unwrapItem } from './unwrap';

export interface TenantUsageSummary {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  status: string;
  tier: { id: string; slug: string; name: string } | null;
  counts: {
    users: number;
    activeUsers: number;
    agents: number;
    departments: number;
    projects: number;
    conversations: number;
    invoices: number;
  };
  tierLimits: {
    maxUsers: number | null;
    maxAgents: number | null;
    maxDepartments: number | null;
    maxStorageGB: number | null;
    maxApiCalls: number | null;
    maxConversationMessages: number | null;
    maxFileSizeMB: number | null;
  };
  utilization: {
    users: number | null;
    agents: number | null;
    departments: number | null;
  };
  generatedAt: string;
}

export interface PasswordResetResult {
  userId: string;
  email: string;
  temporaryPassword: string;
  resetAt: string;
}

class TenantsService {
  async getUsage(tenantId: string): Promise<TenantUsageSummary> {
    const res = await api.get(`/tenants/${tenantId}/usage`);
    return unwrapItem(res) as TenantUsageSummary;
  }

  /**
   * Reset the tenant OWNER's password. Backend resolves the owner and
   * returns a one-time temporary password that the admin must convey.
   */
  async resetOwnerPassword(tenantId: string): Promise<PasswordResetResult> {
    const ownerId = await this.findOwnerId(tenantId);
    if (!ownerId) {
      throw new Error('This tenant has no OWNER user that can have a password reset.');
    }
    const res = await api.post(`/users/${ownerId}/reset-password`);
    return unwrapItem(res) as PasswordResetResult;
  }

  async deleteTenant(tenantId: string): Promise<void> {
    await api.delete(`/tenants/${tenantId}`);
  }

  private async findOwnerId(tenantId: string): Promise<string | null> {
    const res = await api.get(`/users/tenant/${tenantId}/owner`);
    const payload = unwrapItem(res) as { ownerId: string | null };
    return payload.ownerId;
  }
}

export const tenantsService = new TenantsService();
