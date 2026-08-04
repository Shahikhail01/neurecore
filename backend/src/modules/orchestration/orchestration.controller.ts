import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { TasksService } from './services/tasks.service';
import { WorkflowsService } from './services/workflows.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/workflow.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import type { TaskStatus, WorkflowStatus } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { TenantIsolated } from '../../common/guards/tenant-isolated.decorator';

const PLATFORM_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SECURITY_OFFICER,
  UserRole.SUPPORT,
]);

@ApiCommon('orchestration')
// Phase 0.5 collision-resolution:
// Previously this controller was mounted at the API root with handlers like
// `@Get('workflows')` which collided with the canonical
// `modules/workflows/workflows.controller.ts` (also mounted at
// `@Controller({ path: 'workflows', version: '1' })`). We moved the
// orchestration routes under `orchestration/*` to make the boundary explicit.
// See neurecore/memory-bank-arc/comms/route-duplication-report.yaml.
@Controller({ path: 'orchestration', version: '1' })
export class OrchestrationController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly workflowsService: WorkflowsService,
  ) {}

  /**
   * FIX-010: resolve the effective tenantId. Platform roles (SUPER_ADMIN etc.)
   * return '*' when they have no JWT tenantId — the services skip
   * tenant scoping for cross-tenant queries. Non-platform roles throw if
   * they lack a tenant context.
   */
  private resolveTenantId(user: JwtPayload): string {
    const raw = user.tenantId;
    if (raw) return raw;
    if (PLATFORM_ROLES.has(user.role)) return '*';
    throw new Error('Tenant ID required');
  }

  // ─── Tasks ────────────────────────────────────────────────

  @Get('tasks')
  findAllTasks(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: TaskStatus,
    @Query('agentId') agentId?: string,
    @Query('projectId') projectId?: string,
    @Query('goalId') goalId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.tasksService.findAll(
      {
        status,
        agentId,
        projectId,
        goalId,
        page: Number(page),
        limit: Number(limit),
      },
      tenantId,
    );
  }

  @Get('tasks/:id')
  @TenantIsolated()
  findOneTask(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.tasksService.findOne(id, tenantId);
  }

  /**
   * SIM-04 G-05 — list eligible AI agents for a task. Tenant-scoped;
   * returns a scored + reason-tagged short-list suitable for the FE
   * assignment picker. Never exposes cross-tenant agents.
   */
  @Get('tasks/:id/eligible-agents')
  @TenantIsolated()
  eligibleAgents(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.tasksService.findEligibleAgents(id, tenantId);
  }

  /**
   * SIM-04 G-06 — list execution attempts for a task in chronological
   * order. Tenant-scoped; returns the same minimal attempt shape the FE
   * needs to render attempt chips on the task board.
   */
  @Get('tasks/:id/attempts')
  @TenantIsolated()
  attemptsForTask(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.tasksService.findAttemptsForTask(id, tenantId);
  }

  @Post('tasks')
  createTask(@Body() dto: CreateTaskDto, @CurrentUser() user: JwtPayload) {
    const tenantId = this.resolveTenantId(user);
    return this.tasksService.create(
      {
        ...dto,
        createdById: user.sub,
      },
      tenantId,
    );
  }

  @Patch('tasks/:id')
  updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.tasksService.update(id, dto, tenantId);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTask(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.tasksService.remove(id, tenantId);
  }

  // ─── Workflows ────────────────────────────────────────────

  @Get('workflows')
  findAllWorkflows(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: WorkflowStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.workflowsService.findAll(
      {
        status,
        page: Number(page),
        limit: Number(limit),
      },
      tenantId,
    );
  }

  @Get('workflows/:id')
  @TenantIsolated()
  findOneWorkflow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.workflowsService.findOne(id, tenantId);
  }

  @Post('workflows')
  createWorkflow(
    @Body() dto: CreateWorkflowDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.workflowsService.create(dto, tenantId);
  }

  @Patch('workflows/:id')
  updateWorkflow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.workflowsService.update(id, dto, tenantId);
  }

  @Post('workflows/:id/activate')
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.workflowsService.activate(id, tenantId);
  }

  @Post('workflows/:id/execute')
  @HttpCode(HttpStatus.ACCEPTED)
  execute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.workflowsService.execute(id, tenantId);
  }

  @Get('workflows/:id/status')
  getStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.workflowsService.getStatus(id, tenantId);
  }

  @Delete('workflows/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeWorkflow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const tenantId = this.resolveTenantId(user);
    return this.workflowsService.remove(id, tenantId);
  }
}
