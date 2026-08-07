import { CaseResponseSkill } from './case-response.skill';

const ctx = () => ({
  tenantId: 'tenant-A',
  isCrossTenant: false,
  actorRole: 'OWNER' as const,
  actorUserId: 'u1',
});

describe('Phase 19 — CaseResponseSkill', () => {
  const skill = new CaseResponseSkill();

  it('rejects unknown tone', () => {
    expect(
      skill.validateInput({
        tenantId: 't',
        caseId: 'c-1',
        subjectText: 'x',
        tone: 'shouty',
      }),
    ).toBe(false);
  });

  it('accepts documented tones', () => {
    for (const tone of ['formal', 'casual', 'friendly', 'urgent', 'neutral'] as const) {
      expect(
        skill.validateInput({
          tenantId: 't',
          caseId: 'c-1',
          subjectText: 'x',
          tone,
        }),
      ).toBe(true);
    }
  });

  it('parse falls back to NONE escalation + raw body on non-JSON', () => {
    const { prompt } = skill.buildPrompt(
      { tenantId: 't', caseId: 'c-1', subjectText: 'broken' },
      ctx(),
    );
    const parsed = prompt.parse('not json') as {
      content: { draftBody: string; recommendedEscalation: string };
    };
    expect(parsed.content.draftBody).toBe('not json');
    expect(parsed.content.recommendedEscalation).toBe('NONE');
  });

  it('parse surfaces typed escalation when model emits JSON', () => {
    const { prompt } = skill.buildPrompt(
      { tenantId: 't', caseId: 'c-1', subjectText: 'lost access' },
      ctx(),
    );
    const sample = JSON.stringify({
      content: {
        draftBody: 'Hi, we are looking into this now.',
        recommendedEscalation: 'TIER_2',
        escalationReason: 'Technical depth required',
      },
      limits: [],
    });
    const parsed = prompt.parse(sample) as {
      content: { recommendedEscalation: string; draftBody: string };
    };
    expect(parsed.content.recommendedEscalation).toBe('TIER_2');
    expect(parsed.content.draftBody).toContain('Hi');
  });
});
