import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { DepartmentStatus } from '@prisma/client';
import { TenantResourcePolicyService } from '../../tiers/services/tenant-resource-policy.service';

export interface CreateDeptInput {
  name: string;
  description?: string;
  status?: DepartmentStatus;
  headAgentId?: string;
  parentId?: string;
  tenantId: string;
  tierDepartmentPoolId?: string;
  templateId?: string;
  deployedFromTierId?: string;
  isFixed?: boolean;
  isSelected?: boolean;
}

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPolicy: TenantResourcePolicyService,
  ) {}

  async findAll(tenantId?: string | null) {
    return this.prisma.department.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            tierId: true,
            tier: {
              select: {
                id: true,
                name: true,
                slug: true,
                maxAgents: true,
              },
            },
          },
        },
        headAgent: {
          select: { id: true, name: true, status: true, type: true },
        },
        children: true,
        parent: { select: { id: true, name: true } },
        agents: { select: { id: true, name: true, status: true, type: true } },
        _count: { select: { agents: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, tenantId },
      include: {
        children: true,
        parent: { select: { id: true, name: true } },
        agents: { select: { id: true, name: true, status: true, type: true } },
        _count: { select: { agents: true } },
      },
    });
    if (!dept) throw new NotFoundException(`Department ${id} not found`);
    return dept;
  }

  async findOneForPlatform(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        children: true,
        parent: { select: { id: true, name: true } },
        agents: { select: { id: true, name: true, status: true, type: true } },
        _count: { select: { agents: true } },
      },
    });
    if (!dept) throw new NotFoundException(`Department ${id} not found`);
    return dept;
  }

  async create(input: CreateDeptInput) {
    const parentId = input.parentId
      ? await this.resolveParentId(input.tenantId, input.parentId)
      : undefined;
    const headAgentId = input.headAgentId
      ? await this.resolveHeadAgentId(input.tenantId, input.headAgentId)
      : undefined;

    const tierSlotAssignment = input.tierDepartmentPoolId
      ? await this.tenantPolicy.assertTierDepartmentPoolBelongsToTenant(
          input.tenantId,
          input.tierDepartmentPoolId,
        )
      : undefined;

    if (tierSlotAssignment) {
      await this.tenantPolicy.assertNoDuplicateFixedDepartmentSlot(
        input.tenantId,
        tierSlotAssignment.poolSlot.id,
      );
    }

    return this.prisma.department.create({
      data: {
        name: input.name,
        description: input.description,
        status: input.status ?? 'ACTIVE',
        headAgentId,
        parentId,
        templateId: input.templateId,
        tierDepartmentPoolId: tierSlotAssignment?.poolSlot.id,
        deployedFromTierId:
          input.deployedFromTierId ?? tierSlotAssignment?.tenant.tierId,
        isFixed:
          input.isFixed ??
          (tierSlotAssignment
            ? tierSlotAssignment.poolSlot.slotType === 'FIXED' ||
              tierSlotAssignment.poolSlot.isRequired
            : false),
        isSelected: input.isSelected ?? true,
        tenantId: input.tenantId,
      },
    });
  }

  async update(id: string, tenantId: string, data: Partial<CreateDeptInput>) {
    await this.findOne(id, tenantId);

    const effectiveTenantId = data.tenantId ?? tenantId;
    const isTenantReassignment = effectiveTenantId !== tenantId;

    if (isTenantReassignment) {
      const targetTenant = await this.prisma.tenant.findUnique({
        where: { id: effectiveTenantId },
        select: { id: true },
      });
      if (!targetTenant) {
        throw new NotFoundException(`Tenant ${effectiveTenantId} not found`);
      }
    }

    const parentId = data.parentId
      ? await this.resolveParentId(effectiveTenantId, data.parentId, id)
      : undefined;
    const headAgentId = data.headAgentId
      ? await this.resolveHeadAgentId(effectiveTenantId, data.headAgentId)
      : data.headAgentId;

    const tierSlotAssignment = data.tierDepartmentPoolId
      ? await this.tenantPolicy.assertTierDepartmentPoolBelongsToTenant(
          effectiveTenantId,
          data.tierDepartmentPoolId,
        )
      : undefined;

    if (tierSlotAssignment) {
      await this.tenantPolicy.assertNoDuplicateFixedDepartmentSlot(
        effectiveTenantId,
        tierSlotAssignment.poolSlot.id,
        id,
      );
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.tenantId && { tenantId: effectiveTenantId }),
        ...(data.headAgentId !== undefined && { headAgentId }),
        ...(parentId !== undefined && { parentId }),
        ...(isTenantReassignment &&
          data.parentId === undefined && {
            parentId: null,
          }),
        ...(data.templateId !== undefined && { templateId: data.templateId }),
        ...(tierSlotAssignment !== undefined && {
          tierDepartmentPoolId: tierSlotAssignment.poolSlot.id,
          deployedFromTierId: tierSlotAssignment.tenant.tierId,
          isFixed:
            tierSlotAssignment.poolSlot.slotType === 'FIXED' ||
            tierSlotAssignment.poolSlot.isRequired,
        }),
        ...(isTenantReassignment &&
          data.tierDepartmentPoolId === undefined && {
            tierDepartmentPoolId: null,
            deployedFromTierId: null,
            isFixed: false,
          }),
        ...(data.deployedFromTierId !== undefined && {
          deployedFromTierId: data.deployedFromTierId,
        }),
        ...(data.isFixed !== undefined && { isFixed: data.isFixed }),
        ...(data.isSelected !== undefined && { isSelected: data.isSelected }),
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.department.delete({ where: { id } });
  }

  async assignParent(id: string, tenantId: string, parentId?: string | null) {
    await this.findOne(id, tenantId);
    const resolvedParentId = parentId
      ? await this.resolveParentId(tenantId, parentId, id)
      : null;

    return this.prisma.department.update({
      where: { id },
      data: { parentId: resolvedParentId },
    });
  }

  async assignTierSlot(id: string, tenantId: string, slotId: string) {
    await this.findOne(id, tenantId);
    const { tenant, poolSlot } =
      await this.tenantPolicy.assertTierDepartmentPoolBelongsToTenant(
        tenantId,
        slotId,
      );
    await this.tenantPolicy.assertNoDuplicateFixedDepartmentSlot(
      tenantId,
      slotId,
      id,
    );

    return this.prisma.department.update({
      where: { id },
      data: {
        tierDepartmentPoolId: poolSlot.id,
        deployedFromTierId: tenant.tierId,
        templateId: poolSlot.departmentTemplateId,
        isFixed: poolSlot.slotType === 'FIXED' || poolSlot.isRequired,
        isSelected: true,
      },
    });
  }

  private async resolveParentId(
    tenantId: string,
    parentId: string,
    departmentId?: string,
  ) {
    if (departmentId && parentId === departmentId) {
      throw new BadRequestException('Department cannot be its own parent');
    }

    const parent = await this.tenantPolicy.assertDepartmentBelongsToTenant(
      tenantId,
      parentId,
    );

    return parent.id;
  }

  private async resolveHeadAgentId(tenantId: string, headAgentId: string) {
    const agent = await this.tenantPolicy.assertAgentBelongsToTenant(
      tenantId,
      headAgentId,
    );

    return agent.id;
  }
}
