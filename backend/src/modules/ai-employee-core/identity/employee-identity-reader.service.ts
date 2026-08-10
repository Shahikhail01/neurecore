import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  AGENT_TENANT_SCOPE,
  AgentTenantScopeGuard,
} from '../../agents/agents-tenant-scope.guard';
import {
  EmployeeIdentity,
  IEmployeeIdentityReader,
} from '../contracts/employee-resolver.interface';

@Injectable()
export class EmployeeIdentityReaderService implements IEmployeeIdentityReader {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AGENT_TENANT_SCOPE)
    private readonly tenantScope: Pick<AgentTenantScopeGuard, 'assert'>,
  ) {}

  async find(
    tenantId: string,
    employeeId: string,
  ): Promise<EmployeeIdentity | null> {
    const scopedTenantId = this.tenantScope.assert(
      'EmployeeIdentityReader.find',
      tenantId,
    );
    return this.prisma.agent.findFirst({
      where: { id: employeeId, tenantId: scopedTenantId },
      select: { id: true, tenantId: true, name: true, role: true },
    });
  }
}
