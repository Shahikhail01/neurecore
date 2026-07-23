import api from './api';
import type { IndustryOption as PickerIndustryOption } from '@/components/onboarding/IndustryGroupPicker';

export type IndustryOption = PickerIndustryOption;

export interface IndustryGroup {
  slug: string;
  label: string;
  icon: string;
  sortOrder: number;
  description: string;
  industries?: IndustryOption[];
}

export interface CapabilityResponse {
  industry: { slug: string; name: string; industryGroup: string };
  tier: 'basic' | 'business' | 'professional' | 'enterprise';
  capabilities: {
    maxAgents: number;
    maxDepartments: number;
    maxStorageGB: number;
    maxApprovalStages: number;
    activeAgentSlugs: string[];
    packageTiersAvailable: string[];
    projectTypesVisible: string[];
    integrationsAvailable: string[];
    featureFlags: string[];
    description: string;
  };
}

/**
 * industriesService — client for `/api/v1/industries/...` public endpoints.
 *
 * SRP: only industry-group / capability lookups used by onboarding +
 * the Plan Impact panel. The /tiers/:id endpoint (tenant's resolved
 * capabilities) lives in tiers.service.ts.
 */
export const industriesService = {
  async listGroups(): Promise<IndustryGroup[]> {
    const res = await api.get('/industries/groups');
    return (res.data?.data ?? res.data ?? []) as IndustryGroup[];
  },

  /**
   * Fetch every industry across every group, normalised to IndustryOption[].
   * Walks `GET /industries/by-group/:slug` for each group returned by
   * `listGroups()` so the consumer gets full Industry objects (name, icon,
   * description) instead of just slug strings. The bare `GET /industries/groups`
   * endpoint only returns `{slug, label, industrySlugs: string[]}`; that
   * shape is unsuitable for pickers that need the industry's name + icon.
   */
  async listAllIndustries(): Promise<IndustryOption[]> {
    const groups = await this.listGroups();
    const lists = await Promise.all(
      groups.map(async (group) => {
        try {
          const response = await api.get(
            `/industries/by-group/${encodeURIComponent(group.slug)}`,
          );
          const raw = (response.data?.data ?? []) as ReadonlyArray<{
            slug: string;
            name: string;
            icon?: string | null;
            description?: string | null;
          }>;
          return raw.map<IndustryOption>((ind) => ({
            slug: ind.slug,
            name: ind.name,
            icon: ind.icon ?? null,
            industryGroup: group.slug,
            groupSortOrder: group.sortOrder,
          }));
        } catch {
          return [];
        }
      }),
    );
    return lists.flat();
  },

  async getCapabilities(
    industrySlug: string,
    tierSlug: string,
  ): Promise<CapabilityResponse | null> {
    if (!industrySlug || !tierSlug) return null;
    const res = await api.get(
      `/industries/${encodeURIComponent(industrySlug)}/capabilities`,
      { params: { tier: tierSlug } },
    );
    return (res.data?.data ?? res.data ?? null) as CapabilityResponse | null;
  },
};
