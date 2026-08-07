import api from './api';
import { unwrapItem, unwrapList } from './unwrap';
import type {
  CreateDealPayload,
  Deal,
  DealStage,
  ListDealsOptions,
  UpdateDealPayload,
} from '@/types/deals.types';

export const dealsService = {
  list: async (opts: ListDealsOptions = {}) => {
    const res = await api.get('/deals', { params: opts });
    const { items, total } = unwrapList(res);
    return { items: items as Deal[], total: total ?? items.length };
  },

  get: async (id: string): Promise<Deal | null> => {
    const res = await api.get(`/deals/${id}`);
    return unwrapItem(res) as Deal | null;
  },

  create: async (payload: CreateDealPayload): Promise<Deal> => {
    const res = await api.post('/deals', payload);
    return unwrapItem(res) as Deal;
  },

  update: async (id: string, payload: UpdateDealPayload): Promise<Deal> => {
    const res = await api.patch(`/deals/${id}`, payload);
    return unwrapItem(res) as Deal;
  },

  /**
   * Archive = soft-delete. Backend uses DELETE /deals/:id which soft-deletes
   * and emits an audit log entry.
   */
  archive: async (id: string): Promise<void> => {
    await api.delete(`/deals/${id}`);
  },

  /**
   * State-machine transition. Backend enforces
   * LEAD → QUALIFIED → PROPOSAL → NEGOTIATION → WON; any → LOST.
   */
  transition: async (id: string, toStage: DealStage, reason?: string): Promise<Deal> => {
    const res = await api.post(`/deals/${id}/transitions`, { toStage, reason });
    return unwrapItem(res) as Deal;
  },
};