import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DepartmentTemplateCategory } from '@prisma/client';
import type {
  IDepartmentTemplateService,
  CreateDeptTemplateInput,
} from './interfaces/department-template.interface';
import { INDUSTRY_GROUP } from '../industry/tier-industry-matrix';

const INDUSTRY_GROUP_INDUSTRIES: Record<string, string[]> = {
  [INDUSTRY_GROUP.HEALTHCARE]: ['healthcare-life-sciences'],
  'public-social': [
    'government-public-sector',
    'education-research',
    'nonprofit-international',
  ],
  [INDUSTRY_GROUP.FINANCIAL_COMPLIANCE]: [
    'accounting-audit-services',
    'financial-services',
    'insurance',
  ],
  [INDUSTRY_GROUP.BUSINESS_TECHNOLOGY]: [
    'technology-digital-services',
    'professional-business-services',
  ],
  [INDUSTRY_GROUP.INDUSTRIAL_INFRASTRUCTURE]: [
    'manufacturing-industrial',
    'construction-engineering-infrastructure',
    'energy-utilities-natural-resources',
    'logistics-transportation-supply-chain',
  ],
  [INDUSTRY_GROUP.CONSUMER_COMMERCE]: [
    'retail-commerce-consumer',
    'media-communications-creative',
  ],
  [INDUSTRY_GROUP.AGRICULTURE_FOOD]: ['agriculture-food-systems'],
  [INDUSTRY_GROUP.OTHER]: ['special-purpose-organizations'],
};

/**
 * DepartmentTemplatesService
 *
 * SRP : Manages CRUD for DepartmentTemplate records only.
 *       Does NOT perform deployment — that is DeploymentService's concern.
 * OCP : New filter/sort options can be added via opts without changing callers.
 * DIP : Controller depends on this service through constructor injection only.
 */
@Injectable()
export class DepartmentTemplatesService implements IDepartmentTemplateService {
  private readonly logger = new Logger(DepartmentTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Query ──────────────────────────────────────────────────────────────────

  async findAll(opts?: {
    category?: string;
    industryGroup?: string;
    page?: number;
    limit?: number;
  }) {
    const { category, industryGroup, page = 1, limit = 20 } = opts ?? {};
    const where: Record<string, unknown> = {
      isPublic: true,
    };
    if (category) {
      where.category = category;
    }

    if (industryGroup) {
      const all = await this.prisma.departmentTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      const groupIndustries = INDUSTRY_GROUP_INDUSTRIES[industryGroup] ?? [];
      const filterTags = [
        industryGroup,
        `industry:${industryGroup}`,
        ...groupIndustries,
        ...groupIndustries.map((i) => i.split('-')[0]),
      ];
      const filtered = all.filter((t) => {
        const tags = Array.isArray(t.tags) ? (t.tags as string[]) : [];
        if (t.category === industryGroup) return true;
        for (const ind of groupIndustries) {
          if (t.category === ind) return true;
        }
        for (const ftag of filterTags) {
          if (tags.includes(ftag)) return true;
        }
        return false;
      });
      const total = filtered.length;
      const skip = (page - 1) * limit;
      return {
        data: filtered.slice(skip, skip + limit),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.departmentTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.departmentTemplate.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const tmpl = await this.prisma.departmentTemplate.findUnique({
      where: { id },
    });
    if (!tmpl)
      throw new NotFoundException(`Department template ${id} not found`);
    return tmpl;
  }

  async findBySlug(slug: string) {
    const tmpl = await this.prisma.departmentTemplate.findUnique({
      where: { slug },
    });
    if (!tmpl)
      throw new NotFoundException(`Department template "${slug}" not found`);
    return tmpl;
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  async create(dto: CreateDeptTemplateInput) {
    // Enforce unique slug at service layer (distinct from DB constraint error)
    const existing = await this.prisma.departmentTemplate.findUnique({
      where: { slug: dto.slug },
    });
    if (existing)
      throw new ConflictException(`Slug "${dto.slug}" is already taken`);

    const tmpl = await this.prisma.departmentTemplate.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        structure: (dto.structure ?? []) as never,
        category: dto.category ?? DepartmentTemplateCategory.OTHER,
        tags: (dto.tags ?? []) as never,
        isPublic: dto.isPublic ?? true,
      },
    });

    this.logger.log(`Created department template "${tmpl.slug}"`);
    return tmpl;
  }

  async update(id: string, dto: Partial<CreateDeptTemplateInput>) {
    await this.findOne(id); // throws if missing

    return this.prisma.departmentTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.structure !== undefined && {
          structure: dto.structure as never,
        }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.tags !== undefined && { tags: dto.tags as never }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // throws if missing
    await this.prisma.departmentTemplate.delete({ where: { id } });
    this.logger.log(`Deleted department template ${id}`);
  }
}
