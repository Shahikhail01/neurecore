import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TenantResourcePolicyService } from './tenant-resource-policy.service';

@Injectable()
export class AssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPolicy: TenantResourcePolicyService,
  ) {}

  async resolveDepartmentAssignment(tenantId: string, departmentId?: string | null) {
    if (!departmentId) {
      return null;
    }

    const department = await this.tenantPolicy.assertDepartmentBelongsToTenant(
      tenantId,
      departmentId,
    );
    return department.id;
  }

  async assignAgentToDepartment(
    tenantId: string,
    agentId: string,
    departmentId?: string | null,
  ) {
    await this.tenantPolicy.assertAgentBelongsToTenant(tenantId, agentId);
    const resolvedDepartmentId = await this.resolveDepartmentAssignment(
      tenantId,
      departmentId,
    );

    return this.prisma.agent.update({
      where: { id: agentId },
      data: { departmentId: resolvedDepartmentId },
    });
  }

  async assignAgentToTierSlot(
    tenantId: string,
    agentId: string,
    slotId: string,
  ) {
    await this.tenantPolicy.assertAgentBelongsToTenant(tenantId, agentId);
    const { tenant, poolSlot } = await this.tenantPolicy.assertTierAgentPoolBelongsToTenant(
      tenantId,
      slotId,
    );

    return this.prisma.agent.update({
      where: { id: agentId },
      data: {
        tierAgentPoolId: poolSlot.id,
        deployedFromTierId: tenant.tierId,
        isFixed: poolSlot.slotType === 'FIXED' || poolSlot.isRequired,
        isSelected: true,
      },
    });
  }
}
