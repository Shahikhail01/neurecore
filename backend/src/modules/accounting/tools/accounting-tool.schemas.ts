/**
 * Accounting tool schemas — nc.accounting.* tool definitions.
 *
 * Plan ref: NC-ACCT-IMP-1 §7 (nc.* tool surface).
 *
 * Mirrors `scoped-tool.schemas.ts` (Hermes) shape. Each tool has:
 *   - A Zod schema for argument validation.
 *   - An entry in NC_ACCOUNTING_TOOL_NAMES.
 *   - Optionally a TIER_2 entry (requires approval).
 *
 * Tools added in Phase 1 (this file):
 *   TIER-1 (auto-approved):
 *     nc.accounting.compute_npv
 *     nc.accounting.compute_irr
 *     nc.accounting.compute_mirr
 *     nc.accounting.amortize_loan
 *     nc.accounting.validate_postings
 *     nc.accounting.export_beancount
 *     nc.accounting.get_account_balance
 *     nc.accounting.list_accounts
 *     nc.accounting.list_periods
 *     nc.accounting.generate_report
 *   TIER-2 (human approval required):
 *     nc.accounting.post_ledger
 *     nc.accounting.create_account
 *     nc.accounting.create_period
 *     nc.accounting.close_period
 *     nc.accounting.record_finding
 */

import { z } from 'zod';

export const NC_ACCOUNTING_TOOL_NAMES = [
  'nc.accounting.compute_npv',
  'nc.accounting.compute_irr',
  'nc.accounting.compute_mirr',
  'nc.accounting.amortize_loan',
  'nc.accounting.validate_postings',
  'nc.accounting.export_beancount',
  'nc.accounting.get_account_balance',
  'nc.accounting.list_accounts',
  'nc.accounting.list_periods',
  'nc.accounting.generate_report',
  'nc.accounting.post_ledger',
  'nc.accounting.create_account',
  'nc.accounting.create_period',
  'nc.accounting.close_period',
  'nc.accounting.record_finding',
] as const;

export type NcAccountingToolName = (typeof NC_ACCOUNTING_TOOL_NAMES)[number];

const id = z.union([z.string().uuid(), z.string().cuid()]);
const code = z.string().trim().regex(/^[0-9A-Za-z_-]{1,32}$/,
  'must match /^[0-9A-Za-z_-]{1,32}$/');
const currency = z.string().trim().regex(/^[A-Z]{3}$/, 'ISO-4217 3-letter currency');
const decimalString = z.string().regex(/^-?\d+(\.\d{1,4})?$/, 'decimal string up to 4 dp');

export const ncAccountingToolSchemas: Record<NcAccountingToolName, z.ZodTypeAny> = {
  'nc.accounting.compute_npv': z.object({
    rate: z.number().min(-1).max(10),
    cashflows: z.array(z.number()).min(1).max(1000),
  }).strict(),

  'nc.accounting.compute_irr': z.object({
    cashflows: z.array(z.number()).min(2).max(1000),
  }).strict(),

  'nc.accounting.compute_mirr': z.object({
    financeRate: z.number().min(-1).max(10),
    reinvestRate: z.number().min(-1).max(10),
    cashflows: z.array(z.number()).min(2).max(1000),
  }).strict(),

  'nc.accounting.amortize_loan': z.object({
    principal: z.number().positive().max(1e12),
    rate: z.number().min(-1).max(10),
    nper: z.number().int().positive().max(600),
  }).strict(),

  'nc.accounting.validate_postings': z.object({
    postings: z.array(z.object({
      accountCode: code,
      amount: decimalString,
      currency,
    }).strict()).min(2).max(500),
  }).strict(),

  'nc.accounting.export_beancount': z.object({
    asOf: z.string().datetime().optional(),
  }).strict(),

  'nc.accounting.get_account_balance': z.object({
    accountCode: code,
    asOf: z.string().datetime().optional(),
  }).strict(),

  'nc.accounting.list_accounts': z.object({
    type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).optional(),
    isActive: z.boolean().optional(),
  }).strict(),

  'nc.accounting.list_periods': z.object({
    fiscalYear: z.number().int().min(1900).max(2200).optional(),
    status: z.enum(['OPEN', 'CLOSING', 'CLOSED', 'LOCKED']).optional(),
  }).strict(),

  'nc.accounting.generate_report': z.object({
    type: z.enum(['BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW']),
    asOf: z.string().datetime().optional(),
  }).strict(),

  'nc.accounting.post_ledger': z.object({
    periodId: id,
    txnDate: z.string().datetime(),
    narration: z.string().trim().min(1).max(2000),
    postings: z.array(z.object({
      accountCode: code,
      amount: decimalString,
      currency,
      postingType: z.enum(['DEBIT', 'CREDIT']),
      counterparty: z.string().max(200).optional(),
      narration: z.string().max(500).optional(),
    }).strict()).min(2).max(500),
  }).strict(),

  'nc.accounting.create_account': z.object({
    code,
    name: z.string().trim().min(1).max(200),
    type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
    normalBalance: z.enum(['DEBIT', 'CREDIT']),
    parentCode: code.optional(),
    currency: currency.optional(),
    isLeaf: z.boolean().optional(),
    description: z.string().max(1000).optional(),
  }).strict(),

  'nc.accounting.create_period': z.object({
    code,
    name: z.string().trim().min(1).max(200),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    fiscalYear: z.number().int().min(1900).max(2200),
  }).strict(),

  'nc.accounting.close_period': z.object({
    periodId: id,
  }).strict(),

  'nc.accounting.record_finding': z.object({
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    category: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(5000),
    evidence: z.record(z.unknown()).default({}),
    recommendation: z.string().max(5000).optional(),
    scenarioId: z.string().max(100).optional(),
    simulationRunId: z.string().max(100).optional(),
  }).strict(),
};

/**
 * Tools that require TIER-2 (human) approval before execution.
 * Maps to the existing `approvalRequiredTools` pattern.
 */
export const accountingApprovalRequiredTools = new Set<NcAccountingToolName>([
  'nc.accounting.post_ledger',
  'nc.accounting.create_account',
  'nc.accounting.create_period',
  'nc.accounting.close_period',
  'nc.accounting.record_finding',
]);

/**
 * The `AccountingRole` required to dispatch each TIER-2 tool.
 * Enforced by `AccountingScopedToolGatewayService.requireAnyRole`.
 */
export type RequiredAccountingRole = 'POSTING' | 'REVIEWER' | 'CONTROLLER' | 'CFO' | 'AUDITOR';

export const accountingToolRequiredRoles: Partial<Record<NcAccountingToolName, RequiredAccountingRole[]>> = {
  'nc.accounting.post_ledger': ['POSTING', 'CONTROLLER', 'CFO'],
  'nc.accounting.create_account': ['POSTING', 'CONTROLLER', 'CFO'],
  'nc.accounting.create_period': ['CONTROLLER', 'CFO'],
  'nc.accounting.close_period': ['CONTROLLER', 'CFO'],
  'nc.accounting.record_finding': ['POSTING', 'REVIEWER', 'CONTROLLER', 'CFO', 'AUDITOR'],
};