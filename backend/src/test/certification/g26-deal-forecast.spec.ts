/**
 * Phase 26 — G26 Deal-forecast certification spec.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §7 (P26).
 */

import { Phase26CertificationRunner } from './phase26-certification.runner';

describe('Phase 26 — G26 Deal model + forecast (CR-AI-0703)', () => {
  it('APPROVED — every Phase 26 gate passes', async () => {
    const runner = new Phase26CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.name} — ${g.detail ?? ''}`);
      throw new Error(
        `Phase 26 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
