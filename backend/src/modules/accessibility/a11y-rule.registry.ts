/**
 * Phase 29 — A11y rule registry (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * SOLID
 *   OCP — the registry is keyed by `WcagCriterion`. Adding a criterion
 *         check is one rule class plus one multi-bound provider; the
 *         runner, the sinks and the CLI never change.
 *   SRP — owns ONLY registration and lookup.
 *   DIP — rules arrive through the `A11Y_RULE` token, so the registry
 *         never constructs a rule itself.
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  A11Y_RULE,
  A11Y_RULE_REGISTRY,
  type IA11yRule,
  type WcagCriterion,
} from './interfaces/IA11yRule';

@Injectable()
export class A11yRuleRegistry implements OnModuleInit {
  private readonly logger = new Logger(A11yRuleRegistry.name);
  private readonly byCriterion = new Map<WcagCriterion, IA11yRule[]>();
  private readonly byId = new Map<string, IA11yRule>();

  constructor(
    @Inject(A11Y_RULE)
    private readonly injectedRules: ReadonlyArray<IA11yRule>,
  ) {}

  onModuleInit(): void {
    for (const rule of this.injectedRules) this.register(rule);
    this.logger.log(
      `A11yRuleRegistry wired ${this.byId.size} rule(s) across ${this.byCriterion.size} WCAG criteria`,
    );
  }

  register(rule: IA11yRule): void {
    if (this.byId.has(rule.id)) return;
    this.byId.set(rule.id, rule);
    const bucket = this.byCriterion.get(rule.criterion) ?? [];
    bucket.push(rule);
    this.byCriterion.set(rule.criterion, bucket);
  }

  forCriterion(criterion: WcagCriterion): ReadonlyArray<IA11yRule> {
    return this.byCriterion.get(criterion) ?? [];
  }

  has(ruleId: string): boolean {
    return this.byId.has(ruleId);
  }

  /** Every rule, ordered by criterion then rule id — stable reports. */
  ordered(): ReadonlyArray<IA11yRule> {
    return [...this.byId.values()].sort((a, b) => {
      if (a.criterion !== b.criterion) {
        return a.criterion.localeCompare(b.criterion);
      }
      return a.id.localeCompare(b.id);
    });
  }
}

export const a11yRuleRegistryProvider = {
  provide: A11Y_RULE_REGISTRY,
  useFactory: (registry: A11yRuleRegistry) => registry,
  inject: [A11yRuleRegistry],
};
