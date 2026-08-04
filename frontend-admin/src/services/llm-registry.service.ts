/**
 * LLM Registry — Admin Frontend Service.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.17.4-5.
 * Mirrors the backend `/api/v1/admin/llm-registry/providers` and
 * `/api/v1/llm-registry/bindings` routes.
 *
 * Solid (frontend): SRP — only HTTP calls.
 */

import axios from 'axios';

const ADMIN_BASE = '/api/v1/admin/llm-registry';
const TENANT_BASE = '/api/v1/llm-registry';

function authHeader(): { Authorization?: string } {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('admin_accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type LlmProviderKind =
  | 'OPENAI_COMPATIBLE'
  | 'ANTHROPIC'
  | 'GOOGLE'
  | 'COHERE'
  | 'INTERNAL_MOCK';

export type LlmProviderStatus = 'ACTIVE' | 'DISABLED' | 'DRAINING';

export interface LlmProvider {
  id: string;
  slug: string;
  displayName: string;
  kind: LlmProviderKind;
  status: LlmProviderStatus;
  baseUrl: string;
  orgId: string | null;
  metadata: Record<string, unknown>;
  requestsPerMinuteCap: number | null;
  maxConcurrent: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LlmProviderModel {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capabilities: Record<string, unknown>;
  contextWindow: number;
}

export interface TenantLlmBinding {
  id: string;
  tenantId: string;
  providerId: string;
  modelId: string;
  priority: number;
  status: LlmProviderStatus;
  requestsPerMinuteCap: number | null;
  metadata: Record<string, unknown>;
  createdByActorId: string;
  createdAt: string;
  updatedAt: string;
  lastRotatedAt: string | null;
}

export interface CreateProviderInput {
  slug: string;
  displayName: string;
  kind: LlmProviderKind;
  baseUrl: string;
  secretRef: string;
  orgId?: string;
  requestsPerMinuteCap?: number;
  maxConcurrent?: number;
}

export interface ProviderListResult {
  items: LlmProvider[];
  total: number;
  page: number;
  limit: number;
}

export async function listProviders(args: {
  page?: number;
  limit?: number;
  status?: LlmProviderStatus;
  kind?: LlmProviderKind;
} = {}): Promise<ProviderListResult> {
  const res = await axios.get<{ data: ProviderListResult }>(
    `${ADMIN_BASE}/providers`,
    {
      headers: authHeader(),
      params: args,
    },
  );
  return res.data.data;
}

export async function createProvider(input: CreateProviderInput): Promise<LlmProvider> {
  const res = await axios.post<{ data: LlmProvider }>(
    `${ADMIN_BASE}/providers`,
    input,
    { headers: authHeader() },
  );
  return res.data.data;
}

export async function deleteProvider(id: string): Promise<void> {
  await axios.delete(`${ADMIN_BASE}/providers/${id}`, {
    headers: authHeader(),
  });
}

export async function addModel(
  providerId: string,
  input: {
    modelId: string;
    displayName: string;
    contextWindow: number;
    capabilities?: Record<string, unknown>;
  },
): Promise<LlmProviderModel> {
  const res = await axios.post<{ data: LlmProviderModel }>(
    `${ADMIN_BASE}/providers/${providerId}/models`,
    input,
    { headers: authHeader() },
  );
  return res.data.data;
}

export async function listBindings(tenantId: string): Promise<TenantLlmBinding[]> {
  const res = await axios.get<{ data: TenantLlmBinding[] }>(
    `${TENANT_BASE}/bindings`,
    {
      headers: authHeader(),
      params: { tenantId },
    },
  );
  return res.data.data ?? [];
}

export async function createBinding(input: {
  tenantId: string;
  providerId: string;
  modelId: string;
  priority?: number;
  requestsPerMinuteCap?: number;
}): Promise<TenantLlmBinding> {
  const res = await axios.post<{ data: TenantLlmBinding }>(
    `${TENANT_BASE}/bindings`,
    input,
    { headers: authHeader() },
  );
  return res.data.data;
}

export async function disableBinding(id: string): Promise<TenantLlmBinding> {
  const res = await axios.post<{ data: TenantLlmBinding }>(
    `${TENANT_BASE}/bindings/${id}/disable`,
    {},
    { headers: authHeader() },
  );
  return res.data.data;
}

export async function rotateBinding(id: string): Promise<TenantLlmBinding> {
  const res = await axios.post<{ data: TenantLlmBinding }>(
    `${TENANT_BASE}/bindings/${id}/rotate`,
    {},
    { headers: authHeader() },
  );
  return res.data.data;
}
