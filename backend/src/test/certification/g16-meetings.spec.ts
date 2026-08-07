import { Phase16CertificationRunner } from './phase16-certification.runner';

describe('Phase 16 — G16 Meetings', () => {
  it('APPROVED — every Phase 16 gate passes', async () => {
    const runner = new Phase16CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.detail ?? ''}`);
      throw new Error(
        `Phase 16 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
