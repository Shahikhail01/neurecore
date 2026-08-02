/**
 * AccountingController — REST endpoints for the accounting capability.
 *
 * Plan ref: NC-ACCT-IMP-1 §5.
 *
 * Routes (all /api/v1/accounting/* — mounted by the global prefix):
 *
 *   GET    /accounts                              list COA
 *   POST   /accounts                              create account     [TIER-2]
 *   GET    /accounts/:id                          get one account
 *   GET    /accounts/by-code/:code                resolve code → account
 *   PATCH  /accounts/:id                          update name/active [TIER-2]
 *
 *   POST   /periods                               create period      [TIER-2]
 *   GET    /periods                               list periods
 *   POST   /periods/:id/close                     transition         [TIER-2]
 *
 *   POST   /compute/npv                           TIER-1
 *   POST   /compute/irr                           TIER-1
 *   POST   /compute/mirr                          TIER-1
 *   POST   /loans/amortize                        TIER-1
 *   POST   /ledger/validate                       TIER-1
 *
 *   POST   /ledger/postings                       TIER-2
 *   GET    /ledger/postings                       list journal entries
 *   GET    /ledger/postings/:id                   get one
 *
 *   POST   /reports/balance-sheet                 TIER-1
 *   POST   /reports/income-statement              TIER-1
 *   POST   /reports/cash-flow                     TIER-1
 *   GET    /ledger/export.beancount               raw .beancount text
 *
 *   GET    /accounts/:code/balance                get balance
 */

import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Req, Res, HttpStatus, HttpCode,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AccountingService } from '../services/accounting.service';
import { AccountingApprovalGuard, ApprovalTier } from '../guards/accounting-approval.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateAccountInput } from '../services/chart-of-accounts.service';
import { CreatePeriodInput } from '../services/accounting-period.service';
import { PostingInput } from '../services/ledger-repository.service';
import { AccountType } from '@prisma/client';

@Controller({ path: 'accounting', version: '1' })
@UseGuards(JwtAuthGuard, AccountingApprovalGuard)
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  // ─── COA ────────────────────────────────────────────────

  @Get('accounts')
  @ApprovalTier('TIER_1')
  async listAccounts(
    @Req() req: Request,
    @Query('type') type?: AccountType,
    @Query('isActive') isActive?: string,
  ) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.listAccounts(user.tenantId, {
      type,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Post('accounts')
  @ApprovalTier('TIER_2')
  @HttpCode(HttpStatus.CREATED)
  async createAccount(@Req() req: Request, @Body() input: Omit<CreateAccountInput, 'tenantId'>) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.createAccount(user.tenantId, user.id, input);
  }

  @Get('accounts/:id')
  @ApprovalTier('TIER_1')
  async getAccount(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.getAccount(user.tenantId, id);
  }

  @Patch('accounts/:id')
  @ApprovalTier('TIER_2')
  async updateAccount(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { name?: string; isActive?: boolean; description?: string },
  ) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.updateAccount(user.tenantId, user.id, id, body);
  }

  @Get('accounts/by-code/:code')
  @ApprovalTier('TIER_1')
  async getAccountByCode(@Req() req: Request, @Param('code') code: string) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.getAccountByCode(user.tenantId, code);
  }

  @Get('accounts/:code/balance')
  @ApprovalTier('TIER_1')
  async getBalance(
    @Req() req: Request,
    @Param('code') code: string,
    @Query('asOf') asOf?: string,
  ) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.getAccountBalance(
      user.tenantId,
      code,
      asOf ? new Date(asOf) : undefined,
    );
  }

  // ─── Periods ────────────────────────────────────────────

  @Post('periods')
  @ApprovalTier('TIER_2')
  @HttpCode(HttpStatus.CREATED)
  async createPeriod(@Req() req: Request, @Body() input: Omit<CreatePeriodInput, 'tenantId'>) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.createPeriod(user.tenantId, user.id, input);
  }

  @Get('periods')
  @ApprovalTier('TIER_1')
  async listPeriods(@Req() req: Request, @Query('fiscalYear') fiscalYear?: string) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.listPeriods(user.tenantId, fiscalYear ? parseInt(fiscalYear, 10) : undefined);
  }

  @Post('periods/:id/close')
  @ApprovalTier('TIER_2')
  async closePeriod(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.closePeriod(user.tenantId, user.id, id);
  }

  // ─── Compute (TIER-1) ───────────────────────────────────

  @Post('compute/npv')
  @ApprovalTier('TIER_1')
  async computeNpv(
    @Req() req: Request,
    @Body() body: { rate: number; cashflows: number[] },
  ) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.computeNpv(user.tenantId, user.id, body.rate, body.cashflows);
  }

  @Post('compute/irr')
  @ApprovalTier('TIER_1')
  async computeIrr(@Req() req: Request, @Body() body: { cashflows: number[] }) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.computeIrr(user.tenantId, user.id, body.cashflows);
  }

  @Post('compute/mirr')
  @ApprovalTier('TIER_1')
  async computeMirr(
    @Req() req: Request,
    @Body() body: { financeRate: number; reinvestRate: number; cashflows: number[] },
  ) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.computeMirr(
      user.tenantId,
      user.id,
      body.financeRate,
      body.reinvestRate,
      body.cashflows,
    );
  }

  @Post('loans/amortize')
  @ApprovalTier('TIER_1')
  async amortize(
    @Req() req: Request,
    @Body() body: { principal: number; rate: number; nper: number },
  ) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.amortizeLoan(user.tenantId, user.id, body.principal, body.rate, body.nper);
  }

  // ─── Journal entries (TIER-2) ───────────────────────────

  @Post('ledger/postings')
  @ApprovalTier('TIER_2')
  @HttpCode(HttpStatus.CREATED)
  async postJournalEntry(
    @Req() req: Request,
    @Body() body: {
      periodId: string;
      txnDate: string;
      narration: string;
      postings: PostingInput[];
      approvalId: string;
    },
  ) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.postJournalEntry(user.tenantId, user.id, {
      periodId: body.periodId,
      txnDate: new Date(body.txnDate),
      narration: body.narration,
      postings: body.postings,
      approvalId: body.approvalId,
    });
  }

  @Get('ledger/postings')
  @ApprovalTier('TIER_1')
  async listPostings(
    @Req() req: Request,
    @Query('periodId') periodId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.listJournalEntries(user.tenantId, {
      periodId,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ─── Reports & export (TIER-1) ──────────────────────────

  @Post('reports/balance-sheet')
  @ApprovalTier('TIER_1')
  async reportBalanceSheet(
    @Req() req: Request,
    @Body() body: { asOf?: string },
  ) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.generateReport(
      user.tenantId,
      user.id,
      'BALANCE_SHEET',
      body.asOf ? new Date(body.asOf) : undefined,
    );
  }

  @Post('reports/income-statement')
  @ApprovalTier('TIER_1')
  async reportIncomeStatement(
    @Req() req: Request,
    @Body() body: { asOf?: string },
  ) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.generateReport(
      user.tenantId,
      user.id,
      'INCOME_STATEMENT',
      body.asOf ? new Date(body.asOf) : undefined,
    );
  }

  @Post('reports/cash-flow')
  @ApprovalTier('TIER_1')
  async reportCashFlow(
    @Req() req: Request,
    @Body() body: { asOf?: string },
  ) {
    const user = req.user as { id: string; tenantId: string };
    return this.accounting.generateReport(
      user.tenantId,
      user.id,
      'CASH_FLOW',
      body.asOf ? new Date(body.asOf) : undefined,
    );
  }

  @Get('ledger/export.beancount')
  @ApprovalTier('TIER_1')
  async exportBeancount(
    @Req() req: Request,
    @Res() res: Response,
    @Query('asOf') asOf?: string,
  ) {
    const user = req.user as { id: string; tenantId: string };
    const text = await this.accounting.exportBeancount(
      user.tenantId,
      asOf ? new Date(asOf) : undefined,
    );
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ledger-${user.tenantId}-${(asOf ?? new Date().toISOString()).slice(0, 10)}.beancount"`,
    );
    res.status(HttpStatus.OK).send(text);
  }
}