import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TenantTemplateSeederService {
  private readonly logger = new Logger(TenantTemplateSeederService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedForTenant(tenantId: string, industrySlug: string): Promise<number> {
    // Normalise empty-string or whitespace industry to null so the
    // universal baseline (`industrySlug IS NULL`) seeds land too.
    // Fixes the "tenant created without industry → /settings/templates
    // shows No templates found" bug.
    const normalisedIndustry =
      typeof industrySlug === 'string' && industrySlug.trim().length > 0
        ? industrySlug.trim()
        : null;

    const seeds = await this.prisma.tenantTemplate.findMany({
      where: {
        tenantId: null,
        isActive: true,
        ...(normalisedIndustry
          ? {
              OR: [
                { industrySlug: normalisedIndustry },
                { industrySlug: null },
              ],
            }
          : { industrySlug: null }),
      },
    });

    let created = 0;
    for (const seed of seeds) {
      const exists = await this.prisma.tenantTemplate.findUnique({
        where: {
          tenantId_slug_templateType: {
            tenantId,
            slug: seed.slug,
            templateType: seed.templateType,
          },
        },
      });
      if (exists) continue;

      await this.prisma.tenantTemplate.create({
        data: {
          tenantId,
          slug: seed.slug,
          name: seed.name,
          description: seed.description,
          templateType: seed.templateType,
          industrySlug: seed.industrySlug,
          config: seed.config as Prisma.InputJsonValue,
          sourceSeedId: seed.id,
          isActive: true,
          version: 1,
        },
      });
      created++;
    }

    this.logger.log(
      `Seeded ${created} templates for tenant ${tenantId} (industry: ${industrySlug})`,
    );
    return created;
  }

  async reseedForTenant(
    tenantId: string,
    industrySlug: string,
  ): Promise<number> {
    await this.prisma.tenantTemplate.updateMany({
      where: { tenantId, sourceSeedId: { not: null } },
      data: { isActive: false },
    });

    return this.seedForTenant(tenantId, industrySlug);
  }
}
