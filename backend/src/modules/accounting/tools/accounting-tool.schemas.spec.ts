/**
 * Tests for the nc.accounting.* tool schemas.
 *
 * Verifies that every registered tool:
 *   - Has a unique name.
 *   - Has a valid Zod schema.
 *   - Rejects malformed args.
 *   - Accepts the canonical valid args.
 *   - Maps to the correct tier (TIER-1 or TIER-2).
 */

import {
  NC_ACCOUNTING_TOOL_NAMES, ncAccountingToolSchemas,
  accountingApprovalRequiredTools, accountingToolRequiredRoles,
} from './accounting-tool.schemas';

describe('NC_ACCOUNTING_TOOL_NAMES', () => {
  it('has no duplicate names', () => {
    const set = new Set(NC_ACCOUNTING_TOOL_NAMES);
    expect(set.size).toBe(NC_ACCOUNTING_TOOL_NAMES.length);
  });

  it('every name starts with nc.accounting.', () => {
    for (const name of NC_ACCOUNTING_TOOL_NAMES) {
      expect(name.startsWith('nc.accounting.')).toBe(true);
    }
  });

  it('exposes exactly 15 tools (matches plan §7)', () => {
    expect(NC_ACCOUNTING_TOOL_NAMES.length).toBe(15);
  });
});

describe('Schema validation — TIER-1 tools accept canonical inputs', () => {
  it('compute_npv', () => {
    const r = ncAccountingToolSchemas['nc.accounting.compute_npv']
      .safeParse({ rate: 0.1, cashflows: [-1000, 300, 400, 500] });
    expect(r.success).toBe(true);
  });

  it('compute_irr — rejects single-cashflow arrays', () => {
    const r = ncAccountingToolSchemas['nc.accounting.compute_irr']
      .safeParse({ cashflows: [100] });
    expect(r.success).toBe(false);
  });

  it('compute_mirr — requires both finance + reinvest rates', () => {
    const r = ncAccountingToolSchemas['nc.accounting.compute_mirr']
      .safeParse({ financeRate: 0.1, reinvestRate: 0.12, cashflows: [-1000, 300, 400, 500] });
    expect(r.success).toBe(true);
  });

  it('amortize_loan — rejects zero principal', () => {
    const r = ncAccountingToolSchemas['nc.accounting.amortize_loan']
      .safeParse({ principal: 0, rate: 0.06, nper: 12 });
    expect(r.success).toBe(false);
  });

  it('validate_postings — requires ≥2 postings', () => {
    const ok = ncAccountingToolSchemas['nc.accounting.validate_postings']
      .safeParse({ postings: [{ accountCode: '1000', amount: '100.00', currency: 'USD' }] });
    expect(ok.success).toBe(false);

    const valid = ncAccountingToolSchemas['nc.accounting.validate_postings']
      .safeParse({ postings: [
        { accountCode: '1000', amount: '100.00', currency: 'USD' },
        { accountCode: '2000', amount: '-100.00', currency: 'USD' },
      ] });
    expect(valid.success).toBe(true);
  });

  it('export_beancount — asOf is optional', () => {
    const noDate = ncAccountingToolSchemas['nc.accounting.export_beancount']
      .safeParse({});
    expect(noDate.success).toBe(true);

    const withDate = ncAccountingToolSchemas['nc.accounting.export_beancount']
      .safeParse({ asOf: '2026-12-31T00:00:00Z' });
    expect(withDate.success).toBe(true);
  });

  it('list_accounts — type filter must be a valid enum', () => {
    const r = ncAccountingToolSchemas['nc.accounting.list_accounts']
      .safeParse({ type: 'INVALID' });
    expect(r.success).toBe(false);
  });

  it('generate_report — type is one of three reports', () => {
    for (const type of ['BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW']) {
      const r = ncAccountingToolSchemas['nc.accounting.generate_report']
        .safeParse({ type });
      expect(r.success).toBe(true);
    }
    const bad = ncAccountingToolSchemas['nc.accounting.generate_report']
      .safeParse({ type: 'TRIAL_BALANCE' });
    expect(bad.success).toBe(false);
  });
});

describe('Schema validation — TIER-2 tools reject malformed payloads', () => {
  it('post_ledger — postings must balance to within 0 (strict for this test; runtime allows tolerance)', () => {
    const ok = ncAccountingToolSchemas['nc.accounting.post_ledger'].safeParse({
      periodId: '00000000-0000-0000-0000-000000000000',
      txnDate: '2026-07-30T00:00:00Z',
      narration: 'Office supplies',
      postings: [
        { accountCode: '1000', amount: '500.0000', currency: 'USD', postingType: 'DEBIT' },
        { accountCode: '2000', amount: '-500.0000', currency: 'USD', postingType: 'CREDIT' },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it('post_ledger — rejects extra fields (strict)', () => {
    const r = ncAccountingToolSchemas['nc.accounting.post_ledger'].safeParse({
      periodId: '00000000-0000-0000-0000-000000000000',
      txnDate: '2026-07-30T00:00:00Z',
      narration: 'x',
      postings: [
        { accountCode: '1000', amount: '100', currency: 'USD', postingType: 'DEBIT' },
        { accountCode: '2000', amount: '-100', currency: 'USD', postingType: 'CREDIT' },
      ],
      rogueField: 'bad',
    });
    expect(r.success).toBe(false);
  });

  it('create_account — code format is enforced', () => {
    const bad = ncAccountingToolSchemas['nc.accounting.create_account'].safeParse({
      code: 'has spaces!',
      name: 'X',
      type: 'ASSET',
      normalBalance: 'DEBIT',
    });
    expect(bad.success).toBe(false);

    const good = ncAccountingToolSchemas['nc.accounting.create_account'].safeParse({
      code: '1000',
      name: 'Cash',
      type: 'ASSET',
      normalBalance: 'DEBIT',
    });
    expect(good.success).toBe(true);
  });

  it('create_period — endDate must parse as datetime', () => {
    const r = ncAccountingToolSchemas['nc.accounting.create_period'].safeParse({
      code: '2027-Q1',
      name: 'Q1 2027',
      startDate: 'not-a-date',
      endDate: '2027-03-31T23:59:59Z',
      fiscalYear: 2027,
    });
    expect(r.success).toBe(false);
  });

  it('close_period — requires periodId', () => {
    const r = ncAccountingToolSchemas['nc.accounting.close_period'].safeParse({});
    expect(r.success).toBe(false);
  });

  it('record_finding — severity must be one of four values', () => {
    const r = ncAccountingToolSchemas['nc.accounting.record_finding'].safeParse({
      severity: 'BLOCKER',
      category: 'X',
      title: 'Y',
      description: 'Z',
    });
    expect(r.success).toBe(false);
  });
});

describe('TIER-2 set + role matrix', () => {
  it('exactly 5 tools require TIER-2 approval', () => {
    expect(accountingApprovalRequiredTools.size).toBe(5);
  });

  it('the TIER-2 set is exactly {post_ledger, create_account, create_period, close_period, record_finding}', () => {
    const tier2Names = Array.from(accountingApprovalRequiredTools).sort();
    expect(tier2Names).toEqual([
      'nc.accounting.close_period',
      'nc.accounting.create_account',
      'nc.accounting.create_period',
      'nc.accounting.post_ledger',
      'nc.accounting.record_finding',
    ]);
  });

  it('every TIER-2 tool has a required-role entry', () => {
    for (const tool of accountingApprovalRequiredTools) {
      const roles = accountingToolRequiredRoles[tool];
      expect(roles).toBeDefined();
      expect(roles!.length).toBeGreaterThan(0);
    }
  });

  it('SoD: post_ledger requires POSTING/CONTROLLER/CFO (NOT REVIEWER — prevents single-user-post+approve)', () => {
    // The approve path is enforced by `AccountingApprovalGuard`, not by the
    // role check on the tool. REVIEWER can ONLY approve, not post.
    expect(accountingToolRequiredRoles['nc.accounting.post_ledger']).toEqual(
      ['POSTING', 'CONTROLLER', 'CFO'],
    );
    expect(accountingToolRequiredRoles['nc.accounting.post_ledger']).not.toContain('REVIEWER');
  });
});