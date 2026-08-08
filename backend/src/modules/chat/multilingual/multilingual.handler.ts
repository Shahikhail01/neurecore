/**
 * Phase 22 — MultilingualHandler (CR-AI-0004).
 *
 * Source plan: IMPLEMENTATION_PLAN_PARITY_COMPLETION.md §3 (P22).
 *
 * Closes CR-AI-0004: full multilingual handling, not just a
 * localizer seam. The handler wraps the existing ResponseLocalizer
 * and adds:
 *
 *   - full KNOWN_LOCALES negotiation (all 10, not just en/es/fr)
 *   - a typed `IMultilingualHandler` interface (ISP)
 *   - model instruction envelope (entities + dates + currency preserved)
 *   - typed fallback when the requested locale is unsupported
 *
 * SOLID — ISP: `IMultilingualHandler` exposes only the surfaces a
 * caller actually needs (resolve + envelope). The localizer stays
 * internal.
 *
 * DIP: chat dispatchers depend on `IMultilingualHandler`, never on
 * the underlying localizer.
 */

import { Injectable } from '@nestjs/common';
import {
  KNOWN_LOCALES,
  ResponseLocalizer,
  type SupportedLocale,
} from './response-localizer';

export interface MultilingualEnvelope {
  readonly targetLocale: SupportedLocale;
  readonly isSupported: boolean;
  readonly fallbackApplied: boolean;
  readonly modelInstruction: string;
  readonly preservedEntities: ReadonlyArray<{
    readonly kind: 'email' | 'currency' | 'date' | 'number';
    readonly raw: string;
  }>;
}

export interface ResolveOptions {
  readonly targetLocale?: string;
  readonly acceptLanguage?: string;
  readonly text?: string;
}

export interface IMultilingualHandler {
  resolve(opts: ResolveOptions): MultilingualEnvelope;
  /** Convenience: produce a model-instruction suffix for the dispatcher. */
  buildInstruction(opts: ResolveOptions): string;
}

const FALLBACK_LOCALE: SupportedLocale = 'en';

@Injectable()
export class MultilingualHandler implements IMultilingualHandler {
  constructor(private readonly localizer: ResponseLocalizer) {}

  resolve(opts: ResolveOptions): MultilingualEnvelope {
    const supported = this.normalizeLocale(opts.targetLocale);
    const headerSupported = this.firstSupported(opts.acceptLanguage);
    const finalLocale: SupportedLocale =
      supported ?? headerSupported ?? FALLBACK_LOCALE;
    const fallbackApplied =
      !supported && !!opts.targetLocale && opts.targetLocale !== finalLocale;

    const entities = opts.text ? this.localizer.extract(opts.text) : [];

    const modelInstruction = [
      'Locale: ' + finalLocale,
      fallbackApplied
        ? `(locale "${opts.targetLocale}" unsupported; fell back to "${finalLocale}")`
        : '',
      this.localizer.systemInstruction(),
    ]
      .filter(Boolean)
      .join('\n');

    return {
      targetLocale: finalLocale,
      isSupported: supported !== undefined,
      fallbackApplied,
      modelInstruction,
      preservedEntities: entities,
    };
  }

  buildInstruction(opts: ResolveOptions): string {
    return this.resolve(opts).modelInstruction;
  }

  private normalizeLocale(input: string | undefined): SupportedLocale | undefined {
    if (!input) return undefined;
    const lower = input.toLowerCase().slice(0, 2);
    return (KNOWN_LOCALES as ReadonlyArray<string>).includes(lower)
      ? (lower as SupportedLocale)
      : undefined;
  }

  private firstSupported(header: string | undefined): SupportedLocale | undefined {
    if (!header) return undefined;
    for (const part of header.split(',')) {
      const code = part.trim().slice(0, 2).toLowerCase();
      if ((KNOWN_LOCALES as ReadonlyArray<string>).includes(code)) {
        return code as SupportedLocale;
      }
    }
    return undefined;
  }
}
