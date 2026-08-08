/**
 * Localization — Module.
 *
 * Phase 29 (CR-AI-1304) additionally wires the locale *format* stack:
 *   TenantLocaleResolver → LocaleFormatterRegistry (5 kinds)
 *   → LocaleFormatPolicyService
 *
 * The formatter list below is the only place that changes when a new
 * value kind is localised (OCP).
 */

import { Module } from '@nestjs/common';
import { LocalizationService } from './localization.service';
import { LocalizationController } from './localization.controller';
import { UserLocaleService } from './user-locale.service';
import {
  LOCALE_FORMATTER,
  LOCALE_RESOLVER,
  type ILocaleFormatter,
} from './format/interfaces/ILocaleFormatter';
import {
  LocaleFormatterRegistry,
  localeFormatterRegistryProvider,
} from './format/locale-formatter.registry';
import { LocaleFormatPolicyService } from './format/locale-format.policy';
import { TenantLocaleResolver } from './format/resolvers/tenant-locale.resolver';
import {
  DateLocaleFormatter,
  DateTimeLocaleFormatter,
  TimeLocaleFormatter,
} from './format/formatters/temporal-locale.formatter';
import { CurrencyLocaleFormatter } from './format/formatters/currency-locale.formatter';
import { NumberLocaleFormatter } from './format/formatters/number-locale.formatter';

/** Every formatter the registry multi-binds. Add one line per kind. */
export const LOCALE_FORMATTER_CLASSES = [
  DateLocaleFormatter,
  DateTimeLocaleFormatter,
  TimeLocaleFormatter,
  NumberLocaleFormatter,
  CurrencyLocaleFormatter,
] as const;

@Module({
  controllers: [LocalizationController],
  providers: [
    LocalizationService,
    UserLocaleService,
    ...LOCALE_FORMATTER_CLASSES,
    {
      provide: LOCALE_FORMATTER,
      useFactory: (...formatters: ILocaleFormatter[]) => formatters,
      inject: [...LOCALE_FORMATTER_CLASSES],
    },
    LocaleFormatterRegistry,
    localeFormatterRegistryProvider,
    TenantLocaleResolver,
    { provide: LOCALE_RESOLVER, useExisting: TenantLocaleResolver },
    LocaleFormatPolicyService,
  ],
  exports: [
    LocalizationService,
    UserLocaleService,
    LocaleFormatterRegistry,
    LocaleFormatPolicyService,
    TenantLocaleResolver,
  ],
})
export class LocalizationModule {}
