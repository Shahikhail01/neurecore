'use client';

/**
 * Phase 29 — Locale preference source (CR-AI-1304).
 *
 * Collects the three preference layers the resolver needs:
 *   • per-user   (`/me` profile: locale + time zone)
 *   • per-tenant (tenant store: locale + time zone + currency)
 *   • browser    (resolved inside `LocaleProvider`)
 *
 * SOLID
 *   SRP — owns ONLY preference collection. It resolves nothing and
 *         formats nothing.
 *   DIP — consumers depend on this hook, not on the tenant store or
 *         the `/me` endpoint.
 */

import { useEffect, useMemo, useState } from 'react';
import meService from '@/services/me.service';
import { useTenantStore } from '@/stores/tenantStore';
import type { LocalePreferences } from './resolve-locale';

interface UserLocalePreference {
  readonly locale: string | null;
  readonly timezone: string | null;
}

export function useLocalePreferences(): LocalePreferences {
  const tenantLocale = useTenantStore((s) => s.locale);
  const tenantTimeZone = useTenantStore((s) => s.timezone);
  const tenantCurrency = useTenantStore((s) => s.currency);
  const [user, setUser] = useState<UserLocalePreference | null>(null);

  useEffect(() => {
    let cancelled = false;
    meService.profile
      .get()
      .then((profile) => {
        if (cancelled || !profile) return;
        setUser({ locale: profile.locale, timezone: profile.timezone });
      })
      .catch(() => {
        // A failed /me read must never block the shell; the resolver
        // falls back to tenant → browser → platform default.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo<LocalePreferences>(
    () => ({
      userLocale: user?.locale ?? null,
      userTimeZone: user?.timezone ?? null,
      tenantLocale,
      tenantTimeZone,
      tenantCurrency,
    }),
    [user, tenantLocale, tenantTimeZone, tenantCurrency],
  );
}
