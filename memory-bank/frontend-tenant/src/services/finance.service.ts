import api from './api';
import { unwrapItem } from './unwrap';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  currency: string;
  total: string | number;
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class FinanceService {
  async listInvoices(params?: { page?: number; limit?: number }): Promise<PaginatedResult<Invoice>> {
    const res = await api.get('/finance/invoices', { params });
    return unwrapItem(res) as PaginatedResult<Invoice>;
  }

  async listBillingEvents(params?: { page?: number; limit?: number }) {
    const res = await api.get('/finance/billing-events', { params });
    return unwrapItem(res);
  }
}

export const financeService = new FinanceService();
