/**
 * Shared locale pickers — DRY across onboarding wizard,
 * `settings/wizard/[slug]/wizards/ProfileWizard`,
 * `settings/wizard/[slug]/wizards/LocalizationWizard`.
 *
 * SRP: this module owns the *display* list of common timezones +
 * currencies. Backend validates timezone as `string` and currency
 * as an ISO-4217 code (`TiersService` etc.) — this list is purely a
 * UX convenience so the dropdowns aren't empty for common regions.
 *
 * Per `INDUSTRY-GROUPS-CONCEPT.md` the platform is global, so the
 * default lists must include Asia-Pacific, Africa, and Latin America
 * regions, not just UTC + Americas + Europe.
 */

export interface CurrencyOption {
  readonly code: string;
  readonly label: string;
}

export const COMMON_TIMEZONES: readonly string[] = [
  'UTC',
  // Americas
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/Sao_Paulo',
  // Europe / Africa
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Africa/Cairo',
  'Africa/Johannesburg',
  // Asia / Pacific
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Makassar',
  'Asia/Jayapura',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const;

export const COMMON_CURRENCIES: readonly CurrencyOption[] = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'PKR', label: 'PKR — Pakistani Rupee' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'IDR', label: 'IDR — Indonesian Rupiah' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'THB', label: 'THB — Thai Baht' },
  { code: 'CNY', label: 'CNY — Chinese Yuan' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
  { code: 'MXN', label: 'MXN — Mexican Peso' },
] as const;

export const COMMON_DATE_FORMATS = [
  { value: 'short', label: 'Short (1/15/26)' },
  { value: 'medium', label: 'Medium (Jan 15, 2026)' },
  { value: 'long', label: 'Long (January 15, 2026)' },
  { value: 'relative', label: 'Relative (2 days ago)' },
] as const;

export const COMMON_TIME_FORMATS = [
  { value: '12h', label: '12-hour (3:42 PM)' },
  { value: '24h', label: '24-hour (15:42)' },
] as const;
