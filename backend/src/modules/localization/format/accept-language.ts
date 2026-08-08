/**
 * Phase 29 — Accept-Language negotiation (CR-AI-1304).
 *
 * Pure, dependency-free RFC 7231 §5.3.5 parsing: order the client's
 * language ranges by q-value, then pick the first that the OOB locale
 * catalog can serve. An exact tag wins over a language-only match, so
 * `en-GB` never silently degrades to `en-US` when both are offered.
 *
 * SOLID
 *   SRP — owns ONLY header negotiation. Persistence and formatting
 *         live elsewhere.
 */

import { OOB_LOCALES, type LocaleId } from '../locale.registry';

interface LanguageRange {
  readonly tag: string;
  readonly quality: number;
}

function parseRanges(header: string): ReadonlyArray<LanguageRange> {
  return header
    .split(',')
    .map((part) => {
      const [rawTag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const quality = qParam ? Number(qParam.trim().slice(2)) : 1;
      return {
        tag: (rawTag ?? '').trim(),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((r) => r.tag.length > 0 && r.quality > 0)
    .sort((a, b) => b.quality - a.quality);
}

/**
 * Best supported locale for the header, or `null` when nothing in the
 * catalog matches (the caller then falls back to tenant preference).
 */
export function negotiateLocale(header: string | undefined): LocaleId | null {
  if (!header) return null;
  const supported = OOB_LOCALES.map((l) => l.id);

  for (const range of parseRanges(header)) {
    if (range.tag === '*') return supported[0] ?? null;
    const exact = supported.find(
      (id) => id.toLowerCase() === range.tag.toLowerCase(),
    );
    if (exact) return exact;
    const language = (range.tag.split('-')[0] ?? '').toLowerCase();
    const partial = supported.find(
      (id) => (id.split('-')[0] ?? '').toLowerCase() === language,
    );
    if (partial) return partial;
  }
  return null;
}
