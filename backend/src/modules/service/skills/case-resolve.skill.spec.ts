import { CaseResolveSkill } from './case-resolve.skill';

const ctx = () => ({
  tenantId: 'tenant-A',
  isCrossTenant: false,
  actorRole: 'OWNER' as const,
  actorUserId: 'u1',
});

describe('Phase 19 — CaseResolveSkill', () => {
  const skill = new CaseResolveSkill({} as never);

  it('rejects missing tenantId', () => {
    expect(skill.validateInput({ caseId: 'c-1', subjectText: 'x' })).toBe(false);
  });

  it('rejects missing caseId', () => {
    expect(skill.validateInput({ tenantId: 't', subjectText: 'x' })).toBe(false);
  });

  it('rejects missing subjectText', () => {
    expect(skill.validateInput({ tenantId: 't', caseId: 'c-1' })).toBe(false);
  });

  it('accepts a complete input', () => {
    expect(
      skill.validateInput({ tenantId: 't', caseId: 'c-1', subjectText: 'x' }),
    ).toBe(true);
  });

  it('parse falls back to typed default when model produces no JSON', () => {
    const { prompt } = skill.buildPrompt(
      { tenantId: 't', caseId: 'c-1', subjectText: 'broken item' },
      ctx(),
    );
    const parsed = prompt.parse('not json') as {
      content: { recommendations: unknown[] };
    };
    expect(parsed.content.recommendations).toEqual([]);
  });

  it('parse surfaces typed recommendations', () => {
    const { prompt } = skill.buildPrompt(
      { tenantId: 't', caseId: 'c-1', subjectText: 'broken' },
      ctx(),
    );
    const sample = JSON.stringify({
      content: {
        recommendations: [
          {
            knowledgeEntryId: 'k-1',
            title: 'How to fix it',
            excerpt: 'Step 1',
            matchScore: 0.9,
          },
        ],
      },
      limits: [],
    });
    const parsed = prompt.parse(sample) as {
      content: { recommendations: Array<{ knowledgeEntryId: string; matchScore: number }> };
    };
    expect(parsed.content.recommendations).toHaveLength(1);
    expect(parsed.content.recommendations[0]!.matchScore).toBe(0.9);
  });
});
