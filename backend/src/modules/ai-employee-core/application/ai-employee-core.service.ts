import { Inject, Injectable } from '@nestjs/common';
import {
  WORK_RUNTIME,
  type IWorkRuntime,
  type WorkRunStepView,
  type WorkRunView,
  type StepWithResult,
} from '../../work-runtime/contracts/work-runtime.interface';
import {
  EMPLOYEE_IDENTITY_READER,
  EMPLOYEE_RESOLVER,
} from '../ai-employee-core.tokens';
import {
  IAIEmployeeCore,
  StartEmployeeRunInput,
  DurableStartResult,
} from '../contracts/ai-employee-core.interface';
import {
  type IEmployeeResolver,
  type IEmployeeIdentityReader,
  type ResolvedEmployee,
} from '../contracts/employee-resolver.interface';
import {
  EmployeeRunFilter,
  EmployeeRunView,
} from '../contracts/employee-run.types';
import {
  EmployeeRunViewMapper,
  type EmployeeRunProjectionSource,
} from '../projections/employee-run-view.mapper';
import { extractArtifactRefs } from '../projections/artifact-extractor';

@Injectable()
export class AIEmployeeCoreService implements IAIEmployeeCore {
  constructor(
    @Inject(EMPLOYEE_RESOLVER)
    private readonly employees: IEmployeeResolver,
    @Inject(WORK_RUNTIME) private readonly runtime: IWorkRuntime,
    @Inject(EMPLOYEE_IDENTITY_READER)
    private readonly identities: IEmployeeIdentityReader,
    private readonly mapper: EmployeeRunViewMapper,
  ) {}

  async start(input: StartEmployeeRunInput): Promise<EmployeeRunView> {
    const { run, created } = await this.startDurable(input);
    if (!created) return run;
    return this.executeRun(run.tenantId, run.id);
  }

  async startDurable(
    input: StartEmployeeRunInput,
  ): Promise<DurableStartResult> {
    const normalized = this.validate(input);
    const employee = await this.employees.resolve(
      normalized.tenantId,
      normalized.employeeId,
    );
    const created = await this.runtime.createRun({
      tenantId: normalized.tenantId,
      actorId: employee.id,
      actorType: 'AI_AGENT',
      employeeId: employee.id,
      requestedByActorId: normalized.requestedBy.actorId,
      taskId: normalized.context?.taskId ?? null,
      triggerType: normalized.trigger.type,
      triggerSourceId: normalized.trigger.sourceId ?? null,
      idempotencyKey: normalized.idempotencyKey,
      threadId: normalized.context?.threadId ?? null,
      request: normalized.objective,
      scope: {
        projectId: normalized.context?.projectId,
        customerId: normalized.context?.customerId,
        fileIds: normalized.context?.fileIds
          ? [...normalized.context.fileIds]
          : undefined,
        includeCapabilities: normalized.context?.includeCapabilities
          ? [...normalized.context.includeCapabilities]
          : undefined,
      },
    });

    // Durable start only creates (or returns the existing replay). Execution is
    // the caller's responsibility via executeRun; it is NOT performed here.
    const run = created.isReplay
      ? created
      : { ...created, status: 'CREATED' as const };
    const mapped = await this.map(run, employee);
    return {
      run: mapped,
      created: !created.isReplay && created.status === 'CREATED',
    };
  }

  async executeRun(tenantId: string, runId: string): Promise<EmployeeRunView> {
    this.assertTenant(tenantId);
    const run = await this.runtime.execute(runId, tenantId);
    return this.mapRequired(run, tenantId);
  }

  async get(tenantId: string, runId: string): Promise<EmployeeRunView | null> {
    this.assertTenant(tenantId);
    const run = await this.runtime.getRun(runId, tenantId);
    if (!run?.employeeId || run.tenantId !== tenantId) return null;
    const employee = await this.identities.find(tenantId, run.employeeId);
    return employee ? this.map(run, employee) : null;
  }

  async list(
    tenantId: string,
    filter?: EmployeeRunFilter,
  ): Promise<readonly EmployeeRunView[]> {
    this.assertTenant(tenantId);
    const runs = await this.runtime.listRuns(tenantId, filter);
    const mapped = await Promise.all(
      runs
        .filter((run) => run.tenantId === tenantId)
        .filter((run): run is WorkRunView & { employeeId: string } =>
          Boolean(run.employeeId),
        )
        .map(async (run) => {
          const employee = await this.identities.find(tenantId, run.employeeId);
          return employee ? this.map(run, employee) : null;
        }),
    );
    return mapped.filter((run): run is EmployeeRunView => run !== null);
  }

  async resume(tenantId: string, runId: string): Promise<EmployeeRunView> {
    const run = await this.runtime.resume(runId, tenantId);
    return this.mapRequired(run, tenantId);
  }

  async cancel(
    tenantId: string,
    runId: string,
    reason: string,
  ): Promise<EmployeeRunView> {
    if (!reason.trim()) throw new Error('cancellation reason is required');
    const run = await this.runtime.cancel(runId, tenantId, reason.trim());
    return this.mapRequired(run, tenantId);
  }

  private async mapRequired(
    run: WorkRunView,
    tenantId: string,
  ): Promise<EmployeeRunView> {
    if (!run.employeeId) throw new Error('run is not an Employee WorkRun');
    const employee = await this.identities.find(tenantId, run.employeeId);
    if (!employee) throw new Error('Employee identity not found for run');
    return this.map(run, employee);
  }

  private async map(
    run: WorkRunView,
    employee: Pick<ResolvedEmployee, 'id' | 'name' | 'role'>,
  ): Promise<EmployeeRunView> {
    const [runtimeSteps, stepResults] = await Promise.all([
      this.runtime.getSteps(run.id, run.tenantId),
      this.runtime
        .getStepResults(run.id, run.tenantId)
        .catch((): StepWithResult[] => []),
    ]);
    const approvalId =
      runtimeSteps.find((step) => step.approvalId)?.approvalId ?? null;
    const artifacts = extractArtifactRefs(stepResults);
    return this.mapper.map(
      {
        ...run,
        triggerType: run.triggerType ?? 'USER',
        employeeId: run.employeeId!,
      } as EmployeeRunProjectionSource,
      { id: employee.id, name: employee.name, role: employee.role },
      artifacts,
      runtimeSteps.map((step) => this.mapStep(step)),
      approvalId,
    );
  }

  private mapStep(step: WorkRunStepView) {
    return { id: step.id, name: step.toolName, status: step.status } as const;
  }

  private validate(input: StartEmployeeRunInput): StartEmployeeRunInput {
    const objective = input.objective?.trim();
    const idempotencyKey = input.idempotencyKey?.trim();
    if (!input.tenantId || input.tenantId === '*')
      throw new Error('valid tenantId is required');
    if (!input.employeeId) throw new Error('employeeId is required');
    if (!input.requestedBy?.actorId)
      throw new Error('requesting actor is required');
    if (!objective || objective.length > 10_000)
      throw new Error('objective must contain 1-10000 characters');
    if (
      !idempotencyKey ||
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 200
    ) {
      throw new Error('idempotencyKey must contain 8-200 characters');
    }
    if ((input.context?.fileIds?.length ?? 0) > 20)
      throw new Error('at most 20 fileIds are allowed');
    if ((input.context?.includeCapabilities?.length ?? 0) > 50)
      throw new Error('at most 50 capabilities are allowed');
    return { ...input, objective, idempotencyKey };
  }

  private assertTenant(tenantId: string): void {
    if (!tenantId || tenantId === '*')
      throw new Error('valid tenantId is required');
  }
}
