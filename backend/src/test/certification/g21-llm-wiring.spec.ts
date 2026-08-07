import { Phase21CertificationRunner } from './phase21-certification.runner';

describe('Phase 21 — G21 LLM-wiring', () => {
  it('APPROVED — every Phase 21 gate passes', async () => {
    const runner = new Phase21CertificationRunner();
    const out = await runner.run();
    if (out.verdict !== 'APPROVED') {
      const failing = out.gates
        .filter((g) => !g.passed)
        .map((g) => `${g.id}: ${g.detail ?? ''}`);
      throw new Error(
        `Phase 21 verdict = ${out.verdict}\nFailing gates:\n  - ${failing.join('\n  - ')}`,
      );
    }
    expect(out.verdict).toBe('APPROVED');
  }, 60_000);
});
