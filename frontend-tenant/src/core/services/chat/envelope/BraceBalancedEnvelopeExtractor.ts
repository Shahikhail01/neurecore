// ─── BraceBalancedEnvelopeExtractor.ts ─────────────────────────────────────────
// SRP: Extracts the first balanced JSON object {...} from arbitrary text.
//      Returns arbitrary brace-balanced JSON, NOT just chart payloads.
//      The existing chart-only BraceBalancedJsonExtractor (fallback/...) is
//      preserved for legacy callers and short-circuits on
//      `"chartType"` (see BraceBalancedJsonExtractor.ts:13). Mixing envelope
//      payloads with that extractor silently fails every envelope that does
//      not contain a chart key.

import type { IEnvelopeJsonExtractor } from './interfaces/IEnvelopeParser';

export class BraceBalancedEnvelopeExtractor implements IEnvelopeJsonExtractor {
  extract(text: string): { cleaned: string; json: unknown } | null {
    const jsonStr = this._extractBalancedBlock(text);
    if (!jsonStr) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return null;
    }
    return { cleaned: text.replace(jsonStr, '').trim(), json: parsed };
  }

  private _extractBalancedBlock(text: string): string | null {
    const start = text.indexOf('{');
    if (start < 0) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return text.substring(start, i + 1);
        }
      }
    }

    return null;
  }
}
