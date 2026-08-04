/**
 * DSR — Frontend Service.
 */

import axios from 'axios';

const BASE = '/api/v1/dsr';

function authHeader(): { Authorization?: string } {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('admin_accessToken') ||
    window.localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type DsrRequestType =
  | 'EXPORT'
  | 'DELETE'
  | 'RESTRICT'
  | 'RECTIFY'
  | 'PORTABILITY';

export type DsrRequestStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export interface DsrRequest {
  id: string;
  tenantId: string;
  type: DsrRequestType;
  status: DsrRequestStatus;
  subjectId: string;
  subjectKind: string;
  requesterId: string;
  reason: string | null;
  resolution: Record<string, unknown>;
  openedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export async function listRequests(args: {
  status?: DsrRequestStatus;
  type?: DsrRequestType;
} = {}): Promise<DsrRequest[]> {
  const res = await axios.get<{ data: DsrRequest[] }>(`${BASE}/requests`, {
    headers: authHeader(),
    params: args,
  });
  return res.data.data ?? [];
}

export async function openRequest(input: {
  type: DsrRequestType;
  subjectId: string;
  subjectKind?: string;
  reason?: string;
}): Promise<DsrRequest> {
  const res = await axios.post<{ data: DsrRequest }>(`${BASE}/requests`, input, {
    headers: authHeader(),
  });
  return res.data.data;
}

export async function startRequest(id: string): Promise<DsrRequest> {
  const res = await axios.post<{ data: DsrRequest }>(
    `${BASE}/requests/${id}/start`,
    {},
    { headers: authHeader() },
  );
  return res.data.data;
}

export async function completeRequest(
  id: string,
  resolution: Record<string, unknown>,
  reason?: string,
): Promise<DsrRequest> {
  const res = await axios.post<{ data: DsrRequest }>(
    `${BASE}/requests/${id}/complete`,
    { resolution, reason },
    { headers: authHeader() },
  );
  return res.data.data;
}

export async function rejectRequest(
  id: string,
  reason: string,
): Promise<DsrRequest> {
  const res = await axios.post<{ data: DsrRequest }>(
    `${BASE}/requests/${id}/reject`,
    { reason },
    { headers: authHeader() },
  );
  return res.data.data;
}

export async function cancelRequest(
  id: string,
  reason?: string,
): Promise<DsrRequest> {
  const res = await axios.post<{ data: DsrRequest }>(
    `${BASE}/requests/${id}/cancel`,
    { reason },
    { headers: authHeader() },
  );
  return res.data.data;
}
