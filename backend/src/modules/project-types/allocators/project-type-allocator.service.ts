/**
 * ProjectTypes — Allocator (Phase 2G)
 *
 * Single Responsibility: clone system ProjectType rows (tenantId IS NULL,
 * isSystem = true, industry = X) into tenant-scoped copies on first-time
 * onboarding complete(). Idempotent — checks (tenantId, name) before insert.
 *
 * Per §7.3 of project-creation-imp-plan.md:
 *   - copies `ProjectType` (tenantId, isSystem=false, classification)
 *   - copies linked `ProjectTypePack` M2M rows
 *   - copies latest `ProjectTypeVersion` v1 (fieldSchema, stageTemplate,
 *     approvalTemplate, informationRequirements, goalTemplate, roleTemplate)
 *   - skips the source's `createdAt`/`updatedAt` (timestamps are computed)
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ProjectTypeClassification } from '../interfaces/project-type.interface';

export interface AllocationResult {
  allocated: number;
  skipped: number;
}

const VALID_CLASSIFICATIONS: ProjectTypeClassification[] = [
  'CLIENT_ENGAGEMENT',
  'INTERNAL_INITIATIVE',
  'OPERATIONAL_PROGRAM',
];

function validClassification(
  v: string | null | undefined,
): ProjectTypeClassification | null {
  if (
    v !== null &&
    v !== undefined &&
    (VALID_CLASSIFICATIONS as readonly string[]).includes(v)
  ) {
    return v as ProjectTypeClassification;
  }
  return null;
}

@Injectable()
export class ProjectTypeAllocatorService {
  private readonly logger = new Logger(ProjectTypeAllocatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async allocateForTenant(
    tenantId: string,
    industry: string | null | undefined,
  ): Promise<AllocationResult> {
    const slug = (industry ?? '').trim();
    if (!slug) {
      this.logger.debug(
        `Tenant ${tenantId} has no industry — skipping allocation`,
      );
      return { allocated: 0, skipped: 0 };
    }

    const sources = await this.prisma.projectType.findMany({
      where: { tenantId: null, isSystem: true, industry: slug },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        industry: true,
        classification: true,
      },
    });

    if (sources.length === 0) {
      this.logger.warn(
        `No system ProjectTypes for industry "${slug}" — nothing to allocate`,
      );
      return { allocated: 0, skipped: 0 };
    }

    let allocated = 0;
    let skipped = 0;

    for (const source of sources) {
      const exists = await this.prisma.projectType.findFirst({
        where: { tenantId, name: source.name },
        select: { id: true },
      });
      if (exists) {
        skipped += 1;
        continue;
      }

      const classification = validClassification(source.classification);
      await this.cloneOne(tenantId, source, classification);
      allocated += 1;
    }

    this.logger.log(
      `Allocated ${allocated} ProjectTypes (skipped ${skipped}) ` +
        `for tenant ${tenantId} industry "${slug}"`,
    );
    return { allocated, skipped };
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private async cloneOne(
    tenantId: string,
    source: {
      id: string;
      name: string;
      slug: string | null;
      industry: string | null;
    },
    classification: ProjectTypeClassification | null,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const clone = await tx.projectType.create({
        data: {
          tenantId,
          name: source.name,
          slug: source.slug ?? null,
          industry: source.industry ?? null,
          isSystem: false,
          classification,
        },
        select: { id: true },
      });

      const links = await tx.projectTypePack.findMany({
        where: { projectTypeId: source.id },
        orderBy: { sortOrder: 'asc' },
        select: { questionPackId: true, sortOrder: true },
      });
      if (links.length > 0) {
        await tx.projectTypePack.createMany({
          data: links.map((l) => ({
            projectTypeId: clone.id,
            questionPackId: l.questionPackId,
            sortOrder: l.sortOrder,
          })),
        });
      }

      const version = await tx.projectTypeVersion.findFirst({
        where: { projectTypeId: source.id },
        orderBy: { version: 'desc' },
        select: {
          fieldSchema: true,
          stageTemplate: true,
          approvalTemplate: true,
          goalTemplate: true,
          roleTemplate: true,
          informationRequirements: true,
        },
      });
      if (version) {
        await tx.projectTypeVersion.create({
          data: {
            projectTypeId: clone.id,
            version: 1,
            fieldSchema: (version.fieldSchema as Prisma.InputJsonValue) ?? [],
            stageTemplate:
              (version.stageTemplate as Prisma.InputJsonValue) ?? [],
            approvalTemplate:
              (version.approvalTemplate as Prisma.InputJsonValue) ?? [],
            goalTemplate: (version.goalTemplate as Prisma.InputJsonValue) ?? [],
            roleTemplate: (version.roleTemplate as Prisma.InputJsonValue) ?? [],
            informationRequirements:
              (version.informationRequirements as Prisma.InputJsonValue) ?? [],
          },
        });
      }
    });
  }
}
