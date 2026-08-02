/**
 * P9 — CORE scenarios (CORE-001..006).
 */

import { scenariosByCategory } from './scenario-index';

describe('P9 — CORE scenarios', () => {
  const scenarios = scenariosByCategory('CORE');
  it('registers every CORE scenario', () => {
    const ids = scenarios.map((s) => s.scenarioId);
    expect(ids).toEqual(
      expect.arrayContaining([
        'CORE-001',
        'CORE-002',
        'CORE-003',
        'CORE-004',
        'CORE-005',
        'CORE-006',
      ]),
    );
  });
  for (const scenario of scenarios) {
    it(`${scenario.scenarioId} maps to capability ${scenario.capabilityIds.join(',')}`, () => {
      expect(scenario.capabilityIds.length).toBeGreaterThan(0);
      expect(scenario.scenarioId).toMatch(/^CORE-\d{3}$/);
    });
  }
});
