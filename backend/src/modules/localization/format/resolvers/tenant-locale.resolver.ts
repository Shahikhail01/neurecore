/**
 * Phase 29 — Tenant locale resolver (CR-AI-1304).
 *
 * The single adapter that turns "who is asking" into a fully resolved
 * `LocaleFormatContext`. Resolution order, highest first:
 *
 *   1. explicit override      (an admin previewing another locale)
 *   2. Accept-Language header (the browser the request came from)
 *   3. per-user preference    (`users.locale`)
 *   4. tenant preference      (`tenants.locale`)
 *   5. platform default       (`en-US`)
 *
 * Time zone follows the same ladder (`user.timezone` → `tenant.timezone`
 * → `UTC`); currency comes from `tenants.currency` and falls back to
 * the locale's canonical ISO-4217 code.
 *
 * SOLID
 *   SRP — owns ONLY resolution. It formats nothing.
 *   LSP — implements `ILocaleResolver`; a request-scoped or a static
 *         resolver substitutes it without touching the policy.
 *   DIP — this is the ONE place in the format stack allowed to touch
 *         Prisma, so every formatter stays pure.
 */

import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  findLocale,
  OOB_LOCALES,
  validateLocale,
  type LocaleId,
  type LocaleSpec,
} from '../../locale.registry';
import type { LocaleFormatContext } from '../interfaces/ILocaleFormatter';
import type {
  ILocaleResolver,
  LocaleResolutionRequest,
} from '../interfaces/ILocaleResolver';
import { negotiateLocale } from '../accept-language';

export class LocaleResolutionScopeError extends ForbiddenException {}

const DEFAULT_LOCALE: LocaleSpec = OOB_LOCALES[0];
const DEFAULT_TIME_ZONE = 'UTC';

@Injectable()
export class TenantLocaleResolver implements ILocaleResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    request: LocaleResolutionRequest,
  ): Promise<LocaleFormatContext> {
    this.assertScope(request.tenantId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: request.tenantId },
      select: { locale: true, timezone: true, currency: true },
    });
    const user = request.userId
      ? await this.prisma.user.findUnique({
          where: { id: request.userId },
          select: { locale: true, timezone: true },
        })
      : null;

    const spec =
      this.specOf(request.localeOverride) ??
      this.specOf(negotiateLocale(request.acceptLanguage)) ??
      this.specOf(user?.locale) ??
      this.specOf(tenant?.locale) ??
      DEFAULT_LOCALE;

    const timeZone =
      request.timeZoneOverride?.trim() ||
      user?.timezone?.trim() ||
      tenant?.timezone?.trim() ||
      DEFAULT_TIME_ZONE;

    return {
      locale: spec.bcp47,
      timeZone,
      currency: tenant?.currency?.trim() || spec.currency,
      rtl: spec.rtl,
    };
  }

  private specOf(candidate: string | null | undefined): LocaleSpec | null {
    if (!candidate) return null;
    return validateLocale(candidate) ?? findLocale(candidate as LocaleId);
  }

  private assertScope(tenantId: string): void {
    if (!tenantId || tenantId === '*') {
      throw new LocaleResolutionScopeError(
        'tenantId required for locale resolution; wildcard or empty forbidden',
      );
    }
  }
}
