import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Invoice {
  id: string;
  number?: string;
  status: InvoiceStatus;
  currency?: string;
  total?: string | number;
  amountCents?: number;
  issuedAt?: string;
  dueDate?: string;
  createdAt?: string;
}

export interface Expense {
  id: string;
  description?: string;
  category?: string;
  vendor?: string;
  amountCents?: number;
  date?: string;
  createdAt?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface CostSummary {
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: Record<string, number>;
  recordCount: number;
}

class FinanceService {
  async listInvoices(params?: { page?: number; limit?: number }): Promise<PaginatedResult<Invoice>> {
    const res = await api.get('/finance/invoices', { params });
    return unwrapList(res) as PaginatedResult<Invoice>;
  }

  async listExpenses(params?: { page?: number; limit?: number }): Promise<PaginatedResult<Expense>> {
    const res = await api.get('/finance/expenses', { params });
    return unwrapList(res) as PaginatedResult<Expense>;
  }

  async listBillingEvents(params?: { page?: number; limit?: number }) {
    const res = await api.get('/finance/billing-events', { params });
    return unwrapItem(res);
  }

  async getCostSummary(): Promise<CostSummary | null> {
    const res = await api.get('/costs/summary');
    return res?.data?.data ?? res?.data ?? null;
  }

  async getBudgets(): Promise<Record<string, unknown>[]> {
    const res = await api.get('/costs/budgets');
    const data = res?.data?.data ?? res?.data ?? null;
    return Array.isArray(data) ? data : [];
  }

  async getCostIncidents(): Promise<{ id: string; acknowledged?: boolean; [key: string]: unknown }[]> {
    const res = await api.get('/costs/incidents');
    const data = res?.data?.data ?? res?.data ?? null;
    return Array.isArray(data) ? data : [];
  }
}

export const financeService = new FinanceService();
