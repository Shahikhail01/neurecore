'use client';

/**
 * Phase 29 — Admin LocaleProvider (CR-AI-1304).
 *
 * The admin console is a platform surface: it has no tenant currency
 * and no tenant time zone of its own, so it resolves from the
 * operator's browser and publishes `lang` / `dir` on the document.
 *
 * SOLID
 *   SRP — owns ONLY publication of the resolved context.
 *   LSP — the same `LocaleFormatContext` contract as the tenant
 *         portal, so a formatter written for one app runs in the
 *         other unchanged.
 */

import { createContext, useContext, useEffect, useMemo } from 'react';
import { setActiveLocaleContext } from './active-locale';
import {
  DEFAULT_LOCALE_CONTEXT,
  type LocaleFormatContext,
  type LocaleFormatKind,
  type LocaleFormatValue,
} from './locale-format.types';
import { localeFormatters } from './locale-formatter.registry';
import {
  browserLocale,
  resolveLocaleContext,
  type LocalePreferences,
} from './resolve-locale';

const LocaleContext = createContext<LocaleFormatContext>(
  DEFAULT_LOCALE_CONTEXT,
);

export function LocaleProvider({
  preferences,
  children,
}: {
  readonly preferences?: LocalePreferences;
  readonly children: React.ReactNode;
}): React.ReactElement {
  const resolved = useMemo(
    () =>
      resolveLocaleContext({
        ...(preferences ?? {}),
        browserLocale: preferences?.browserLocale ?? browserLocale(),
      }),
    [preferences],
  );

  useEffect(() => {
    setActiveLocaleContext(resolved);
    if (typeof document === 'undefined') return;
    document.documentElement.lang = resolved.locale;
    document.documentElement.dir = resolved.rtl ? 'rtl' : 'ltr';
  }, [resolved]);

  return (
    <LocaleContext.Provider value={resolved}>{children}</LocaleContext.Provider>
  );
}

export function useLocaleContext(): LocaleFormatContext {
  return useContext(LocaleContext);
}

export function useLocaleFormat(): (
  kind: LocaleFormatKind,
  value: LocaleFormatValue,
) => string {
  const context = useLocaleContext();
  return (kind, value) => localeFormatters.format(kind, value, context);
}
