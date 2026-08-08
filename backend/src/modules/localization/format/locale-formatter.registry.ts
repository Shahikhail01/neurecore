/**
 * Phase 29 — Locale formatter registry (CR-AI-1304).
 *
 * Source plan: IMPLEMENTATION-PLAN-PARITY-COMPLETION.md §10 (P29).
 *
 * SOLID
 *   OCP — keyed by `LocaleFormatKind`. Adding a kind is one formatter
 *         class plus one entry in the module's provider list; the
 *         registry body and the policy service never change.
 *   SRP — owns ONLY registration and lookup.
 *   DIP — formatters arrive through the `LOCALE_FORMATTER` token.
 */

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  LOCALE_FORMATTER,
  LOCALE_FORMATTER_REGISTRY,
  type ILocaleFormatter,
  type LocaleFormatKind,
} from './interfaces/ILocaleFormatter';

export class UnknownLocaleFormatKindError extends Error {
  constructor(readonly kind: string) {
    super(`no locale formatter registered for kind "${kind}"`);
    this.name = 'UnknownLocaleFormatKindError';
  }
}

@Injectable()
export class LocaleFormatterRegistry implements OnModuleInit {
  private readonly logger = new Logger(LocaleFormatterRegistry.name);
  private readonly byKind = new Map<LocaleFormatKind, ILocaleFormatter>();

  constructor(
    @Inject(LOCALE_FORMATTER)
    private readonly injected: ReadonlyArray<ILocaleFormatter>,
  ) {}

  onModuleInit(): void {
    for (const formatter of this.injected) this.register(formatter);
    this.logger.log(
      `LocaleFormatterRegistry wired ${this.byKind.size} formatter(s): ${[...this.byKind.keys()].join(', ')}`,
    );
  }

  register(formatter: ILocaleFormatter): void {
    this.byKind.set(formatter.kind, formatter);
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
}

export const localeFormatterRegistryProvider = {
  provide: LOCALE_FORMATTER_REGISTRY,
  useFactory: (registry: LocaleFormatterRegistry) => registry,
  inject: [LocaleFormatterRegistry],
};
