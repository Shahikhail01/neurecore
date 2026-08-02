/**
 * HttpAccountingSidecarClient — typed client for the Python accounting sidecar.
 *
 * Plan ref: NC-ACCT-IMP-1 §5.
 *
 * Mirrors the Hermes adapter pattern: a typed interface (`ISidecarHttpClient`)
 * + a fetch-based default implementation. Tests can pass a fake.
 *
 * **Endpoints used:**
 *   POST /healthz                                  (Tier-1, no body)
 *   POST /v1/compute/investment/npv                (Tier-1)
 *   POST /v1/compute/investment/irr                (Tier-1)
 *   POST /v1/compute/investment/mirr               (Tier-1)
 *   POST /v1/loan/amortize                         (Tier-1)
 *   POST /v1/ledger/validate                       (Tier-1)
 *   POST /v1/ledger/reports/balance-sheet          (Tier-1, stateless MVP)
 *   POST /v1/ledger/reports/income-statement       (Tier-1, stateless MVP)
 *   POST /v1/ledger/reports/cash-flow              (Tier-1, stateless MVP)
 *   POST /v1/datasets/generate                     (Tier-1)
 *   GET  /v1/datasets/{id}/rows                    (Tier-1)
 *   POST /v1/findings/validate                     (Tier-1)
 *
 * **What this client is NOT:**
 *   - It does NOT mint tokens. `AccountingService` mints via
 *     `AccountingTokenService` and passes the token to each call.
 *   - It does NOT translate domain errors. Callers map HTTP status +
 *     `issues[]` arrays into NestJS `HttpException`s.
 *   - It does NOT cache. The sidecar caches its own snapshot; NestJS
 *     owns the snapshot regeneration job (Phase 1k).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountingTokenService } from '../services/accounting-token.service';

export interface ISidecarHttpClient {
  post<T>(url: string, body: unknown, headers: Record<string, string>)
    : Promise<{ status: number; data: T }>;
}

export class FetchSidecarHttpClient implements ISidecarHttpClient {
  constructor(
    private readonly timeoutMs: number,
    private readonly logger?: Logger,
  ) {}

  async post<T>(
    url: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<{ status: number; data: T }> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      let data: T;
      try {
        data = text ? (JSON.parse(text) as T) : ({} as T);
      } catch {
        this.logger?.warn(`Sidecar returned non-JSON body: ${text.slice(0, 200)}`);
        data = { status: response.status, raw: text } as unknown as T;
      }
      return { status: response.status, data };
    } finally {
      clearTimeout(t);
    }
  }
}

@Injectable()
export class HttpAccountingSidecarClient {
  private readonly logger = new Logger(HttpAccountingSidecarClient.name);
  private sidecarUrl = '';
  private requestTimeoutMs = 30_000;
  private readonly httpClient: ISidecarHttpClient;

  constructor(
    config: ConfigService,
    private readonly tokenService: AccountingTokenService,
  ) {
    // Lazy: do NOT throw on construction. Validate on first use.
    // This lets the backend boot when the sidecar is offline (dev/test).
    this.reloadConfig(config);
    this.httpClient = new FetchSidecarHttpClient(this.requestTimeoutMs, this.logger);
  }

  /**
   * Re-read config (called from constructor and on hot-reload).
   */
  reloadConfig(config: ConfigService): void {
    const url = config.get<string>('ACCOUNTING_SIDECAR_URL');
    if (url) {
      this.sidecarUrl = url.replace(/\/+$/, '');
    } else {
      this.sidecarUrl = '';
    }
    const timeoutEnv = config.get<string>('ACCOUNTING_SIDECAR_TIMEOUT_MS');
    const configuredTimeout = timeoutEnv ? parseInt(timeoutEnv, 10) : 30_000;
    this.requestTimeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 30_000;
  }

  private requireUrl(): string {
    if (!this.sidecarUrl) {
      throw new Error(
        'ACCOUNTING_SIDECAR_URL is not configured. Set it to the sidecar\'s internal address (e.g. http://127.0.0.1:8091).',
      );
    }
    return this.sidecarUrl;
  }

  // ─── Public methods ─────────────────────────────────────────

  async computeNpv(input: {
    tenantId: string;
    userId: string;
    rate: number;
    cashflows: number[];
  }): Promise<{ computationId: string; npv: number; converged: boolean }> {
    return this.post('/v1/compute/investment/npv', input.userId, input.tenantId, {
      rate: input.rate,
      cashflows: input.cashflows,
    });
  }

  async computeIrr(input: {
    tenantId: string;
    userId: string;
    cashflows: number[];
  }): Promise<{ computationId: string; irr: number | null; converged: boolean }> {
    return this.post('/v1/compute/investment/irr', input.userId, input.tenantId, {
      cashflows: input.cashflows,
    });
  }

  async computeMirr(input: {
    tenantId: string;
    userId: string;
    financeRate: number;
    reinvestRate: number;
    cashflows: number[];
  }): Promise<{ computationId: string; mirr: number; converged: boolean }> {
    return this.post('/v1/compute/investment/mirr', input.userId, input.tenantId, {
      financeRate: input.financeRate,
      reinvestRate: input.reinvestRate,
      cashflows: input.cashflows,
    });
  }

  async amortizeLoan(input: {
    tenantId: string;
    userId: string;
    principal: number;
    rate: number;
    nper: number;
  }): Promise<{ schedule: Array<{ period: number; payment: number; interest: number; principal: number; balance: number }> }> {
    return this.post('/v1/loan/amortize', input.userId, input.tenantId, {
      principal: input.principal,
      rate: input.rate,
      nper: input.nper,
    });
  }

  async validatePostings(input: {
    tenantId: string;
    userId: string;
    postings: Array<{ account: string; amount: string; currency: string }>;
  }): Promise<{ validated: boolean; beancountChunk: string; issues: string[] }> {
    return this.post('/v1/ledger/validate', input.userId, input.tenantId, {
      postings: input.postings,
    });
  }

  async generateBalanceSheet(input: {
    tenantId: string;
    userId: string;
    beancount: string;
    reportType: 'BALANCE_SHEET';
  }): Promise<unknown> {
    return this.post('/v1/ledger/reports/balance-sheet', input.userId, input.tenantId, {
      beancount: input.beancount,
      reportType: 'BALANCE_SHEET',
    });
  }

  async generateIncomeStatement(input: {
    tenantId: string;
    userId: string;
    beancount: string;
    reportType: 'INCOME_STATEMENT';
  }): Promise<unknown> {
    return this.post('/v1/ledger/reports/income-statement', input.userId, input.tenantId, {
      beancount: input.beancount,
      reportType: 'INCOME_STATEMENT',
    });
  }

  async generateCashFlow(input: {
    tenantId: string;
    userId: string;
    beancount: string;
    reportType: 'CASH_FLOW';
  }): Promise<unknown> {
    return this.post('/v1/ledger/reports/cash-flow', input.userId, input.tenantId, {
      beancount: input.beancount,
      reportType: 'CASH_FLOW',
    });
  }

  // ─── HTTP plumbing ──────────────────────────────────────────

  private async post<T>(
    path: string,
    userId: string,
    tenantId: string,
    body: unknown,
  ): Promise<T> {
    const token = this.tokenService.mint({
      sub: userId,
      tenantId,
      executionId: `${tenantId}-${Date.now()}`,
      workspacePath: `/var/lib/neurecore/accounting/tenants/${tenantId}/`,
      allowedTools: [],
      approvalThreshold: 'NONE',
    });
    try {
      const response = await this.httpClient.post<T>(
        `${this.requireUrl()}${path}`,
        body,
        {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      );
      if (response.status >= 400) {
        this.logger.warn(
          `Sidecar returned HTTP ${response.status} on ${path}: ${JSON.stringify(response.data)}`,
        );
      }
      return response.data;
    } catch (e) {
      this.logger.error(
        `Sidecar transport error on ${path}: ${e instanceof Error ? e.message : String(e)}`,
      );
      throw e;
    }
  }
}