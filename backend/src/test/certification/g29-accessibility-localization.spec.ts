/**
 * Phase 29 — G29 WCAG 2.2 AA + localization certification spec.
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 */

import { Phase29CertificationRunner } from './phase29-certification.runner';

describe('Phase 29 — G29 Accessibility WCAG 2.2 AA + localization (CR-AI-1304)', () => {
  it('APPROVED — every Phase 29 gate passes', async () => {
    const runner = new Phase29CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.name} — ${g.detail ?? ''}`);
      throw new Error(
        `Phase 29 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 120_000);
});
