import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import {
  TOOL_REGISTRY,
  type IToolRegistry,
  type RuntimeTool,
  type RuntimeToolResult,
} from '../../work-runtime/contracts/work-runtime.interface';
import { TasksService } from '../../orchestration/services/tasks.service';
import {
  EMPLOYEE_ELIGIBILITY,
  type IEmployeeEligibility,
  type EmployeeEligibilityCriteria,
} from '../contracts/employee-eligibility.interface';
import { EmployeeEligibilityError } from '../eligibility/employee-eligibility.errors';

function req(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`tool input missing required string "${key}"`);
  }
  return v;
}

/**
 * Phase 6 — registers `employees.find_eligible` (READ) and `tasks.assign`
 * (INTERNAL_WRITE) as governed RuntimeTools.
 *
 * SOLID:
 *  - SRP: each tool adapts exactly one public capability operation.
 *  - DIP: tools depend on the {@link IEmployeeEligibility} port and the
 *    TasksService public command, never on arbitrary Prisma tables.
 *  - LSP: `tasks.assign` re-validates eligibility inside the tool (via
 *    {@link IEmployeeEligibility.assertEligible}); it never trusts planner
 *    output alone, and a fabricated/foreign Employee ID is rejected.
 */
@Injectable()
export class EmployeeTaskToolsProvider implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmployeeTaskToolsProvider.name);

  constructor(
    @Inject(TOOL_REGISTRY) private readonly registry: IToolRegistry,
    @Inject(EMPLOYEE_ELIGIBILITY)
    private readonly eligibility: IEmployeeEligibility,
    private readonly tasks: TasksService,
  ) {}

  onApplicationBootstrap(): void {
    for (const tool of this.buildTools()) this.registry.register(tool);
    this.logger.log(
      `Registered Employee task tools: ${this.buildTools()
        .map((t) => t.name)
        .join(', ')}`,
    );
  }

  private buildTools(): RuntimeTool[] {
    return [
      {
        name: 'employees.find_eligible',
        capability: 'employees',
        description:
          'Find eligible tenant AI Employees ranked deterministically for a follow-up task. Accepts optional requiredCapabilities, requiredRole, departmentId, dataClassification, and limit. Returns ranked employees with capability coverage, role/department match, and workload.',
        effect: 'READ',
        requiredAuthority: 10,
        approvalSensitive: false,
        timeoutMs: 8000,
        maxRetries: 1,
        validateInput: () => undefined,
        execute: async (i, ctx): Promise<RuntimeToolResult> => {
          try {
            const criteria: EmployeeEligibilityCriteria = {
              requiredCapabilities: Array.isArray(i.requiredCapabilities)
                ? (i.requiredCapabilities as string[])
                : undefined,
              requiredRole:
                typeof i.requiredRole === 'string' ? i.requiredRole : undefined,
              departmentId:
                typeof i.departmentId === 'string' ? i.departmentId : undefined,
              dataClassification:
                typeof i.dataClassification === 'string'
                  ? (i.dataClassification as EmployeeEligibilityCriteria['dataClassification'])
                  : undefined,
              limit: typeof i.limit === 'number' ? i.limit : undefined,
            };
            const eligible = await this.eligibility.findEligible(
              ctx.tenantId,
              criteria,
            );
            return {
              ok: true,
              data: {
                count: eligible.length,
                employees: eligible.map((e) => ({
                  employeeId: e.employeeId,
                  name: e.name,
                  role: e.role,
                  departmentId: e.departmentId,
                  capabilityCoverage: e.capabilityCoverage,
                  capabilityComplete: e.capabilityComplete,
                  roleMatch: e.roleMatch,
                  departmentMatch: e.departmentMatch,
                  dataClassification: e.dataClassification,
                  activeWorkRuns: e.activeWorkRuns,
                  maxConcurrency: e.maxConcurrency,
                  score: e.score,
                  reasons: [...e.reasons],
                })),
              },
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
              ok: false,
              errorCode: 'EMPLOYEE_ELIGIBILITY_FAILED',
              errorMessage: message,
              retryable: false,
            };
          }
        },
      },
      {
        name: 'tasks.assign',
        capability: 'orchestration',
        description:
          'Assign a follow-up task to an eligible Employee. Requires taskId and employeeId. Re-validates Employee eligibility inside the tool (never trusts planner output). Returns taskId, employeeId, and workRunId linkage.',
        effect: 'INTERNAL_WRITE',
        requiredAuthority: 50,
        approvalSensitive: false,
        timeoutMs: 8000,
        maxRetries: 1,
        validateInput: (i) => {
          req(i, 'taskId');
          req(i, 'employeeId');
        },
        execute: async (i, ctx): Promise<RuntimeToolResult> => {
          try {
            const taskId = req(i, 'taskId');
            const employeeId = req(i, 'employeeId');
            const criteria: EmployeeEligibilityCriteria = {
              requiredCapabilities: Array.isArray(i.requiredCapabilities)
                ? (i.requiredCapabilities as string[])
                : undefined,
              requiredRole:
                typeof i.requiredRole === 'string' ? i.requiredRole : undefined,
              departmentId:
                typeof i.departmentId === 'string' ? i.departmentId : undefined,
              dataClassification:
                typeof i.dataClassification === 'string'
                  ? (i.dataClassification as EmployeeEligibilityCriteria['dataClassification'])
                  : undefined,
            };

            // Re-validate inside the tool. Throws EMPLOYEE_NOT_FOUND /
            // TASK_ASSIGNMENT_INELIGIBLE on a fabricated/foreign/ineligible ID.
            await this.eligibility.assertEligible(
              ctx.tenantId,
              employeeId,
              criteria,
            );

            const task = await this.tasks.assignToEmployee(
              taskId,
              ctx.tenantId,
              {
                agentId: employeeId,
                workRunId: ctx.runId,
                rationale:
                  typeof i.rationale === 'string' ? i.rationale : undefined,
                assignedById: ctx.actorId,
              },
            );

            return {
              ok: true,
              data: {
                taskId,
                employeeId,
                workRunId: ctx.runId,
                status: (task as { status?: string }).status,
              },
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const isEligibility = err instanceof EmployeeEligibilityError;
            return {
              ok: false,
              errorCode: isEligibility
                ? 'TASK_ASSIGNMENT_INELIGIBLE'
                : 'TOOL_ERROR',
              errorMessage: message,
              retryable: false,
            };
          }
        },
      },
    ];
  }
}
