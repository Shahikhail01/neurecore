/**
 * Phase 7 — Frontend service.
 */

import axios from 'axios';

const P7 = '/api/v1/phase7';

function authHeader(): { Authorization?: string } {
  if (typeof window === 'undefined') return {};
  const token =
    window.localStorage.getItem('admin_accessToken') ||
    window.localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Touchpoint {
  id: string;
  tenantId: string;
  customerId: string;
  channelKind: string;
  externalId: string;
  occurredAt: string;
  receivedAt: string;
  tags: string[];
}

export interface Customer360 {
  tenantId: string;
  customerId: string;
  timeline: Touchpoint[];
  intentSignals: Array<{ id: string; intentKind: string; confidence: number; detectedAt: string }>;
  summary: {
    totalTouchpoints: number;
    channelsTouched: string[];
    lastTouchpointAt: string | null;
    activeIntent: string | null;
  };
}

export interface TriageRule {
  id: string;
  tenantId: string;
  slug: string;
  displayName: string;
  description: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  action: 'AUTO_ROUTE_QUEUE' | 'AUTO_ROUTE_OWNER' | 'AUTO_PRIORITY' | 'ESCALATE_HUMAN' | 'REQUEST_INFO';
  targetQueue: string | null;
  targetOwnerId: string | null;
  predicate: Record<string, unknown>;
  enabled: boolean;
}

export interface ChatbotPersona {
  id: string;
  tenantId: string;
  kind: 'SELF_SERVICE_24_7' | 'SALES_ASSIST' | 'SUPPORT_TIER_1' | 'INTERNAL_HELPDESK';
  slug: string;
  displayName: string;
  systemPrompt: string;
  allowedActionIds: string[];
  knowledgeCategories: string[];
  escalationThreshold: number;
  enabled: boolean;
}

export interface KnowledgeGap {
  id: string;
  tenantId: string;
  topic: string;
  caseCount: number;
  topicHash: string;
  suggestedTitle: string | null;
  suggestedBody: string | null;
  status: 'OPEN' | 'DRAFTED' | 'PUBLISHED' | 'DISMISSED';
  detectedAt: string;
}

export interface OperationalHealth {
  id: string;
  tenantId: string;
  probe: string;
  severity: 'OK' | 'WARN' | 'CRITICAL';
  detail: Record<string, unknown>;
  observedAt: string;
}

export interface InternalCompliance {
  id: string;
  tenantId: string;
  category: 'operational' | 'management' | 'it';
  checkName: string;
  outcome: 'PASS' | 'FAIL' | 'ERROR';
  detail: Record<string, unknown>;
  ranAt: string;
}

export interface SecurityControl {
  id: string;
  tenantId: string;
  controlKey: string;
  state: 'enabled' | 'disabled' | 'misconfigured';
  detail: Record<string, unknown>;
  observedAt: string;
}

export interface CustomGovRule {
  id: string;
  tenantId: string;
  slug: string;
  displayName: string;
  description: string;
  domain: 'data' | 'user-access' | 'operational' | 'security';
  standards: string[];
  predicate: Record<string, unknown>;
  enabled: boolean;
}

export interface XaiExplanation {
  id: string;
  tenantId: string;
  executionId: string;
  reason: string;
  factors: Array<{ factor: string; value: number; weight: number }>;
  decisionTrace: Record<string, unknown>;
  featureImportances: Record<string, number>;
  generatedAt: string;
}

export interface XaiWhyPanel {
  tenantId: string;
  intent: string;
  factors: Array<{ factor: string; value: number; weight: number }>;
  narrative: string;
  modelId: string;
}

export async function getCustomer360(tenantId: string, customerId: string): Promise<Customer360> {
  const res = await axios.get<{ data: Customer360 }>(`${P7}/customer-360`, {
    headers: authHeader(),
    params: { tenantId, customerId },
  });
  return res.data.data;
}

export async function ingestTouchpoint(input: {
  tenantId: string;
  customerId: string;
  channelKind: string;
  externalId: string;
  occurredAt: string;
  tags?: string[];
}): Promise<Touchpoint> {
  const res = await axios.post<{ data: Touchpoint }>(`${P7}/customer-360/ingest`, input, {
    headers: authHeader(),
  });
  return res.data.data;
}

export async function listTriageRules(tenantId: string): Promise<TriageRule[]> {
  const res = await axios.get<{ data: TriageRule[] }>(`${P7}/triage/rules`, {
    headers: authHeader(),
    params: { tenantId },
  });
  return res.data.data ?? [];
}

export async function createTriageRule(input: Partial<TriageRule> & { tenantId: string }): Promise<TriageRule> {
  const res = await axios.post<{ data: TriageRule }>(`${P7}/triage/rules`, input, {
    headers: authHeader(),
  });
  return res.data.data;
}

export async function evaluateTriage(input: {
  tenantId: string;
  caseId: string;
  payload: Record<string, unknown>;
}): Promise<{ matched: boolean; ruleId?: string; priority?: string; action?: string; target?: string | null }> {
  const res = await axios.post<{ data: unknown }>(`${P7}/triage/evaluate`, input, {
    headers: authHeader(),
  });
  return res.data.data as never;
}

export async function listChatbotPersonas(tenantId: string): Promise<ChatbotPersona[]> {
  const res = await axios.get<{ data: ChatbotPersona[] }>(`${P7}/chatbot-personas`, {
    headers: authHeader(),
    params: { tenantId },
  });
  return res.data.data ?? [];
}

export async function createChatbotPersona(input: Partial<ChatbotPersona> & { tenantId: string }): Promise<ChatbotPersona> {
  const res = await axios.post<{ data: ChatbotPersona }>(`${P7}/chatbot-personas`, input, {
    headers: authHeader(),
  });
  return res.data.data;
}

export async function listKnowledgeGaps(tenantId: string): Promise<KnowledgeGap[]> {
  const res = await axios.get<{ data: KnowledgeGap[] }>(`${P7}/knowledge-gaps`, {
    headers: authHeader(),
    params: { tenantId },
  });
  return res.data.data ?? [];
}

export async function detectKnowledgeGaps(input: {
  tenantId: string;
  topics: string[];
  caseCount?: number;
}): Promise<KnowledgeGap[]> {
  const res = await axios.post<{ data: KnowledgeGap[] }>(`${P7}/knowledge-gaps`, input, {
    headers: authHeader(),
  });
  return res.data.data ?? [];
}

export async function runOperationalProbes(tenantId: string): Promise<OperationalHealth[]> {
  const res = await axios.post<{ data: OperationalHealth[] }>(
    `${P7}/governance/probes/operational/run`,
    { tenantId },
    { headers: authHeader() },
  );
  return res.data.data ?? [];
}

export async function listOperationalHealth(tenantId: string): Promise<OperationalHealth[]> {
  const res = await axios.get<{ data: OperationalHealth[] }>(
    `${P7}/governance/probes/operational`,
    { headers: authHeader(), params: { tenantId } },
  );
  return res.data.data ?? [];
}

export async function runInternalCompliance(tenantId: string): Promise<InternalCompliance[]> {
  const res = await axios.post<{ data: InternalCompliance[] }>(
    `${P7}/governance/probes/internal/run`,
    { tenantId },
    { headers: authHeader() },
  );
  return res.data.data ?? [];
}

export async function listInternalCompliance(tenantId: string): Promise<InternalCompliance[]> {
  const res = await axios.get<{ data: InternalCompliance[] }>(
    `${P7}/governance/probes/internal`,
    { headers: authHeader(), params: { tenantId } },
  );
  return res.data.data ?? [];
}

export async function listSecurityControls(tenantId: string): Promise<SecurityControl[]> {
  const res = await axios.get<{ data: SecurityControl[] }>(
    `${P7}/governance/probes/security`,
    { headers: authHeader(), params: { tenantId } },
  );
  return res.data.data ?? [];
}

export async function setSecurityControl(input: {
  tenantId: string;
  controlKey: string;
  state: 'enabled' | 'disabled' | 'misconfigured';
}): Promise<SecurityControl> {
  const res = await axios.post<{ data: SecurityControl }>(
    `${P7}/governance/probes/security`,
    input,
    { headers: authHeader() },
  );
  return res.data.data;
}

export async function listCustomGovRules(tenantId: string): Promise<CustomGovRule[]> {
  const res = await axios.get<{ data: CustomGovRule[] }>(`${P7}/governance/rules`, {
    headers: authHeader(),
    params: { tenantId },
  });
  return res.data.data ?? [];
}

export async function createCustomGovRule(input: Partial<CustomGovRule> & { tenantId: string }): Promise<CustomGovRule> {
  const res = await axios.post<{ data: CustomGovRule }>(`${P7}/governance/rules`, input, {
    headers: authHeader(),
  });
  return res.data.data;
}

export async function fetchWhyPanel(input: {
  tenantId: string;
  intent: string;
  factors: Array<{ factor: string; value: number }>;
}): Promise<XaiWhyPanel> {
  const res = await axios.post<{ data: XaiWhyPanel }>(`${P7}/xai/why-panel`, input, {
    headers: authHeader(),
  });
  return res.data.data;
}
