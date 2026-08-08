/**
 * Phase 28 — G28 Mobile FE certification spec.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §9 (P28).
 *
 * Closes CR-AI-1107.
 */

import { Phase28CertificationRunner } from './phase28-certification.runner';

describe('Phase 28 — G28 Mobile FE (CR-AI-1107)', () => {
  it('APPROVED — every Phase 28 gate passes', async () => {
    const runner = new Phase28CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.name} — ${g.detail ?? ''}`);
      throw new Error(
        `Phase 28 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
