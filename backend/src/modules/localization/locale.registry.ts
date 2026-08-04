/**
 * Localization — Single Canonical Locale Registry.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.20.
 *
 * Solid:
 *   • SRP — only the locale catalog. Localisation of message strings
 *     lives in the chat / agent modules (Phase 5.5 wires the lookup).
 *   • Single source of truth — adding a locale = new entry; no other
 *     code changes.
 *   • Every entry is data — the type `LocaleId` is exhaustively typed.
 */

export type LocaleId =
  | 'en-US'
  | 'en-GB'
  | 'fr-FR'
  | 'de-DE'
  | 'es-ES'
  | 'pt-BR'
  | 'it-IT'
  | 'nl-NL'
  | 'pl-PL'
  | 'ru-RU'
  | 'tr-TR'
  | 'ar-SA'
  | 'he-IL'
  | 'zh-CN'
  | 'ja-JP'
  | 'ko-KR';

export interface LocaleSpec {
  id: LocaleId;
  displayName: string;
  englishName: string;
  rtl: boolean;
  // IETF BCP-47 region tag.
  bcp47: string;
  // ISO 4217 currency hint for formatting.
  currency: string;
}

/**
 * The 16 locales Creatio publishes. Adding a locale = new entry;
 * removing one = breaking change (audit log rows may reference it).
 */
export const OOB_LOCALES: ReadonlyArray<LocaleSpec> = [
  { id: 'en-US', displayName: 'English (US)', englishName: 'English (United States)', rtl: false, bcp47: 'en-US', currency: 'USD' },
  { id: 'en-GB', displayName: 'English (UK)', englishName: 'English (United Kingdom)', rtl: false, bcp47: 'en-GB', currency: 'GBP' },
  { id: 'fr-FR', displayName: 'Français', englishName: 'French (France)', rtl: false, bcp47: 'fr-FR', currency: 'EUR' },
  { id: 'de-DE', displayName: 'Deutsch', englishName: 'German (Germany)', rtl: false, bcp47: 'de-DE', currency: 'EUR' },
  { id: 'es-ES', displayName: 'Español', englishName: 'Spanish (Spain)', rtl: false, bcp47: 'es-ES', currency: 'EUR' },
  { id: 'pt-BR', displayName: 'Português (BR)', englishName: 'Portuguese (Brazil)', rtl: false, bcp47: 'pt-BR', currency: 'BRL' },
  { id: 'it-IT', displayName: 'Italiano', englishName: 'Italian (Italy)', rtl: false, bcp47: 'it-IT', currency: 'EUR' },
  { id: 'nl-NL', displayName: 'Nederlands', englishName: 'Dutch (Netherlands)', rtl: false, bcp47: 'nl-NL', currency: 'EUR' },
  { id: 'pl-PL', displayName: 'Polski', englishName: 'Polish (Poland)', rtl: false, bcp47: 'pl-PL', currency: 'PLN' },
  { id: 'ru-RU', displayName: 'Русский', englishName: 'Russian (Russia)', rtl: false, bcp47: 'ru-RU', currency: 'RUB' },
  { id: 'tr-TR', displayName: 'Türkçe', englishName: 'Turkish (Turkey)', rtl: false, bcp47: 'tr-TR', currency: 'TRY' },
  { id: 'ar-SA', displayName: 'العربية', englishName: 'Arabic (Saudi Arabia)', rtl: true, bcp47: 'ar-SA', currency: 'SAR' },
  { id: 'he-IL', displayName: 'עברית', englishName: 'Hebrew (Israel)', rtl: true, bcp47: 'he-IL', currency: 'ILS' },
  { id: 'zh-CN', displayName: '简体中文', englishName: 'Chinese (Simplified)', rtl: false, bcp47: 'zh-CN', currency: 'CNY' },
  { id: 'ja-JP', displayName: '日本語', englishName: 'Japanese (Japan)', rtl: false, bcp47: 'ja-JP', currency: 'JPY' },
  { id: 'ko-KR', displayName: '한국어', englishName: 'Korean (Korea)', rtl: false, bcp47: 'ko-KR', currency: 'KRW' },
];

export function findLocale(id: LocaleId): LocaleSpec | null {
  return OOB_LOCALES.find((l) => l.id === id) ?? null;
}

/**
 * Validate a string against the locale catalog. Returns the spec or null.
 */
export function validateLocale(id: string): LocaleSpec | null {
  return OOB_LOCALES.find((l) => l.id === id) ?? null;
}
