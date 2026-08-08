/**
 * Phase 30 — Cost + resilience dashboard (CR-AI-1305).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §11 (P30)
 * — "`CostDashboard` surface in Command Center (admin FE)".
 *
 * Composes three already-real reads into one operator view:
 *   • `CostCentsService`  — integer-cents spend vs soft budget
 *   • `CostCeilingService` — hard ceiling utilisation per dimension
 *   • `SloCounters`        — resilience counters (latency, denials,
 *                            duplicate effects, recovery)
 *
 * It computes nothing that the underlying services do not already
 * own, so a number on the dashboard always traces to a source row.
 *
 * SOLID
 *   SRP — owns ONLY composition for the read model.
 *   DIP — depends on three injected services; it opens no client.
 */

import { Injectable } from '@nestjs/common';
import {
  CostCentsService,
  type CCostSummary,
} from '@/modules/command-center/services/cost.cents.service';
import {
  SloCounters,
  type SloCountersSnapshot,
} from '@/modules/service-gateway-v2/rollout/slo-counters';
import { CostCeilingService, type CeilingStatus } from './cost-ceiling.service';
import { CostCeilingScopeError } from './cost-ceiling.errors';

export interface CostResilienceDashboard {
  readonly tenantId: string;
  readonly generatedAt: string;
  readonly cost: CCostSummary;
  readonly ceilings: CeilingStatus;
  readonly resilience: SloCountersSnapshot;
  /** True when any hard ceiling is currently breached. */
  readonly containmentActive: boolean;
}

@Injectable()
export class CostDashboardService {
  constructor(
    private readonly costs: CostCentsService,
    private readonly ceilings: CostCeilingService,
    private readonly slo: SloCounters,
  ) {}

  async dashboard(tenantId: string): Promise<CostResilienceDashboard> {
    if (!tenantId || tenantId === '*') {
      throw new CostCeilingScopeError('dashboard');
    }
    const [cost, ceilings, resilience] = await Promise.all([
      this.costs.summaryForTenant(tenantId),
      this.ceilings.status(tenantId),
      this.slo.aggregatedSnapshot(),
    ]);
    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      cost,
      ceilings,
      resilience,
      containmentActive: ceilings.anyExceeded,
    };
  }
}
