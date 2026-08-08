/**
 * Phase 30 — Ceiling rule registry (CR-AI-1305).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §11 (P30)
 * — "ceiling rules = `Map<CostDimension, ICeilingRule>`; a new
 * dimension = one rule".
 *
 * SOLID
 *   OCP — keyed by `CostDimension`; the service, the guard and the
 *         dashboard never gain a branch when a dimension is added.
 *   SRP — owns ONLY registration and lookup.
 *   DIP — rules arrive through the `CEILING_RULE` token.
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CEILING_RULE,
  CEILING_RULE_REGISTRY,
  COST_DIMENSIONS,
  type CostDimension,
  type ICeilingRule,
} from './interfaces/ICeilingRule';

export class UnknownCostDimensionError extends Error {
  constructor(readonly dimension: string) {
    super(`no ceiling rule registered for dimension "${dimension}"`);
    this.name = 'UnknownCostDimensionError';
  }
}

@Injectable()
export class CeilingRuleRegistry implements OnModuleInit {
  private readonly logger = new Logger(CeilingRuleRegistry.name);
  private readonly byDimension = new Map<CostDimension, ICeilingRule>();

  constructor(
    @Inject(CEILING_RULE)
    private readonly injected: ReadonlyArray<ICeilingRule>,
  ) {}

  onModuleInit(): void {
    for (const rule of this.injected) this.register(rule);
    this.logger.log(
      `CeilingRuleRegistry wired ${this.byDimension.size} rule(s): ${[...this.byDimension.keys()].join(', ')}`,
    );
  }

  register(rule: ICeilingRule): void {
    this.byDimension.set(rule.dimension, rule);
  }

  get(dimension: CostDimension): ICeilingRule {
    const rule = this.byDimension.get(dimension);
    if (!rule) throw new UnknownCostDimensionError(dimension);
    return rule;
  }

  has(dimension: CostDimension): boolean {
    return this.byDimension.has(dimension);
  }

  /** Registered rules in canonical dimension order — stable reports. */
  ordered(): ReadonlyArray<ICeilingRule> {
    return COST_DIMENSIONS.filter((d) => this.byDimension.has(d)).map((d) =>
      this.get(d),
    );
  }
}

export const ceilingRuleRegistryProvider = {
  provide: CEILING_RULE_REGISTRY,
  useFactory: (registry: CeilingRuleRegistry) => registry,
  inject: [CeilingRuleRegistry],
};
