/**
 * Accounting Capability — NestJS module.
 *
 * Plan ref: NC-ACCT-IMP-1 §5 (NestJS module), §6 (schema), §7 (tools).
 *
 * Architecture:
 *   - NestJS owns persistence (Postgres via Prisma) and Beancount snapshot
 *     regeneration. The Python sidecar is a stateless (compute) +
 *     stateful-but-isolated (reports via mmap'd snapshot) worker.
 *   - All ledger writes go through `LedgerRepositoryService` which writes
 *     rows + outbox events + snapshot regen in a single UoW.
 *   - TIER-2 (human) approval is enforced by `AccountingApprovalGuard`
 *     via the existing `ApprovalWorkflowEngine`.
 *   - SoD: `postingUserId != approvedById` is enforced at the DB level
 *     (CHECK constraint) AND at the application level by the guard.
 *
 * **What this module is NOT (yet):**
 *   - It does not include AR/AP/payroll/fixed-asset/bank-recon/tax subledgers.
 *   - It does not generate Beancount snapshot files (Phase 1k).
 *   - It does not run the Merkle root background job (Phase 1l).
 *   - It does not yet wire `nc.accounting.*` tools through
 *     `ScopedToolGatewayService` (Phase 1j).
 */

import { Module } from '@nestjs/common';
import { ConfigurationModule } from '../../config/configuration.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { OutboxModule } from '../../common/outbox/outbox.module';
import { ApprovalsModule } from '../approvals/approvals.module';

import { AccountingController } from './controllers/accounting.controller';
import { AccountingService } from './services/accounting.service';
import { AccountingTokenService } from './services/accounting-token.service';
import { LedgerRepositoryService } from './services/ledger-repository.service';
import { ChartOfAccountsService } from './services/chart-of-accounts.service';
import { AccountingPeriodService } from './services/accounting-period.service';
import { SegregationOfDutiesService } from './services/segregation-of-duties.service';
import { AccountingEventEmitterService } from './services/accounting-event-emitter.service';
import { BeancountSnapshotService } from './services/beancount-snapshot.service';
import { OutboxMerkleRootService } from './services/outbox-merkle-root.service';
import { HttpAccountingSidecarClient } from './infrastructure/http-accounting-sidecar.client';
import { AccountingApprovalGuard } from './guards/accounting-approval.guard';
import { AccountingScopedToolGatewayService } from './tools/accounting-tool-gateway.service';
import {
  NpvTool, IrrTool, MirrTool, AmortizeLoanTool,
  ACCOUNTING_STRUCTURED_TOOLS,
} from './tools/accounting-tools.providers';

@Module({
  imports: [
    ConfigurationModule,
    DatabaseModule,
    OutboxModule,
    ApprovalsModule,
  ],
  controllers: [AccountingController],
  providers: [
    AccountingService,
    AccountingTokenService,
    LedgerRepositoryService,
    ChartOfAccountsService,
    AccountingPeriodService,
    SegregationOfDutiesService,
    AccountingEventEmitterService,
    BeancountSnapshotService,
    OutboxMerkleRootService,
    HttpAccountingSidecarClient,
    AccountingApprovalGuard,
    AccountingScopedToolGatewayService,
    NpvTool,
    IrrTool,
    MirrTool,
    AmortizeLoanTool,
  ],
  exports: [
    AccountingService,
    AccountingTokenService,
    ChartOfAccountsService,
    AccountingPeriodService,
    LedgerRepositoryService,
    AccountingScopedToolGatewayService,
    ...ACCOUNTING_STRUCTURED_TOOLS,
  ],
})
export class AccountingModule {
}