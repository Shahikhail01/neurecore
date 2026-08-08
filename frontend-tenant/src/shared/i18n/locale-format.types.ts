/**
 * Phase 29 — Frontend locale contracts (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * Mirrors the backend `ILocaleFormatter` vocabulary exactly, so a
 * value rendered server-side and the same value rendered client-side
 * are byte-identical for a given locale.
 *
 * SOLID
 *   SRP — this file owns ONLY the vocabulary.
 *   OCP — a new kind = one formatter + one registry key.
 *   ISP — one method per formatter; resolution is a separate concern.
 */

export type LocaleFormatKind =
  | 'date'
  | 'datetime'
  | 'time'
  | 'number'
  | 'currency';

export interface LocaleFormatContext {
  /** BCP-47 tag, e.g. `de-DE`. */
  readonly locale: string;
  /** IANA time zone, e.g. `Europe/Berlin`. */
  readonly timeZone: string;
  /** ISO-4217 code, e.g. `EUR`. */
  readonly currency: string;
  /** True for right-to-left locales (`ar-SA`, `he-IL`). */
  readonly rtl: boolean;
}

export type LocaleFormatValue = Date | string | number;

export interface ILocaleFormatter {
  readonly kind: LocaleFormatKind;
  format(value: LocaleFormatValue, context: LocaleFormatContext): string;
}

/** The platform default, used before the tenant profile has loaded. */
export const DEFAULT_LOCALE_CONTEXT: LocaleFormatContext = {
  locale: 'en-US',
  timeZone: 'UTC',
  currency: 'USD',
  rtl: false,
};

/** Locales the platform ships (mirrors backend `OOB_LOCALES`). */
export const RTL_LOCALES: ReadonlyArray<string> = ['ar-SA', 'he-IL'];
