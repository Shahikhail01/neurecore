'use client';

/**
 * Phase 29 — LocaleProvider (CR-AI-1304).
 *
 * The single writer of the ambient locale context. It also applies
 * the two document-level localisation attributes that WCAG 3.1.1 and
 * RTL support require:
 *
 *   • `document.documentElement.lang` — so screen readers pronounce
 *     content with the right voice.
 *   • `document.documentElement.dir`  — so `ar-SA` / `he-IL` render
 *     right-to-left instead of mirroring English layout.
 *
 * SOLID
 *   SRP — owns ONLY publication of the resolved context.
 *   DIP — preferences arrive as props; the provider reads no store.
 */

import { createContext, useContext, useEffect, useMemo } from 'react';
import {
  getActiveLocaleContext,
  setActiveLocaleContext,
} from './active-locale';
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

export interface LocaleProviderProps {
  readonly preferences?: LocalePreferences;
  readonly children: React.ReactNode;
}

export function LocaleProvider({
  preferences,
  children,
}: LocaleProviderProps): React.ReactElement {
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

/** The resolved context for the current subtree. */
export function useLocaleContext(): LocaleFormatContext {
  return useContext(LocaleContext);
}

/** Locale-aware formatting bound to the current context. */
export function useLocaleFormat(): (
  kind: LocaleFormatKind,
  value: LocaleFormatValue,
) => string {
  const context = useLocaleContext();
  return (kind, value) => localeFormatters.format(kind, value, context);
}

/** Non-React accessor for helpers that cannot use hooks. */
export function currentLocaleContext(): LocaleFormatContext {
  return getActiveLocaleContext();
}
