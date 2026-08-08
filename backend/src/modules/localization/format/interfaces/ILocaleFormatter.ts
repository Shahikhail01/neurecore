/**
 * Phase 29 — Locale formatter contract (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * "Localization correctness pass (time-zone / currency across
 * locales)" needs one thing above all: a single place that decides
 * how a value is rendered for a locale, so no screen can drift back
 * to a hard-coded `en-US`.
 *
 * SOLID
 *   SRP — this file owns ONLY the formatting vocabulary.
 *   OCP — a new value kind (e.g. `'percent'`) is one formatter class
 *         plus one registry key; the policy service never changes.
 *   LSP — every formatter substitutes `ILocaleFormatter`; the policy
 *         service never branches on the concrete type.
 *   ISP — one method (`format`). Locale *resolution* is a separate
 *         contract (`ILocaleResolver`).
 *   DIP — formatters receive a fully-resolved `LocaleFormatContext`
 *         value object; they never read a tenant, a user or a DB.
 */

/** Value kinds the platform formats for end users. */
export type LocaleFormatKind =
  | 'date'
  | 'datetime'
  | 'time'
  | 'number'
  | 'currency';

/** Everything a formatter needs, already resolved. */
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

/** The value a formatter accepts. Dates arrive as `Date` or ISO string. */
export type LocaleFormatValue = Date | string | number;

export interface ILocaleFormatter {
  readonly kind: LocaleFormatKind;
  format(value: LocaleFormatValue, context: LocaleFormatContext): string;
}

/** DI token — multi-bound array of every registered formatter. */
export const LOCALE_FORMATTER = Symbol('LocaleFormatter');
/** DI token — the kind-keyed formatter registry. */
export const LOCALE_FORMATTER_REGISTRY = Symbol('LocaleFormatterRegistry');
/** DI token — the tenant/user locale resolver. */
export const LOCALE_RESOLVER = Symbol('LocaleResolver');
