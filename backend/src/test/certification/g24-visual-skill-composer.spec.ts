/**
 * Phase 24 — G24 Visual skill composer certification spec.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §5 (P24).
 */

import { Phase24CertificationRunner } from './phase24-certification.runner';

describe('Phase 24 — G24 Visual skill composer (CR-AI-0602)', () => {
  it('APPROVED — every Phase 24 gate passes', async () => {
    const runner = new Phase24CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.name} — ${g.detail ?? ''}`);
      throw new Error(
        `Phase 24 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
