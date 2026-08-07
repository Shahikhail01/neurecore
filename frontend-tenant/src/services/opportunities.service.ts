import { dealsService } from './deals.service';
import type { Deal, ListDealsOptions } from '@/types/deals.types';

/**
 * Phase 10.6 R1 — Opportunities = same data shape as Deals, exposed as a
 * distinct rail entry. The backend has a single `/deals` endpoint; we
 * mirror it under `/opportunities` so future divergence (qualification
 * metadata, separate stage enum) doesn't require a route rewrite. The
 * service interface stays 5-method per the design contract.
 */

export type Opportunity = Deal;

export type ListOpportunitiesOptions = ListDealsOptions;

export const opportunitiesService = {
  list: async (opts: ListOpportunitiesOptions = {}) => dealsService.list(opts),
  get: async (id: string): Promise<Opportunity | null> => dealsService.get(id),
  create: async (payload: Parameters<typeof dealsService.create>[0]): Promise<Opportunity> =>
    dealsService.create({ ...payload, stage: payload.stage ?? 'QUALIFIED' }),
  update: async (id: string, payload: Parameters<typeof dealsService.update>[1]): Promise<Opportunity> =>
    dealsService.update(id, payload),
  archive: async (id: string): Promise<void> => dealsService.archive(id),
};