/**
 * tiersPool.service.ts — Frontend service for the canonical Tier pool.
 *
 * TIER-SYSTEM-CONCEPT.md Phase 3: Tier is the single source of truth.
 * The legacy TierTemplate pool was removed; this service targets the
 * new /api/v1/tiers endpoint (Tier model in Prisma).
 */

import api from '@/services/api';
import { unwrapItem, unwrapList } from '@/services/unwrap';
import type {
  IPoolAdminService,
  PoolListOptions,
  PoolPage,
} from '@/lib/pool/IPoolAdminService';

/**
 * Tier — mirrors the backend Prisma model (Tier).
 * Fields match `backend/src/modules/tiers/dto/tier.dto.ts` + Prisma schema.
 */
export interface Tier {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  description?: string | null;
  icon?: string | null;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  // Pricing
  monthlyPrice: number | string;
  yearlyPrice: number | string;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  // Trial
  trialDays: number | null;
  // Limits
  maxUsers: number;
  maxAgents: number;
  maxDepartments: number;
  maxStorageGB: number;
  maxApiCalls: number;
  maxConversationMessages: number;
  maxFileSizeMB: number;
  maxApprovalStages: number;
  // Feature flags
  allowCustomBranding: boolean;
  allowApiAccess: boolean;
  allowSso: boolean;
  allowAuditExport: boolean;
  allowWhiteLabel: boolean;
  allowPredictiveAnalytics: boolean;
  allowCustomDashboards: boolean;
  allowMultiOffice: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTierPayload {
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  icon?: string;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  monthlyPrice?: number;
  yearlyPrice?: number;
  currency?: string;
  billingCycle?: 'monthly' | 'yearly';
  trialDays?: number;
  maxUsers?: number;
  maxAgents?: number;
  maxDepartments?: number;
  maxStorageGB?: number;
  maxApiCalls?: number;
  maxConversationMessages?: number;
  maxFileSizeMB?: number;
  maxApprovalStages?: number;
  allowCustomBranding?: boolean;
  allowApiAccess?: boolean;
  allowSso?: boolean;
  allowAuditExport?: boolean;
  allowWhiteLabel?: boolean;
  allowPredictiveAnalytics?: boolean;
  allowCustomDashboards?: boolean;
  allowMultiOffice?: boolean;
}

export const tiersPoolService: IPoolAdminService<Tier, CreateTierPayload, Partial<CreateTierPayload>> = {
  async list(opts: PoolListOptions = {}): Promise<PoolPage<Tier>> {
    const params: Record<string, unknown> = {};
    if (opts.page)    params.page  = opts.page;
    if (opts.limit)   params.limit = opts.limit;
    if (opts.search)  params.search = opts.search;
    if (opts.sortBy)  params.sortBy = opts.sortBy;
    if (opts.sortDir) params.sortDir = opts.sortDir;
    const res = await api.get('/tiers', { params });
    const list = unwrapList(res);
    return {
      items: (list.items ?? []) as Tier[],
      total: list.total ?? 0,
      page: list.page ?? opts.page ?? 1,
      limit: list.limit ?? opts.limit ?? 20,
      totalPages: list.totalPages ?? 1,
    };
  },

  async get(id: string): Promise<Tier> {
    const res = await api.get(`/tiers/${id}`);
    return unwrapItem(res) as Tier;
  },

  async getBySlug(slug: string): Promise<Tier> {
    const res = await api.get(`/tiers/slug/${slug}`);
    return unwrapItem(res) as Tier;
  },

  async create(payload: CreateTierPayload): Promise<Tier> {
    const res = await api.post('/tiers', payload);
    return unwrapItem(res) as Tier;
  },

  async update(id: string, payload: Partial<CreateTierPayload>): Promise<Tier> {
    const res = await api.patch(`/tiers/${id}`, payload);
    return unwrapItem(res) as Tier;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/tiers/${id}`);
  },
};
