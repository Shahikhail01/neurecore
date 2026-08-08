/**
 * Phase 29 — Number formatter (CR-AI-1304).
 *
 * Group and decimal separators differ per locale (`1,234.5` in en-US,
 * `1.234,5` in de-DE, `1 234,5` in fr-FR). Rendering a raw
 * `toString()` is a localization defect that makes numbers unreadable
 * — and in `ar-SA` it also loses the correct digit shaping.
 *
 * SOLID
 *   SRP — owns ONLY plain-number rendering.
 */

import { Injectable } from '@nestjs/common';
import {
  type ILocaleFormatter,
  type LocaleFormatContext,
  type LocaleFormatKind,
  type LocaleFormatValue,
} from '../interfaces/ILocaleFormatter';

@Injectable()
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
