/**
 * Phase 13 — G13 runner as a jest test.
 */

import { Phase13CertificationRunner } from './phase13-certification.runner';

describe('Phase 13 — G13 Agents', () => {
  it('APPROVED — every Phase 13 gate passes', async () => {
    const runner = new Phase13CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.detail ?? ''}`);
      throw new Error(
        `Phase 13 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
