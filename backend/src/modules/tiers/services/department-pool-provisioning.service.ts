import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TenantResourcePolicyService } from './tenant-resource-policy.service';

interface ProvisionDepartmentInput {
  name?: string;
  description?: string;
  headAgentId?: string;
  parentId?: string;
}

@Injectable()
export class DepartmentPoolProvisioningService {
  private readonly logger = new Logger(DepartmentPoolProvisioningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPolicy: TenantResourcePolicyService,
  ) {}

  async provisionFromSlot(
    tenantId: string,
    slotId: string,
    input: ProvisionDepartmentInput,
    userId?: string,
  ) {
    const { tenant, poolSlot } =
      await this.tenantPolicy.assertTierDepartmentPoolBelongsToTenant(
        tenantId,
        slotId,
      );

    if (poolSlot.slotType === 'FIXED') {
      throw new ForbiddenException(
        'Cannot manually provision a FIXED department slot. Fixed departments are managed automatically by your tier policy.',
      );
    }

    const existingDepartment = await this.prisma.department.findFirst({
      where: {
        tenantId,
        tierDepartmentPoolId: slotId,
        isSelected: true,
      },
      select: { id: true, name: true },
    });

    if (existingDepartment) {
      throw new BadRequestException(
        `Slot ${poolSlot.slot} is already filled with department "${existingDepartment.name}" (${existingDepartment.id}).`,
      );
    }

    const template = await this.prisma.departmentTemplate.findUnique({
      where: { id: poolSlot.departmentTemplateId },
    });

    if (!template) {
      throw new NotFoundException(
        `Department template ${poolSlot.departmentTemplateId} not found`,
      );
    }

    const headAgentId = input.headAgentId
      ? (
          await this.tenantPolicy.assertAgentBelongsToTenant(
            tenantId,
            input.headAgentId,
          )
        ).id
      : undefined;

    const parentId = input.parentId
      ? (
          await this.tenantPolicy.assertDepartmentBelongsToTenant(
            tenantId,
            input.parentId,
          )
        ).id
      : undefined;

    const department = await this.prisma.department.create({
      data: {
        name: input.name?.trim() || template.name,
        description:
          input.description !== undefined
            ? input.description.trim() || null
            : (template.description ?? null),
        status: 'ACTIVE',
        tenantId,
        headAgentId,
        parentId,
        tierDepartmentPoolId: poolSlot.id,
        templateId: template.id,
        deployedFromTierId: tenant.tierId,
        isFixed: false,
        isSelected: true,
        createdById: userId ?? undefined,
      },
    });

    this.logger.log(
      `Provisioned choice department "${department.name}" (${department.id}) for tenant ${tenantId} from slot ${slotId}`,
    );

    return {
      departmentId: department.id,
      slotId,
      slotType: 'CHOICE' as const,
      isFixed: false,
      departmentName: department.name,
    };
  }
}
