// ─── AgentAdapter.ts ─────────────────────────────────────────────────────────
// LSP: Substitutable IBatchAdapter — same interface as all other adapters.
// SRP: Only responsible for Agent raw → domain mapping.

import type { IBatchAdapter } from '@/core/services/api/interfaces/IDataAdapter';
import type { Agent, AgentStatus, AgentMood, AgentPerformance } from '@/shared/types/domain.types';

export interface RawAgent {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  model: string;
  isActive: boolean;
  tenantId: string;
  departmentId?: string;
  department?: { name: string };
  avatarUrl?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  lastActivity?: string;
  _count?: { tasks?: number; executions?: number };
  metrics?: {
    successRate?: number;
    avgTaskDuration?: number;
    tasksCompleted?: number;
    tasksInProgress?: number;
    tasksFailed?: number;
    lastEvaluationScore?: number;
    streak?: number;
  };
}

export class AgentAdapter implements IBatchAdapter<RawAgent, Agent> {
  adapt(raw: RawAgent): Agent {
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      type: raw.type,
      status: this.mapStatus(raw.status),
      mood: this.mapMood(raw.status, raw.metrics),
      model: raw.model,
      isActive: raw.isActive,
      tenantId: raw.tenantId,
      departmentId: raw.departmentId,
      departmentName: raw.department?.name,
      performance: this.mapPerformance(raw),
      avatarUrl: raw.avatarUrl,
      workloadGauge: this.calculateWorkload(raw),
      tags: raw.tags ?? [],
      createdAt: raw.createdAt,
      lastActiveAt: raw.lastActivity,
    };
  }

  adaptMany(raws: RawAgent[]): Agent[] {
    return raws.map((r) => this.adapt(r));
  }

  reverse(domain: Agent): Partial<RawAgent> {
    return {
      id: domain.id,
      name: domain.name,
      description: domain.description,
      type: domain.type,
      status: domain.status,
      model: domain.model,
      isActive: domain.isActive,
    };
  }

  // ─── Private mappers ─────────────────────────────────────────────────────

  private mapStatus(raw: string): AgentStatus {
    const map: Record<string, AgentStatus> = {
      ACTIVE: 'ACTIVE',
      INACTIVE: 'INACTIVE',
      TRAINING: 'TRAINING',
      ERROR: 'ERROR',
      PAUSED: 'PAUSED',
    };
    return map[raw] ?? 'INACTIVE';
  }

  private mapMood(status: string, metrics?: RawAgent['metrics']): AgentMood {
    if (status === 'ERROR') return 'stressed';
    if (status === 'INACTIVE' || status === 'PAUSED') return 'offline';
    if ((metrics?.tasksInProgress ?? 0) > 3) return 'busy';
    if ((metrics?.successRate ?? 0) >= 90) return 'optimistic';
    return 'idle';
  }

  private mapPerformance(raw: RawAgent): AgentPerformance {
    const m = raw.metrics ?? {};
    return {
      successRate: m.successRate ?? 0,
      avgTaskDuration: m.avgTaskDuration ?? 0,
      tasksCompleted: m.tasksCompleted ?? raw._count?.tasks ?? 0,
      tasksInProgress: m.tasksInProgress ?? 0,
      tasksFailed: m.tasksFailed ?? 0,
      lastEvaluationScore: m.lastEvaluationScore,
      streak: m.streak ?? 0,
    };
  }

  private calculateWorkload(raw: RawAgent): number {
    const inProgress = raw.metrics?.tasksInProgress ?? 0;
    return Math.min(100, inProgress * 25); // 4+ tasks = 100%
  }
}

export const agentAdapter = new AgentAdapter();
