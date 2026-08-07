import { Phase17CertificationRunner } from './phase17-certification.runner';

describe('Phase 17 — G17 Sales Analytics', () => {
  it('APPROVED — every Phase 17 gate passes', async () => {
    const runner = new Phase17CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.detail ?? ''}`);
      throw new Error(
        `Phase 17 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
