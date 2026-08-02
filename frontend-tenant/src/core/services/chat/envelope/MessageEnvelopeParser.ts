// ─── MessageEnvelopeParser.ts ──────────────────────────────────────────────────
// SRP: parses a message content string into `{ text, envelope? }`.
// Validates against the envelope schema and separates text from components.
// Fallback for brace-balanced JSON that is NOT envelope-shaped: return the
// full content as plain text. Chart-bearing JSON is still handled by the
// legacy BraceBalancedJsonExtractor path on the consumer side.

import type {
  EnvelopeComponent,
  Envelope,
  IEnvelopeJsonExtractor,
  IEnvelopeParser,
  EnvelopeComponentType,
} from './interfaces/IEnvelopeParser';

const VALID_COMPONENT_TYPES: ReadonlyArray<EnvelopeComponentType> = [
  'chart',
  'table',
  'metrics',
];

export class MessageEnvelopeParser implements IEnvelopeParser {
  constructor(private readonly jsonExtractor: IEnvelopeJsonExtractor) {}

  parse(content: string): { text: string; envelope?: Envelope } {
    if (!content) return { text: '' };

    const extracted = this.jsonExtractor.extract(content);
    if (
      !extracted ||
      typeof extracted.json !== 'object' ||
      extracted.json === null
    ) {
      return { text: content };
    }

    const candidate = extracted.json as Record<string, unknown>;
    const components = this.validateComponents(candidate.components);
    if (components === null) {
      // Balanced JSON was found but it wasn't envelope-shaped — fall
      // back to the entire content as plain text. The legacy chart
      // extractor still picks up chartKey if it exists, separately.
      return { text: content };
    }

    const envelope: Envelope = { components };
    if (typeof candidate.text === 'string') {
      envelope.text = candidate.text;
    }
    const text = typeof candidate.text === 'string'
      ? candidate.text
      : extracted.cleaned || content;
    return { text, envelope };
  }

  private validateComponents(raw: unknown): EnvelopeComponent[] | null {
    if (!Array.isArray(raw)) return null;
    const validated: EnvelopeComponent[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const type = obj.type;
      const props = obj.props;
      if (typeof type !== 'string') return null;
      if (!VALID_COMPONENT_TYPES.includes(type as EnvelopeComponentType)) {
        return null;
      }
      if (typeof props !== 'object' || props === null) return null;
      validated.push({
        type: type as EnvelopeComponentType,
        props: props as Record<string, unknown>,
      });
    }
    return validated;
  }
}
