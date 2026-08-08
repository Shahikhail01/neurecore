/**
 * Phase 30 — G30 Resilience + per-tenant cost ceiling spec.
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §11 (P30).
 */

import { Phase30CertificationRunner } from './phase30-certification.runner';

describe('Phase 30 — G30 Resilience + per-tenant cost ceiling (CR-AI-1305)', () => {
  it('APPROVED — every Phase 30 gate passes', async () => {
    const runner = new Phase30CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.name} — ${g.detail ?? ''}`);
      throw new Error(
        `Phase 30 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 180_000);
});
