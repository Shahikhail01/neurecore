/**
 * Accounting tools — registered with StructuredToolRegistry (NC-ACCT-IMP-1 §7).
 *
 * Plan ref: NC-ACCT-IMP-1 §7.
 *
 * Phase 1 wiring: 4 TIER-1 (read-only, auto-approved) compute tools.
 * Phase 2 will add 11 TIER-2 tools (post_ledger, create_account, etc.) wired
 * through the ApprovalAddonRegistry.
 *
 * Tools here extract `tenantId` and `userId` from ToolExecutionContext (passed
 * by the agent runtime), not from the input body. This is the same pattern as
 * QueryTool and other built-ins in this codebase.
 */

import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../../tools/structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../../tools/interfaces/structured-tool.interface';
import { AccountingService } from '../services/accounting.service';

const NPV_INPUT = z.object({
  rate: z.number().min(-1).max(10),
  cashflows: z.array(z.number()).min(1).max(1000),
}).strict();

const IRR_INPUT = z.object({
  cashflows: z.array(z.number()).min(2).max(1000),
}).strict();

const MIRR_INPUT = z.object({
  financeRate: z.number().min(-1).max(10),
  reinvestRate: z.number().min(-1).max(10),
  cashflows: z.array(z.number()).min(2).max(1000),
}).strict();

const AMORTIZE_INPUT = z.object({
  principal: z.number().positive().max(1e12),
  rate: z.number().min(-1).max(10),
  nper: z.number().int().positive().max(600),
}).strict();

/** nc.accounting.compute_npv — net present value. Tier 1, read-only. */
@Injectable()
export class NpvTool extends BaseStructuredTool {
  protected readonly logger = new Logger(NpvTool.name);

  constructor(private readonly accounting: AccountingService) { super(); }

  readonly name = 'nc.accounting.compute_npv';
  readonly description =
    'Compute the Net Present Value of a series of cashflows at a given discount rate. ' +
    'Uses numpy-financial on the accounting-sidecar. Returns {npv, computationId}. ' +
    'Example: rate=0.10, cashflows=[-1000, 300, 400, 500] → npv ≈ -21.04.';
  readonly inputSchema = NPV_INPUT;
  readonly category = ToolCategory.CALCULATION;

  async executeImpl(input: z.infer<typeof NPV_INPUT>, ctx: ToolExecutionContext): Promise<StructuredToolResult> {
    if (!ctx.tenantId || !ctx.userId) {
      return { success: false, error: `MISSING_CONTEXT: ToolExecutionContext.tenantId and userId are required`};
    }
    try {
      const result = await this.accounting.computeNpv(
        ctx.tenantId, ctx.userId, input.rate, input.cashflows,
      );
      return { success: true, data: result };
    } catch (e) {
      this.logger.warn(`compute_npv failed: ${e instanceof Error ? e.message : String(e)}`);
      return { success: false, error: `COMPUTE_FAILED: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
}

/** nc.accounting.compute_irr — internal rate of return. Tier 1, read-only. */
@Injectable()
export class IrrTool extends BaseStructuredTool {
  protected readonly logger = new Logger(IrrTool.name);

  constructor(private readonly accounting: AccountingService) { super(); }

  readonly name = 'nc.accounting.compute_irr';
  readonly description =
    'Compute the Internal Rate of Return of a series of cashflows. ' +
    'Returns {irr, converged}. If the cashflows have no sign change, ' +
    'converged=false and irr=null.';
  readonly inputSchema = IRR_INPUT;
  readonly category = ToolCategory.CALCULATION;

  async executeImpl(input: z.infer<typeof IRR_INPUT>, ctx: ToolExecutionContext): Promise<StructuredToolResult> {
    if (!ctx.tenantId || !ctx.userId) {
      return { success: false, error: `MISSING_CONTEXT: ToolExecutionContext.tenantId and userId are required`};
    }
    try {
      const result = await this.accounting.computeIrr(
        ctx.tenantId, ctx.userId, input.cashflows,
      );
      return { success: true, data: result };
    } catch (e) {
      this.logger.warn(`compute_irr failed: ${e instanceof Error ? e.message : String(e)}`);
      return { success: false, error: `COMPUTE_FAILED: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
}

/** nc.accounting.compute_mirr — modified IRR. Tier 1, read-only. */
@Injectable()
export class MirrTool extends BaseStructuredTool {
  protected readonly logger = new Logger(MirrTool.name);

  constructor(private readonly accounting: AccountingService) { super(); }

  readonly name = 'nc.accounting.compute_mirr';
  readonly description =
    'Compute Modified Internal Rate of Return with separate finance and reinvest rates.';
  readonly inputSchema = MIRR_INPUT;
  readonly category = ToolCategory.CALCULATION;

  async executeImpl(input: z.infer<typeof MIRR_INPUT>, ctx: ToolExecutionContext): Promise<StructuredToolResult> {
    if (!ctx.tenantId || !ctx.userId) {
      return { success: false, error: `MISSING_CONTEXT: ToolExecutionContext.tenantId and userId are required`};
    }
    try {
      const r = await this.accounting.computeMirr(
        ctx.tenantId, ctx.userId, input.financeRate, input.reinvestRate, input.cashflows,
      );
      return { success: true, data: r };
    } catch (e) {
      this.logger.warn(`compute_mirr failed: ${e instanceof Error ? e.message : String(e)}`);
      return { success: false, error: `COMPUTE_FAILED: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
}

/** nc.accounting.amortize_loan — loan payment schedule. Tier 1, read-only. */
@Injectable()
export class AmortizeLoanTool extends BaseStructuredTool {
  protected readonly logger = new Logger(AmortizeLoanTool.name);

  constructor(private readonly accounting: AccountingService) { super(); }

  readonly name = 'nc.accounting.amortize_loan';
  readonly description =
    'Amortize a loan into monthly payment schedule. Returns the schedule ' +
    'and totals (payment, interest, principal).';
  readonly inputSchema = AMORTIZE_INPUT;
  readonly category = ToolCategory.CALCULATION;

  async executeImpl(input: z.infer<typeof AMORTIZE_INPUT>, ctx: ToolExecutionContext): Promise<StructuredToolResult> {
    if (!ctx.tenantId || !ctx.userId) {
      return { success: false, error: `MISSING_CONTEXT: ToolExecutionContext.tenantId and userId are required`};
    }
    try {
      const r = await this.accounting.amortizeLoan(
        ctx.tenantId, ctx.userId, input.principal, input.rate, input.nper,
      );
      return { success: true, data: r };
    } catch (e) {
      this.logger.warn(`amortize_loan failed: ${e instanceof Error ? e.message : String(e)}`);
      return { success: false, error: `COMPUTE_FAILED: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
}

/**
 * Provider of the 4 TIER-1 structured tools for the agent runtime.
 * Add this to ToolsModule via `StructuredToolRegistry.register()` or
 * `setTools([...])` from a Module initializer.
 */
export const ACCOUNTING_STRUCTURED_TOOLS = [
  NpvTool,
  IrrTool,
  MirrTool,
  AmortizeLoanTool,
];

// Compile-time check: ensure BaseStructuredTool is imported.
const _baseCheck: typeof BaseStructuredTool = null as any;