/**
 * Phase 29 — Frontend locale formatter registry (CR-AI-1304).
 *
 * SOLID
 *   OCP — keyed by `LocaleFormatKind`; adding a kind is one class and
 *         one entry in `DEFAULT_LOCALE_FORMATTERS`.
 *   SRP — owns ONLY registration and lookup.
 */

import type {
  ILocaleFormatter,
  LocaleFormatContext,
  LocaleFormatKind,
  LocaleFormatValue,
} from './locale-format.types';
import {
  CurrencyLocaleFormatter,
  DateLocaleFormatter,
  DateTimeLocaleFormatter,
  NumberLocaleFormatter,
  TimeLocaleFormatter,
} from './locale-formatters';

export class UnknownLocaleFormatKindError extends Error {
  constructor(readonly kind: string) {
    super(`no locale formatter registered for kind "${kind}"`);
    this.name = 'UnknownLocaleFormatKindError';
  }
}

/** Every formatter the registry ships with. Add one line per kind. */
export const DEFAULT_LOCALE_FORMATTERS: ReadonlyArray<ILocaleFormatter> = [
  new DateLocaleFormatter(),
  new DateTimeLocaleFormatter(),
  new TimeLocaleFormatter(),
  new NumberLocaleFormatter(),
  new CurrencyLocaleFormatter(),
];

export class LocaleFormatterRegistry {
  private readonly byKind = new Map<LocaleFormatKind, ILocaleFormatter>();

  constructor(
    formatters: ReadonlyArray<ILocaleFormatter> = DEFAULT_LOCALE_FORMATTERS,
  ) {
    for (const formatter of formatters) this.byKind.set(formatter.kind, formatter);
  }

  get(kind: LocaleFormatKind): ILocaleFormatter {
    const formatter = this.byKind.get(kind);
    if (!formatter) throw new UnknownLocaleFormatKindError(kind);
    return formatter;
  }

  has(kind: LocaleFormatKind): boolean {
    return this.byKind.has(kind);
  }

  kinds(): ReadonlyArray<LocaleFormatKind> {
    return [...this.byKind.keys()].sort();
  }

  format(
    kind: LocaleFormatKind,
    value: LocaleFormatValue,
    context: LocaleFormatContext,
  ): string {
    return this.get(kind).format(value, context);
  }
}

/** Shared instance — stateless, so a singleton is safe. */
export const localeFormatters = new LocaleFormatterRegistry();
