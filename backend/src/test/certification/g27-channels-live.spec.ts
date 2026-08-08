/**
 * Phase 27 — G27 Live channels certification spec.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §8 (P27).
 *
 * Closes CR-AI-1103 / CR-AI-1104 / CR-AI-1106.
 */

import { Phase27CertificationRunner } from './phase27-certification.runner';

describe('Phase 27 — G27 Live channels (CR-AI-1103, CR-AI-1104, CR-AI-1106)', () => {
  it('APPROVED — every Phase 27 gate passes', async () => {
    const runner = new Phase27CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.name} — ${g.detail ?? ''}`);
      throw new Error(
        `Phase 27 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
