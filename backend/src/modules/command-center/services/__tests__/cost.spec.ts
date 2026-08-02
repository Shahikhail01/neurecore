/**
 * cost.spec.ts — CostService unit coverage (P8 CR-AI-1203).
 *
 * Asserts the pure helper that derives budget utilisation.
 */

import { computeCostUtilization } from '../cost.service';

describe('CostService.computeCostUtilization (P8 CR-AI-1203)', () => {
  it('returns 0% when no budgets', () => {
    const out = computeCostUtilization([]);
    expect(out.totalBudgetCents).toBe(0);
    expect(out.totalCurrentSpend).toBe(0);
    expect(out.utilizationPercent).toBe(0);
  });

  it('sums Decimal-string budget fields correctly', () => {
    const out = computeCostUtilization([
      { limitCents: '10000', currentSpendCents: '2500' },
      { limitCents: '5000', currentSpendCents: '5000' },
    ]);
    expect(out.totalBudgetCents).toBe(15000);
    expect(out.totalCurrentSpend).toBe(7500);
    expect(out.utilizationPercent).toBeCloseTo(0.5);
  });

  it('returns 0 utilisation when total budget is 0 (no divide-by-zero)', () => {
    const out = computeCostUtilization([
      { limitCents: '0', currentSpendCents: '500' },
    ]);
    expect(out.utilizationPercent).toBe(0);
  });

  it('accepts numeric inputs', () => {
    const out = computeCostUtilization([
      { limitCents: 200, currentSpendCents: 50 },
    ]);
    expect(out.totalBudgetCents).toBe(200);
    expect(out.utilizationPercent).toBeCloseTo(0.25);
  });
});
