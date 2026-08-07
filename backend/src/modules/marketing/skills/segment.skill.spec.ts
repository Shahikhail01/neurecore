/**
 * Phase 19 — SegmentSkill spec.
 */

import { SegmentSkill } from './segment.skill';

const ctx = () => ({
  tenantId: 'tenant-A',
  isCrossTenant: false,
  actorRole: 'OWNER' as const,
  actorUserId: 'u1',
});

describe('Phase 19 — SegmentSkill', () => {
  const skill = new SegmentSkill({} as never);

  it('rejects missing topic', () => {
    expect(skill.validateInput({ tenantId: 't' })).toBe(false);
  });

  it('rejects missing tenantId', () => {
    expect(skill.validateInput({ topic: 'x' })).toBe(false);
  });

  it('accepts a tenant + topic + sources', () => {
    expect(
      skill.validateInput({
        tenantId: 't',
        topic: 'enterprise SaaS',
        sources: [{ kind: 'text', text: 'enterprise SaaS' }],
      }),
    ).toBe(true);
  });

  it('parse emits empty segments when the model produces no JSON', () => {
    const { prompt } = skill.buildPrompt(
      {
        tenantId: 't',
        topic: 'whatever',
      },
      ctx(),
    );
    const parsed = prompt.parse('not json') as {
      content: { segments: unknown[] };
      limits: string[];
    };
    expect(parsed.content.segments).toEqual([]);
    expect(parsed.limits).toBeDefined();
  });

  it('parse surfaces valid typed segments when the model produces JSON', () => {
    const { prompt } = skill.buildPrompt(
      { tenantId: 't', topic: 'topic' },
      ctx(),
    );
    const sample = JSON.stringify({
      content: {
        segments: [
          {
            id: 's-1',
            topic: 'topic',
            memberCount: 2,
            members: [
              { recordType: 'customer', recordId: 'c-1', matchScore: 0.9 },
              { recordType: 'lead', recordId: 'l-1', matchScore: 0.8 },
            ],
            confidence: 0.9,
            permissions: ['read:customers'],
            explanation: 'matched by topic',
          },
        ],
      },
      limits: [],
    });
    const parsed = prompt.parse(sample) as {
      content: { segments: Array<{ id: string; memberCount: number; confidence: number }> };
    };
    expect(parsed.content.segments).toHaveLength(1);
    expect(parsed.content.segments[0]!.id).toBe('s-1');
    expect(parsed.content.segments[0]!.memberCount).toBe(2);
    expect(parsed.content.segments[0]!.confidence).toBe(0.9);
  });

  it('parse filters segments below confidence threshold', () => {
    const { prompt } = skill.buildPrompt(
      { tenantId: 't', topic: 'topic', minMemberCount: 10 },
      ctx(),
    );
    const sample = JSON.stringify({
      content: {
        segments: [
          { id: 's-1', topic: 't', memberCount: 1, members: [], confidence: 0.3, permissions: [], explanation: '' },
        ],
      },
      limits: [],
    });
    const parsed = prompt.parse(sample) as {
      content: { segments: unknown[] };
    };
    expect(parsed.content.segments).toEqual([]);
  });
});
