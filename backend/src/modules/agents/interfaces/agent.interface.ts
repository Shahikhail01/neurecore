import type { AgentStatus, AgentType } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────

export interface AgentConfig {
  model: string;
  systemPrompt?: string;
  instructions?: string;
  budgetPerDay?: number;
  permissions: string[];
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  type?: AgentType;
  model?: string;
  systemPrompt?: string;
  instructions?: string;
  budgetPerDay?: number;
  permissions?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  departmentId?: string;
  tierAgentPoolId?: string;
  isSelected?: boolean;
}

export interface UpdateAgentInput {
  tenantId?: string;
  name?: string;
  description?: string;
  status?: AgentStatus;
  model?: string;
  systemPrompt?: string;
  instructions?: string;
  budgetPerDay?: number;
  permissions?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
  departmentId?: string;
  tierAgentPoolId?: string;
  isSelected?: boolean;
}

export interface AgentFilter {
  tenantId?: string | null;
  departmentId?: string;
  status?: AgentStatus;
  type?: AgentType;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// ─────────────────────────────────────────────────────────────
// Interface: IAgentService  (SOLID ISP / DIP)
// ─────────────────────────────────────────────────────────────

export interface IAgentService {
  findAll(filter: AgentFilter): Promise<{
    data: unknown[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  findOne(id: string, tenantId: string): Promise<unknown>;
  create(
    input: CreateAgentInput,
    tenantId: string,
    userId: string,
  ): Promise<unknown>;
  update(
    id: string,
    input: UpdateAgentInput,
    tenantId: string,
  ): Promise<unknown>;
  remove(id: string, tenantId: string): Promise<void>;
  updateStatus(
    id: string,
    status: AgentStatus,
    tenantId: string,
  ): Promise<unknown>;
}

export const AGENT_SERVICE = Symbol('AGENT_SERVICE');
