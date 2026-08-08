/**
 * Phase 29 — Locale resolution (CR-AI-1304).
 *
 * Client-side mirror of `TenantLocaleResolver`. Resolution order,
 * highest first:
 *
 *   1. explicit override (admin preview / query param)
 *   2. per-user preference   (`me.locale`)
 *   3. tenant preference     (`tenant.locale`)
 *   4. browser preference    (`navigator.language`)
 *   5. platform default      (`en-US`)
 *
 * SOLID
 *   SRP — owns ONLY resolution. It formats nothing and renders
 *         nothing.
 */

import {
  DEFAULT_LOCALE_CONTEXT,
  RTL_LOCALES,
  type LocaleFormatContext,
} from './locale-format.types';

export interface LocalePreferences {
  readonly userLocale?: string | null;
  readonly userTimeZone?: string | null;
  readonly tenantLocale?: string | null;
  readonly tenantTimeZone?: string | null;
  readonly tenantCurrency?: string | null;
  readonly browserLocale?: string | null;
  readonly override?: string | null;
}

/** ISO-4217 default per locale, used when the tenant sets no currency. */
const LOCALE_CURRENCY: Readonly<Record<string, string>> = {
  'en-US': 'USD',
  'en-GB': 'GBP',
  'fr-FR': 'EUR',
  'de-DE': 'EUR',
  'es-ES': 'EUR',
  'pt-BR': 'BRL',
  'it-IT': 'EUR',
  'nl-NL': 'EUR',
  'pl-PL': 'PLN',
  'ru-RU': 'RUB',
  'tr-TR': 'TRY',
  'ar-SA': 'SAR',
  'he-IL': 'ILS',
  'zh-CN': 'CNY',
  'ja-JP': 'JPY',
  'ko-KR': 'KRW',
};

function firstNonEmpty(
  ...candidates: ReadonlyArray<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/** True when the locale renders right-to-left. */
export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.includes(locale);
}

export function resolveLocaleContext(
  preferences: LocalePreferences,
): LocaleFormatContext {
  const locale =
    firstNonEmpty(
      preferences.override,
      preferences.userLocale,
      preferences.tenantLocale,
      preferences.browserLocale,
    ) ?? DEFAULT_LOCALE_CONTEXT.locale;

  const timeZone =
    firstNonEmpty(preferences.userTimeZone, preferences.tenantTimeZone) ??
    DEFAULT_LOCALE_CONTEXT.timeZone;

  const currency =
    firstNonEmpty(preferences.tenantCurrency, LOCALE_CURRENCY[locale]) ??
    DEFAULT_LOCALE_CONTEXT.currency;

  return { locale, timeZone, currency, rtl: isRtlLocale(locale) };
}

/** The browser's preferred language, or null outside a browser. */
export function browserLocale(): string | null {
  if (typeof navigator === 'undefined') return null;
  return navigator.language || null;
}
