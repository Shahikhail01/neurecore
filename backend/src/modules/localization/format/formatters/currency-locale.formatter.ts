/**
 * Phase 29 — Currency formatter (CR-AI-1304).
 *
 * The amount arrives as integer **cents**, matching `CostCentsService`
 * and every money column in the schema, so no float ever reaches the
 * presentation layer. Zero-decimal currencies (JPY, KRW) are handled
 * by `Intl` itself once the correct ISO-4217 code is supplied by the
 * resolved locale context.
 *
 * SOLID
 *   SRP — owns ONLY money rendering.
 *   DIP — the currency code comes from the injected context, never
 *         from a hard-coded default.
 */

import { Injectable } from '@nestjs/common';
import {
  type ILocaleFormatter,
  type LocaleFormatContext,
  type LocaleFormatKind,
  type LocaleFormatValue,
} from '../interfaces/ILocaleFormatter';

@Injectable()
export class CurrencyLocaleFormatter implements ILocaleFormatter {
  readonly kind: LocaleFormatKind = 'currency';

  /** @param value integer cents (minor units). */
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
