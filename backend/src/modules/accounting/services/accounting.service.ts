/**
 * AccountingService — orchestrates the COA, Period, SoD, Ledger, and Sidecar
 * services. Controllers should call this service, not the repos directly.
 *
 * Plan ref: NC-ACCT-IMP-1 §5, §7.
 *
 * The methods here mirror the operations the nc.accounting.* tools expose
 * (compute NPV/IRR/amortize, post ledger, generate report, record finding,
 * export Beancount, get balance, list/create accounts, list/close periods).
 */

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ChartOfAccountsService, CreateAccountInput } from './chart-of-accounts.service';
import { AccountingPeriodService, CreatePeriodInput } from './accounting-period.service';
import { LedgerRepositoryService, CreateJournalEntryInput, PostingInput } from './ledger-repository.service';
import { SegregationOfDutiesService } from './segregation-of-duties.service';
import { HttpAccountingSidecarClient } from '../infrastructure/http-accounting-sidecar.client';
import { AccountingRole, AccountingPeriodStatus, AccountType, ApprovalStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coa: ChartOfAccountsService,
    private readonly periods: AccountingPeriodService,
    private readonly ledger: LedgerRepositoryService,
    private readonly sod: SegregationOfDutiesService,
    private readonly sidecar: HttpAccountingSidecarClient,
  ) {}

  // ─── COA ────────────────────────────────────────────────

  async createAccount(tenantId: string, userId: string, input: {
    code: string;
    name: string;
    type: AccountType;
    normalBalance: 'DEBIT' | 'CREDIT';
    parentCode?: string;
    currency?: string;
    isLeaf?: boolean;
    description?: string;
  }) {
    await this.sod.requireAnyRole(tenantId, userId, [AccountingRole.POSTING, AccountingRole.CONTROLLER, AccountingRole.CFO]);

    // Resolve parentCode → parentId if given.
    let parentId: string | undefined;
    if (input.parentCode) {
      const parent = await this.coa.findByCode(tenantId, input.parentCode);
      if (!parent) {
        throw new BadRequestException(`Parent account ${input.parentCode} not found`);
      }
      parentId = parent.id;
    }

    return this.coa.create({
      tenantId,
      code: input.code,
      name: input.name,
      type: input.type,
      normalBalance: input.normalBalance,
      parentId,
      currency: input.currency ?? 'USD',
      isLeaf: input.isLeaf ?? true,
      description: input.description,
    });
  }

  async listAccounts(tenantId: string, opts?: { type?: AccountType; isActive?: boolean }) {
    return this.coa.list(tenantId, opts);
  }

  async getAccount(tenantId: string, id: string) {
    return this.coa.findById(tenantId, id);
  }

  async getAccountByCode(tenantId: string, code: string) {
    return this.coa.findByCode(tenantId, code);
  }

  async updateAccount(tenantId: string, userId: string, id: string, input: { name?: string; isActive?: boolean; description?: string }) {
    await this.sod.requireAnyRole(tenantId, userId, [AccountingRole.CONTROLLER, AccountingRole.CFO]);
    return this.coa.update(tenantId, id, input);
  }

  // ─── Periods ────────────────────────────────────────────

  async createPeriod(tenantId: string, userId: string, input: Omit<CreatePeriodInput, 'tenantId'>) {
    await this.sod.requireAnyRole(tenantId, userId, [AccountingRole.CONTROLLER, AccountingRole.CFO]);
    return this.periods.create({ ...input, tenantId });
  }

  async listPeriods(tenantId: string, fiscalYear?: number, status?: 'OPEN' | 'CLOSING' | 'CLOSED' | 'LOCKED') {
    return this.periods.list(tenantId, { fiscalYear, status });
  }

  async closePeriod(tenantId: string, userId: string, periodId: string) {
    await this.sod.requireAnyRole(tenantId, userId, [AccountingRole.CONTROLLER, AccountingRole.CFO]);
    return this.periods.transition(tenantId, periodId, AccountingPeriodStatus.CLOSING, userId);
  }

  // ─── Compute (TIER-1, no journal write) ─────────────────

  async computeNpv(tenantId: string, userId: string, rate: number, cashflows: number[]) {
    return this.sidecar.computeNpv({ tenantId, userId, rate, cashflows });
  }

  async computeIrr(tenantId: string, userId: string, cashflows: number[]) {
    return this.sidecar.computeIrr({ tenantId, userId, cashflows });
  }

  async computeMirr(tenantId: string, userId: string, financeRate: number, reinvestRate: number, cashflows: number[]) {
    return this.sidecar.computeMirr({ tenantId, userId, financeRate, reinvestRate, cashflows });
  }

  async amortizeLoan(tenantId: string, userId: string, principal: number, rate: number, nper: number) {
    return this.sidecar.amortizeLoan({ tenantId, userId, principal, rate, nper });
  }

  async validatePostings(
    tenantId: string,
    userId: string,
    postings: Array<{ accountCode: string; amount: string; currency: string }>,
  ) {
    // The sidecar uses {account, amount, currency}; tools send {accountCode}.
    const sidecarPostings = postings.map((p) => ({
      account: p.accountCode,
      amount: p.amount,
      currency: p.currency,
    }));
    return this.sidecar.validatePostings({
      tenantId, userId, postings: sidecarPostings,
    });
  }

  // ─── Journal entries (TIER-2, require approval) ─────────

  async postJournalEntry(
    tenantId: string,
    userId: string,
    input: {
      periodId: string;
      txnDate: Date;
      narration: string;
      postings: PostingInput[];
      approvalId: string;
    },
  ) {
    // Role + SoD checks
    await this.sod.requireAnyRole(tenantId, userId, [AccountingRole.POSTING, AccountingRole.CONTROLLER, AccountingRole.CFO]);

    const approval = await this.prisma.approvalRequest.findFirst({
      where: { id: input.approvalId, tenantId },
    });
    if (!approval) {
      throw new NotFoundException(`ApprovalRequest ${input.approvalId} not found`);
    }
    if (approval.status !== ApprovalStatus.APPROVED) {
      throw new BadRequestException(
        `ApprovalRequest ${input.approvalId} is ${approval.status}, expected APPROVED`,
      );
    }
    if (!approval.reviewedById || !approval.approvedAt) {
      throw new BadRequestException(
        `ApprovalRequest ${input.approvalId} is APPROVED but missing reviewer`,
      );
    }
    if (approval.reviewedById === userId) {
      throw new BadRequestException(
        'Segregation of duties: you cannot approve your own posting',
      );
    }

    return this.ledger.createJournalEntry({
      tenantId,
      postingUserId: userId,
      periodId: input.periodId,
      txnDate: input.txnDate,
      narration: input.narration,
      source: 'nc.accounting.post_ledger',
      postings: input.postings,
      approvalId: input.approvalId,
      approvedById: approval.reviewedById,
      approvedAt: approval.approvedAt,
    });
  }

  async listJournalEntries(tenantId: string, opts?: { periodId?: string; fromDate?: Date; toDate?: Date; limit?: number }) {
    return this.ledger.listJournalEntries(tenantId, opts);
  }

  // ─── Read-side ─────────────────────────────────────────

  async getAccountBalance(tenantId: string, accountCode: string, asOf?: Date) {
    return this.ledger.getAccountBalance(tenantId, accountCode, asOf);
  }

  async exportBeancount(tenantId: string, asOf?: Date) {
    return this.ledger.exportBeancount(tenantId, asOf);
  }

  async generateReport(tenantId: string, userId: string, type: 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW', asOf?: Date) {
    const beancount = await this.ledger.exportBeancount(tenantId, asOf);
    if (type === 'BALANCE_SHEET') return this.sidecar.generateBalanceSheet({ tenantId, userId, beancount, reportType: 'BALANCE_SHEET' });
    if (type === 'INCOME_STATEMENT') return this.sidecar.generateIncomeStatement({ tenantId, userId, beancount, reportType: 'INCOME_STATEMENT' });
    return this.sidecar.generateCashFlow({ tenantId, userId, beancount, reportType: 'CASH_FLOW' });
  }
}