// ─── accounting.service.ts — Client for the accounting capability ───────────
//
// Plan ref: NC-ACCT-IMP-1 §7 (nc.* tools) and §8 (UI surface).
//
// All calls hit /api/v1/accounting/* (NestJS adapter → accounting-sidecar
// via HMAC-scoped bearer token). The NestJS adapter injects the HMAC
// token transparently; the tenant frontend only sees standard JWT auth.
//
// Pattern mirrors finance.service.ts and the other tenant services.

import { authHttpClient as api } from '@/auth/transport/authHttpClient';
import type { ApiResponse } from '@/types/api.types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';
export type PeriodStatus = 'OPEN' | 'CLOSING' | 'CLOSED' | 'LOCKED';
export type PostingType = 'DEBIT' | 'CREDIT';
export type FindingSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type FindingStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'WAIVED';

export interface ChartOfAccount {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentId: string | null;
  currency: string;
  isLeaf: boolean;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingPeriod {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  fiscalYear: number;
  closedAt: string | null;
  closedById: string | null;
  lockedAt: string | null;
  lockedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Posting {
  id: string;
  tenantId: string;
  journalEntryId: string;
  accountId: string;
  account?: ChartOfAccount;
  amount: string;            // Decimal as string (Postgres precision)
  currency: string;
  fxRate?: string | null;
  baseCurrency?: string | null;
  baseAmount?: string | null;
  postingType: PostingType;
  counterparty?: string | null;
  narration?: string | null;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  tenantId: string;
  periodId: string;
  txnId: string;
  txnDate: string;
  narration: string;
  source: string;
  postingUserId: string;
  approvalId: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  totalDebit: string;
  totalCredit: string;
  baseCurrency: string;
  createdAt: string;
  updatedAt: string;
  postings?: Posting[];
}

export interface AuditFinding {
  id: string;
  tenantId: string;
  scenarioId?: string | null;
  simulationRunId?: string | null;
  severity: FindingSeverity;
  category: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation?: string | null;
  status: FindingStatus;
  resolvedAt?: string | null;
  resolvedById?: string | null;
  resolvedNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComputeResult<T> {
  success: boolean;
  data?: T;
}

export interface NpvResult {
  computationId: string;
  npv: number;
  converged: boolean;
}

export interface IrrResult {
  computationId: string;
  irr: number | null;
  converged: boolean;
}

export interface ValidateResult {
  validated: boolean;
  beancountChunk: string;
  issues: string[];
}

// ─── COA ────────────────────────────────────────────────────────────────────

export const accountingService = {
  async listAccounts(opts?: { type?: AccountType; isActive?: boolean }) {
    const params = new URLSearchParams();
    if (opts?.type) params.set('type', opts.type);
    if (opts?.isActive !== undefined) params.set('isActive', String(opts.isActive));
    const qs = params.toString();
    const r = await api.get<ApiResponse<ChartOfAccount[]>>(
      `/accounting/accounts${qs ? `?${qs}` : ''}`,
    );
    return r.data.data ?? [];
  },

  async getAccountByCode(code: string) {
    const r = await api.get<ApiResponse<ChartOfAccount>>(
      `/accounting/accounts/by-code/${encodeURIComponent(code)}`,
    );
    return r.data.data;
  },

  async getAccountBalance(code: string, asOf?: Date) {
    const params = asOf ? `?asOf=${asOf.toISOString()}` : '';
    const r = await api.get<ApiResponse<{ balance: string; currency: string }>>(
      `/accounting/accounts/${encodeURIComponent(code)}/balance${params}`,
    );
    return r.data.data;
  },

  // ─── Compute (TIER-1, no approval needed) ──────────────────────────────

  async computeNpv(rate: number, cashflows: number[]): Promise<NpvResult> {
    const r = await api.post<ApiResponse<NpvResult>>('/accounting/compute/npv', {
      rate, cashflows,
    });
    if (!r.data.data) throw new Error('Empty response from /accounting/compute/npv');
    return r.data.data;
  },

  async computeIrr(cashflows: number[]): Promise<IrrResult> {
    const r = await api.post<ApiResponse<IrrResult>>('/accounting/compute/irr', {
      cashflows,
    });
    if (!r.data.data) throw new Error('Empty response from /accounting/compute/irr');
    return r.data.data;
  },

  async validatePostings(postings: Array<{ accountCode: string; amount: string; currency: string }>): Promise<ValidateResult> {
    const r = await api.post<ApiResponse<ValidateResult>>(
      '/accounting/ledger/validate',
      { postings },
    );
    if (!r.data.data) throw new Error('Empty response from /accounting/ledger/validate');
    return r.data.data;
  },

  // ─── Periods ────────────────────────────────────────────────────────────

  async listPeriods(opts?: { fiscalYear?: number; status?: PeriodStatus }) {
    const params = new URLSearchParams();
    if (opts?.fiscalYear) params.set('fiscalYear', String(opts.fiscalYear));
    if (opts?.status) params.set('status', opts.status);
    const qs = params.toString();
    const r = await api.get<ApiResponse<AccountingPeriod[]>>(
      `/accounting/periods${qs ? `?${qs}` : ''}`,
    );
    return r.data.data ?? [];
  },

  // ─── Ledger ─────────────────────────────────────────────────────────────

  async listJournalEntries(opts?: { periodId?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (opts?.periodId) params.set('periodId', opts.periodId);
    if (opts?.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    const r = await api.get<ApiResponse<JournalEntry[]>>(
      `/accounting/ledger/postings${qs ? `?${qs}` : ''}`,
    );
    return r.data.data ?? [];
  },

  async exportBeancount(asOf?: Date): Promise<Blob> {
    const url = asOf
      ? `/accounting/ledger/export.beancount?asOf=${asOf.toISOString()}`
      : '/accounting/ledger/export.beancount';
    const r = await api.get<Blob>(url, { responseType: 'blob' });
    return r.data;
  },

  async generateReport(
    type: 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW',
    asOf?: Date,
  ): Promise<unknown> {
    const r = await api.post<ApiResponse<unknown>>(
      `/accounting/reports/${type === 'BALANCE_SHEET' ? 'balance-sheet' : type === 'INCOME_STATEMENT' ? 'income-statement' : 'cash-flow'}`,
      asOf ? { asOf: asOf.toISOString() } : {},
    );
    return r.data.data ?? null;
  },
};

export type AccountingService = typeof accountingService;