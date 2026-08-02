import { describe, expect, it } from 'vitest';
import { BraceBalancedEnvelopeExtractor } from './BraceBalancedEnvelopeExtractor';
import { MessageEnvelopeParser } from './MessageEnvelopeParser';

const parser = new MessageEnvelopeParser(new BraceBalancedEnvelopeExtractor());

describe('MessageEnvelopeParser', () => {
  it('returns plain text when content is empty', () => {
    expect(parser.parse('')).toEqual({ text: '' });
  });

  it('returns plain text when no JSON block found', () => {
    expect(parser.parse('Hello there')).toEqual({ text: 'Hello there' });
  });

  it('returns plain text when balanced JSON is not envelope-shaped', () => {
    // chartKey present but no `components` array → fall back to plain text.
    const r = parser.parse(
      'Prose {"chartType":"bar","chartData":[]} more prose',
    );
    expect(r).toEqual({
      text: 'Prose {"chartType":"bar","chartData":[]} more prose',
    });
  });

  it('parses a valid envelope with table component', () => {
    const content =
      'Here are results: {"text":"(3 total)","components":[{"type":"table","props":{"headers":["id","name"],"rows":[{"id":"a","name":"A"}]}}]}';
    const r = parser.parse(content);
    expect(r.text).toBe('(3 total)');
    expect(r.envelope?.components).toHaveLength(1);
    expect(r.envelope?.components?.[0].type).toBe('table');
  });

  it('rejects unknown component types', () => {
    const content = '{"components":[{"type":"video","props":{}}]}';
    expect(parser.parse(content)).toEqual({ text: content });
  });

  it('rejects components with missing props', () => {
    const content = '{"components":[{"type":"table"}]}';
    expect(parser.parse(content)).toEqual({ text: content });
  });

  it('accepts metrics components', () => {
    const content =
      '{"components":[{"type":"metrics","props":{"items":[{"label":"A","value":1}]}}]}';
    const r = parser.parse(content);
    expect(r.envelope?.components?.[0].type).toBe('metrics');
  });

  it('accepts chart components', () => {
    const content =
      '{"components":[{"type":"chart","props":{"chartData":[{"label":"X","value":10}]}}]}';
    const r = parser.parse(content);
    expect(r.envelope?.components?.[0].type).toBe('chart');
  });

  it('uses cleaned text when envelope.text is not a string', () => {
    const content =
      'preamble {"components":[{"type":"metrics","props":{"items":[]}}]} postamble';
    const r = parser.parse(content);
    expect(r.text.replace(/\s+/g, ' ')).toBe('preamble postamble');
  });
});
