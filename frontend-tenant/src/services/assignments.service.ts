// src/services/assignments.service.ts
//
// Phase 7 — Frontend client for the Phase 4 assignment endpoints
// (eligible-agents + assign + release + override-audit). The agent
// picker integrates with this surface so the UI never has to type
// UUIDs.

import api from './api';

export interface EligibleAgent {
  agentId: string;
  name: string;
  role: string;
  currentWorkload: number;
  score: number;
  rationale: string;
}

export interface AssignTaskInput {
  taskId: string;
  agentId?: string;
  // For auto-assignment (no agentId) the backend picks the top
  // eligible agent. The caller can always pass a chosen agentId.
  manualOverrideRationale?: string;
  overrideByActorId?: string;
  overrideByActorType?: 'HUMAN' | 'AI_AGENT' | 'SYSTEM';
}

export interface AssignTaskResult {
  taskId: string;
  agentId: string;
  assignmentId: string;
  generation: number;
  rationale: string;
  agentName?: string;
}

export const assignmentsService = {
  async listEligibleAgents(taskId: string): Promise<EligibleAgent[]> {
    const res = await api.get(`/assignments/eligible-agents/${taskId}`);
    const inner = (res as any)?.data?.data ?? (res as any)?.data ?? res;
    return Array.isArray(inner) ? (inner as EligibleAgent[]) : [];
  },
  async assign(input: AssignTaskInput): Promise<AssignTaskResult> {
    const res = await api.post('/assignments/assign', input);
    const inner = (res as any)?.data?.data ?? (res as any)?.data ?? res;
    return inner as AssignTaskResult;
  },
  async release(input: {
    taskId: string;
    assignmentId?: string;
    reason?: string;
  }): Promise<{ released: boolean }> {
    const res = await api.post('/assignments/release', input);
    return { released: true };
  },
};
