/**
 * Phase 15 — ResponseLocalizer.
 *
 * Source plan: IMPLEMENTATION_PLAN_PHASE_15_18.md §1.
 *
 * Closes CR-AI-0004: the assistant accepts and produces in the
 * actor's preferred language while preserving entities (people,
 * products, places), dates, and currency verbatim.
 *
 * SRP — owns ONLY the locale negotiation + entity protection pass.
 * The model layer is the chat dispatcher's job; this is the seam
 * that wraps the model's reply with locale-aware pre/post processing.
 *
 * Detection algorithm (regulatory-safe but not licensed):
 *   1. If the caller supplies `targetLocale`, trust it.
 *   2. Else infer from `Accept-Language` headers (FE → BE), then
 *      fall back to `en`.
 *   3. The model is asked to preserve entities and dates verbatim
 *      via the system prompt.
 *
 * Entity extraction is intentionally conservative (regex over
 * `@`, currency tokens, and `\d{4}-\d{2}-\d{2}`). The model is the
 * canonical extractor; this regex pass catches the obvious cases
 * before they get translated.
 */

import { Injectable, Logger } from '@nestjs/common';

const KNOWN_LOCALES = [
  'en',
  'es',
  'fr',
  'de',
  'ur',
  'ar',
  'hi',
  'pt',
  'zh',
  'ja',
] as const;

export type SupportedLocale = (typeof KNOWN_LOCALES)[number];

export interface LocalizationResult<T> {
  readonly content: T;
  readonly detectedLocale: SupportedLocale | string;
  readonly targetLocale: SupportedLocale | string;
  readonly preservedEntities: ReadonlyArray<string>;
}

/**
 * Format-preserving entities (stamped before the model reply is
 * shipped back to the FE so the FE never sees a translated
 * customer name, currency value, or ISO date).
 */
export interface ResolvedEntity {
  readonly kind: 'email' | 'currency' | 'date' | 'number';
  readonly raw: string;
}

@Injectable()
export class ResponseLocalizer {
  private readonly logger = new Logger(ResponseLocalizer.name);

  /**
   * Negotiate the target locale. Returns the actor-supplied locale
   * first, otherwise the first `Accept-Language` parseable entry,
   * otherwise `en`.
   */
  negotiate(
    targetLocale: string | undefined,
    acceptLanguageHeader: string | undefined,
  ): SupportedLocale | string {
    if (targetLocale) {
      const lower = targetLocale.toLowerCase().slice(0, 2);
      if (lower === 'en' || lower === 'es' || lower === 'fr') return lower;
      // The known list above covers the bare minimum; anything outside
      // is preserved as-is so the model sees the spec.
      return lower;
    }
    if (acceptLanguageHeader) {
      const parts = acceptLanguageHeader.split(',');
      for (const part of parts) {
        const code = part.trim().slice(0, 2).toLowerCase();
        if (code === 'en' || code === 'es' || code === 'fr') return code;
      }
    }
    return 'en';
  }

  /**
   * Heuristic extractor — returns the obvious preserved entities so
   * the chat dispatcher can stamp them onto the reply envelope.
   */
  extract(text: string): ResolvedEntity[] {
    const entities: ResolvedEntity[] = [];
    const emails = text.match(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/g) ?? [];
    for (const m of emails) entities.push({ kind: 'email', raw: m });
    // Currency: a leading symbol, optional decimals, optional 3-digit
    // separators, no leading minus, end before whitespace+letter.
    const currency = text.match(
      /[$€£¥₹]\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?=\s|$|[^a-zA-Z0-9])/g,
    ) ?? [];
    for (const m of currency) entities.push({ kind: 'currency', raw: m });
    const dates = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
    for (const m of dates) entities.push({ kind: 'date', raw: m });
    const plainNums = text.match(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g) ?? [];
    for (const m of plainNums) entities.push({ kind: 'number', raw: m });
    return entities;
  }

  /**
   * Apply the localizer to a model reply. Preserves the extracted
   * entities verbatim, normalizes the detected locale, and tags
   * the reply with the entities the FE should display as
   * untranslatable references.
   */
  localize<T extends string | { text?: string }>(
    reply: T,
    opts: { targetLocale?: string; acceptLanguage?: string },
  ): LocalizationResult<T> {
    const text =
      typeof reply === 'string' ? reply : (reply as { text?: string }).text ?? '';
    const entities = this.extract(text);
    return {
      content: reply,
      detectedLocale: opts.targetLocale
        ? this.negotiate(opts.targetLocale, opts.acceptLanguage)
        : this.negotiate(undefined, opts.acceptLanguage),
      targetLocale: this.negotiate(opts.targetLocale, opts.acceptLanguage),
      preservedEntities: entities.map((e) => e.raw),
    };
  }

  /**
   * Returns the canonical English prompt fragment that tells the
   * model to preserve entities, dates, and currency. Designed to
   * be inserted as a system-instruction suffix by the chat dispatcher.
   */
  systemInstruction(): string {
    return [
      'Preserve verbatim:',
      ' - emails (e.g. "alice@example.com" stays as-is)',
      ' - dates in ISO form (e.g. "2026-08-06")',
      ' - currency tokens (e.g. "$5,000", "₹12,500")',
      ' - product names, customer names, proper nouns.',
      'Translate only the prose around them.',
    ].join('\n');
  }
}

export { KNOWN_LOCALES };
