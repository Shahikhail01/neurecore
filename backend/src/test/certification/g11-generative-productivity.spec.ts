/**
 * Phase 11 — G11 Generative Productivity runner as a jest test.
 *
 * CI usage: jest --testPathPatterns=g11-generative-productivity
 *
 * Emits PASS / FAIL rows matching the Phase 9 G9 convention.
 */

import { Phase11CertificationRunner } from './phase11-certification.runner';

describe('Phase 11 — G11 Generative Productivity', () => {
  it('APPROVED — every Phase 11 gate passes', async () => {
    const runner = new Phase11CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      // Provide a useful failure message listing all gates.
      const failing = out.gates.filter((g) => !g.passed).map((g) => `${g.id}: ${g.detail ?? ''}`);
      throw new Error(
        `Phase 11 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 30_000);
});
