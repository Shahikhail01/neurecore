import { Phase19CertificationRunner } from './phase19-certification.runner';

describe('Phase 19 — G19 Marketing / Service / Predictive / Outlook-Teams', () => {
  it('APPROVED — every Phase 19 gate passes', async () => {
    const runner = new Phase19CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.detail ?? ''}`);
      throw new Error(
        `Phase 19 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
