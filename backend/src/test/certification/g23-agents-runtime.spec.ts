/**
 * Phase 23 — G23 Agents Runtime jest test entry.
 */

import { Phase23CertificationRunner } from './phase23-certification.runner';

describe('Phase 23 — G23 Agents Runtime', () => {
  it('APPROVED — every Phase 23 gate passes', async () => {
    const runner = new Phase23CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.detail ?? ''}`);
      throw new Error(
        `Phase 23 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
