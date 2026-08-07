import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export interface Campaign {
  id: string;
  name: string;
  channel: 'EMAIL' | 'SOCIAL' | 'PAID' | 'OFFLINE';
  budget: number;
  targetAudience?: string | null;
  status: 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'ENDED';
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignPayload {
  name: string;
  channel: Campaign['channel'];
  budget: number;
  targetAudience?: string;
  status?: Campaign['status'];
}

export interface UpdateCampaignPayload {
  name?: string;
  channel?: Campaign['channel'];
  budget?: number;
  targetAudience?: string;
  status?: Campaign['status'];
}

export interface ListCampaignsOptions {
  q?: string;
  channel?: Campaign['channel'];
  status?: Campaign['status'];
  page?: number;
  limit?: number;
}

export const campaignsService = {
  list: async (opts: ListCampaignsOptions = {}) => {
    const res = await api.get('/campaigns', { params: opts });
    const { items, total } = unwrapList(res);
    return { items: items as Campaign[], total: total ?? items.length };
  },
  get: async (id: string): Promise<Campaign | null> => {
    const res = await api.get(`/campaigns/${id}`);
    return unwrapItem(res) as Campaign | null;
  },
  create: async (payload: CreateCampaignPayload): Promise<Campaign> => {
    const res = await api.post('/campaigns', payload);
    return unwrapItem(res) as Campaign;
  },
  update: async (id: string, payload: UpdateCampaignPayload): Promise<Campaign> => {
    const res = await api.patch(`/campaigns/${id}`, payload);
    return unwrapItem(res) as Campaign;
  },
  archive: async (id: string): Promise<void> => {
    await api.delete(`/campaigns/${id}`);
  },
};