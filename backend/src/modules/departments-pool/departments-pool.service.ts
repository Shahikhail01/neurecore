/**
 * DepartmentsPoolService — manages the Departments Pool (Pool #2).
 *
 * Phase 10 — Admin Business Composition.
 *
 * Reuses the existing `DepartmentTemplate` Prisma model. No data movement —
 * the Admin UI just gains a new, cleaner REST surface under /api/v1/departments-pool.
 * Legacy /api/v1/department-templates remains available for back-compat.
 */

import { Injectable } from '@nestjs/common';
import { DepartmentTemplate, DepartmentTemplateCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PoolListOptions } from '../../common/pool/pool.types';
import {
  PoolModelConfig,
  PoolService,
} from '../../common/pool/pool.service';
import type { CreateDepartmentPoolDto } from './dto/create-department-pool.dto';
import type { UpdateDepartmentPoolDto } from './dto/update-department-pool.dto';

@Injectable()
export class DepartmentsPoolService extends PoolService<
  DepartmentTemplate,
  CreateDepartmentPoolDto,
  UpdateDepartmentPoolDto
> {
  protected readonly uniqueKey: 'id' | 'slug' | 'key' = 'slug';

  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  protected get config(): PoolModelConfig<
    DepartmentTemplate,
    CreateDepartmentPoolDto,
    UpdateDepartmentPoolDto
  > {
    return {
      delegate: this.prismaService.departmentTemplate as unknown as PoolModelConfig<
        DepartmentTemplate,
        CreateDepartmentPoolDto,
        UpdateDepartmentPoolDto
      >['delegate'],
      defaultSortBy: 'createdAt',
      useSoftDelete: false,
      buildWhere: (opts: PoolListOptions): Prisma.DepartmentTemplateWhereInput => {
        const where: Prisma.DepartmentTemplateWhereInput = {
          // Pool UI hides the legacy "OTHER" bucket from the default list.
          // phase5a-p13 collapsed all pre-enum values (including
          // 'legacy-tier') into OTHER, so excluding OTHER here is the
          // correct post-migration filter.
          NOT: { category: DepartmentTemplateCategory.OTHER },
        };
        if (opts.status)
          where.category = opts.status as DepartmentTemplateCategory;
        if (opts.search) {
          where.OR = [
            { slug: { contains: opts.search, mode: 'insensitive' } },
            { name: { contains: opts.search, mode: 'insensitive' } },
          ];
        }
        return where;
      },
      buildOrderBy: (opts: PoolListOptions) => {
        const key = opts.sortBy ?? 'createdAt';
        const dir = opts.sortDir ?? 'desc';
        return { [key]: dir };
      },
    };
  }
}
