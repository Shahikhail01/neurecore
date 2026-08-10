import { Inject, Injectable } from '@nestjs/common';
import {
  AgentClassification,
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
  EligibleEmployee,
  EmployeeEligibilityCriteria,
  IEmployeeEligibility,
} from '../contracts/employee-eligibility.interface';
import { EmployeeEligibilityError } from './employee-eligibility.errors';

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

/** Classification rank: INTERNAL < CONFIDENTIAL < RESTRICTED. */
const CLASSIFICATION_RANK: Record<AgentClassification, number> = {
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  RESTRICTED: 3,
};

interface EligibleAgentRow {
  id: string;
  name: string;
  role: string | null;
  departmentId: string | null;
  capabilities: string[];
  status: AgentStatus;
  availability: AwlAgentAvailability;
  isActive: boolean;
  isSelected: boolean;
  archived: boolean;
  maxConcurrency: number;
  dataClassification: AgentClassification;
}

/**
 * Phase 6 — deterministic, tenant-scoped Employee selection (SOL-02 §Phase 6).
 *
 * Read-only. Queries only tenant Employees meeting active/selected/non-archived
 * requirements, required capability coverage, data-classification eligibility,
 * optional department/role constraints, and concurrency limits. Ranks by
 * capability coverage, then department/role match, then workload (fewer active
 * WorkRuns first), then stable Agent ID (ascending).
 *
 * LSP: returns the same typed shape regardless of adapter; never reports success
 * when an Employee did not actually meet the criteria.
 */
@Injectable()
export class EmployeeEligibilityService implements IEmployeeEligibility {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AGENT_TENANT_SCOPE)
    private readonly tenantScope: Pick<AgentTenantScopeGuard, 'assert'>,
  ) {}

  async findEligible(
    tenantId: string,
    criteria: EmployeeEligibilityCriteria = {},
  ): Promise<readonly EligibleEmployee[]> {
    const scopedTenantId = this.tenantScope.assert(
      'EmployeeEligibility.findEligible',
      tenantId,
    );
    const requiredCaps = this.toArray(criteria.requiredCapabilities);

    const agents = await this.queryCandidates(scopedTenantId);
    const workloads = await this.loadWorkloads(
      scopedTenantId,
      agents.map((a) => a.id),
    );

    const ranked: EligibleEmployee[] = [];

    for (const agent of agents) {
      const capabilityCoverage = requiredCaps.filter((cap) =>
        agent.capabilities.includes(cap),
      ).length;
      // Vacuously complete when no capability is required.
      const capabilityComplete =
        requiredCaps.length === 0 || capabilityCoverage === requiredCaps.length;
      const roleMatch =
        criteria.requiredRole == null ||
        (typeof criteria.requiredRole === 'string' &&
          agent.role === criteria.requiredRole);
      const departmentMatch =
        criteria.departmentId == null ||
        agent.departmentId === criteria.departmentId;
      const classificationOk =
        criteria.dataClassification == null ||
        CLASSIFICATION_RANK[agent.dataClassification] >=
          CLASSIFICATION_RANK[criteria.dataClassification];
      const activeWorkRuns = workloads.get(agent.id) ?? 0;
      const concurrencyOk =
        agent.maxConcurrency > 0 && activeWorkRuns < agent.maxConcurrency;

      if (!capabilityComplete) continue;
      if (!roleMatch) continue;
      if (!departmentMatch) continue;
      if (!classificationOk) continue;
      if (!concurrencyOk) continue;

      const reasons: string[] = [];
      if (capabilityComplete)
        reasons.push(
          `covers ${capabilityCoverage}/${requiredCaps.length} required capabilities`,
        );
      if (roleMatch) reasons.push('role matches');
      if (departmentMatch) reasons.push('department matches');
      reasons.push(`has capacity (${activeWorkRuns}/${agent.maxConcurrency})`);

      const score = this.score({
        capabilityCoverage,
        requiredCapabilityCount: requiredCaps.length,
        roleMatch,
        departmentMatch,
        activeWorkRuns,
      });

      ranked.push(
        Object.freeze({
          employeeId: agent.id,
          name: agent.name,
          role: agent.role,
          departmentId: agent.departmentId,
          capabilityCoverage,
          capabilityComplete,
          roleMatch,
          departmentMatch,
          dataClassification: agent.dataClassification,
          activeWorkRuns,
          maxConcurrency: agent.maxConcurrency,
          score,
          reasons: Object.freeze(reasons),
        }),
      );
    }

    // Deterministic ranking:
    // 1. score (capability coverage, then role/dept match)
    // 2. workload — fewer active WorkRuns first
    // 3. stable Agent ID ascending
    ranked.sort(
      (a, b) =>
        b.score - a.score ||
        a.activeWorkRuns - b.activeWorkRuns ||
        a.employeeId.localeCompare(b.employeeId),
    );

    const limit = Math.max(1, criteria.limit ?? 10);
    return Object.freeze(ranked.slice(0, limit));
  }

  async assertEligible(
    tenantId: string,
    employeeId: string,
    criteria: EmployeeEligibilityCriteria = {},
  ): Promise<EligibleEmployee> {
    const scopedTenantId = this.tenantScope.assert(
      'EmployeeEligibility.assertEligible',
      tenantId,
    );
    if (!employeeId || typeof employeeId !== 'string') {
      throw this.error(
        'TASK_ASSIGNMENT_INELIGIBLE',
        employeeId,
        'A valid Employee ID is required for assignment',
      );
    }

    const candidates = await this.findEligible(scopedTenantId, {
      ...criteria,
      limit: 100,
    });
    const match = candidates.find((c) => c.employeeId === employeeId);
    if (!match) {
      // Distinguish a foreign/missing Employee from a merely ineligible one.
      const exists = await this.prisma.agent.findFirst({
        where: { id: employeeId, tenantId: scopedTenantId },
        select: { id: true },
      });
      if (!exists) {
        throw this.error(
          'EMPLOYEE_NOT_FOUND',
          employeeId,
          'Employee was not found in this tenant',
        );
      }
      throw this.error(
        'TASK_ASSIGNMENT_INELIGIBLE',
        employeeId,
        'Employee is not eligible for this assignment (capability, role, department, classification, or capacity)',
      );
    }
    return match;
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private async queryCandidates(tenantId: string): Promise<EligibleAgentRow[]> {
    const rows = await this.prisma.agent.findMany({
      where: {
        tenantId,
        isActive: true,
        isSelected: true,
        archived: false,
        availability: {
          notIn: [AwlAgentAvailability.OFFLINE, AwlAgentAvailability.ARCHIVED],
        },
        status: { notIn: [...UNAVAILABLE_STATUSES] },
      },
      select: {
        id: true,
        name: true,
        role: true,
        departmentId: true,
        capabilities: true,
        status: true,
        availability: true,
        isActive: true,
        isSelected: true,
        archived: true,
        maxConcurrency: true,
        dataClassification: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      departmentId: row.departmentId,
      capabilities: row.capabilities ?? [],
      status: row.status,
      availability: row.availability,
      isActive: row.isActive,
      isSelected: row.isSelected,
      archived: row.archived,
      maxConcurrency: row.maxConcurrency,
      dataClassification: row.dataClassification,
    }));
  }

  private async loadWorkloads(
    tenantId: string,
    agentIds: string[],
  ): Promise<Map<string, number>> {
    if (agentIds.length === 0) return new Map();
    const rows = await this.prisma.workRun.groupBy({
      by: ['employeeId'] as unknown as Prisma.WorkRunScalarFieldEnum[],
      where: {
        tenantId,
        employeeId: { in: agentIds },
        status: { in: [...ACTIVE_WORK_RUN_STATUSES] },
      } as unknown as Prisma.WorkRunGroupByArgs['where'],
      _count: { _all: true },
    });
    const map = new Map<string, number>();
    for (const row of rows as unknown as Array<{
      employeeId: string;
      _count: { _all: number };
    }>) {
      map.set(row.employeeId, row._count._all);
    }
    return map;
  }

  private score(params: {
    capabilityCoverage: number;
    requiredCapabilityCount: number;
    roleMatch: boolean;
    departmentMatch: boolean;
    activeWorkRuns: number;
  }): number {
    let score = 0;
    score +=
      params.requiredCapabilityCount > 0
        ? (params.capabilityCoverage / params.requiredCapabilityCount) * 100
        : 10;
    if (params.roleMatch) score += 5;
    if (params.departmentMatch) score += 2;
    return score;
  }

  private toArray(value: readonly string[] | undefined): string[] {
    if (!value || !Array.isArray(value)) return [];
    const arr = value as readonly string[];
    const out: string[] = [];
    for (let i = 0; i < arr.length; i++) out.push(arr[i]);
    return out;
  }

  private error(
    code: 'EMPLOYEE_NOT_FOUND' | 'TASK_ASSIGNMENT_INELIGIBLE',
    employeeId: string,
    message: string,
  ): EmployeeEligibilityError {
    return new EmployeeEligibilityError(code, message, employeeId);
  }
}
