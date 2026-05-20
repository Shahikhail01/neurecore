import api from "./api";
import { unwrapItem } from "./unwrap";

export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export interface Invoice {
  id: string;
  tenantId?: string;
  number: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: string | number;
  taxAmount: string | number;
  total: string | number;
  createdAt: string;
  issuedAt?: string | null;
  paidAt?: string | null;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class FinanceService {
  async listInvoices(params?: {
    tenantId?: string;
    scope?: "platform";
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<Invoice>> {
    const res = await api.get("/finance/invoices", { params });
    return unwrapItem(res) as PaginatedResult<Invoice>;
  }

  async issueInvoice(id: string, tenantId?: string): Promise<Invoice> {
    const res = await api.post(`/finance/invoices/${id}/issue`, null, {
      params: tenantId ? { tenantId } : undefined,
    });
    return unwrapItem(res) as Invoice;
  }

  async markPaid(id: string, tenantId?: string): Promise<Invoice> {
    const res = await api.post(`/finance/invoices/${id}/paid`, null, {
      params: tenantId ? { tenantId } : undefined,
    });
    return unwrapItem(res) as Invoice;
  }

  async cancelInvoice(id: string, tenantId?: string): Promise<Invoice> {
    const res = await api.post(`/finance/invoices/${id}/cancel`, null, {
      params: tenantId ? { tenantId } : undefined,
    });
    return unwrapItem(res) as Invoice;
  }
}

export const financeService = new FinanceService();
