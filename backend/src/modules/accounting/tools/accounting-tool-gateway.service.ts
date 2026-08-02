/**
 * AccountingScopedToolGatewayService — dispatches nc.accounting.* tools.
 *
 * Plan ref: NC-ACCT-IMP-1 §7.
 *
 * Mirrors the Hermes `ScopedToolGatewayService` shape:
 *   1. Validate tool name against the registered list.
 *   2. Validate args against the Zod schema.
 *   3. Check approval (TIER-2 tools create a PENDING ApprovalRequest if
 *      no `approvedApprovalId` is supplied).
 *   4. Enforce role (DB-backed, not just client-asserted).
 *   5. Dispatch to `AccountingService`.
 *   6. Audit.
 *
 * The scope of the token claim is `accounting:execute` (vs. `hermes:execute`).
 * Tool claims use `AccountingScopedTokenClaims` (from `accounting-token.service.ts`).
 */

import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ApprovalsService } from '../../approvals/services/approvals.service';
import { AccountingService } from '../services/accounting.service';
import { ChartOfAccountsService } from '../services/chart-of-accounts.service';
import { SegregationOfDutiesService } from '../services/segregation-of-duties.service';
import { AccountingRole } from '@prisma/client';
import {
  NC_ACCOUNTING_TOOL_NAMES, NcAccountingToolName,
  ncAccountingToolSchemas, accountingApprovalRequiredTools,
  accountingToolRequiredRoles,
} from './accounting-tool.schemas';
import type { AccountingScopedTokenClaims } from '../services/accounting-token.service';

export interface ToolGatewayResult {
  success: boolean;
  data?: unknown;
  deferred?: boolean;
  approvalId?: string;
  truncated?: boolean;
  error?: { code: string; message: string; retriable: boolean };
}

@Injectable()
export class AccountingScopedToolGatewayService {
  constructor(
    private readonly accounting: AccountingService,
    private readonly coa: ChartOfAccountsService,
    private readonly sod: SegregationOfDutiesService,
    private readonly approvals: ApprovalsService,
    private readonly prisma: PrismaService,
  ) {}

  listTools(): readonly string[] { return NC_ACCOUNTING_TOOL_NAMES; }

  async execute(
    name: string,
    args: unknown,
    claims: AccountingScopedTokenClaims,
    approvedApprovalId?: string,
  ): Promise<ToolGatewayResult> {
    const started = Date.now();
    const toolName = name as NcAccountingToolName;

    if (!NC_ACCOUNTING_TOOL_NAMES.includes(toolName)) {
      throw new NotFoundException(`Tool ${name} is not a registered accounting tool`);
    }
    if (!claims.allowedTools.includes(toolName)) {
      await this.audit(claims, name, args, 'denied', Date.now() - started);
      throw new ForbiddenException(`Tool ${name} is not in this execution's allowedTools`);
    }

    const parsed = ncAccountingToolSchemas[toolName].safeParse(args);
    if (!parsed.success) {
      await this.audit(claims, name, args, 'denied', Date.now() - started, parsed.error.flatten());
      throw new BadRequestException({
        code: 'INVALID_TOOL_ARGUMENTS',
        issues: parsed.error.issues,
      });
    }
    const a = parsed.data as Record<string, unknown>;

    try {
      // Role check (always required, even for TIER-1 tools — TIER-1 just
      // skips approval creation).
      const required = accountingToolRequiredRoles[toolName];
      if (required && required.length > 0) {
        await this.sod.requireAnyRole(claims.tenantId, claims.sub, required as AccountingRole[]);
      }

      if (accountingApprovalRequiredTools.has(toolName)) {
        if (approvedApprovalId) {
          const approved = await this.approvals.findOne(approvedApprovalId, claims.tenantId);
          if (!approved || approved.status !== 'APPROVED') {
            throw new ForbiddenException('Approval is not granted');
          }
          if (approved.resourceId !== claims.executionId) {
            throw new ForbiddenException('Approval execution mismatch');
          }
          // SoD: the approver (reviewer) must differ from the actor.
          if (approved.reviewedById === claims.sub) {
            throw new ForbiddenException('Segregation of duties: actor cannot approve own call');
          }
          const data = await this.dispatch(toolName, a, claims);
          await this.audit(claims, name, parsed.data, 'allowed', Date.now() - started,
            { approvalId: approvedApprovalId });
          return this.limit({ success: true, data });
        }

        // No approval yet — create one (idempotent by argsHash).
        const argsHash = createHash('sha256').update(JSON.stringify(parsed.data)).digest('hex');
        const existing = await this.prisma.approvalRequest.findFirst({
          where: {
            tenantId: claims.tenantId,
            status: 'PENDING',
            resourceType: 'accounting_tool_call',
            resourceId: claims.executionId,
            AND: [
              { payload: { path: ['toolName'], equals: toolName } },
              { payload: { path: ['argsHash'], equals: argsHash } },
            ],
          },
          select: { id: true },
        });
        if (existing) {
          await this.audit(claims, name, parsed.data, 'deferred', Date.now() - started,
            { approvalId: existing.id, reused: true });
          return { success: true, deferred: true, approvalId: existing.id };
        }
        const approval = await this.approvals.create(claims.tenantId, {
          title: `Approve ${toolName}`,
          description: `Accounting execution ${claims.executionId} requested ${toolName}`,
          resourceType: 'accounting_tool_call',
          resourceId: claims.executionId,
          requestedById: claims.sub,
          payload: {
            toolName, args: parsed.data, argsHash,
            executionId: claims.executionId,
          },
        });
        await this.audit(claims, name, parsed.data, 'deferred', Date.now() - started,
          { approvalId: approval.id });
        return { success: true, deferred: true, approvalId: approval.id };
      }

      // TIER-1: dispatch directly.
      const data = await this.dispatch(toolName, a, claims);
      await this.audit(claims, name, parsed.data, 'allowed', Date.now() - started);
      return this.limit({ success: true, data });
    } catch (error) {
      await this.audit(claims, name, parsed.data, 'failed', Date.now() - started,
        { message: error instanceof Error ? error.message : String(error) });
      if (error instanceof BadRequestException
          || error instanceof ForbiddenException
          || error instanceof NotFoundException) {
        throw error;
      }
      return {
        success: false,
        error: {
          code: 'TOOL_EXECUTION_FAILED',
          message: error instanceof Error ? error.message : 'Tool execution failed',
          retriable: false,
        },
      };
    }
  }

  private async dispatch(
    name: NcAccountingToolName,
    a: Record<string, any>,
    c: AccountingScopedTokenClaims,
  ): Promise<unknown> {
    switch (name) {
      case 'nc.accounting.compute_npv':
        return this.accounting.computeNpv(c.tenantId, c.sub,
          a.rate, a.cashflows);
      case 'nc.accounting.compute_irr':
        return this.accounting.computeIrr(c.tenantId, c.sub, a.cashflows);
      case 'nc.accounting.compute_mirr':
        return this.accounting.computeMirr(c.tenantId, c.sub,
          a.financeRate, a.reinvestRate, a.cashflows);
      case 'nc.accounting.amortize_loan':
        return this.accounting.amortizeLoan(c.tenantId, c.sub,
          a.principal, a.rate, a.nper);
      case 'nc.accounting.validate_postings':
        // The sidecar already provides this; we proxy through AccountingService.
        return this.accounting.validatePostings(c.tenantId, c.sub, a.postings);
      case 'nc.accounting.export_beancount':
        return this.accounting.exportBeancount(c.tenantId,
          a.asOf ? new Date(a.asOf) : undefined);
      case 'nc.accounting.get_account_balance':
        return this.accounting.getAccountBalance(c.tenantId, a.accountCode,
          a.asOf ? new Date(a.asOf) : undefined);
      case 'nc.accounting.list_accounts':
        return this.accounting.listAccounts(c.tenantId,
          { type: a.type, isActive: a.isActive });
      case 'nc.accounting.list_periods':
        return this.accounting.listPeriods(c.tenantId, a.fiscalYear, a.status);
      case 'nc.accounting.generate_report':
        return this.accounting.generateReport(c.tenantId, c.sub, a.type,
          a.asOf ? new Date(a.asOf) : undefined);
      case 'nc.accounting.post_ledger':
        return this.accounting.postJournalEntry(c.tenantId, c.sub, {
          periodId: a.periodId,
          txnDate: new Date(a.txnDate),
          narration: a.narration,
          postings: a.postings,
          approvalId: c.executionId, // caller passes the approved approval id; see execute()
        });
      case 'nc.accounting.create_account':
        return this.accounting.createAccount(c.tenantId, c.sub, {
          code: a.code,
          name: a.name,
          type: a.type,
          normalBalance: a.normalBalance,
          parentCode: a.parentCode,
          currency: a.currency,
          isLeaf: a.isLeaf,
          description: a.description,
        });
      case 'nc.accounting.create_period':
        return this.accounting.createPeriod(c.tenantId, c.sub, {
          code: a.code,
          name: a.name,
          startDate: new Date(a.startDate),
          endDate: new Date(a.endDate),
          fiscalYear: a.fiscalYear,
        });
      case 'nc.accounting.close_period':
        return this.accounting.closePeriod(c.tenantId, c.sub, a.periodId);
      case 'nc.accounting.record_finding':
        return this.prisma.auditFinding.create({
          data: {
            tenantId: c.tenantId,
            severity: a.severity,
            category: a.category,
            title: a.title,
            description: a.description,
            evidence: a.evidence as Prisma.InputJsonValue,
            recommendation: a.recommendation ?? null,
            scenarioId: a.scenarioId ?? null,
            simulationRunId: a.simulationRunId ?? null,
          },
        });
    }
  }

  private limit(result: ToolGatewayResult): ToolGatewayResult {
    const encoded = JSON.stringify(result);
    if (Buffer.byteLength(encoded) <= 50 * 1024) return result;
    return { success: true, data: encoded.slice(0, 50 * 1024), truncated: true };
  }

  private async audit(
    c: AccountingScopedTokenClaims,
    toolName: string,
    args: unknown,
    decision: string,
    durationMs: number,
    extra: unknown = {},
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actor: c.sub,
        tenantId: c.tenantId,
        action: 'accounting.tool.call',
        resource: toolName,
        resourceId: c.executionId,
        result: decision === 'allowed' || decision === 'deferred' ? 'success' : 'failure',
        correlationId: c.executionId,
        details: {
          toolName,
          argsHash: createHash('sha256').update(JSON.stringify(args ?? {})).digest('hex'),
          decision,
          durationMs,
          extra,
        } as Prisma.InputJsonValue,
      },
    });
  }
}