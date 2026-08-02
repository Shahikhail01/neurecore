// ─── IEnvelopeParser.ts ────────────────────────────────────────────────────────
// ISP: narrow interfaces — each client depends on what it needs.
// DIP: parser depends on IEnvelopeJsonExtractor abstraction.

export type EnvelopeComponentType = 'chart' | 'table' | 'metrics';

export interface EnvelopeComponent {
  type: EnvelopeComponentType;
  props: Record<string, unknown>;
}

export interface Envelope {
  text?: string;
  components?: EnvelopeComponent[];
}

export interface IEnvelopeJsonExtractor {
  /**
   * Extract a brace-balanced JSON object from arbitrary text. Returns
   * null when the text contains no balanced JSON block or when JSON
   * parsing fails. Returns the cleaned (JSON-stripped) text alongside
   * the parsed payload so callers can present the prose to the user
   * without re-running regex cleanup themselves.
   */
  extract(text: string): { cleaned: string; json: unknown } | null;
}

export interface IEnvelopeParser {
  parse(content: string): { text: string; envelope?: Envelope };
}
