import api from "@/services/api";
import { unwrapItem, unwrapList } from "./unwrap";

export type TierSlotType = "FIXED" | "CHOICE";

export interface TierAgentPoolSlot {
  id: string;
  tierId: string;
  templateId: string;
  templateName: string;
  slot: number;
  slotType: TierSlotType;
  isRequired: boolean;
  isDefaultSelected: boolean;
  defaultBudgetPerDay?: number;
  defaultModel?: string;
  filledAgentId?: string;
  filledAgentName?: string;
  filledAgentStatus?: string;
  filledAt?: string;
}

export interface TierDepartmentPoolSlot {
  id: string;
  tierId: string;
  departmentTemplateId: string;
  slot: number;
  slotType: TierSlotType;
  isRequired: boolean;
  isDefaultSelected: boolean;
  departmentTemplate: {
    id: string;
    name: string;
    slug?: string;
    description?: string;
  };
}

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  tier?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface TierDeploymentPreview {
  tenantId: string;
  tenantName: string;
  currentTier: {
    id: string;
    name: string;
    slug: string;
    maxAgents: number;
  };
  targetTier: {
    id: string;
    name: string;
    slug: string;
    maxAgents: number;
  };
  usage: {
    selectedAgents: number;
    selectedDepartments: number;
  };
  compatibility: {
    canChange: boolean;
    blockingReasons: string[];
  };
  impact: {
    agentsToProvision: Array<{
      templateId: string;
      templateName: string;
      slotType: string;
    }>;
    departmentsToProvision: Array<{
      templateId: string;
      templateName: string;
      slotType: string;
    }>;
    reusableAgents: Array<{
      id: string;
      name: string;
      templateId: string | null;
    }>;
    reusableDepartments: Array<{
      id: string;
      name: string;
      templateId: string | null;
    }>;
    tierLinkedAgentsOutsideTargetPolicy: Array<{
      id: string;
      name: string;
      templateId: string | null;
    }>;
    tierLinkedDepartmentsOutsideTargetPolicy: Array<{
      id: string;
      name: string;
      templateId: string | null;
    }>;
  };
}

export type TierChangePreview = TierDeploymentPreview;

export interface TierBootstrapResult {
  tenantId: string;
  tierId: string;
  departmentsProvisioned: number;
  departmentIds: string[];
  departmentsReused: number;
  agentsProvisioned: number;
  agentIds: string[];
  agentsReused: number;
}

export interface AgentPoolPayload {
  templateId: string;
  slot: number;
  slotType: TierSlotType;
  isRequired?: boolean;
  isDefaultSelected?: boolean;
  defaultBudgetPerDay?: number;
  defaultModel?: string;
}

export interface DepartmentPoolPayload {
  departmentTemplateId: string;
  slot?: number;
  slotType: TierSlotType;
  isRequired?: boolean;
  isDefaultSelected?: boolean;
}

interface AgentPoolResponse {
  slots: TierAgentPoolSlot[];
}

export const tierCompositionService = {
  async listTenants(limit = 100): Promise<TenantListItem[]> {
    const response = await api.get(`/tenants`, {
      params: { limit },
    });
    return unwrapList(response).items as TenantListItem[];
  },

  async previewTenantTierChange(
    tenantId: string,
    tierId: string,
  ): Promise<TierChangePreview> {
    const response = await api.post<TierDeploymentPreview>(
      `/deploy/tenants/${tenantId}/tier-bootstrap/preview`,
      { tierId },
    );
    return unwrapItem(response) as TierDeploymentPreview;
  },

  async previewTenantTierDeployment(
    tenantId: string,
    tierId: string,
  ): Promise<TierDeploymentPreview> {
    const response = await api.post<TierDeploymentPreview>(
      `/deploy/tenants/${tenantId}/tier-bootstrap/preview`,
      { tierId },
    );
    return unwrapItem(response) as TierDeploymentPreview;
  },

  async bootstrapTenantTier(
    tenantId: string,
    tierId?: string,
  ): Promise<TierBootstrapResult> {
    const response = await api.post<TierBootstrapResult>(
      `/deploy/tenants/${tenantId}/tier-bootstrap`,
      tierId ? { tierId } : {},
    );
    return unwrapItem(response) as TierBootstrapResult;
  },

  async listAgentPool(tierId: string): Promise<TierAgentPoolSlot[]> {
    const response = await api.get<AgentPoolResponse>(`/tiers/${tierId}/pool`);
    return Array.isArray(response.data?.slots) ? response.data.slots : [];
  },

  async createAgentPoolSlot(
    tierId: string,
    payload: AgentPoolPayload,
  ): Promise<TierAgentPoolSlot> {
    const response = await api.post<TierAgentPoolSlot>(
      `/tiers/${tierId}/pool/slots`,
      payload,
    );
    return response.data;
  },

  async updateAgentPoolSlot(
    tierId: string,
    slotId: string,
    payload: Partial<AgentPoolPayload>,
  ): Promise<TierAgentPoolSlot> {
    const response = await api.patch<TierAgentPoolSlot>(
      `/tiers/${tierId}/pool/slots/${slotId}`,
      payload,
    );
    return response.data;
  },

  async deleteAgentPoolSlot(tierId: string, slotId: string): Promise<void> {
    await api.delete(`/tiers/${tierId}/pool/slots/${slotId}`);
  },

  async reorderAgentPool(
    tierId: string,
    orderedIds: string[],
  ): Promise<TierAgentPoolSlot[]> {
    const response = await api.post<TierAgentPoolSlot[]>(
      `/tiers/${tierId}/pool/reorder`,
      { orderedIds },
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async listDepartmentPool(tierId: string): Promise<TierDepartmentPoolSlot[]> {
    const response = await api.get<TierDepartmentPoolSlot[]>(
      `/tiers/${tierId}/department-pool`,
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async createDepartmentPoolSlot(
    tierId: string,
    payload: DepartmentPoolPayload,
  ): Promise<TierDepartmentPoolSlot> {
    const response = await api.post<TierDepartmentPoolSlot>(
      `/tiers/${tierId}/department-pool/slots`,
      payload,
    );
    return response.data;
  },

  async updateDepartmentPoolSlot(
    tierId: string,
    slotId: string,
    payload: Partial<DepartmentPoolPayload>,
  ): Promise<TierDepartmentPoolSlot> {
    const response = await api.patch<TierDepartmentPoolSlot>(
      `/tiers/${tierId}/department-pool/slots/${slotId}`,
      payload,
    );
    return response.data;
  },

  async deleteDepartmentPoolSlot(
    tierId: string,
    slotId: string,
  ): Promise<void> {
    await api.delete(`/tiers/${tierId}/department-pool/slots/${slotId}`);
  },

  async reorderDepartmentPool(
    tierId: string,
    orderedIds: string[],
  ): Promise<TierDepartmentPoolSlot[]> {
    const response = await api.post<TierDepartmentPoolSlot[]>(
      `/tiers/${tierId}/department-pool/reorder`,
      { orderedIds },
    );
    return Array.isArray(response.data) ? response.data : [];
  },
};
