/**
 * Phase 30 — CostCeilingService (CR-AI-1305).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §11 (P30).
 *
 * The enforcement point. For a tenant it:
 *   1. loads the configured ceilings,
 *   2. measures usage once,
 *   3. asks every registered rule for its verdict,
 *   4. denies the call with a typed error on the first breach and
 *      emits an append-only alert.
 *
 * It contains no per-dimension knowledge whatsoever — that is what
 * makes "a new dimension = one rule" true rather than aspirational.
 *
 * SOLID
 *   SRP — owns ONLY authorise / report / status orchestration.
 *   OCP — dimensions arrive through the registry.
 *   ISP — implements the two-method `ICostCeilingEnforcer` for the
 *         call path; configuration lives on the repository.
 *   DIP — every collaborator is injected through a DI token.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CEILING_RULE_REGISTRY,
  COST_ALERT_SINK,
  USAGE_REPORTER,
  ZERO_PROJECTION,
  type CeilingConfig,
  type CeilingEvaluation,
  type CostProjection,
  type CostUsageSnapshot,
} from './interfaces/ICeilingRule';
import type { IUsageReporter } from './interfaces/IUsageReporter';
import type { IAlertSink } from './interfaces/IAlertSink';
import {
  SPEND_RECORDER,
  type ISpendRecorder,
} from './interfaces/ISpendRecorder';
import type {
  CeilingAuthorizationRequest,
  ICostCeilingEnforcer,
  SpendReport,
} from './interfaces/ICostCeilingEnforcer';
import {
  CostCeilingExceededError,
  CostCeilingScopeError,
} from './cost-ceiling.errors';
import type { CeilingRuleRegistry } from './ceiling-rule.registry';
import { TenantCostCeilingRepository } from './config/tenant-cost-ceiling.repository';
import { RequestRateWindow } from './usage/request-rate.window';

export interface CeilingStatus {
  readonly tenantId: string;
  readonly usage: CostUsageSnapshot;
  readonly evaluations: ReadonlyArray<CeilingEvaluation>;
  readonly anyExceeded: boolean;
}

@Injectable()
export class CostCeilingService implements ICostCeilingEnforcer {
  private readonly logger = new Logger(CostCeilingService.name);

  constructor(
    private readonly repository: TenantCostCeilingRepository,
    @Inject(CEILING_RULE_REGISTRY)
    private readonly rules: CeilingRuleRegistry,
    @Inject(USAGE_REPORTER) private readonly usage: IUsageReporter,
    @Inject(COST_ALERT_SINK) private readonly alerts: IAlertSink,
    @Inject(SPEND_RECORDER) private readonly spend: ISpendRecorder,
    private readonly rateWindow: RequestRateWindow,
  ) {}

  /**
   * Deny the call when any enabled ceiling would be breached. The
   * request is counted against the rate window only after it is
   * authorised, so a denied call never inflates the tenant's rate.
   */
  async authorize(request: CeilingAuthorizationRequest): Promise<void> {
    this.assertScope(request.tenantId, 'authorize');
    const projection = request.projection ?? ZERO_PROJECTION;
    const configs = await this.repository.list(request.tenantId);
    if (configs.length === 0) {
      this.rateWindow.record(request.tenantId);
      return;
    }

    const usage = await this.usage.snapshot(request.tenantId);
    for (const evaluation of this.evaluate(usage, configs, projection)) {
      if (!evaluation.exceeded) continue;
      await this.alerts.alert({
        tenantId: request.tenantId,
        capability: request.capability,
        evaluation,
        ...(request.actorUserId ? { actorUserId: request.actorUserId } : {}),
      });
      this.logger.warn(
        `cost ceiling ${evaluation.dimension} denied tenant=${request.tenantId} used=${evaluation.used} limit=${evaluation.limitValue}`,
      );
      throw new CostCeilingExceededError(
        request.tenantId,
        request.capability,
        evaluation,
      );
    }
    this.rateWindow.record(request.tenantId);
  }

  /** Persist realised spend so the next authorisation sees it. */
  async reportSpend(report: SpendReport): Promise<void> {
    this.assertScope(report.tenantId, 'reportSpend');
    await this.spend.record(report);
  }

  /** Read-only projection for the Command Center dashboard. */
  async status(tenantId: string): Promise<CeilingStatus> {
    this.assertScope(tenantId, 'status');
    const [configs, usage] = await Promise.all([
      this.repository.list(tenantId),
      this.usage.snapshot(tenantId),
    ]);
    const evaluations = this.evaluate(usage, configs, ZERO_PROJECTION);
    return {
      tenantId,
      usage,
      evaluations,
      anyExceeded: evaluations.some((e) => e.exceeded),
    };
  }

  private evaluate(
    usage: CostUsageSnapshot,
    configs: ReadonlyArray<CeilingConfig>,
    projection: CostProjection,
  ): ReadonlyArray<CeilingEvaluation> {
    const byDimension = new Map(configs.map((c) => [c.dimension, c]));
    const evaluations: CeilingEvaluation[] = [];
    for (const rule of this.rules.ordered()) {
      const config = byDimension.get(rule.dimension);
      if (!config) continue;
      evaluations.push(rule.evaluate(usage, config, projection));
    }
    return evaluations;
  }

  private assertScope(tenantId: string, operation: string): void {
    if (!tenantId || tenantId === '*') {
      throw new CostCeilingScopeError(operation);
    }
  }
}
