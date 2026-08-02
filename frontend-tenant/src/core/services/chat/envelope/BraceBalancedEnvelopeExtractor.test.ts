import { describe, expect, it } from 'vitest';
import { BraceBalancedEnvelopeExtractor } from './BraceBalancedEnvelopeExtractor';

describe('BraceBalancedEnvelopeExtractor', () => {
  const extractor = new BraceBalancedEnvelopeExtractor();

  it('extracts the first balanced JSON block', () => {
    const text =
      'Some prose {"components": [{"type": "table", "props": {}}]} trailing.';
    const result = extractor.extract(text);
    expect(result).not.toBeNull();
    expect(result?.json).toEqual({
      components: [{ type: 'table', props: {} }],
    });
    expect(result?.cleaned).not.toContain('{');
  });

  it('returns null when no `{` present', () => {
    expect(extractor.extract('just plain text')).toBeNull();
  });

  it('returns null on unbalanced braces (no throw)', () => {
    expect(extractor.extract('a {b c')).toBeNull();
    // Even with a string section that contains `}`, the brace count
    // stays unbalanced — extractor returns null safely.
    expect(extractor.extract('a {b "}')).toBeNull();
  });

  it('handles nested objects', () => {
    const text = 'x {"a": {"b": {"c": 1}}} y';
    const r = extractor.extract(text);
    expect(r?.json).toEqual({ a: { b: { c: 1 } } });
  });

  it('handles escaped quotes inside strings', () => {
    const text = 'msg: {"x": "he said \\"hi\\""}';
    const r = extractor.extract(text);
    expect(r?.json).toEqual({ x: 'he said "hi"' });
  });

  it('returns null on invalid JSON', () => {
    expect(extractor.extract('foo {not json} bar')).toBeNull();
  });

  it('cleaned text has the JSON block removed', () => {
    const text = 'before {"a":1} after';
    const r = extractor.extract(text);
    // The trimmed result has a double-space from removing the JSON in
    // the middle — acceptable because MessageEnvelopeParser only uses
    // cleaned text as a fallback when no envelope.text is provided.
    expect(r?.cleaned.replace(/\s+/g, ' ')).toBe('before after');
  });
});
