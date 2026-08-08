'use client';

/**
 * Phase 30 — Cost ceiling client (CR-AI-1305).
 *
 * Typed wrapper over the Command Center ceiling endpoints. Every
 * response is narrowed at runtime, matching the existing admin
 * convention of never letting `unknown` become `any`.
 *
 * SOLID
 *   SRP — owns ONLY transport + narrowing.
 *   DIP — the card depends on this client, not on axios.
 */

import api from '@/services/api';
import {
  COST_DIMENSIONS,
  type CostCeilingEntry,
  type CostDimension,
  type CostResilienceDashboard,
} from './cost-ceiling.types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asDimension(value: unknown): CostDimension {
  const candidate = asString(value, 'MONTHLY_SPEND_CENTS');
  return (COST_DIMENSIONS as ReadonlyArray<string>).includes(candidate)
    ? (candidate as CostDimension)
    : 'MONTHLY_SPEND_CENTS';
}

/** Unwrap `{ data: { data: X } }` and `{ data: X }` envelopes. */
function unwrap(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  const inner = raw['data'];
  if (isObject(inner) && 'data' in inner) return inner['data'];
  return inner ?? raw;
}

function mapEvaluation(raw: unknown): CostCeilingEntry {
  const obj = isObject(raw) ? raw : {};
  return {
    dimension: asDimension(obj['dimension']),
    unit: asString(obj['unit'], 'cents'),
    used: asNumber(obj['used'], 0),
    limitValue: asNumber(obj['limitValue'], 0),
    exceeded: asBoolean(obj['exceeded'], false),
    utilization: asNumber(obj['utilization'], 0),
  };
}

export function mapDashboard(raw: unknown): CostResilienceDashboard {
  const data = isObject(raw) ? raw : {};
  const ceilings = isObject(data['ceilings']) ? data['ceilings'] : {};
  const cost = isObject(data['cost']) ? data['cost'] : {};
  const resilience = isObject(data['resilience']) ? data['resilience'] : {};
  return {
    tenantId: asString(data['tenantId'], ''),
    generatedAt: asString(data['generatedAt'], new Date().toISOString()),
    totalSpentCents: asNumber(cost['totalSpent'], 0),
    totalBudgetCents: asNumber(cost['totalBudget'], 0),
    ceilings: asArray<unknown>(ceilings['evaluations']).map(mapEvaluation),
    containmentActive: asBoolean(data['containmentActive'], false),
    denialRate: asNumber(resilience['denialRate'], 0),
    latencyP95Ms: asNumber(resilience['latencyP95Ms'], 0),
    duplicateEffects: asNumber(resilience['duplicateEffects'], 0),
    recoveries: asNumber(resilience['recoveries'], 0),
  };
}

export interface ICostCeilingClient {
  getDashboard(): Promise<CostResilienceDashboard>;
  setCeiling(input: {
    dimension: CostDimension;
    limitValue: number;
    enabled: boolean;
    reason: string;
  }): Promise<void>;
}

export const costCeilingClient: ICostCeilingClient = {
  async getDashboard(): Promise<CostResilienceDashboard> {
    const res = await api.get<unknown>('/command-center/cost-ceilings/dashboard');
    return mapDashboard(unwrap(res));
  },

  async setCeiling(input): Promise<void> {
    await api.post<unknown>('/command-center/cost-ceilings', input);
  },
};
