/**
 * command-center/services/cost.service.ts
 *
 * P8 — CR-AI-1203 Cost view.
 *
 * Reconciles CostRecord aggregates (per-model, per-provider) with
 * BudgetPolicy utilisation. Every figure traces to a source row.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  CostResponseDto,
  CostByModelDto,
  CostBudgetDto,
} from '../dto/cost.dto';

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function computeCostUtilization(
  budgets: ReadonlyArray<{
    limitCents: number | string;
    currentSpendCents: number | string;
  }>,
): {
  totalBudgetCents: number;
  totalCurrentSpend: number;
  utilizationPercent: number;
} {
  const totalBudget = budgets.reduce(
    (a, b) => a + Number(b.limitCents ?? 0),
    0,
  );
  const totalSpend = budgets.reduce(
    (a, b) => a + Number(b.currentSpendCents ?? 0),
    0,
  );
  return {
    totalBudgetCents: totalBudget,
    totalCurrentSpend: totalSpend,
    utilizationPercent: totalBudget > 0 ? totalSpend / totalBudget : 0,
  };
}

@Injectable()
export class CostService {
  constructor(private readonly prisma: PrismaService) {}

  async getCosts(tenantId: string): Promise<CostResponseDto> {
    const now = new Date();
    const windowStart = startOfMonth(now);
    const windowEnd = now;

    const [byModelRaw, budgets] = await Promise.all([
      this.prisma.costRecord.groupBy({
        by: ['provider', 'model'],
        where: {
          tenantId,
          windowStart: { gte: windowStart },
          windowEnd: { lte: windowEnd },
        },
        _sum: { costCents: true, inputTokens: true, outputTokens: true },
      }),
      this.prisma.budgetPolicy.findMany({
        where: { tenantId, enabled: true },
        orderBy: { resetAt: 'asc' },
        select: {
          id: true,
          name: true,
          scope: true,
          limitCents: true,
          currentSpendCents: true,
          enabled: true,
          resetAt: true,
        },
      }),
    ]);

    const byModel: CostByModelDto[] = byModelRaw.map((r) => ({
      model: r.model,
      provider: r.provider,
      costCents: Number(r._sum.costCents ?? 0),
      tokens:
        Number(r._sum.inputTokens ?? 0) + Number(r._sum.outputTokens ?? 0),
      source: 'CostRecord',
    }));

    const monthToDateCents = byModel.reduce((a, b) => a + b.costCents, 0);
    const monthToDateTokens = byModel.reduce((a, b) => a + b.tokens, 0);

    const costBudgets: CostBudgetDto[] = budgets.map((b) => {
      const limit = Number(b.limitCents);
      const current = Number(b.currentSpendCents);
      return {
        id: b.id,
        name: b.name,
        scope: String(b.scope),
        limitCents: limit,
        currentSpendCents: current,
        utilizationPercent: limit > 0 ? (current / limit) * 100 : 0,
        enabled: b.enabled,
        resetAt: b.resetAt.toISOString(),
        source: 'BudgetPolicy',
      };
    });

    const totalBudgetCents = costBudgets.reduce((a, b) => a + b.limitCents, 0);
    const totalCurrentSpend = costBudgets.reduce(
      (a, b) => a + b.currentSpendCents,
      0,
    );
    const utilizationPercent =
      totalBudgetCents > 0 ? totalCurrentSpend / totalBudgetCents : 0;

    return {
      tenantId,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      fetchedAt: now.toISOString(),
      monthToDateCents,
      monthToDateTokens,
      totalBudgetCents,
      utilizationPercent,
      byModel,
      budgets: costBudgets,
    };
  }
}
