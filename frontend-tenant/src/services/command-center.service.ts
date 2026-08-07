/**
 * command-center.service.ts — Thin typed wrapper for the P8 Command Center
 * REST surface (CR-AI-1201..1207).
 *
 * Phase 14 thin surface. Each method maps 1:1 to a documented endpoint in
 * `neurecore/backend/src/modules/command-center/controllers/command-center.controller.ts`
 * and returns a strictly typed shape derived from the corresponding DTO.
 *
 * Conventions:
 *   - GET endpoints return a typed object; POST endpoints return a typed object.
 *   - `tenantId` is passed for symmetry with multi-tenant admin callers. The
 *     NestJS controller scopes by `req.user.tenantId` server-side; passing it
 *     here documents intent and is harmless.
 *   - All network failures propagate as `Error` (the response interceptor in
 *     `services/api.ts` already converts axios errors into AppError). Callers
 *     do not see raw axios types.
 *   - No `any` is used; runtime checks narrow `unknown` payloads before cast.
 *
 * The legacy `commandCenterService` object (Phase 8) and all of its types are
 * re-exported below so existing consumers (`/intelligence`, `/home`) keep
 * compiling while callers are migrated to the thin surface.
 */

import api from '@/services/api';
import {
  restClient,
} from '@/core/services/api/clients/RestClient';
import { unwrapItem } from '@/services/unwrap';

// ─── Typed DTO mirrors (CR-AI-1201..1207) ──────────────────────────────────

export interface InventoryAgent {
  id: string;
  name: string;
  status: string;
  model: string;
  departmentId: string | null;
  updatedAt: string;
  source: 'Agent';
}

export interface InventorySkill {
  id: string;
  name: string;
  slug: string;
  version: string;
  status: string;
  updatedAt: string;
  source: 'AgentSkillDefinition';
}

export interface InventoryModel {
  model: string;
  provider: string;
  agentCount: number;
  source: 'ExecutionAttempt';
}

export interface InventoryKnowledge {
  id: string;
  name: string;
  kind: string;
  status: string;
  updatedAt: string;
  source: 'KnowledgeEntry';
}

export interface InventoryChannel {
  id: string;
  type: string;
  status: string;
  source: 'CrmConnector';
}

export interface InventoryResponse {
  agents: InventoryAgent[];
  skills: InventorySkill[];
  models: InventoryModel[];
  knowledge: InventoryKnowledge[];
  channels: InventoryChannel[];
  tenantId: string;
  fetchedAt: string;
}

export interface CostByModel {
  model: string;
  provider: string;
  costCents: number;
  tokens: number;
  source: 'CostRecord';
}

export interface CostBudget {
  id: string;
  name: string;
  scope: string;
  limitCents: number;
  currentSpendCents: number;
  utilizationPercent: number;
  enabled: boolean;
  resetAt: string;
  source: 'BudgetPolicy';
}

export interface CostResponse {
  monthToDateCents: number;
  monthToDateTokens: number;
  totalBudgetCents: number;
  utilizationPercent: number;
  byModel: CostByModel[];
  budgets: CostBudget[];
  tenantId: string;
  windowStart: string;
  windowEnd: string;
  fetchedAt: string;
}

export interface QualityAttempt {
  attemptId: string;
  taskId: string;
  agentId: string | null;
  score: number | null;
  reflection: string | null;
  evaluatedAt: string;
  source: 'ExecutionLog';
}

export interface QualityReview {
  id: string;
  taskId: string;
  attemptId: string;
  decision: string;
  status: string;
  comment: string | null;
  decidedAt: string | null;
  source: 'Review';
}

export interface QualitySummary {
  averageScore: number | null;
  evaluatedCount: number;
  abstentionCount: number;
  correctionCount: number;
  revisionCount: number;
  feedbackCount: number;
}

export interface QualityResponse {
  summary: QualitySummary;
  attempts: QualityAttempt[];
  reviews: QualityReview[];
  tenantId: string;
  windowStart: string;
  windowEnd: string;
  fetchedAt: string;
}

export type KillSwitchScope = 'process' | 'phase' | 'channel' | 'tenant-feature';

export interface KillSwitchEntry {
  scope: KillSwitchScope;
  target: string;
  enabled: boolean;
  processEnabled: boolean;
  updatedAt: string;
}

export interface KillSwitchListResponse {
  entries: KillSwitchEntry[];
  processEnabled: boolean;
  overrides: Record<string, boolean>;
  tenantId: string;
  fetchedAt: string;
}

// ─── Runtime narrowing helpers (no `any`) ─────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function asBoolean(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asStringOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function asNumberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function asRecordStringBoolean(v: unknown): Record<string, boolean> {
  if (!isObject(v)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === 'boolean') out[k] = val;
  }
  return out;
}

function unwrapResponse<T>(res: unknown): T {
  const body: unknown = isObject(res) && 'data' in res ? (res as { data: unknown }).data : res;
  return body as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Shape mappers: `unknown` → typed response ─────────────────────────────

function mapInventory(raw: unknown): InventoryResponse {
  const data = isObject(raw) ? raw : {};
  return {
    agents: asArray<InventoryAgent>(data['agents']),
    skills: asArray<InventorySkill>(data['skills']),
    models: asArray<InventoryModel>(data['models']),
    knowledge: asArray<InventoryKnowledge>(data['knowledge']),
    channels: asArray<InventoryChannel>(data['channels']),
    tenantId: asString(data['tenantId'], ''),
    fetchedAt: asString(data['fetchedAt'], nowIso()),
  };
}

function mapCost(raw: unknown): CostResponse {
  const data = isObject(raw) ? raw : {};
  return {
    monthToDateCents: asNumber(data['monthToDateCents'], 0),
    monthToDateTokens: asNumber(data['monthToDateTokens'], 0),
    totalBudgetCents: asNumber(data['totalBudgetCents'], 0),
    utilizationPercent: asNumber(data['utilizationPercent'], 0),
    byModel: asArray<CostByModel>(data['byModel']),
    budgets: asArray<CostBudget>(data['budgets']),
    tenantId: asString(data['tenantId'], ''),
    windowStart: asString(data['windowStart'], ''),
    windowEnd: asString(data['windowEnd'], ''),
    fetchedAt: asString(data['fetchedAt'], nowIso()),
  };
}

function mapQualitySummary(raw: unknown): QualitySummary {
  const data = isObject(raw) ? raw : {};
  return {
    averageScore: asNumberOrNull(data['averageScore']),
    evaluatedCount: asNumber(data['evaluatedCount'], 0),
    abstentionCount: asNumber(data['abstentionCount'], 0),
    correctionCount: asNumber(data['correctionCount'], 0),
    revisionCount: asNumber(data['revisionCount'], 0),
    feedbackCount: asNumber(data['feedbackCount'], 0),
  };
}

function mapQuality(raw: unknown): QualityResponse {
  const data = isObject(raw) ? raw : {};
  return {
    summary: mapQualitySummary(data['summary']),
    attempts: asArray<QualityAttempt>(data['attempts']),
    reviews: asArray<QualityReview>(data['reviews']),
    tenantId: asString(data['tenantId'], ''),
    windowStart: asString(data['windowStart'], ''),
    windowEnd: asString(data['windowEnd'], ''),
    fetchedAt: asString(data['fetchedAt'], nowIso()),
  };
}

function mapKillSwitches(raw: unknown): KillSwitchListResponse {
  const data = isObject(raw) ? raw : {};
  return {
    entries: asArray<KillSwitchEntry>(data['entries']),
    processEnabled: asBoolean(data['processEnabled'], false),
    overrides: asRecordStringBoolean(data['overrides']),
    tenantId: asString(data['tenantId'], ''),
    fetchedAt: asString(data['fetchedAt'], nowIso()),
  };
}

// ─── Thin typed wrapper ────────────────────────────────────────────────────

export interface CommandCenterService {
  getInventory(tenantId: string): Promise<InventoryResponse>;
  getCost(tenantId: string): Promise<CostResponse>;
  getQuality(tenantId: string): Promise<QualityResponse>;
  getKillSwitches(tenantId: string): Promise<KillSwitchListResponse>;
}

export const commandCenterApi: CommandCenterService = {
  async getInventory(_tenantId: string): Promise<InventoryResponse> {
    const res = await api.get<unknown>('/command-center/inventory');
    return mapInventory(unwrapResponse<unknown>(res));
  },

  async getCost(_tenantId: string): Promise<CostResponse> {
    const res = await api.get<unknown>('/command-center/cost');
    return mapCost(unwrapResponse<unknown>(res));
  },

  async getQuality(_tenantId: string): Promise<QualityResponse> {
    const res = await api.get<unknown>('/command-center/quality');
    return mapQuality(unwrapResponse<unknown>(res));
  },

  async getKillSwitches(_tenantId: string): Promise<KillSwitchListResponse> {
    const res = await api.get<unknown>('/command-center/kill-switches');
    return mapKillSwitches(unwrapResponse<unknown>(res));
  },
};

// ─── Legacy surface (preserved for existing /intelligence and /home pages) ─
//
// The Phase 8 comprehensive wrapper still drives the /intelligence Command
// Center tab and the /home KPI strip. While those consumers migrate to the
// thin surface above, the legacy types and `commandCenterService` object
// remain exported below. No new code should use these.

function ensureArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export interface CommandCenterAgent {
  id: string;
  name: string;
  type: string;
  status: string;
  model: string | null;
  departmentId: string | null;
  _count: { tasks: number };
}

export interface CommandCenterTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  agentId: string | null;
  createdAt: string;
}

export interface CommandCenterWorkflow {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface CommandCenterDepartment {
  id: string;
  name: string;
  status: string;
}

export interface CommandCenterSummary {
  agents: {
    total: number;
    active: number;
    running: number;
    paused: number;
    error: number;
    list: CommandCenterAgent[];
  };
  tasks: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    list: CommandCenterTask[];
  };
  workflows: {
    total: number;
    active: number;
    list: CommandCenterWorkflow[];
  };
  departments: {
    total: number;
    list: CommandCenterDepartment[];
  };
  approvals: { pending: number };
  costs: { monthCents: number; budgetCents: number };
  activity: Array<{
    id: string;
    message: string;
    severity: string;
    timestamp: string;
  }>;
  fetchedAt: string;
}

export type CommandCenterInventoryAgent = InventoryAgent;
export type CommandCenterInventorySkill = InventorySkill;
export type CommandCenterInventoryModel = InventoryModel;
export type CommandCenterInventoryKnowledge = InventoryKnowledge;
export type CommandCenterInventoryChannel = InventoryChannel;
export type CommandCenterInventory = InventoryResponse;
export type CommandCenterQualityAttempt = QualityAttempt;
export type CommandCenterQualityReview = QualityReview;
export type CommandCenterQualitySummary = QualitySummary;
export type CommandCenterQuality = QualityResponse;
export type CommandCenterCostByModel = CostByModel;
export type CommandCenterCostBudget = CostBudget;
export type CommandCenterCosts = CostResponse;
export type CommandCenterKillSwitchEntry = KillSwitchEntry;
export type CommandCenterKillSwitchList = KillSwitchListResponse;

export interface CommandCenterModelHealthEntry {
  model: string;
  attempts: number;
  successful: number;
  failed: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
  errorRate: number;
  grade: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
  source: 'ExecutionAttempt';
}

export interface CommandCenterModelHealth {
  models: CommandCenterModelHealthEntry[];
  totalAttempts: number;
  overallErrorRate: number;
  tenantId: string;
  windowStart: string;
  windowEnd: string;
  fetchedAt: string;
}

export interface CommandCenterChannelHealthEntry {
  id: string;
  type: string;
  provider: string;
  status: string;
  enabled: boolean;
  tokenExpiresAt: string | null;
  failureRate: number;
  grade: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
  source: 'CrmConnector';
}

export interface CommandCenterChannelHealth {
  channels: CommandCenterChannelHealthEntry[];
  totalChannels: number;
  healthyChannels: number;
  degradedChannels: number;
  unhealthyChannels: number;
  tenantId: string;
  fetchedAt: string;
}

export interface CommandCenterSecurityEvent {
  id: string;
  actor: string;
  action: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resource: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  result: 'success' | 'failure';
  occurredAt: string;
  source: 'AuditLog';
}

export interface CommandCenterSecuritySummary {
  total: number;
  denials: number;
  injectionAttempts: number;
  dlpEvents: number;
  malwareEvents: number;
  criticalCount: number;
}

export interface CommandCenterSecurityEvents {
  summary: CommandCenterSecuritySummary;
  events: CommandCenterSecurityEvent[];
  tenantId: string;
  fetchedAt: string;
}

export interface CommandCenterAuditCorrelationEvent {
  id: string;
  actor: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  correlationId: string | null;
  causationId: string | null;
  result: string;
  occurredAt: string;
}

export interface CommandCenterAuditCorrelation {
  tenantId: string;
  windowStart: string;
  windowEnd: string;
  count: number;
  events: CommandCenterAuditCorrelationEvent[];
}

export interface SetKillSwitchInput {
  scope: 'process' | 'phase' | 'channel' | 'tenant-feature';
  target?: string;
  enabled: boolean;
  reason: string;
}

export interface SetKillSwitchResult {
  scope: 'process' | 'phase' | 'channel' | 'tenant-feature';
  target: string | null;
  enabled: boolean;
  appliedAt: string;
  auditLogId: string;
}

function unwrapLegacy<T>(res: unknown): T {
  const raw: unknown = isObject(res) ? res : {};
  if (isObject(raw) && 'data' in raw) return raw['data'] as T;
  return raw as T;
}

export const commandCenterService = {
  async getSummary(): Promise<CommandCenterSummary> {
    const res = await restClient.get('/command-center/summary');
    const item: unknown = unwrapItem(res);
    const data = isObject(item) ? item : {};
    const d = data;
    return {
      agents: { total: asNumber((d['agents'] as Record<string, unknown> | undefined)?.['total'], 0), active: asNumber((d['agents'] as Record<string, unknown> | undefined)?.['active'], 0), running: asNumber((d['agents'] as Record<string, unknown> | undefined)?.['running'], 0), paused: asNumber((d['agents'] as Record<string, unknown> | undefined)?.['paused'], 0), error: asNumber((d['agents'] as Record<string, unknown> | undefined)?.['error'], 0), list: ensureArray<CommandCenterAgent>((d['agents'] as Record<string, unknown> | undefined)?.['list']) },
      tasks: { total: asNumber((d['tasks'] as Record<string, unknown> | undefined)?.['total'], 0), pending: asNumber((d['tasks'] as Record<string, unknown> | undefined)?.['pending'], 0), running: asNumber((d['tasks'] as Record<string, unknown> | undefined)?.['running'], 0), completed: asNumber((d['tasks'] as Record<string, unknown> | undefined)?.['completed'], 0), failed: asNumber((d['tasks'] as Record<string, unknown> | undefined)?.['failed'], 0), list: ensureArray<CommandCenterTask>((d['tasks'] as Record<string, unknown> | undefined)?.['list']) },
      workflows: { total: asNumber((d['workflows'] as Record<string, unknown> | undefined)?.['total'], 0), active: asNumber((d['workflows'] as Record<string, unknown> | undefined)?.['active'], 0), list: ensureArray<CommandCenterWorkflow>((d['workflows'] as Record<string, unknown> | undefined)?.['list']) },
      departments: { total: asNumber((d['departments'] as Record<string, unknown> | undefined)?.['total'], 0), list: ensureArray<CommandCenterDepartment>((d['departments'] as Record<string, unknown> | undefined)?.['list']) },
      approvals: { pending: asNumber((d['approvals'] as Record<string, unknown> | undefined)?.['pending'], 0) },
      costs: { monthCents: asNumber((d['costs'] as Record<string, unknown> | undefined)?.['monthCents'], 0), budgetCents: asNumber((d['costs'] as Record<string, unknown> | undefined)?.['budgetCents'], 0) },
      activity: ensureArray<{ id: string; message: string; severity: string; timestamp: string }>(d['activity']),
      fetchedAt: asString(d['fetchedAt'], nowIso()),
    };
  },

  async getInventory(limit = 100): Promise<CommandCenterInventory> {
    const res = await restClient.get(
      `/command-center/inventory?limit=${encodeURIComponent(String(limit))}`,
    );
    const item = unwrapItem(res) as Partial<CommandCenterInventory> | unknown;
    return mapInventory(item) as CommandCenterInventory;
  },

  async getQuality(windowHours = 168, limit = 50): Promise<CommandCenterQuality> {
    const res = await restClient.get(
      `/command-center/quality?windowHours=${encodeURIComponent(String(windowHours))}&limit=${encodeURIComponent(String(limit))}`,
    );
    const item = unwrapItem(res) as Partial<CommandCenterQuality> | unknown;
    return mapQuality(item) as CommandCenterQuality;
  },

  async getCosts(): Promise<CommandCenterCosts> {
    const res = await restClient.get('/command-center/costs');
    const item = unwrapItem(res) as Partial<CommandCenterCosts> | unknown;
    return mapCost(item) as CommandCenterCosts;
  },

  async getModelHealth(windowHours = 24): Promise<CommandCenterModelHealth> {
    const res = await restClient.get(
      `/command-center/model-health?windowHours=${encodeURIComponent(String(windowHours))}`,
    );
    const item = unwrapItem(res) as Partial<CommandCenterModelHealth> | unknown;
    const data = isObject(item) ? item : {};
    return {
      models: ensureArray<CommandCenterModelHealthEntry>(data['models']),
      totalAttempts: asNumber(data['totalAttempts'], 0),
      overallErrorRate: asNumber(data['overallErrorRate'], 0),
      tenantId: asString(data['tenantId'], ''),
      windowStart: asString(data['windowStart'], ''),
      windowEnd: asString(data['windowEnd'], ''),
      fetchedAt: asString(data['fetchedAt'], nowIso()),
    };
  },

  async getChannelHealth(): Promise<CommandCenterChannelHealth> {
    const res = await restClient.get('/command-center/channel-health');
    const item = unwrapItem(res) as Partial<CommandCenterChannelHealth> | unknown;
    const data = isObject(item) ? item : {};
    return {
      channels: ensureArray<CommandCenterChannelHealthEntry>(data['channels']),
      totalChannels: asNumber(data['totalChannels'], 0),
      healthyChannels: asNumber(data['healthyChannels'], 0),
      degradedChannels: asNumber(data['degradedChannels'], 0),
      unhealthyChannels: asNumber(data['unhealthyChannels'], 0),
      tenantId: asString(data['tenantId'], ''),
      fetchedAt: asString(data['fetchedAt'], nowIso()),
    };
  },

  async getSecurityEvents(limit = 100): Promise<CommandCenterSecurityEvents> {
    const res = await restClient.get(
      `/command-center/security-events?limit=${encodeURIComponent(String(limit))}`,
    );
    const item = unwrapItem(res) as Partial<CommandCenterSecurityEvents> | unknown;
    const data = isObject(item) ? item : {};
    return {
      summary: (isObject(data['summary']) ? (data['summary'] as unknown as CommandCenterSecuritySummary) : {
        total: 0, denials: 0, injectionAttempts: 0, dlpEvents: 0, malwareEvents: 0, criticalCount: 0,
      }),
      events: ensureArray<CommandCenterSecurityEvent>(data['events']),
      tenantId: asString(data['tenantId'], ''),
      fetchedAt: asString(data['fetchedAt'], nowIso()),
    };
  },

  async getKillSwitches(): Promise<CommandCenterKillSwitchList> {
    const res = await restClient.get('/command-center/kill-switches');
    const item = unwrapItem(res) as Partial<CommandCenterKillSwitchList> | unknown;
    return mapKillSwitches(item) as CommandCenterKillSwitchList;
  },

  async setKillSwitch(input: SetKillSwitchInput): Promise<SetKillSwitchResult> {
    const res = await restClient.post('/command-center/kill-switches', input);
    const data: unknown = unwrapLegacy<unknown>(res);
    const obj = isObject(data) ? data : {};
    return {
      scope: (obj['scope'] as SetKillSwitchInput['scope']) ?? input.scope,
      target: asStringOrNull(obj['target']),
      enabled: asBoolean(obj['enabled'], input.enabled),
      appliedAt: asString(obj['appliedAt'], nowIso()),
      auditLogId: asString(obj['auditLogId'], ''),
    };
  },

  async getAuditCorrelation(
    limit = 50,
    windowHours = 24,
    correlationId?: string,
  ): Promise<CommandCenterAuditCorrelation> {
    const qs = new URLSearchParams({
      limit: String(limit),
      windowHours: String(windowHours),
    });
    if (correlationId) qs.set('correlationId', correlationId);
    const res = await restClient.get(
      `/command-center/audit-correlation?${qs.toString()}`,
    );
    const item = unwrapItem(res) as Partial<CommandCenterAuditCorrelation> | unknown;
    const data = isObject(item) ? item : {};
    return {
      tenantId: asString(data['tenantId'], ''),
      windowStart: asString(data['windowStart'], ''),
      windowEnd: asString(data['windowEnd'], ''),
      count: asNumber(data['count'], 0),
      events: ensureArray<CommandCenterAuditCorrelationEvent>(data['events']),
    };
  },
};
