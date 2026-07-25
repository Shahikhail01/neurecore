import {
  Injectable,
  NotFoundException,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { DepartmentStatus } from '@prisma/client';
import { TenantTemplateRuntimeService } from '../../tenant-templates/tenant-template-runtime.service';

export interface CreateDeptInput {
  name: string;
  description?: string;
  status?: DepartmentStatus;
  headAgentId?: string | null;
  parentId?: string;
}

export interface AutoCreateFromTemplateResult {
  created: number;
  skipped: number;
  departments: Array<{ id: string; name: string; skipped?: boolean }>;
}

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly templateRuntime?: TenantTemplateRuntimeService,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId },
      include: {
        children: true,
        parent: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, tenantId },
      include: { children: true, parent: { select: { id: true, name: true } } },
    });
    if (!dept) throw new NotFoundException(`Department ${id} not found`);
    return dept;
  }

  async create(input: CreateDeptInput, tenantId: string) {
    return this.prisma.department.create({
      data: {
        name: input.name,
        description: input.description,
        status: input.status ?? 'ACTIVE',
        headAgentId: input.headAgentId,
        parentId: input.parentId,
        tenantId,
      },
    });
  }

  async update(
    id: string,
    data: Partial<Omit<CreateDeptInput, 'tenantId'>>,
    tenantId: string,
  ) {
    await this.findOne(id, tenantId);
    return this.prisma.department.update({ where: { id }, data });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.department.delete({ where: { id } });
  }

  /**
   * Stage 1 §4.7 — Create the full department structure described by a
   * tenant's DEPARTMENT_DEFAULT template. Idempotent — skips departments
   * whose name already exists for the tenant.
   */
  async autoCreateFromTemplate(
    tenantId: string,
    templateSlug?: string,
  ): Promise<AutoCreateFromTemplateResult> {
    if (!this.templateRuntime) {
      return { created: 0, skipped: 0, departments: [] };
    }
    let resolvedSlug = templateSlug;
    if (!resolvedSlug) {
      try {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { industry: true },
        });
        const map: Record<string, string> = {
          'accounting-audit-services': 'accounting-firm-dept-structure',
          'financial-services': 'financial-services-dept-structure',
        };
        if (tenant?.industry && map[tenant.industry]) {
          resolvedSlug = map[tenant.industry];
        }
      } catch (err) {
        this.logger.warn(
          `autoCreateFromTemplate: tenant lookup failed for ${tenantId}: ${(err as Error).message}`,
        );
      }
    }
    const tpl = await this.templateRuntime.resolveDepartmentTemplate(
      tenantId,
      resolvedSlug,
    );
    if (!tpl || tpl.departments.length === 0) {
      return { created: 0, skipped: 0, departments: [] };
    }

    const existing = await this.prisma.department.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    const existingByName = new Set(existing.map((d) => d.name));

    const result: AutoCreateFromTemplateResult = {
      created: 0,
      skipped: 0,
      departments: [],
    };

    for (const spec of tpl.departments) {
      if (existingByName.has(spec.name)) {
        const found = existing.find((d) => d.name === spec.name)!;
        result.skipped += 1;
        result.departments.push({
          id: found.id,
          name: spec.name,
          skipped: true,
        });
        continue;
      }
      const created = await this.prisma.department.create({
        data: {
          tenantId,
          name: spec.name,
          description: `Industry department structure (template ${tpl.sourceTemplateId})`,
          status: 'ACTIVE',
        },
      });
      result.created += 1;
      result.departments.push({ id: created.id, name: spec.name });
    }

    this.logger.log(
      `autoCreateFromTemplate tenant=${tenantId} template=${templateSlug ?? 'default'}: created=${result.created} skipped=${result.skipped}`,
    );
    return result;
  }
}
