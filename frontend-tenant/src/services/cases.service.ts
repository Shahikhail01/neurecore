import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export interface Case {
  id: string;
  caseNumber: string;
  beneficiaryId?: string | null;
  openedAt: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  assignedAgent?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCasePayload {
  caseNumber: string;
  beneficiaryId?: string;
  openedAt: string;
  status?: Case['status'];
  assignedAgent?: string;
}

export interface UpdateCasePayload {
  caseNumber?: string;
  beneficiaryId?: string;
  openedAt?: string;
  status?: Case['status'];
  assignedAgent?: string;
}

export interface ListCasesOptions {
  q?: string;
  status?: Case['status'];
  page?: number;
  limit?: number;
}

export const casesService = {
  list: async (opts: ListCasesOptions = {}) => {
    const res = await api.get('/cases', { params: opts });
    const { items, total } = unwrapList(res);
    return { items: items as Case[], total: total ?? items.length };
  },
  get: async (id: string): Promise<Case | null> => {
    const res = await api.get(`/cases/${id}`);
    return unwrapItem(res) as Case | null;
  },
  create: async (payload: CreateCasePayload): Promise<Case> => {
    const res = await api.post('/cases', payload);
    return unwrapItem(res) as Case;
  },
  update: async (id: string, payload: UpdateCasePayload): Promise<Case> => {
    const res = await api.patch(`/cases/${id}`, payload);
    return unwrapItem(res) as Case;
  },
  archive: async (id: string): Promise<void> => {
    await api.delete(`/cases/${id}`);
  },
};