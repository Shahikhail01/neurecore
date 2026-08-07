/**
 * Phase 14 — G14 runner as a jest test.
 */

import { Phase14CertificationRunner } from './phase14-certification.runner';

describe('Phase 14 — G14 Command Center', () => {
  it('APPROVED — every Phase 14 gate passes', async () => {
    const runner = new Phase14CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.detail ?? ''}`);
      throw new Error(
        `Phase 14 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
