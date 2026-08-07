import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export interface Quote {
  id: string;
  dealId?: string | null;
  customerId?: string | null;
  number?: string;
  status?: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  amount?: string;
  currency?: string;
  validUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotePayload {
  dealId?: string;
  customerId?: string;
  number?: string;
  status?: Quote['status'];
  amount?: number;
  currency?: string;
  validUntil?: string;
}

export interface UpdateQuotePayload {
  dealId?: string;
  customerId?: string;
  number?: string;
  status?: Quote['status'];
  amount?: number;
  currency?: string;
  validUntil?: string;
}

export interface ListQuotesOptions {
  q?: string;
  status?: Quote['status'];
  dealId?: string;
  page?: number;
  limit?: number;
}

export const quotesService = {
  list: async (opts: ListQuotesOptions = {}) => {
    const res = await api.get('/quotes', { params: opts });
    const { items, total } = unwrapList(res);
    return { items: items as Quote[], total: total ?? items.length };
  },
  get: async (id: string): Promise<Quote | null> => {
    const res = await api.get(`/quotes/${id}`);
    return unwrapItem(res) as Quote | null;
  },
  create: async (payload: CreateQuotePayload): Promise<Quote> => {
    const res = await api.post('/quotes', payload);
    return unwrapItem(res) as Quote;
  },
  update: async (id: string, payload: UpdateQuotePayload): Promise<Quote> => {
    const res = await api.patch(`/quotes/${id}`, payload);
    return unwrapItem(res) as Quote;
  },
  archive: async (id: string): Promise<void> => {
    await api.delete(`/quotes/${id}`);
  },
};