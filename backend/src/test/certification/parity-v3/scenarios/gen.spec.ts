/**
 * P9 — GEN scenarios (GEN-001..007).
 */

import { scenariosByCategory } from './scenario-index';

describe('P9 — GEN scenarios', () => {
  const scenarios = scenariosByCategory('GEN');
  it('registers every GEN scenario', () => {
    const ids = scenarios.map((s) => s.scenarioId);
    expect(ids).toEqual(
      expect.arrayContaining([
        'GEN-001',
        'GEN-002',
        'GEN-003',
        'GEN-004',
        'GEN-005',
        'GEN-006',
        'GEN-007',
      ]),
    );
  });
  for (const scenario of scenarios) {
    it(`${scenario.scenarioId} maps to capability ${scenario.capabilityIds.join(',')}`, () => {
      expect(scenario.capabilityIds.length).toBeGreaterThan(0);
      expect(scenario.scenarioId).toMatch(/^GEN-\d{3}$/);
    });
  }
});
