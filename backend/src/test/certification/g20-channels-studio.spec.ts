import { Phase20CertificationRunner } from './phase20-certification.runner';

describe('Phase 20 — G20 Channels + Mobile', () => {
  it('APPROVED — every Phase 20 gate passes', async () => {
    const runner = new Phase20CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.detail ?? ''}`);
      throw new Error(
        `Phase 20 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
