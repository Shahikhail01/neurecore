/**
 * KnowledgeHealthSkill — validateInput + buildPrompt tests.
 */

import { KnowledgeHealthSkill } from './knowledge-health.skill';

const ctx = () => ({
  tenantId: 'tenant-A',
  isCrossTenant: false,
  actorRole: 'OWNER' as const,
  actorUserId: 'u1',
});

describe('KnowledgeHealthSkill', () => {
  const skill = new KnowledgeHealthSkill();

  it('rejects unknown mode', () => {
    expect(
      skill.validateInput({
        sources: [{ kind: 'text', text: 'x' }],
        mode: 'mystery',
      }),
    ).toBe(false);
  });

  it('rejects missing sources array', () => {
    expect(skill.validateInput({ mode: 'gap' })).toBe(false);
  });

  it('accepts the three documented modes', () => {
    for (const mode of ['gap', 'duplicate', 'conflict'] as const) {
      expect(
        skill.validateInput({
          mode,
          sources: [{ kind: 'text', text: 'x' }],
        }),
      ).toBe(true);
    }
  });

  it('build prompt routes to the chosen mode in the user-instruction', () => {
    const { prompt } = skill.buildPrompt(
      {
        mode: 'duplicate',
        sources: [
          { kind: 'record', recordType: 'KnowledgeEntry', recordId: 'k1' },
          { kind: 'record', recordType: 'KnowledgeEntry', recordId: 'k2' },
        ],
      },
      ctx(),
    );
    expect(prompt.userInstruction).toContain('duplicate');
    expect(prompt.responseJsonRequired).toBe(true);
    expect(prompt.sources).toHaveLength(2);
  });

  it('deterministic parse returns no-op action when findings are clean', () => {
    const { prompt } = skill.buildPrompt(
      {
        mode: 'gap',
        sources: [{ kind: 'text', text: 'unrelated' }],
      },
      ctx(),
    );
    const parsed = prompt.parse('') as {
      content: {
        findings: ReadonlyArray<unknown>;
        recommendedAction: string;
      };
    };
    expect(parsed.content.findings).toEqual([]);
    expect(parsed.content.recommendedAction).toBe('no-op');
  });
});
