import { Phase15CertificationRunner } from './phase15-certification.runner';

describe('Phase 15 — G15 Core UX', () => {
  it('APPROVED — every Phase 15 gate passes', async () => {
    const runner = new Phase15CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.detail ?? ''}`);
      throw new Error(
        `Phase 15 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
