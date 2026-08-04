/**
 * Per-user locale preference.
 *
 * Source plan: §5.20 — per-user locale override (Phase 6 deliverable).
 *
 * Solid:
 *   • SRP — only locale resolution + persistence. The OOB catalog
 *     lives in Phase 5.5's localization module.
 *   • DIP — depends on PrismaService. No other service imports this.
 *
 * Resolution order: user → tenant → default (en-US).
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/database/prisma.service';
import {
  OOB_LOCALES,
  LocaleId,
  LocaleSpec,
  findLocale,
} from '../localization/locale.registry';

@Injectable()
export class UserLocaleService {
  private readonly logger = new Logger(UserLocaleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the effective locale for a user: explicit per-user
   * preference → tenant preference → default (en-US).
   */
  async resolve(args: {
    userId: string;
    tenantId: string;
  }): Promise<LocaleSpec> {
    const userPref = await this.prisma.userLocalePreference.findUnique({
      where: { userId_tenantId: { userId: args.userId, tenantId: args.tenantId } },
    });
    if (userPref) {
      const spec = findLocale(userPref.localeId as LocaleId);
      if (spec) return spec;
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: args.tenantId },
      select: { locale: true },
    });
    const id = (tenant?.locale ?? 'en-US') as LocaleId;
    return findLocale(id) ?? (OOB_LOCALES[0] as LocaleSpec);
  }

  async setUserLocale(args: {
    userId: string;
    tenantId: string;
    localeId: string;
  }): Promise<void> {
    if (!findLocale(args.localeId as LocaleId)) {
      throw new Error(`unknown locale ${args.localeId}`);
    }
    if (!args.tenantId || args.tenantId === '*') {
      throw new Error('tenantId "*" is forbidden');
    }
    await this.prisma.userLocalePreference.upsert({
      where: { userId_tenantId: { userId: args.userId, tenantId: args.tenantId } },
      create: {
        userId: args.userId,
        tenantId: args.tenantId,
        localeId: args.localeId,
      },
      update: { localeId: args.localeId },
    });
  }

  async clearUserLocale(args: { userId: string; tenantId: string }): Promise<void> {
    await this.prisma.userLocalePreference.deleteMany({
      where: { userId: args.userId, tenantId: args.tenantId },
    });
  }
}
