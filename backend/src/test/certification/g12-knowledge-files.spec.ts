/**
 * Phase 12 — G12 runner as a jest test.
 */

import { Phase12CertificationRunner } from './phase12-certification.runner';

describe('Phase 12 — G12 Knowledge + Files', () => {
  it('APPROVED — every Phase 12 gate passes', async () => {
    const runner = new Phase12CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.detail ?? ''}`);
      throw new Error(
        `Phase 12 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 30_000);
});
