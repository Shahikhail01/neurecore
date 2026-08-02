/**
 * quality.spec.ts — QualityService unit coverage (P8 CR-AI-1202).
 *
 * Asserts the pure helper that derives summary metrics from
 * execution logs + reviews.
 */

import { computeQualitySummary } from '../quality.service';

describe('QualityService.computeQualitySummary (P8 CR-AI-1202)', () => {
  it('returns null average when no scored attempts', () => {
    const out = computeQualitySummary([], [], 0, 0);
    expect(out.averageScore).toBeNull();
    expect(out.evaluatedCount).toBe(0);
    expect(out.abstentionCount).toBe(0);
    expect(out.correctionCount).toBe(0);
  });

  it('averages non-null scores and ignores nulls', () => {
    const out = computeQualitySummary(
      [
        { evaluationScore: 0.8, reflection: null },
        { evaluationScore: 0.6, reflection: null },
        { evaluationScore: null, reflection: null },
      ],
      [],
      0,
      0,
    );
    expect(out.averageScore).toBeCloseTo(0.7);
    expect(out.evaluatedCount).toBe(3);
  });

  it('counts abstentions via reflection keywords (case-insensitive)', () => {
    const out = computeQualitySummary(
      [
        { evaluationScore: 0.9, reflection: 'ABSTAIN: not supported' },
        { evaluationScore: 0.5, reflection: 'ok' },
        { evaluationScore: 0.4, reflection: 'abstention due to safety' },
      ],
      [],
      0,
      0,
    );
    expect(out.abstentionCount).toBe(2);
  });

  it('counts REJECTED + REVISION_REQUESTED reviews as corrections', () => {
    const out = computeQualitySummary(
      [],
      [
        { decision: 'APPROVED', comment: null },
        { decision: 'REJECTED', comment: 'wrong' },
        { decision: 'REVISION_REQUESTED', comment: null },
      ],
      1,
      2,
    );
    expect(out.correctionCount).toBe(2);
    expect(out.revisionCount).toBe(1);
    expect(out.feedbackCount).toBe(2);
  });

  it('handles empty input without throwing', () => {
    expect(() => computeQualitySummary([], [], 0, 0)).not.toThrow();
  });
});
