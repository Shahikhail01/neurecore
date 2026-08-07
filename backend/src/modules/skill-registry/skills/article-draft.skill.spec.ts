/**
 * ArticleDraftSkill — validateInput + buildPrompt tests.
 *
 * No LLM call. Validates every public branch.
 */

import { ArticleDraftSkill } from './article-draft.skill';

const ctx = () => ({
  tenantId: 'tenant-A',
  isCrossTenant: false,
  actorRole: 'OWNER' as const,
  actorUserId: 'u1',
});

describe('ArticleDraftSkill', () => {
  const skill = new ArticleDraftSkill();

  it('rejects empty topic', () => {
    expect(
      skill.validateInput({ topic: '', sources: [{ kind: 'text', text: 'x' }] }),
    ).toBe(false);
  });

  it('rejects empty sources', () => {
    expect(skill.validateInput({ topic: 'topic', sources: [] })).toBe(false);
  });

  it('rejects non-array sources', () => {
    expect(skill.validateInput({ topic: 'topic', sources: 'text' })).toBe(false);
  });

  it('accepts a topic + at least one source', () => {
    expect(
      skill.validateInput({
        topic: 'CRM scoring playbook',
        sources: [{ kind: 'text', text: 'prior notes' }],
      }),
    ).toBe(true);
  });

  it('builds a prompt that carries the topic in user-instruction', () => {
    const { prompt } = skill.buildPrompt(
      {
        topic: 'CRM scoring playbook',
        sources: [{ kind: 'text', text: 'prior notes' }],
      },
      ctx(),
    );
    expect(prompt.userInstruction).toContain('CRM scoring playbook');
    expect(prompt.sources).toHaveLength(1);
    expect(prompt.responseJsonRequired).toBe(true);
  });

  it('output parse falls back to a typed default when JSON is malformed', () => {
    const { prompt } = skill.buildPrompt(
      {
        topic: 'Topic',
        sources: [{ kind: 'text', text: 'source' }],
      },
      ctx(),
    );
    const parsed = prompt.parse('not json at all') as {
      content: {
        title: string;
        bodyMarkdown: string;
        proposedTags: string[];
        sources: string[];
      };
      limits: string[];
    };
    expect(parsed.content.title).toBe('Topic');
    expect(parsed.content.bodyMarkdown).toBe('not json at all');
    expect(parsed.content.proposedTags).toContain('knowledge-base');
  });

  it('output parse produces a typed object from valid JSON', () => {
    const { prompt } = skill.buildPrompt(
      {
        topic: 'Topic',
        sources: [{ kind: 'text', text: 'source' }],
      },
      ctx(),
    );
    const sample = JSON.stringify({
      content: {
        title: 'A Title',
        bodyMarkdown: '# Body',
        proposedTags: ['kb', 'ops'],
        sources: ['source-1'],
      },
      limits: [],
    });
    const parsed = prompt.parse(sample) as {
      content: {
        title: string;
        bodyMarkdown: string;
        proposedTags: string[];
        sources: string[];
      };
    };
    expect(parsed.content.title).toBe('A Title');
    expect(parsed.content.proposedTags).toEqual(['kb', 'ops']);
  });
});
