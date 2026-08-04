/**
 * PackagesService — manages the Package Pool (Pool #6 — composite root).
 *
 * Phase 10 — Admin Business Composition.
 *
 * SOLID:
 *   S — owns Package CRUD + composition. No deploy logic (v2).
 *   O — composition can be extended (e.g. "sizing") without changing CRUD.
 *   L — usable anywhere IPoolAdminService<Package,…> is required.
 *   I — does not implement PoolService abstract class directly because of
 *       the M2M composition requirement; instead exposes a compatible API
 *       via `list`, `getById`, `getBySlug`, `create`, `update`, `remove`.
 *   D — depends on PrismaService + the other Pool services (read-only).
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Package, PackageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PoolListOptions, PoolPage } from '../../common/pool/pool.types';
import type { CreatePackageDto } from './dto/create-package.dto';
import type { UpdatePackageDto } from './dto/update-package.dto';
import type {
  AcceptPackageRecommendationsDto,
  DismissPackageRecommendationsDto,
  PackagePreviewDto,
  SnoozePackageRecommendationsDto,
  UpdatePackageCompositionDto,
} from './dto/package-composition.dto';

const COMPOSITION_INCLUDE = {
  industry: true,
  tier: true,
  departments: { orderBy: { name: 'asc' as const } },
  aiAgents: { orderBy: { name: 'asc' as const } },
  features: { orderBy: { name: 'asc' as const } },
} satisfies Prisma.PackageInclude;

@Injectable()
export class PackagesService {
  private readonly logger = new Logger(PackagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── LIST / GET (parallels PoolService contract) ───────────────────────

  async list(opts: PoolListOptions = {}): Promise<PoolPage<Package>> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;
    const where = this.buildWhere(opts);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.package.findMany({
        where,
        include: COMPOSITION_INCLUDE,
        orderBy: { [opts.sortBy ?? 'sortOrder']: opts.sortDir ?? 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.package.count({ where }),
    ]);

    return {
      items: items as unknown as Package[],
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(id: string): Promise<Package> {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
      include: COMPOSITION_INCLUDE,
    });
    if (!pkg) throw new NotFoundException(`Package ${id} not found`);
    return pkg as unknown as Package;
  }

  async getBySlug(slug: string): Promise<Package> {
    const pkg = await this.prisma.package.findFirst({
      where: { slug },
      include: COMPOSITION_INCLUDE,
    });
    if (!pkg) throw new NotFoundException(`Package "${slug}" not found`);
    return pkg as unknown as Package;
  }

  // ─── MUTATIONS ─────────────────────────────────────────────────────────

  async create(payload: CreatePackageDto): Promise<Package> {
    await this.assertIndustryAndTierExist(payload.industryId, payload.tierId);
    const created = await this.prisma.package.create({
      data: {
        slug: payload.slug,
        name: payload.name,
        description: payload.description,
        status: payload.status ?? 'DRAFT',
        sortOrder: payload.sortOrder ?? 0,
        industryId: payload.industryId,
        tierId: payload.tierId,
      },
    });
    this.logger.log(`Package created: ${created.slug} (${created.id})`);
    return created;
  }

  async update(id: string, payload: UpdatePackageDto): Promise<Package> {
    await this.getById(id);
    const updated = await this.prisma.package.update({
      where: { id },
      data: payload,
    });
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.getById(id);
    await this.prisma.package.delete({ where: { id } });
    this.logger.log(`Package removed: ${id}`);
  }

  // ─── COMPOSITION (M2M) ────────────────────────────────────────────────

  /**
   * SRP: composition update is one transactional action (Liskov-equivalent
   * to a SET on all three relations at once).
   *
   * Validates every id actually exists in its respective pool, then writes
   * the three relations in a single Prisma transaction.
   */
  async updateComposition(
    id: string,
    body: UpdatePackageCompositionDto,
  ): Promise<Package> {
    const existing = await this.prisma.package.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Package ${id} not found`);

    // Validate references OUTSIDE the transaction so the transaction only
    // contains Prisma operations (Solid: each operation has one purpose).
    if (body.departmentIds)
      await this.validateReferences('departmentTemplate', body.departmentIds);
    if (body.aiAgentIds)
      await this.validateReferences('agentTemplate', body.aiAgentIds);
    if (body.featureIds)
      await this.validateReferences('feature', body.featureIds);

    const tasks: Prisma.PrismaPromise<unknown>[] = [];

    if (body.departmentIds) {
      tasks.push(
        this.prisma.package.update({
          where: { id },
          data: {
            departments: { set: body.departmentIds.map((d) => ({ id: d })) },
          },
        }),
      );
    }
    if (body.aiAgentIds) {
      tasks.push(
        this.prisma.package.update({
          where: { id },
          data: {
            aiAgents: { set: body.aiAgentIds.map((d) => ({ id: d })) },
          },
        }),
      );
    }
    if (body.featureIds) {
      tasks.push(
        this.prisma.package.update({
          where: { id },
          data: {
            features: { set: body.featureIds.map((d) => ({ id: d })) },
          },
        }),
      );
    }
    if (
      body.suggestedAgentCount !== undefined ||
      body.suggestedDepartmentCount !== undefined
    ) {
      tasks.push(
        this.prisma.package.update({
          where: { id },
          data: {
            suggestedAgentCount: body.suggestedAgentCount,
            suggestedDepartmentCount: body.suggestedDepartmentCount,
          },
        }),
      );
    }

    if (tasks.length === 0) {
      throw new BadRequestException('No composition fields provided');
    }

    await this.prisma.$transaction(tasks);
    return this.getById(id);
  }

  // ─── PREVIEW (dry-run composition) ────────────────────────────────────

  /**
   * Validate-and-count without writing. Used by the Package composer UI to
   * surface validation errors before the user submits.
   */
  async preview(body: PackagePreviewDto) {
    await this.assertIndustryAndTierExist(body.industryId, body.tierId);

    const departmentIds = body.departmentIds ?? [];
    const aiAgentIds = body.aiAgentIds ?? [];
    const featureIds = body.featureIds ?? [];

    const [departments, agents, features] = await Promise.all([
      departmentIds.length > 0
        ? this.prisma.departmentTemplate.findMany({
            where: { id: { in: departmentIds } },
          })
        : Promise.resolve(
            [] as Awaited<
              ReturnType<typeof this.prisma.departmentTemplate.findMany>
            >,
          ),
      aiAgentIds.length > 0
        ? this.prisma.agentTemplate.findMany({
            where: { id: { in: aiAgentIds } },
          })
        : Promise.resolve(
            [] as Awaited<
              ReturnType<typeof this.prisma.agentTemplate.findMany>
            >,
          ),
      featureIds.length > 0
        ? this.prisma.feature.findMany({
            where: { id: { in: featureIds } },
          })
        : Promise.resolve(
            [] as Awaited<ReturnType<typeof this.prisma.feature.findMany>>,
          ),
    ]);

    const requestedDeps = new Set(departmentIds);
    const requestedAgents = new Set(aiAgentIds);
    const requestedFeatures = new Set(featureIds);

    const featureCategoryTotals: Record<string, number> = {};
    for (const f of features) {
      featureCategoryTotals[f.category] =
        (featureCategoryTotals[f.category] ?? 0) + 1;
    }

    const featureKeys = new Set(features.map((feature) => feature.key));
    const agentConfigs = agents.map(
      (agent) => (agent.config ?? {}) as Record<string, unknown>,
    );
    const conflicts: string[] = [];
    const dependencies: string[] = [];
    const recommendations: string[] = [];
    const recommendationDetails: Array<{
      message: string;
      severity: 'HIGH' | 'MEDIUM' | 'LOW';
      reason: string;
    }> = [];
    const suggestedFeatureKeys = new Set<string>();
    const suggestedBundles: Array<{
      key: string;
      label: string;
      reason: string;
      featureKeys: string[];
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
    }> = [];

    if (featureKeys.has('webhooks') && !featureKeys.has('api_access')) {
      dependencies.push('`webhooks` works best with `api_access`; add API Access.');
      suggestedFeatureKeys.add('api_access');
    }
    if (featureKeys.has('workflow_automation') && departments.length === 0) {
      conflicts.push('Workflow automation selected without any departments to own the process.');
    }
    if (agents.length > 0 && !featureKeys.has('audit_logs')) {
      const message = 'Add Audit Logs so deployed AI employees have traceable evidence.';
      recommendations.push(message);
      recommendationDetails.push({
        message,
        severity: 'HIGH',
        reason: 'Selected AI employees should leave an operator-visible audit trail.',
      });
      suggestedFeatureKeys.add('audit_logs');
    }
    if (
      agentConfigs.some((config) => config.authorityLevel === 'APPROVAL') &&
      !featureKeys.has('workflow_automation')
    ) {
      const message = 'Approval-bound agents benefit from Workflow Automation for governed routing.';
      recommendations.push(message);
      recommendationDetails.push({
        message,
        severity: 'HIGH',
        reason: 'Approval-requiring agent actions need explicit process routing and handoff structure.',
      });
      suggestedFeatureKeys.add('workflow_automation');
    }
    if (
      agentConfigs.some((config) => config.requiresCitations === true) &&
      !featureKeys.has('custom_reports')
    ) {
      const message = 'Citation-heavy agents pair well with Custom Reports for evidence output.';
      recommendations.push(message);
      recommendationDetails.push({
        message,
        severity: 'MEDIUM',
        reason: 'Grounded outputs are more usable when evidence can be rendered into reusable reporting artifacts.',
      });
      suggestedFeatureKeys.add('custom_reports');
    }
    if (
      agentConfigs.some((config) => Array.isArray(config.channels) && config.channels.includes('voice')) &&
      !featureKeys.has('api_access')
    ) {
      const message = 'Voice-enabled agents usually need API Access for channel orchestration.';
      recommendations.push(message);
      recommendationDetails.push({
        message,
        severity: 'MEDIUM',
        reason: 'Voice channels commonly depend on external orchestration and transport APIs.',
      });
      suggestedFeatureKeys.add('api_access');
    }

    if (
      agents.length >= 3 &&
      !featureKeys.has('audit_logs') &&
      !featureKeys.has('workflow_automation')
    ) {
      suggestedBundles.push({
        key: 'governed-ai-operations',
        label: 'Governed AI Operations',
        reason: 'Multiple AI employees should ship with audit visibility and workflow routing together.',
        featureKeys: ['audit_logs', 'workflow_automation'],
        priority: 'HIGH',
      });
    }

    if (
      departments.length >= 2 &&
      !featureKeys.has('custom_reports')
    ) {
      suggestedBundles.push({
        key: 'cross-functional-visibility',
        label: 'Cross-functional Visibility',
        reason: 'Multi-department packages work better with shared reporting and evidence output.',
        featureKeys: ['custom_reports'],
        priority: 'MEDIUM',
      });
    }

    if (
      featureKeys.has('workflow_automation') &&
      !featureKeys.has('api_access')
    ) {
      suggestedBundles.push({
        key: 'integration-ready-automation',
        label: 'Integration-ready Automation',
        reason: 'Automation packages often need API connectivity for upstream/downstream system actions.',
        featureKeys: ['api_access'],
        priority: 'MEDIUM',
      });
    }

    const readinessScore = Math.max(
      0,
      Math.min(
        100,
        100 -
          conflicts.length * 35 -
          dependencies.length * 15 -
          recommendationDetails.filter((detail) => detail.severity === 'HIGH').length * 8 -
          recommendationDetails.filter((detail) => detail.severity === 'MEDIUM').length * 4,
      ),
    );
    const readinessLabel =
      readinessScore >= 85
        ? 'READY'
        : readinessScore >= 65
          ? 'NEEDS_REVIEW'
          : 'AT_RISK';

    return {
      valid: conflicts.length === 0,
      readiness: {
        score: readinessScore,
        label: readinessLabel,
      },
      totals: {
        departments: departments.length,
        agents: agents.length,
        features: features.length,
      },
      missing: {
        departments: [...requestedDeps].filter(
          (d) => !departments.find((x) => x.id === d),
        ),
        agents: [...requestedAgents].filter(
          (a) => !agents.find((x) => x.id === a),
        ),
        features: [...requestedFeatures].filter(
          (f) => !features.find((x) => x.id === f),
        ),
      },
      categories: featureCategoryTotals,
      rules: {
        conflicts,
        dependencies,
        recommendations,
        recommendationDetails,
        suggestedFeatureKeys: Array.from(suggestedFeatureKeys),
        suggestedBundles,
      },
    };
  }

  async acceptRecommendations(
    actorId: string,
    body: AcceptPackageRecommendationsDto,
  ): Promise<{ ok: true }> {
    await this.assertIndustryAndTierExist(body.industryId, body.tierId);

    await this.prisma.auditLog.create({
      data: {
        actor: actorId,
        action: 'packages.recommendations.accepted',
        resource: 'package',
        resourceId: body.packageId ?? `${body.industryId}:${body.tierId}`,
        result: 'success',
        details: {
          packageId: body.packageId ?? null,
          industryId: body.industryId,
          tierId: body.tierId,
          suggestedFeatureKeys: body.suggestedFeatureKeys,
          currentFeatureIds: body.currentFeatureIds ?? [],
          currentDepartmentIds: body.currentDepartmentIds ?? [],
          currentAiAgentIds: body.currentAiAgentIds ?? [],
        } as never,
      },
    });

    return { ok: true };
  }

  async dismissRecommendations(
    actorId: string,
    body: DismissPackageRecommendationsDto,
  ): Promise<{ ok: true }> {
    await this.assertIndustryAndTierExist(body.industryId, body.tierId);

    await this.prisma.auditLog.create({
      data: {
        actor: actorId,
        action: 'packages.recommendations.dismissed',
        resource: 'package',
        resourceId: body.packageId ?? `${body.industryId}:${body.tierId}`,
        result: 'success',
        details: {
          packageId: body.packageId ?? null,
          industryId: body.industryId,
          tierId: body.tierId,
          suggestedFeatureKeys: body.suggestedFeatureKeys,
          reason: body.reason,
          currentFeatureIds: body.currentFeatureIds ?? [],
          currentDepartmentIds: body.currentDepartmentIds ?? [],
          currentAiAgentIds: body.currentAiAgentIds ?? [],
        } as never,
      },
    });

    return { ok: true };
  }

  async snoozeRecommendations(
    actorId: string,
    body: SnoozePackageRecommendationsDto,
  ): Promise<{ ok: true }> {
    await this.assertIndustryAndTierExist(body.industryId, body.tierId);

    await this.prisma.auditLog.create({
      data: {
        actor: actorId,
        action: 'packages.recommendations.snoozed',
        resource: 'package',
        resourceId: body.packageId ?? `${body.industryId}:${body.tierId}`,
        result: 'success',
        details: {
          packageId: body.packageId ?? null,
          industryId: body.industryId,
          tierId: body.tierId,
          suggestedFeatureKeys: body.suggestedFeatureKeys,
          reason: body.reason,
          snoozeUntil: body.snoozeUntil,
          currentFeatureIds: body.currentFeatureIds ?? [],
          currentDepartmentIds: body.currentDepartmentIds ?? [],
          currentAiAgentIds: body.currentAiAgentIds ?? [],
        } as never,
      },
    });

    return { ok: true };
  }

  async listRecommendationHistory(args: {
    packageId?: string;
    industryId?: string;
    tierId?: string;
    limit?: number;
  }) {
    const limit = Math.min(20, Math.max(1, args.limit ?? 10));
    const resourceIds = [
      args.packageId,
      args.industryId && args.tierId ? `${args.industryId}:${args.tierId}` : undefined,
    ].filter((value): value is string => Boolean(value));

    if (resourceIds.length === 0) {
      return [];
    }

    return this.prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'packages.recommendations.accepted',
            'packages.recommendations.dismissed',
            'packages.recommendations.snoozed',
          ],
        },
        resource: 'package',
        resourceId: { in: resourceIds },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────

  private buildWhere(opts: PoolListOptions): Prisma.PackageWhereInput {
    const where: Prisma.PackageWhereInput = {};
    if (
      opts.status &&
      (opts.status === 'DRAFT' ||
        opts.status === 'PUBLISHED' ||
        opts.status === 'ARCHIVED')
    ) {
      where.status = opts.status as PackageStatus;
    }
    if (opts.search) {
      where.OR = [
        { slug: { contains: opts.search, mode: 'insensitive' } },
        { name: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private async assertIndustryAndTierExist(
    industryId: string,
    tierId: string,
  ): Promise<void> {
    const [ind, tier] = await Promise.all([
      this.prisma.industry.findUnique({ where: { id: industryId } }),
      this.prisma.tier.findUnique({ where: { id: tierId } }),
    ]);
    if (!ind) throw new BadRequestException(`Industry ${industryId} not found`);
    if (!tier) throw new BadRequestException(`Tier ${tierId} not found`);
  }

  private async validateReferences(
    model: 'departmentTemplate' | 'agentTemplate' | 'feature',
    ids: string[],
  ): Promise<void> {
    const delegate = this.prisma[model] as unknown as {
      findMany: (args: {
        where: { id: { in: string[] } };
      }) => Promise<{ id: string }[]>;
    };
    const found = await delegate.findMany({
      where: { id: { in: ids } },
    });
    const foundIds = new Set(found.map((x) => x.id));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `${model} ids not found: ${missing.join(', ')}`,
      );
    }
  }
}
