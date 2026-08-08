/**
 * Phase 30 — Cost ceiling module (CR-AI-1305).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §11 (P30).
 *
 * Wires the containment pipeline:
 *   TenantCostCeilingRepository → CeilingRuleRegistry (4 dimensions)
 *   → CostCeilingService → AuditCostAlertSink
 * plus the operator read model (`CostDashboardService`) and its HTTP
 * surface under the Command Center namespace.
 *
 * The rule list below is the ONLY place that changes when a cost
 * dimension is added — the OCP claim in §2 of the plan, made real.
 *
 * SOLID
 *   OCP — add a `CostCeilingDimension` member + one rule class + one
 *         entry in `CEILING_RULE_CLASSES`.
 *   DIP — the enforcement facade is published under the
 *         `COST_CEILING_ENFORCER` token, so the LLM runner depends on
 *         the interface and never on this module's internals.
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/infrastructure/database/database.module';
import { CommandCenterModule } from '@/modules/command-center/command-center.module';
import { ServiceGatewayFlagsModule } from '@/modules/service-gateway-v2/rollout/service-gateway-flags.module';
import {
  CEILING_RULE,
  COST_ALERT_SINK,
  COST_CEILING_ENFORCER,
  USAGE_REPORTER,
  type ICeilingRule,
} from './interfaces/ICeilingRule';
import { SPEND_RECORDER } from './interfaces/ISpendRecorder';
import {
  CeilingRuleRegistry,
  ceilingRuleRegistryProvider,
} from './ceiling-rule.registry';
import { MonthlySpendCeilingRule } from './rules/monthly-spend-ceiling.rule';
import { DailySpendCeilingRule } from './rules/daily-spend-ceiling.rule';
import { MonthlyTokenCeilingRule } from './rules/monthly-token-ceiling.rule';
import { RequestRateCeilingRule } from './rules/request-rate-ceiling.rule';
import { TenantCostCeilingRepository } from './config/tenant-cost-ceiling.repository';
import { RequestRateWindow } from './usage/request-rate.window';
import { PrismaUsageReporter } from './usage/prisma-usage.reporter';
import { PrismaSpendRecorder } from './usage/prisma-spend.recorder';
import { AuditCostAlertSink } from './alerts/audit-cost-alert.sink';
import { CostCeilingService } from './cost-ceiling.service';
import { CostCeilingTenantScopeService } from './cost-ceiling.tenant-scope.service';
import { CostDashboardService } from './cost-dashboard.service';
import { CostCeilingController } from './controllers/cost-ceiling.controller';

/** Every ceiling rule the registry multi-binds. One line per dimension. */
export const CEILING_RULE_CLASSES = [
  MonthlySpendCeilingRule,
  DailySpendCeilingRule,
  MonthlyTokenCeilingRule,
  RequestRateCeilingRule,
] as const;

@Module({
  imports: [DatabaseModule, CommandCenterModule, ServiceGatewayFlagsModule],
  controllers: [CostCeilingController],
  providers: [
    ...CEILING_RULE_CLASSES,
    {
      provide: CEILING_RULE,
      useFactory: (...rules: ICeilingRule[]) => rules,
      inject: [...CEILING_RULE_CLASSES],
    },
    CeilingRuleRegistry,
    ceilingRuleRegistryProvider,
    TenantCostCeilingRepository,
    RequestRateWindow,
    PrismaUsageReporter,
    { provide: USAGE_REPORTER, useExisting: PrismaUsageReporter },
    PrismaSpendRecorder,
    { provide: SPEND_RECORDER, useExisting: PrismaSpendRecorder },
    AuditCostAlertSink,
    { provide: COST_ALERT_SINK, useExisting: AuditCostAlertSink },
    CostCeilingService,
    { provide: COST_CEILING_ENFORCER, useExisting: CostCeilingService },
    CostCeilingTenantScopeService,
    CostDashboardService,
  ],
  exports: [
    CeilingRuleRegistry,
    CostCeilingService,
    CostCeilingTenantScopeService,
    CostDashboardService,
    TenantCostCeilingRepository,
    RequestRateWindow,
    COST_CEILING_ENFORCER,
  ],
})
export class CostCeilingModule {}
