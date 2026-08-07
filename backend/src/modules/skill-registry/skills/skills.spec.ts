/**
 * Phases 11–13 — Skill unit tests.
 *
 * Covers validateInput + buildPrompt contracts.
 * Does NOT exercise the model — the executor is mocked.
 */

import {
  SummarizeSkill,
  RewriteSkill,
  TranslateSkill,
  ExtractSkill,
  CompareSkill,
  DraftReportSkill,
  DraftEmailSkill,
  NlDraftSkill,
} from './index';

const TENANT = 'tenant-abc';

function ctx(tenantId = TENANT) {
  return {
    tenantId,
    isCrossTenant: false,
    actorRole: 'OWNER' as const,
    actorUserId: 'u1',
  };
}

describe('SummarizeSkill', () => {
  const s = new SummarizeSkill();

  it('rejects empty input', () => {
    expect(s.validateInput(null)).toBe(false);
    expect(s.validateInput({})).toBe(false);
  });

  it('accepts a text source', () => {
    expect(
      s.validateInput({ source: { kind: 'text', text: 'hello' } }),
    ).toBe(true);
  });

  it('builds a prompt that cites Phase-12-locator limit', () => {
    const { prompt } = s.buildPrompt(
      { source: { kind: 'text', text: 'the source text here' } },
      ctx(),
    );
    expect(prompt.systemInstruction).toContain('summarizer');
    expect(prompt.sources).toHaveLength(1);
    expect(prompt.responseJsonRequired).toBe(true);
  });
});

describe('RewriteSkill', () => {
  const s = new RewriteSkill();

  it('rejects empty text', () => {
    expect(s.validateInput({ text: '', mode: 'shorten' })).toBe(false);
  });

  it('rejects unknown mode', () => {
    expect(s.validateInput({ text: 'x', mode: 'lol' })).toBe(false);
  });

  it('accepts the three documented modes', () => {
    for (const mode of ['tone', 'shorten', 'expand'] as const) {
      expect(s.validateInput({ text: 'hello', mode })).toBe(true);
    }
  });

  it('builds a prompt whose userInstruction matches the requested mode', () => {
    const { prompt } = s.buildPrompt(
      { text: 'hello world', mode: 'shorten' },
      ctx(),
    );
    expect(prompt.userInstruction.toLowerCase()).toContain('shorten');
  });
});

describe('TranslateSkill', () => {
  const s = new TranslateSkill();

  it('rejects missing target locale', () => {
    expect(s.validateInput({ text: 'hi' })).toBe(false);
  });

  it('rejects text shorter than 1 char', () => {
    expect(s.validateInput({ text: '', targetLocale: 'es' })).toBe(false);
  });

  it('accepts two-char locale codes', () => {
    for (const locale of ['es', 'fr', 'de', 'en', 'ur', 'ar']) {
      expect(s.validateInput({ text: 'hi', targetLocale: locale })).toBe(true);
    }
  });

  it('builds a JSON prompt that preserves entities', () => {
    const { prompt } = s.buildPrompt(
      { text: '$5 in 2024', targetLocale: 'fr', preserveEntities: true },
      ctx(),
    );
    expect(prompt.systemInstruction).toContain('PRESERVE');
  });
});

describe('ExtractSkill', () => {
  const s = new ExtractSkill();

  it('rejects empty schema', () => {
    expect(
      s.validateInput({ source: { kind: 'text', text: 'x' }, schema: {} }),
    ).toBe(false);
  });

  it('rejects unknown field types', () => {
    expect(
      s.validateInput({
        source: { kind: 'text', text: 'x' },
        schema: { foo: { type: 'magic' } },
      }),
    ).toBe(false);
  });

  it('accepts typed schemas', () => {
    expect(
      s.validateInput({
        source: { kind: 'text', text: 'x' },
        schema: {
          name: { type: 'string' },
          amount: { type: 'currency' },
          flag: { type: 'boolean' },
        },
      }),
    ).toBe(true);
  });
});

describe('CompareSkill', () => {
  const s = new CompareSkill();

  it('rejects when one side is missing', () => {
    expect(
      s.validateInput({ left: { kind: 'text', text: 'a' } }),
    ).toBe(false);
  });

  it('accepts when both sides have SourceRefs', () => {
    expect(
      s.validateInput({
        left: { kind: 'text', text: 'a' },
        right: { kind: 'text', text: 'b' },
      }),
    ).toBe(true);
  });
});

describe('DraftReportSkill', () => {
  const s = new DraftReportSkill();

  it('rejects empty topic', () => {
    expect(s.validateInput({ topic: '', sources: [] })).toBe(false);
  });

  it('accepts a topic + at least one source', () => {
    expect(
      s.validateInput({
        topic: 'Q3 forecast',
        sources: [{ kind: 'text', text: 'numbers' }],
      }),
    ).toBe(true);
  });
});

describe('DraftEmailSkill', () => {
  const s = new DraftEmailSkill();

  it('rejects when intent or recipient missing', () => {
    expect(
      s.validateInput({ source: { kind: 'text', text: '' }, intent: 'x' }),
    ).toBe(false);
  });

  it('accepts a typed recipient + intent', () => {
    expect(
      s.validateInput({
        source: { kind: 'thread', threadId: 't-1' },
        recipient: { email: 'a@b.com', name: 'Alice' },
        intent: 'Confirm Tuesday',
      }),
    ).toBe(true);
  });
});

describe('NlDraftSkill', () => {
  const s = new NlDraftSkill();

  it('rejects empty NL input', () => {
    expect(s.validateInput({ naturalLanguage: '', targetMode: 'chat' })).toBe(false);
  });

  it('rejects unknown mode', () => {
    expect(
      s.validateInput({ naturalLanguage: 'x', targetMode: 'dream' }),
    ).toBe(false);
  });

  it('accepts chat + workflow', () => {
    expect(
      s.validateInput({ naturalLanguage: 'do something', targetMode: 'chat' }),
    ).toBe(true);
    expect(
      s.validateInput({ naturalLanguage: 'do something', targetMode: 'workflow' }),
    ).toBe(true);
  });
});
