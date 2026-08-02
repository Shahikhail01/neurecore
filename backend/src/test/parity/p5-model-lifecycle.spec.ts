/**
 * P5 — Model lifecycle unit tests.
 */

import { MODEL_LIFECYCLE_STAGES } from '../../../src/modules/analytics/services/model-lifecycle.service';

describe('P5 — model lifecycle', () => {
  it('exposes the 11 lifecycle stages', () => {
    expect(MODEL_LIFECYCLE_STAGES.length).toBe(11);
  });
});
