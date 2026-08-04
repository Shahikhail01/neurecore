/**
 * Localization — Service.
 *
 * Source plan: creatio-ai-parity-implementation-plan-v2.md §5.20.
 *
 * Owns:
 *   • Tenant locale preference (which of the 16 OOB locales the tenant
 *     prefers; per-user override is a future Phase 5.5 deliverable).
 *   • User locale preference (per-user; future-facing — Phase 5.5 ships
 *     the table + endpoint; downstream chat / Twin modules consume it).
 *
 * Per v3 P-1 rule §11: every tenant-scoped method refuses the wildcard.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  OOB_LOCALES,
  LocaleId,
  LocaleSpec,
  findLocale,
  validateLocale,
} from './locale.registry';

@Injectable()
export class LocalizationService {
  private readonly logger = new Logger(LocalizationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Catalog ────────────────────────────────────────────────────

  listCatalog(): ReadonlyArray<LocaleSpec> {
    return OOB_LOCALES;
  }

  /**
   * Resolve the effective locale for a tenant: tenant preference if
   * set, else the OOB default (en-US).
   */
  async resolveTenantLocale(tenantId: string): Promise<LocaleSpec> {
    this.assertRealTenant(tenantId);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { locale: true },
    });
    const id = tenant?.locale ?? 'en-US';
    return findLocale(id as LocaleId) ?? (OOB_LOCALES[0] as LocaleSpec);
  }

  async setTenantLocale(tenantId: string, localeId: string): Promise<LocaleSpec> {
    this.assertRealTenant(tenantId);
    if (!validateLocale(localeId)) {
      throw new BadRequestException(`unknown locale id "${localeId}"`);
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { locale: localeId },
    });
    return findLocale(localeId as LocaleId)!;
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private assertRealTenant(tenantId: string) {
    if (!tenantId || tenantId === '*') {
      throw new ForbiddenException(
        'tenantId "*" is forbidden; use a platform-admin port for cross-tenant queries',
      );
    }
  }
}
