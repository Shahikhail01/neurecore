/**
 * P9 — FILE / KNOW / MEET / P4 / P6 / SALES / MKT / SVC / PRED / CHAN / GOV scenarios.
 */

import { scenariosByCategory } from './scenario-index';

function categorySpec(
  category:
    | 'FILE'
    | 'KNOW'
    | 'MEET'
    | 'P4'
    | 'P6'
    | 'SALES'
    | 'MKT'
    | 'SVC'
    | 'PRED'
    | 'CHAN'
    | 'GOV',
  prefix: string,
): void {
  describe(`P9 — ${category} scenarios`, () => {
    const scenarios = scenariosByCategory(category);
    it(`registers ${category} scenarios`, () => {
      expect(scenarios.length).toBeGreaterThan(0);
      for (const s of scenarios) {
        expect(s.scenarioId.startsWith(prefix) || s.category === category).toBe(
          true,
        );
      }
    });
    for (const scenario of scenarios) {
      it(`${scenario.scenarioId} maps to capability ${scenario.capabilityIds.join(',')}`, () => {
        expect(scenario.capabilityIds.length).toBeGreaterThan(0);
      });
    }
  });
}

categorySpec('FILE', 'FILE');
categorySpec('KNOW', 'KNOW');
categorySpec('MEET', 'MEET');
categorySpec('P4', 'P4');
categorySpec('P6', 'P6');
categorySpec('SALES', 'SALES');
categorySpec('MKT', 'MKT');
categorySpec('SVC', 'SVC');
categorySpec('PRED', 'PRED');
categorySpec('CHAN', 'CHAN');
categorySpec('GOV', 'GOV');
