import { Phase18CertificationRunner } from './phase18-certification.runner';

describe('Phase 18 — G18 Platform', () => {
  it('APPROVED — every Phase 18 gate passes', async () => {
    const runner = new Phase18CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.detail ?? ''}`);
      throw new Error(
        `Phase 18 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
