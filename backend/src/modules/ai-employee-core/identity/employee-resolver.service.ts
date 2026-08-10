import { Inject, Injectable } from '@nestjs/common';
import {
  AgentStatus,
  AwlAgentAvailability,
  Prisma,
  WorkRunStatus,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  AGENT_TENANT_SCOPE,
  AgentTenantScopeGuard,
} from '../../agents/agents-tenant-scope.guard';
import {
  IEmployeeResolver,
  ResolvedEmployee,
} from '../contracts/employee-resolver.interface';
import { EmployeeResolutionError } from './employee-resolution.errors';

export const EMPLOYEE_RESOLUTION_SELECT = {
  id: true,
  tenantId: true,
  name: true,
  role: true,
  departmentId: true,
  instructions: true,
  systemPrompt: true,
  capabilities: true,
  permissions: true,
  dataClassification: true,
  budgetPerDay: true,
  status: true,
  availability: true,
  isActive: true,
  isSelected: true,
  archived: true,
  maxConcurrency: true,
  model: true,
} satisfies Prisma.AgentSelect;

const ACTIVE_WORK_RUN_STATUSES: readonly WorkRunStatus[] = [
  WorkRunStatus.CREATED,
  WorkRunStatus.PLANNING,
  WorkRunStatus.PLANNED,
  WorkRunStatus.RUNNING,
  WorkRunStatus.WAITING_FOR_APPROVAL,
  WorkRunStatus.PAUSED,
];

const UNAVAILABLE_STATUSES: readonly AgentStatus[] = [
  AgentStatus.PAUSED,
  AgentStatus.ERROR,
  AgentStatus.TERMINATED,
  AgentStatus.DEPRECATED,
];

@Injectable()
export class EmployeeResolverService implements IEmployeeResolver {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AGENT_TENANT_SCOPE)
    private readonly tenantScope: Pick<AgentTenantScopeGuard, 'assert'>,
  ) {}

  async resolve(
    tenantId: string,
    employeeId: string,
  ): Promise<ResolvedEmployee> {
    const scopedTenantId = this.tenantScope.assert(
      'EmployeeResolver.resolve',
      tenantId,
    );

    const employee = await this.prisma.agent.findFirst({
      where: { id: employeeId, tenantId: scopedTenantId },
      select: EMPLOYEE_RESOLUTION_SELECT,
    });

    if (!employee) {
      throw this.error(
        'EMPLOYEE_NOT_FOUND',
        employeeId,
        'Employee was not found',
      );
    }
    if (!employee.isActive) {
      throw this.error('EMPLOYEE_INACTIVE', employeeId, 'Employee is inactive');
    }
    if (!employee.isSelected) {
      throw this.error(
        'EMPLOYEE_NOT_SELECTED',
        employeeId,
        'Employee is not selected for this tenant',
      );
    }
    if (employee.archived || employee.status === AgentStatus.ARCHIVED) {
      throw this.error('EMPLOYEE_ARCHIVED', employeeId, 'Employee is archived');
    }
    if (
      employee.availability === AwlAgentAvailability.OFFLINE ||
      employee.availability === AwlAgentAvailability.ARCHIVED ||
      UNAVAILABLE_STATUSES.includes(employee.status)
    ) {
      throw this.error(
        'EMPLOYEE_UNAVAILABLE',
        employeeId,
        'Employee is unavailable',
      );
    }

    const permissionNames = this.parsePermissions(
      employee.permissions,
      employeeId,
    );
    // Phase 2 canonical link: capacity belongs to the persisted executing
    // employee, independent of mutable Agent status or legacy actor aliases.
    const activeWorkRuns = await this.prisma.workRun.count({
      where: {
        tenantId: scopedTenantId,
        employeeId: employee.id,
        status: { in: [...ACTIVE_WORK_RUN_STATUSES] },
      } as unknown as Prisma.WorkRunWhereInput,
    });

    if (
      employee.maxConcurrency <= 0 ||
      activeWorkRuns >= employee.maxConcurrency
    ) {
      throw this.error(
        'EMPLOYEE_CONCURRENCY_EXCEEDED',
        employeeId,
        `Employee capacity is exhausted (${activeWorkRuns}/${employee.maxConcurrency})`,
      );
    }

    return this.freeze({
      id: employee.id,
      tenantId: employee.tenantId,
      name: employee.name,
      role: employee.role,
      departmentId: employee.departmentId,
      instructions: employee.instructions,
      systemPrompt: employee.systemPrompt,
      capabilityNames: employee.capabilities,
      permissionNames,
      authorityInputs: {
        dataClassification: employee.dataClassification,
        budgetPerDay: employee.budgetPerDay?.toString() ?? null,
      },
      lifecycle: {
        status: employee.status,
        availability: employee.availability,
        maxConcurrency: employee.maxConcurrency,
        activeWorkRuns,
      },
      modelPreference: { model: employee.model, advisory: true },
    });
  }

  private parsePermissions(
    value: Prisma.JsonValue,
    employeeId: string,
  ): string[] {
    if (
      !Array.isArray(value) ||
      value.some((item) => typeof item !== 'string')
    ) {
      throw this.error(
        'EMPLOYEE_CONFIGURATION_INVALID',
        employeeId,
        'Employee permissions must be an array of strings',
      );
    }
    return value as string[];
  }

  private freeze(employee: ResolvedEmployee): ResolvedEmployee {
    Object.freeze(employee.capabilityNames);
    Object.freeze(employee.permissionNames);
    Object.freeze(employee.authorityInputs);
    Object.freeze(employee.lifecycle);
    Object.freeze(employee.modelPreference);
    return Object.freeze(employee);
  }

  private error(
    code: ConstructorParameters<typeof EmployeeResolutionError>[0],
    employeeId: string,
    message: string,
  ): EmployeeResolutionError {
    return new EmployeeResolutionError(code, message, employeeId);
  }
}
