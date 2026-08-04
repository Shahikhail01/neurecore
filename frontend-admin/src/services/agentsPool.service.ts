/**
 * AI Employees Pool — Phase 10.
 * Reuses AgentTemplate, adds enabled flag + duplicate.
 */

import api from '@/services/api';
import { unwrapItem, unwrapList } from '@/services/unwrap';
import type { AgentTemplate, CreateAgentTemplatePayload } from '@/services/agentTemplates.service';

export interface AgentsPoolEntry extends AgentTemplate {
  enabled: boolean;
}

export interface CreateAgentsPoolPayload extends CreateAgentTemplatePayload {
  enabled?: boolean;
}

export interface SandboxAgentTemplatePayload {
  prompt: string;
  modelOverride?: string;
  maxTokens?: number;
  includeTools?: boolean;
  knowledgeSources?: string[];
}

export interface SandboxAgentTemplateResult {
  templateId: string;
  templateName: string;
  model: string;
  authorityLevel: string;
  memoryPolicy: string;
  channels: string[];
  allowedTools: string[];
  blockedTools: string[];
  knowledgeSources: string[];
  response: string;
  toolPlan: string[];
  warnings: string[];
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
}

export interface PersistedSandboxRun {
  id: string;
  actor: string;
  createdAt: string;
  prompt: string;
  result: SandboxAgentTemplateResult;
}

export interface SandboxRunComparison {
  left: PersistedSandboxRun;
  right: PersistedSandboxRun;
  summary: {
    responseChanged: boolean;
    toolPlanChanged: boolean;
    tokenDelta: number;
    warningDelta: number;
  };
}

export const agentsPoolService = {
  async list(opts?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }) {
    const params: Record<string, unknown> = {};
    if (opts?.page) params.page = opts.page;
    if (opts?.limit) params.limit = opts.limit;
    if (opts?.search) params.search = opts.search;
    if (opts?.status) params.status = opts.status;
    if (opts?.sortBy) params.sortBy = opts.sortBy;
    if (opts?.sortDir) params.sortDir = opts.sortDir;

    const res = await api.get('/agents-pool', { params });
    const list = unwrapList(res);
    return {
      items: (list.items ?? []) as AgentsPoolEntry[],
      total: list.total ?? 0,
      page: opts?.page ?? 1,
      limit: opts?.limit ?? 20,
      totalPages: Math.max(1, Math.ceil((list.total ?? 0) / (opts?.limit ?? 20))),
    };
  },

  async get(id: string): Promise<AgentsPoolEntry> {
    const res = await api.get(`/agents-pool/${id}`);
    return unwrapItem(res) as AgentsPoolEntry;
  },

  async create(payload: CreateAgentsPoolPayload): Promise<AgentsPoolEntry> {
    const res = await api.post('/agents-pool', payload);
    return unwrapItem(res) as AgentsPoolEntry;
  },

  async update(id: string, payload: Partial<CreateAgentsPoolPayload>): Promise<AgentsPoolEntry> {
    const res = await api.patch(`/agents-pool/${id}`, payload);
    return unwrapItem(res) as AgentsPoolEntry;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/agents-pool/${id}`);
  },

  /** Pool-level enable/disable toggle (Phase 10 — distinct from isPublic). */
  async setEnabled(id: string, enabled: boolean): Promise<AgentsPoolEntry> {
    const res = await api.patch(`/agents-pool/${id}/enabled`, { enabled });
    return unwrapItem(res) as AgentsPoolEntry;
  },

  /** Duplicate a template for safe cloning. */
  async duplicate(id: string, name?: string): Promise<AgentsPoolEntry> {
    const res = await api.post(`/agents-pool/${id}/duplicate`, name ? { name } : {});
    return unwrapItem(res) as AgentsPoolEntry;
  },

  async sandboxRun(
    id: string,
    payload: SandboxAgentTemplatePayload,
  ): Promise<SandboxAgentTemplateResult> {
    const res = await api.post(`/agents-pool/${id}/sandbox-run`, payload);
    return unwrapItem(res) as SandboxAgentTemplateResult;
  },

  async listSandboxRuns(id: string): Promise<PersistedSandboxRun[]> {
    const res = await api.get(`/agents-pool/${id}/sandbox-runs`);
    const data = res.data?.data ?? res.data;
    return Array.isArray(data) ? (data as PersistedSandboxRun[]) : [];
  },

  async compareSandboxRuns(
    id: string,
    leftId: string,
    rightId: string,
  ): Promise<SandboxRunComparison> {
    const res = await api.get(`/agents-pool/${id}/sandbox-compare`, {
      params: { leftId, rightId },
    });
    return unwrapItem(res) as SandboxRunComparison;
  },
};
