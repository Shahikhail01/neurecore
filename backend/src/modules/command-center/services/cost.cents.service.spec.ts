/**
 * Phase 14 — CostCentsService unit tests.
 *
 * Validates:
 *   - toCents is integer-round + type-safe
 *   - centsAdd / centsSub are integer-safe
 *   - centsRatio returns 0 for non-positive denominators (no
 *     division-by-zero at the dashboard layer)
 *   - summaryForTenant adapts the CostResponseDto to Cents types
 */

import {
  toCents,
  centsAdd,
  centsSub,
  centsRatio,
  ZERO_CENTS,
  CostCentsService,
} from './cost.cents.service';

describe('Phase 14 — cents helpers', () => {
  it('toCents rounds half-up to the nearest cent', () => {
    // IEEE 754 means Math.round(1.255) === 1 on most runtimes; we
    // accept whatever the runtime gives — every value below is
    // unambiguous.
    expect(toCents(1.234)).toBe(1);
    expect(toCents(1.5)).toBe(2);
    expect(toCents(1.49)).toBe(1);
    expect(toCents(0.0)).toBe(0);
    expect(toCents(-1.4)).toBe(-1);
    expect(toCents(1234)).toBe(1234);
  });

  it('toCents rejects non-finite values', () => {
    expect(() => toCents(Number.NaN)).toThrow(TypeError);
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it('centsAdd / centsSub are integer-safe', () => {
    expect(centsAdd(toCents(2), toCents(3))).toBe(5);
    expect(centsSub(toCents(10), toCents(3))).toBe(7);
    expect(ZERO_CENTS).toBe(0);
  });

  it('centsRatio returns 0 for non-positive denominators', () => {
    expect(centsRatio(toCents(10), toCents(0))).toBe(0);
    expect(centsRatio(toCents(10), toCents(-1))).toBe(0);
  });

  it('centsRatio returns exact float ratio otherwise', () => {
    expect(centsRatio(toCents(50), toCents(100))).toBe(0.5);
    expect(centsRatio(toCents(75), toCents(300))).toBe(0.25);
  });
});

describe('Phase 14 — CostCentsService', () => {
  function makeService(adapter: unknown): CostCentsService {
    return new CostCentsService(
      // stub CostService — we never reach the network in unit tests
      adapter as never,
    );
  }

  it('summaryForTenant maps response to Cents types', async () => {
    const svc = makeService({
      getCosts: async () => ({
        tenantId: 't',
        monthToDateCents: '12345',
        monthToDateTokens: 0,
        totalBudgetCents: '20000',
        utilizationPercent: '0.6173',
        byModel: [
          { provider: 'openai', model: 'gpt-4o-mini', costCents: '12000', tokens: 0, source: 'CostRecord' },
          { provider: 'anthropic', model: 'claude-3-haiku', costCents: '345', tokens: 0, source: 'CostRecord' },
        ],
        budgets: [],
        windowStart: '2026-08-01T00:00:00Z',
        windowEnd: '2026-08-06T20:00:00Z',
        fetchedAt: '2026-08-06T20:00:00Z',
      }),
    });
    const out = await svc.summaryForTenant('t');
    expect(out.totalSpent).toBe(12345);
    expect(out.totalBudget).toBe(20000);
    expect(out.utilization).toBeCloseTo(0.6173, 4);
    expect(out.byModel).toHaveLength(2);
    expect(out.byModel[0]!.spent).toBe(12000);
    expect(out.byModel[1]!.spent).toBe(345);
  });

  it('summaryForTenant tolerates missing window (server time fallback)', async () => {
    const svc = makeService({
      getCosts: async () => ({
        tenantId: 't',
        monthToDateCents: '0',
        monthToDateTokens: 0,
        totalBudgetCents: '0',
        utilizationPercent: '0',
        byModel: [],
        budgets: [],
        windowStart: undefined as unknown as string,
        windowEnd: undefined as unknown as string,
        fetchedAt: new Date().toISOString(),
      }),
    });
    const out = await svc.summaryForTenant('t');
    expect(out.periodStart).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(out.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});
