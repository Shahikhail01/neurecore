// services/tenants.service.ts — Thin wrapper around /tenants/* endpoints.
// Frontend callers depend on this service, not on raw axios.

import api from './api';

export interface TenantSelf {
  id: string;
  name: string;
  slug: string;
  status: string;
  tierId: string;
  tier?: { slug: string; name: string } | null;
  logoUrl: string | null;
  website: string | null;
  industry: string | null;
  // INDUSTRY-GROUPS-CONCEPT.md §5 — denormalised for fast icon-rail branching
  industryGroup: string | null;
  // WS-2.1: PR-1 additive nullable fields
  locale: string | null;
  timezone: string | null;
  currency: string | null;
  dateFormat: string | null;
  timeFormat: string | null;
  fiscalYearStart: string | null;
  sizeBucket: string | null;
  foundedYear: number | null;
  businessType: string | null;
  phone: string | null;
  supportEmail: string | null;
  addressJson: Record<string, string> | null;
  billingProfileJson: Record<string, unknown> | null;
  defaultsJson: Record<string, unknown> | null;
  checklistDismissedAt: string | null;
  onboardingCompletedAt: string | null;
  onboardingStep: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdateMyTenantPayload = Partial<
  Pick<
    TenantSelf,
    | 'name'
    | 'website'
    | 'industry'
    | 'sizeBucket'
    | 'foundedYear'
    | 'businessType'
    | 'phone'
    | 'supportEmail'
    | 'locale'
    | 'timezone'
    | 'currency'
    | 'dateFormat'
    | 'timeFormat'
    | 'fiscalYearStart'
    | 'addressJson'
    | 'billingProfileJson'
    | 'defaultsJson'
    | 'logoUrl'
  >
>;

export const tenantsService = {
  async getCurrent(): Promise<TenantSelf> {
    const res = await api.get('/tenants/me/current');
    return res.data?.data ?? res.data;
  },

  async updateMine(payload: UpdateMyTenantPayload): Promise<TenantSelf> {
    const res = await api.patch('/tenants/me', payload);
    return res.data?.data ?? res.data;
  },
};