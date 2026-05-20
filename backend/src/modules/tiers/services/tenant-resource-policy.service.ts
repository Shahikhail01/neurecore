import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

const TENANT_AGENT_EDITABLE_FIELDS = [
  'name',
  'description',
  'status',
  'model',
  'systemPrompt',
  'instructions',
  'budgetPerDay',
  'permissions',
  'config',
  'metadata',
  'isActive',
] as const;

const TENANT_DEPARTMENT_EDITABLE_FIELDS = [
  'name',
  'description',
  'status',
  'headAgentId',
] as const;

@Injectable()
export class TenantResourcePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  assertAllowedTenantAgentUpdate(input: Record<string, unknown>) {
    return this.assertAllowedFields(
      input,
      TENANT_AGENT_EDITABLE_FIELDS,
      'Tenant Admin cannot update restricted agent fields',
    );
  }

  assertAllowedTenantDepartmentUpdate(input: Record<string, unknown>) {
    return this.assertAllowedFields(
      input,
      TENANT_DEPARTMENT_EDITABLE_FIELDS,
      'Tenant Admin cannot update restricted department fields',
    );
  }

  async assertTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tier: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }
    return tenant;
  }

  async assertDepartmentBelongsToTenant(
    tenantId: string,
    departmentId: string,
  ) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!department) {
      throw new NotFoundException(`Department ${departmentId} not found`);
    }
    if (department.tenantId !== tenantId) {
      throw new ForbiddenException(
        `Department ${departmentId} does not belong to tenant ${tenantId}`,
      );
    }
    return department;
  }

  async assertAgentBelongsToTenant(tenantId: string, agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }
    if (agent.tenantId !== tenantId) {
      throw new ForbiddenException(
        `Agent ${agentId} does not belong to tenant ${tenantId}`,
      );
    }
    return agent;
  }

  async assertTierMatchesTenant(tenantId: string, tierId: string) {
    const tenant = await this.assertTenantExists(tenantId);
    if (tenant.tierId !== tierId) {
      throw new BadRequestException(
        `Tenant ${tenantId} is not assigned to tier ${tierId}`,
      );
    }
    return tenant;
  }

  async assertTierAgentPoolBelongsToTenant(tenantId: string, slotId: string) {
    const tenant = await this.assertTenantExists(tenantId);
    const poolSlot = await this.prisma.tierAgentPool.findUnique({
      where: { id: slotId },
    });
    if (!poolSlot) {
      throw new NotFoundException(`Tier agent pool slot ${slotId} not found`);
    }
    if (poolSlot.tierId !== tenant.tierId) {
      throw new ForbiddenException(
        `Tier agent pool slot ${slotId} does not belong to tenant ${tenantId}`,
      );
    }
    return { tenant, poolSlot };
  }

  async assertTierDepartmentPoolBelongsToTenant(
    tenantId: string,
    slotId: string,
  ) {
    const tenant = await this.assertTenantExists(tenantId);
    const poolSlot = await this.prisma.tierDepartmentPool.findUnique({
      where: { id: slotId },
    });
    if (!poolSlot) {
      throw new NotFoundException(
        `Tier department pool slot ${slotId} not found`,
      );
    }
    if (poolSlot.tierId !== tenant.tierId) {
      throw new ForbiddenException(
        `Tier department pool slot ${slotId} does not belong to tenant ${tenantId}`,
      );
    }
    return { tenant, poolSlot };
  }

  async assertNoDuplicateFixedDepartmentSlot(
    tenantId: string,
    slotId: string,
    excludeDepartmentId?: string,
  ) {
    const { poolSlot } = await this.assertTierDepartmentPoolBelongsToTenant(
      tenantId,
      slotId,
    );

    if (poolSlot.slotType !== 'FIXED' && !poolSlot.isRequired) {
      return poolSlot;
    }

    const existing = await this.prisma.department.findFirst({
      where: {
        tenantId,
        tierDepartmentPoolId: slotId,
        isSelected: true,
        ...(excludeDepartmentId ? { id: { not: excludeDepartmentId } } : {}),
      },
      select: { id: true, name: true },
    });

    if (existing) {
      throw new BadRequestException(
        `Fixed department slot ${slotId} is already deployed as department "${existing.name}" (${existing.id})`,
      );
    }

    return poolSlot;
  }

  async assertNoDuplicateFixedDepartmentTemplateDeployment(
    tenantId: string,
    templateId: string,
  ) {
    const tenant = await this.assertTenantExists(tenantId);
    const fixedPoolEntry = await this.prisma.tierDepartmentPool.findFirst({
      where: {
        tierId: tenant.tierId,
        departmentTemplateId: templateId,
        OR: [{ slotType: 'FIXED' }, { isRequired: true }],
      },
      select: { id: true },
    });

    if (!fixedPoolEntry) {
      return null;
    }

    const existingDeployment = await this.prisma.department.findFirst({
      where: {
        tenantId,
        templateId,
        isSelected: true,
      },
      select: { id: true, name: true },
    });

    if (existingDeployment) {
      throw new BadRequestException(
        `Fixed department template ${templateId} is already deployed as department "${existingDeployment.name}" (${existingDeployment.id})`,
      );
    }

    return fixedPoolEntry;
  }

  private assertAllowedFields(
    input: Record<string, unknown>,
    allowedFields: readonly string[],
    message: string,
  ) {
    const forbiddenFields = Object.keys(input).filter(
      (key) => input[key] !== undefined && !allowedFields.includes(key),
    );

    if (forbiddenFields.length > 0) {
      throw new ForbiddenException(
        `${message}: ${forbiddenFields.sort().join(', ')}`,
      );
    }

    return Object.fromEntries(
      Object.entries(input).filter(
        ([key, value]) => value !== undefined && allowedFields.includes(key),
      ),
    );
  }
}
