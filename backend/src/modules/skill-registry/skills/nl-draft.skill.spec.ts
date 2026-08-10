/**
 * NlDraftSkill — validateInput + buildPrompt tests.
 */

import { NlDraftSkill } from './nl-draft.skill';

const ctx = () => ({
  tenantId: 'tenant-A',
  isCrossTenant: false,
  actorRole: 'OWNER' as const,
  actorUserId: 'u1',
});

describe('NlDraftSkill', () => {
  const skill = new NlDraftSkill();

  it('rejects empty natural language', () => {
    expect(
      skill.validateInput({ naturalLanguage: '', targetMode: 'chat' }),
    ).toBe(false);
  });

  it('rejects unknown target mode', () => {
    expect(
      skill.validateInput({
        naturalLanguage: 'do something',
        targetMode: 'wonderland',
      }),
    ).toBe(false);
  });

  it('rejects missing natural language', () => {
    expect(skill.validateInput({ targetMode: 'workflow' })).toBe(false);
  });

  it('accepts chat + workflow + a non-empty string', () => {
    expect(
      skill.validateInput({
        naturalLanguage: 'summarize a customer request thread',
        targetMode: 'chat',
      }),
    ).toBe(true);
    expect(
      skill.validateInput({
        naturalLanguage: 'kick off a workflow when status flips',
        targetMode: 'workflow',
      }),
    ).toBe(true);
  });

  it('builds a prompt that always carries the activation prohibition', () => {
    const { prompt } = skill.buildPrompt(
      {
        naturalLanguage: 'summarize customer request thread',
        targetMode: 'chat',
      },
      ctx(),
    );
    expect(prompt.userInstruction).toContain('NEVER include any activation hint');
    expect(prompt.responseJsonRequired).toBe(true);
  });

  it('parsed output is always refusedActivation=true (NL-draft never activates)', () => {
    const { prompt } = skill.buildPrompt(
      {
        naturalLanguage: 'whatever the user asks',
        targetMode: 'workflow',
      },
      ctx(),
    );
    const parsed = prompt.parse(
      '{"content": {"draftGraph": {"nodes": [], "edges": [], "inputs": [], "outputs": []}, "explainedIntents": ["intent-1"]}, "limits": []}',
    ) as { content: { draftGraph: unknown; explainedIntents: readonly string[]; refusedActivation: true } };
    expect(parsed.content.refusedActivation).toBe(true);
    expect(parsed.content.explainedIntents).toContain('intent-1');
  });

  it('falls back to typed defaults when the model produces non-JSON', () => {
    const { prompt } = skill.buildPrompt(
      { naturalLanguage: 'any text', targetMode: 'chat' },
      ctx(),
    );
    const parsed = prompt.parse('not json') as { content: { draftGraph: { nodes: readonly unknown[]; edges: readonly unknown[] } } };
    expect(parsed.content.draftGraph.nodes).toEqual([]);
    expect(parsed.content.draftGraph.edges).toEqual([]);
  });
});
