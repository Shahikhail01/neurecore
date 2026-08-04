/**
 * Compliance — Frontend Service.
 */

import axios from 'axios';

const BASE = '/api/v1/compliance/posture';

function authHeader(): { Authorization?: string } {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('admin_accessToken') ||
    window.localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type PostureStatus = 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'UNKNOWN';

export interface StandardPosture {
  standardId: string;
  displayName: string;
  shortName: string;
  status: PostureStatus;
  score: number;
  evaluatedAt: string;
  evidenceCount: number;
  failingControls: number;
  passingControls: number;
  notes: string[];
}

export interface PostureReport {
  tenantId: string;
  generatedAt: string;
  standards: StandardPosture[];
  summary: {
    compliant: number;
    partial: number;
    nonCompliant: number;
    unknown: number;
    overallScore: number;
  };
}

export async function fetchReport(tenantId?: string): Promise<PostureReport> {
  const res = await axios.get<{ data: PostureReport }>(`${BASE}/report`, {
    headers: authHeader(),
    params: tenantId ? { tenantId } : {},
  });
  return res.data.data;
}

export async function listStandards(): Promise<unknown[]> {
  const res = await axios.get<{ data: unknown[] }>(`${BASE}/standards`, {
    headers: authHeader(),
  });
  return res.data.data;
}
