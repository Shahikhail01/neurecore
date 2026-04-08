/**
 * Agent Service
 * CRUD operations for agents
 * Calls Phase 1 endpoints: /api/v1/tenants/:tenantId/agents
 */

import { apiClient } from "@/lib/axiosInterceptor";

export interface Agent {
  id: string;
  email: string;
  name: string;
  role: "admin" | "agent_manager" | "task_approver" | "viewer";
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentRequest {
  email: string;
  name: string;
  role: string;
}

export interface UpdateAgentRequest {
  name?: string;
  role?: string;
  status?: string;
}

class AgentService {
  /**
   * Get all agents for a tenant
   */
  async getAgents(
    tenantId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Agent[]> {
    try {
      const response = await apiClient.get(
        `/api/v1/tenants/${tenantId}/agents`,
        {
          params: { limit, offset },
        },
      );
      return response.data.agents || response.data;
    } catch (error) {
      console.error("Failed to fetch agents:", error);
      throw error;
    }
  }

  /**
   * Get single agent
   */
  async getAgent(tenantId: string, agentId: string): Promise<Agent> {
    try {
      const response = await apiClient.get(
        `/api/v1/tenants/${tenantId}/agents/${agentId}`,
      );
      return response.data;
    } catch (error) {
      console.error("Failed to fetch agent:", error);
      throw error;
    }
  }

  /**
   * Create new agent
   */
  async createAgent(
    tenantId: string,
    request: CreateAgentRequest,
  ): Promise<Agent> {
    try {
      const response = await apiClient.post(
        `/api/v1/tenants/${tenantId}/agents`,
        request,
      );
      return response.data;
    } catch (error) {
      console.error("Failed to create agent:", error);
      throw error;
    }
  }

  /**
   * Update agent
   */
  async updateAgent(
    tenantId: string,
    agentId: string,
    request: UpdateAgentRequest,
  ): Promise<Agent> {
    try {
      const response = await apiClient.patch(
        `/api/v1/tenants/${tenantId}/agents/${agentId}`,
        request,
      );
      return response.data;
    } catch (error) {
      console.error("Failed to update agent:", error);
      throw error;
    }
  }

  /**
   * Delete agent
   */
  async deleteAgent(tenantId: string, agentId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/tenants/${tenantId}/agents/${agentId}`);
    } catch (error) {
      console.error("Failed to delete agent:", error);
      throw error;
    }
  }

  /**
   * Deactivate agent
   */
  async deactivateAgent(tenantId: string, agentId: string): Promise<Agent> {
    return this.updateAgent(tenantId, agentId, { status: "inactive" });
  }

  /**
   * Activate agent
   */
  async activateAgent(tenantId: string, agentId: string): Promise<Agent> {
    return this.updateAgent(tenantId, agentId, { status: "active" });
  }
}

export default new AgentService();
