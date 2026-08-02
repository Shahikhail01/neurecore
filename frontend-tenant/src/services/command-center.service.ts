// ─── commandCenterService.ts ─────────────────────────────────────────────────
// Aggregates the data the command-center dashboard needs in a single
// round-trip. Replaces 7 parallel HTTP requests with one.
// Phase 2 R3 performance fix.
//
// Phase 8 (P8 — CR-AI-1201..1206) extends the legacy summary with
// six intelligence surfaces:
//   inventory, quality, costs, model-health, channel-health, security-events.

import { restClient } from '@/core/services/api/clients/RestClient';
import { unwrapItem } from '@/services/unwrap';

function ensureArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? v : [];
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

// ── P8 — Inventory (CR-AI-1201) ─────────────────────────────────────────────

export interface CommandCenterInventoryAgent {
  id: string;
  name: string;
  status: string;
  model: string;
  departmentId: string | null;
  updatedAt: string;
  source: 'Agent';
}

export interface CommandCenterInventorySkill {
  id: string;
  name: string;
  slug: string;
  version: string;
  status: string;
  updatedAt: string;
  source: 'AgentSkillDefinition';
}

export interface CommandCenterInventoryModel {
  model: string;
  provider: string;
  agentCount: number;
  source: 'ExecutionAttempt';
}

export interface CommandCenterInventoryKnowledge {
  id: string;
  name: string;
  kind: string;
  status: string;
  updatedAt: string;
  source: 'KnowledgeEntry';
}

export interface CommandCenterInventoryChannel {
  id: string;
  type: string;
  status: string;
  source: 'CrmConnector';
}

export interface CommandCenterInventory {
  agents: CommandCenterInventoryAgent[];
  skills: CommandCenterInventorySkill[];
  models: CommandCenterInventoryModel[];
  knowledge: CommandCenterInventoryKnowledge[];
  channels: CommandCenterInventoryChannel[];
  tenantId: string;
  fetchedAt: string;
}

// ── P8 — Quality (CR-AI-1202) ──────────────────────────────────────────────

export interface CommandCenterQualityAttempt {
  attemptId: string;
  taskId: string;
  agentId: string | null;
  score: number | null;
  reflection: string | null;
  evaluatedAt: string;
  source: 'ExecutionLog';
}

export interface CommandCenterQualityReview {
  id: string;
  taskId: string;
  attemptId: string;
  decision: string;
  status: string;
  comment: string | null;
  decidedAt: string | null;
  source: 'Review';
}

export interface CommandCenterQualitySummary {
  averageScore: number | null;
  evaluatedCount: number;
  abstentionCount: number;
  correctionCount: number;
  revisionCount: number;
  feedbackCount: number;
}

export interface CommandCenterQuality {
  summary: CommandCenterQualitySummary;
  attempts: CommandCenterQualityAttempt[];
  reviews: CommandCenterQualityReview[];
  tenantId: string;
  windowStart: string;
  windowEnd: string;
  fetchedAt: string;
}

// ── P8 — Costs (CR-AI-1203) ────────────────────────────────────────────────

export interface CommandCenterCostByModel {
  model: string;
  provider: string;
  costCents: number;
  tokens: number;
  source: 'CostRecord';
}

export interface CommandCenterCostBudget {
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

export interface CommandCenterCosts {
  monthToDateCents: number;
  monthToDateTokens: number;
  totalBudgetCents: number;
  utilizationPercent: number;
  byModel: CommandCenterCostByModel[];
  budgets: CommandCenterCostBudget[];
  tenantId: string;
  windowStart: string;
  windowEnd: string;
  fetchedAt: string;
}

// ── P8 — Model health (CR-AI-1204) ──────────────────────────────────────────

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

// ── P8 — Channel health (CR-AI-1205) ────────────────────────────────────────

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

// ── P8 — Security events (CR-AI-1206) ──────────────────────────────────────

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

export interface CommandCenterKillSwitchEntry {
  scope: 'process' | 'phase' | 'channel' | 'tenant-feature';
  target: string;
  enabled: boolean;
  processEnabled: boolean;
  updatedAt: string;
}

export interface CommandCenterKillSwitchList {
  entries: CommandCenterKillSwitchEntry[];
  processEnabled: boolean;
  overrides: Record<string, boolean>;
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

export const commandCenterService = {
  async getSummary(): Promise<CommandCenterSummary> {
    const res = await restClient.get('/command-center/summary');
    const data = unwrapItem(res);
    if (!data || typeof data !== 'object') {
      throw new Error('command-center/summary returned invalid data');
    }
    const d = data as Record<string, unknown>;
    return {
      agents: { total: (d.agents as { total?: number })?.total ?? 0, active: (d.agents as { active?: number })?.active ?? 0, running: (d.agents as { running?: number })?.running ?? 0, paused: (d.agents as { paused?: number })?.paused ?? 0, error: (d.agents as { error?: number })?.error ?? 0, list: ensureArray((d.agents as { list?: unknown[] })?.list) },
      tasks: { total: (d.tasks as { total?: number })?.total ?? 0, pending: (d.tasks as { pending?: number })?.pending ?? 0, running: (d.tasks as { running?: number })?.running ?? 0, completed: (d.tasks as { completed?: number })?.completed ?? 0, failed: (d.tasks as { failed?: number })?.failed ?? 0, list: ensureArray((d.tasks as { list?: unknown[] })?.list) },
      workflows: { total: (d.workflows as { total?: number })?.total ?? 0, active: (d.workflows as { active?: number })?.active ?? 0, list: ensureArray((d.workflows as { list?: unknown[] })?.list) },
      departments: { total: (d.departments as { total?: number })?.total ?? 0, list: ensureArray((d.departments as { list?: unknown[] })?.list) },
      approvals: { pending: (d.approvals as { pending?: number })?.pending ?? 0 },
      costs: { monthCents: (d.costs as { monthCents?: number })?.monthCents ?? 0, budgetCents: (d.costs as { budgetCents?: number })?.budgetCents ?? 0 },
      activity: ensureArray(d.activity as unknown[] | undefined) as CommandCenterSummary['activity'],
      fetchedAt: (d.fetchedAt as string) ?? new Date().toISOString(),
    };
  },

  // P8 — CR-AI-1201
  async getInventory(limit = 100): Promise<CommandCenterInventory> {
    const res = await restClient.get(
      `/command-center/inventory?limit=${encodeURIComponent(String(limit))}`,
    );
    const data = unwrapItem(res) as Partial<CommandCenterInventory> | null;
    return {
      agents: ensureArray<CommandCenterInventoryAgent>(data?.agents),
      skills: ensureArray<CommandCenterInventorySkill>(data?.skills),
      models: ensureArray<CommandCenterInventoryModel>(data?.models),
      knowledge: ensureArray<CommandCenterInventoryKnowledge>(data?.knowledge),
      channels: ensureArray<CommandCenterInventoryChannel>(data?.channels),
      tenantId: (data?.tenantId as string) ?? '',
      fetchedAt: (data?.fetchedAt as string) ?? new Date().toISOString(),
    };
  },

  // P8 — CR-AI-1202
  async getQuality(windowHours = 168, limit = 50): Promise<CommandCenterQuality> {
    const res = await restClient.get(
      `/command-center/quality?windowHours=${encodeURIComponent(String(windowHours))}&limit=${encodeURIComponent(String(limit))}`,
    );
    const data = unwrapItem(res) as Partial<CommandCenterQuality> | null;
    return {
      summary: (data?.summary as CommandCenterQualitySummary) ?? {
        averageScore: null,
        evaluatedCount: 0,
        abstentionCount: 0,
        correctionCount: 0,
        revisionCount: 0,
        feedbackCount: 0,
      },
      attempts: ensureArray<CommandCenterQualityAttempt>(data?.attempts),
      reviews: ensureArray<CommandCenterQualityReview>(data?.reviews),
      tenantId: (data?.tenantId as string) ?? '',
      windowStart: (data?.windowStart as string) ?? '',
      windowEnd: (data?.windowEnd as string) ?? '',
      fetchedAt: (data?.fetchedAt as string) ?? new Date().toISOString(),
    };
  },

  // P8 — CR-AI-1203
  async getCosts(): Promise<CommandCenterCosts> {
    const res = await restClient.get('/command-center/costs');
    const data = unwrapItem(res) as Partial<CommandCenterCosts> | null;
    return {
      monthToDateCents: data?.monthToDateCents ?? 0,
      monthToDateTokens: data?.monthToDateTokens ?? 0,
      totalBudgetCents: data?.totalBudgetCents ?? 0,
      utilizationPercent: data?.utilizationPercent ?? 0,
      byModel: ensureArray<CommandCenterCostByModel>(data?.byModel),
      budgets: ensureArray<CommandCenterCostBudget>(data?.budgets),
      tenantId: (data?.tenantId as string) ?? '',
      windowStart: (data?.windowStart as string) ?? '',
      windowEnd: (data?.windowEnd as string) ?? '',
      fetchedAt: (data?.fetchedAt as string) ?? new Date().toISOString(),
    };
  },

  // P8 — CR-AI-1204
  async getModelHealth(windowHours = 24): Promise<CommandCenterModelHealth> {
    const res = await restClient.get(
      `/command-center/model-health?windowHours=${encodeURIComponent(String(windowHours))}`,
    );
    const data = unwrapItem(res) as Partial<CommandCenterModelHealth> | null;
    return {
      models: ensureArray<CommandCenterModelHealthEntry>(data?.models),
      totalAttempts: data?.totalAttempts ?? 0,
      overallErrorRate: data?.overallErrorRate ?? 0,
      tenantId: (data?.tenantId as string) ?? '',
      windowStart: (data?.windowStart as string) ?? '',
      windowEnd: (data?.windowEnd as string) ?? '',
      fetchedAt: (data?.fetchedAt as string) ?? new Date().toISOString(),
    };
  },

  // P8 — CR-AI-1205
  async getChannelHealth(): Promise<CommandCenterChannelHealth> {
    const res = await restClient.get('/command-center/channel-health');
    const data = unwrapItem(res) as Partial<CommandCenterChannelHealth> | null;
    return {
      channels: ensureArray<CommandCenterChannelHealthEntry>(data?.channels),
      totalChannels: data?.totalChannels ?? 0,
      healthyChannels: data?.healthyChannels ?? 0,
      degradedChannels: data?.degradedChannels ?? 0,
      unhealthyChannels: data?.unhealthyChannels ?? 0,
      tenantId: (data?.tenantId as string) ?? '',
      fetchedAt: (data?.fetchedAt as string) ?? new Date().toISOString(),
    };
  },

  // P8 — CR-AI-1206
  async getSecurityEvents(limit = 100): Promise<CommandCenterSecurityEvents> {
    const res = await restClient.get(
      `/command-center/security-events?limit=${encodeURIComponent(String(limit))}`,
    );
    const data = unwrapItem(res) as Partial<CommandCenterSecurityEvents> | null;
    return {
      summary: (data?.summary as CommandCenterSecuritySummary) ?? {
        total: 0,
        denials: 0,
        injectionAttempts: 0,
        dlpEvents: 0,
        malwareEvents: 0,
        criticalCount: 0,
      },
      events: ensureArray<CommandCenterSecurityEvent>(data?.events),
      tenantId: (data?.tenantId as string) ?? '',
      fetchedAt: (data?.fetchedAt as string) ?? new Date().toISOString(),
    };
  },

  // P8 — CR-AI-1207
  async getKillSwitches(): Promise<CommandCenterKillSwitchList> {
    const res = await restClient.get('/command-center/kill-switches');
    const data = unwrapItem(res) as Partial<CommandCenterKillSwitchList> | null;
    return {
      entries: ensureArray<CommandCenterKillSwitchEntry>(data?.entries),
      processEnabled: Boolean(data?.processEnabled),
      overrides: (data?.overrides as Record<string, boolean>) ?? {},
      tenantId: (data?.tenantId as string) ?? '',
      fetchedAt: (data?.fetchedAt as string) ?? new Date().toISOString(),
    };
  },

  async setKillSwitch(input: SetKillSwitchInput): Promise<SetKillSwitchResult> {
    const res = await restClient.post('/command-center/kill-switches', input);
    const data = unwrapItem(res) as Partial<SetKillSwitchResult> | null;
    return {
      scope: (data?.scope as SetKillSwitchInput['scope']) ?? input.scope,
      target: (data?.target as string | null) ?? null,
      enabled: Boolean(data?.enabled),
      appliedAt: (data?.appliedAt as string) ?? new Date().toISOString(),
      auditLogId: (data?.auditLogId as string) ?? '',
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
    const data = unwrapItem(res) as Partial<CommandCenterAuditCorrelation> | null;
    return {
      tenantId: (data?.tenantId as string) ?? '',
      windowStart: (data?.windowStart as string) ?? '',
      windowEnd: (data?.windowEnd as string) ?? '',
      count: data?.count ?? 0,
      events: ensureArray<CommandCenterAuditCorrelationEvent>(data?.events),
    };
  },
};
