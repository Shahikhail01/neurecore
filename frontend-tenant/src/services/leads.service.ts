import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export interface Lead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status?: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'DISQUALIFIED';
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadPayload {
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: Lead['status'];
}

export interface UpdateLeadPayload {
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: Lead['status'];
}

export interface ListLeadsOptions {
  q?: string;
  status?: Lead['status'];
  page?: number;
  limit?: number;
}

export const leadsService = {
  list: async (opts: ListLeadsOptions = {}) => {
    const res = await api.get('/leads', { params: opts });
    const { items, total } = unwrapList(res);
    return { items: items as Lead[], total: total ?? items.length };
  },
  get: async (id: string): Promise<Lead | null> => {
    const res = await api.get(`/leads/${id}`);
    return unwrapItem(res) as Lead | null;
  },
  create: async (payload: CreateLeadPayload): Promise<Lead> => {
    const res = await api.post('/leads', payload);
    return unwrapItem(res) as Lead;
  },
  update: async (id: string, payload: UpdateLeadPayload): Promise<Lead> => {
    const res = await api.patch(`/leads/${id}`, payload);
    return unwrapItem(res) as Lead;
  },
  archive: async (id: string): Promise<void> => {
    await api.delete(`/leads/${id}`);
  },
};