/**
 * Governance — Frontend Service.
 */

import axios from 'axios';

const BASE = '/api/v1/governance';

function authHeader(): { Authorization?: string } {
  if (typeof window === 'undefined') return {};
  const token = window.localStorage.getItem('admin_accessToken') ||
    window.localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface GovernanceDomainSummary {
  domain: string;
  displayName: string;
  total: number;
  passing: number;
  failing: number;
}

export async function seed(): Promise<{ created: number }> {
  const res = await axios.post<{ data: { created: number } }>(
    `${BASE}/seed`,
    {},
    { headers: authHeader() },
  );
  return res.data.data;
}

export async function fetchDomains(): Promise<GovernanceDomainSummary[]> {
  const res = await axios.get<{ data: GovernanceDomainSummary[] }>(
    `${BASE}/domains`,
    { headers: authHeader() },
  );
  return res.data.data;
}
