/**
 * AI Twin — Frontend service.
 *
 * Mirrors the backend API surface. One service per backend controller
 * keeps the SOLID mapping explicit.
 *
 * Solid:
 *   • SRP — only HTTP calls to the AI Twin controller.
 *   • OCP — adding a new endpoint is a new method.
 */

import axios from 'axios';
import { tokenManager } from '@/core/infrastructure/auth/TokenManager';

function authHeaders(): Record<string, string> {
  const token = tokenManager.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const BASE = '/api/v1/ai-twin';

export type TwinStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface AiTwin {
  id: string;
  tenantId: string;
  ownerUserId: string;
  slug: string;
  displayName: string;
  description: string | null;
  status: TwinStatus;
  wizardStep: number;
  step1Goal: unknown;
  step2Iteration: unknown;
  step3Test: unknown;
  step4Deploy: unknown;
  agentTemplateId: string | null;
  agentTemplateVersionId: string | null;
  allowedReadScopes: string[];
  allowedWriteScopes: string[];
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  archivedAt: string | null;
}

export interface AiTwinAudit {
  id: string;
  tenantId: string;
  twinId: string;
  actorUserId: string;
  action: string;
  outcome: string;
  envelope: { intent?: string; occurredAt?: string; reason?: string };
  reason: string | null;
  occurredAt: string;
}

export interface CreateTwinInput {
  slug: string;
  displayName: string;
  description?: string;
  step1Goal: Record<string, unknown>;
}

export interface AdvanceWizardInput {
  payload: Record<string, unknown>;
  read?: string[];
  write?: string[];
}

export interface DeployInput {
  agentTemplateId: string;
  agentTemplateVersionId: string;
}

export async function listTwins(): Promise<AiTwin[]> {
  const res = await axios.get<{ data: AiTwin[] }>(`${BASE}/twins`, {
    headers: authHeaders(),
  });
  return res.data.data ?? [];
}

export async function findTwin(id: string): Promise<AiTwin> {
  const res = await axios.get<{ data: AiTwin }>(`${BASE}/twins/${id}`, {
    headers: authHeaders(),
  });
  return res.data.data;
}

export async function listAudits(id: string): Promise<AiTwinAudit[]> {
  const res = await axios.get<{ data: AiTwinAudit[] }>(
    `${BASE}/twins/${id}/audits`,
    { headers: authHeaders() },
  );
  return res.data.data ?? [];
}

export async function createTwin(input: CreateTwinInput): Promise<AiTwin> {
  const res = await axios.post<{ data: AiTwin }>(`${BASE}/twins`, input, {
    headers: authHeaders(),
  });
  return res.data.data;
}

export async function advanceStep(
  id: string,
  step: 1 | 2 | 3 | 4,
  input: AdvanceWizardInput,
): Promise<AiTwin> {
  const res = await axios.post<{ data: AiTwin }>(
    `${BASE}/twins/${id}/wizard/step${step}`,
    input,
    { headers: authHeaders() },
  );
  return res.data.data;
}

export async function deploy(id: string, input: DeployInput): Promise<AiTwin> {
  const res = await axios.post<{ data: AiTwin }>(
    `${BASE}/twins/${id}/deploy`,
    input,
    { headers: authHeaders() },
  );
  return res.data.data;
}

export async function pause(id: string): Promise<AiTwin> {
  const res = await axios.post<{ data: AiTwin }>(
    `${BASE}/twins/${id}/pause`,
    {},
    { headers: authHeaders() },
  );
  return res.data.data;
}

export async function resume(id: string): Promise<AiTwin> {
  const res = await axios.post<{ data: AiTwin }>(
    `${BASE}/twins/${id}/resume`,
    {},
    { headers: authHeaders() },
  );
  return res.data.data;
}

export async function archive(id: string): Promise<AiTwin> {
  const res = await axios.post<{ data: AiTwin }>(
    `${BASE}/twins/${id}/archive`,
    {},
    { headers: authHeaders() },
  );
  return res.data.data;
}
