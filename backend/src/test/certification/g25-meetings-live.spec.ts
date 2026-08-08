/**
 * Phase 25 — G25 Meetings-live certification spec.
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §6 (P25).
 */

import { Phase25CertificationRunner } from './phase25-certification.runner';

describe('Phase 25 — G25 Meetings live (CR-AI-0401..0404, CR-AI-1104)', () => {
  it('APPROVED — every Phase 25 gate passes', async () => {
    const runner = new Phase25CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.name} — ${g.detail ?? ''}`);
      throw new Error(
        `Phase 25 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
