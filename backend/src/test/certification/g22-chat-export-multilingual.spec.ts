/**
 * Phase 22 — G22 Chat export + multilingual certification spec.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §3 (P22).
 */

import { Phase22CertificationRunner } from './phase22-certification.runner';

describe('Phase 22 — G22 Chat export + multilingual (CR-AI-0003, CR-AI-0004)', () => {
  it('APPROVED — every Phase 22 gate passes', async () => {
    const runner = new Phase22CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.name} — ${g.detail ?? ''}`);
      throw new Error(
        `Phase 22 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
