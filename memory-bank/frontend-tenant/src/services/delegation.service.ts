'use client';

/**
 * delegation.service.ts — Task Delegation API abstraction
 *
 * D: all delegation API calls; components never touch api directly
 */

import api from '@/services/api';
import { unwrapArrayOrEmpty, unwrapItem } from '@/services/unwrap';
import type { DelegationFormData } from '@/types/delegation.types';

export interface Department {
  id: string;
  name: string;
  agentCount: number;
}

export interface Agent {
  id: string;
  name: string;
  status: string;
  type: string;
}

export interface DelegationResult {
  taskId: string;
  agentId: string | null;
  status: 'QUEUED' | 'ASSIGNED';
  estimatedStart: string | null;
}

async function listDepartments(): Promise<Department[]> {
  try {
    const res = await api.get('/departments?limit=50');
    return unwrapArrayOrEmpty(res) as Department[];
  } catch {
    return [];
  }
}

async function listAgentsByDepartment(departmentId: string): Promise<Agent[]> {
  try {
    const res = await api.get(`/agents?departmentId=${departmentId}&limit=30`);
    return unwrapArrayOrEmpty(res) as Agent[];
  } catch {
    return [];
  }
}

async function estimateCost(form: DelegationFormData): Promise<number> {
  try {
    const res = await api.post<any>('/tasks/estimate', {
      description:  form.description,
      priority:     form.priority,
      departmentId: form.departmentId,
      agentId:      form.agentId,
    });
    return (res as any)?.data?.estimatedCost ?? 0;
  } catch {
    // Rough offline estimate: priority factor × base cost
    const factor = { LOW: 0.5, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }[form.priority] ?? 1;
    return parseFloat((factor * 0.08 * Math.max(1, form.description.length / 50)).toFixed(4));
  }
}

async function delegateTask(form: DelegationFormData): Promise<DelegationResult> {
  const res = await api.post('/tasks', {
    title:        form.title,
    description:  form.description,
    priority:     form.priority,
    departmentId: form.departmentId || undefined,
    agentId:      form.agentId     || undefined,
    deadline:     form.deadline    || undefined,
    maxRetries:   form.maxRetries,
    tags:         form.tags,
    authority:    form.authority,
    approvalThreshold: form.approvalThreshold ?? undefined,
  });
  return (unwrapItem(res) ?? (res as any)?.data) as DelegationResult;
}

export const delegationService = {
  listDepartments,
  listAgentsByDepartment,
  estimateCost,
  delegateTask,
};
