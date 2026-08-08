/**
 * Phase 29 — Date / date-time / time formatters (CR-AI-1304).
 *
 * Every formatter is time-zone aware. A date rendered without an
 * explicit `timeZone` silently uses the *server's* zone, which is the
 * single most common localization defect in a multi-tenant SaaS: a
 * Berlin tenant sees a UTC timestamp shifted by an hour and files a
 * data-integrity bug.
 *
 * SOLID
 *   SRP — one file, one concern (temporal rendering). Currency and
 *         plain numbers live in their own formatter files.
 *   LSP — all three implement `ILocaleFormatter` identically.
 */

import { Injectable } from '@nestjs/common';
import {
  type ILocaleFormatter,
  type LocaleFormatContext,
  type LocaleFormatKind,
  type LocaleFormatValue,
} from '../interfaces/ILocaleFormatter';

/** Coerce the accepted input union into a `Date`, or throw a typed error. */
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

@Injectable()
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

@Injectable()
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

@Injectable()
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
