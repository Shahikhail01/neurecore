/**
 * Phase 29 — Frontend locale formatters (CR-AI-1304).
 *
 * Every formatter is time-zone aware and locale-driven. Nothing here
 * hard-codes `en-US`, which is the defect this phase removes from the
 * tenant portal.
 *
 * SOLID
 *   SRP — one class per value kind.
 *   LSP — all five substitute `ILocaleFormatter`.
 *   DIP — formatters receive a resolved context; they never read a
 *         store, a cookie or `navigator`.
 */

import type {
  ILocaleFormatter,
  LocaleFormatContext,
  LocaleFormatKind,
  LocaleFormatValue,
} from './locale-format.types';

export function toDate(value: LocaleFormatValue): Date {
  const date =
    value instanceof Date
      ? value
      : new Date(typeof value === 'number' ? value : String(value));
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`not a formattable date: ${String(value)}`);
  }
  return date;
}

export class DateLocaleFormatter implements ILocaleFormatter {
  readonly kind: LocaleFormatKind = 'date';

  format(value: LocaleFormatValue, context: LocaleFormatContext): string {
    return new Intl.DateTimeFormat(context.locale, {
      timeZone: context.timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(toDate(value));
  }
}

export class DateTimeLocaleFormatter implements ILocaleFormatter {
  readonly kind: LocaleFormatKind = 'datetime';

  format(value: LocaleFormatValue, context: LocaleFormatContext): string {
    return new Intl.DateTimeFormat(context.locale, {
      timeZone: context.timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(toDate(value));
  }
}

export class TimeLocaleFormatter implements ILocaleFormatter {
  readonly kind: LocaleFormatKind = 'time';

  format(value: LocaleFormatValue, context: LocaleFormatContext): string {
    return new Intl.DateTimeFormat(context.locale, {
      timeZone: context.timeZone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(toDate(value));
  }
}

export class NumberLocaleFormatter implements ILocaleFormatter {
  readonly kind: LocaleFormatKind = 'number';

  format(value: LocaleFormatValue, context: LocaleFormatContext): string {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      throw new TypeError(`not a formattable number: ${String(value)}`);
    }
    return new Intl.NumberFormat(context.locale, {
      maximumFractionDigits: 2,
    }).format(numeric);
  }
}

/** Accepts integer **cents**, matching every money column in the API. */
export class CurrencyLocaleFormatter implements ILocaleFormatter {
  readonly kind: LocaleFormatKind = 'currency';

  format(value: LocaleFormatValue, context: LocaleFormatContext): string {
    const cents = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(cents)) {
      throw new TypeError(`not a formattable amount: ${String(value)}`);
    }
    return new Intl.NumberFormat(context.locale, {
      style: 'currency',
      currency: context.currency,
    }).format(cents / 100);
  }
}
