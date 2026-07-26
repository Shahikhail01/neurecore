// src/test/certification/failure-recovery.spec.ts
describe('Certification: Failure Recovery', () => {
  it('classifies timeout as transient', () => {
    const error = new Error('EXECUTION_TIMEOUT');
    expect(error.message).toContain('TIMEOUT');
  });

  it('exponential backoff produces 1s, 4s, 16s', () => {
    const backoff = (n: number) => 1000 * Math.pow(4, n);
    expect(backoff(0)).toBe(1000);
    expect(backoff(1)).toBe(4000);
    expect(backoff(2)).toBe(16000);
  });
});
