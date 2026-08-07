import { CampaignBriefSkill } from './campaign-brief.skill';

const ctx = () => ({
  tenantId: 'tenant-A',
  isCrossTenant: false,
  actorRole: 'OWNER' as const,
  actorUserId: 'u1',
});

describe('Phase 19 — CampaignBriefSkill', () => {
  const skill = new CampaignBriefSkill();

  it('rejects unknown brand voice', () => {
    expect(
      skill.validateInput({ tenantId: 't', topic: 'x', brandVoice: 'mystery' }),
    ).toBe(false);
  });

  it('accepts documented brand voices', () => {
    for (const v of ['formal', 'casual', 'friendly', 'urgent', 'neutral'] as const) {
      expect(skill.validateInput({ tenantId: 't', topic: 'x', brandVoice: v })).toBe(true);
    }
  });

  it('parse falls back to typed default on non-JSON input', () => {
    const { prompt } = skill.buildPrompt({ tenantId: 't', topic: 'topic' }, ctx());
    const parsed = prompt.parse('not json') as {
      content: { title: string; body: string };
    };
    expect(parsed.content.title).toBe('Untitled brief');
    expect(parsed.content.body).toBe('not json');
  });

  it('parse surfaces a typed brief on valid JSON', () => {
    const { prompt } = skill.buildPrompt({ tenantId: 't', topic: 'topic' }, ctx());
    const sample = JSON.stringify({
      content: {
        title: 'Q3 launch',
        themes: ['growth', 'automation'],
        subjectLines: ['Meet your AI twin', '5 minutes to ship'],
        body: '# Launch',
        forbiddenPhrases: ['cheap'],
        brandVoice: 'friendly',
      },
      limits: [],
    });
    const parsed = prompt.parse(sample) as {
      content: { title: string; themes: string[]; subjectLines: string[] };
    };
    expect(parsed.content.title).toBe('Q3 launch');
    expect(parsed.content.themes).toEqual(['growth', 'automation']);
    expect(parsed.content.subjectLines).toHaveLength(2);
  });
});
