import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export interface EmailMessage {
  id: string;
  threadId?: string | null;
  direction?: 'INBOUND' | 'OUTBOUND';
  from?: string;
  to?: string[];
  subject?: string;
  body?: string;
  status?: 'DRAFT' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'BOUNCED' | 'REPLIED';
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailPayload {
  threadId?: string;
  direction?: EmailMessage['direction'];
  from?: string;
  to?: string[];
  subject?: string;
  body?: string;
  status?: EmailMessage['status'];
}

export interface UpdateEmailPayload {
  subject?: string;
  body?: string;
  status?: EmailMessage['status'];
}

export interface ListEmailsOptions {
  q?: string;
  threadId?: string;
  status?: EmailMessage['status'];
  page?: number;
  limit?: number;
}

export const emailsService = {
  list: async (opts: ListEmailsOptions = {}) => {
    const res = await api.get('/emails', { params: opts });
    const { items, total } = unwrapList(res);
    return { items: items as EmailMessage[], total: total ?? items.length };
  },
  get: async (id: string): Promise<EmailMessage | null> => {
    const res = await api.get(`/emails/${id}`);
    return unwrapItem(res) as EmailMessage | null;
  },
  create: async (payload: CreateEmailPayload): Promise<EmailMessage> => {
    const res = await api.post('/emails', payload);
    return unwrapItem(res) as EmailMessage;
  },
  update: async (id: string, payload: UpdateEmailPayload): Promise<EmailMessage> => {
    const res = await api.patch(`/emails/${id}`, payload);
    return unwrapItem(res) as EmailMessage;
  },
  archive: async (id: string): Promise<void> => {
    await api.delete(`/emails/${id}`);
  },
};