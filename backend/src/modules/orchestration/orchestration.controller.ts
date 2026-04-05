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
  ForbiddenException,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { TasksService } from './services/tasks.service';
import { CsvExportService } from '../../shared/services/csv-export.service';
import { WorkflowsService } from './services/workflows.service';
import { MultiAgentOrchestratorService } from './services/multi-agent-orchestrator.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/workflow.dto';
import { SupervisedWorkflowDto } from './dto/supervised-workflow.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';
import type { TaskStatus, WorkflowStatus } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// Tasks controller
// ─────────────────────────────────────────────────────────────

@Controller({ path: 'tasks', version: '1' })
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly csvExportService: CsvExportService,
  ) {}

  /** GET /v1/tasks/export/csv — download all tasks as CSV (Phase 3.2) */
  @Get('export/csv')
  async exportCsv(
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
    @Query('status') status?: TaskStatus,
  ) {
    if (!user.tenantId && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Tenant context required');
    }
    const { data } = await this.tasksService.findAll(user.tenantId, {
      status,
      page: 1,
      limit: 5000,
    });
    const rows = (data as Record<string, unknown>[]).map((t) => ({
      id: t['id'],
      title: t['title'],
      status: t['status'],
      priority: t['priority'],
      agentId: t['agentId'],
      createdAt: t['createdAt'],
    }));
    const csv = this.csvExportService.toCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tasks-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return res.send(csv);
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: TaskStatus,
    @Query('agentId') agentId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if (!user.tenantId && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Tenant context required');
    }
    return this.tasksService.findAll(user.tenantId, {
      status,
      agentId,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.findOne(id, user.tenantId!);
  }

  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: JwtPayload) {
    return this.tasksService.create({
      ...dto,
      tenantId: user.tenantId!,
      createdById: user.sub,
    });
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.update(id, user.tenantId!, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tasksService.remove(id, user.tenantId!);
  }
}

// ─────────────────────────────────────────────────────────────
// Workflows controller
// ─────────────────────────────────────────────────────────────

@Controller({ path: 'workflows', version: '1' })
export class WorkflowsController {
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly multiAgentOrchestrator: MultiAgentOrchestratorService,
  ) {}

  private resolveTenantId(user: JwtPayload, tenantId?: string): string {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!tenantId)
        throw new BadRequestException('tenantId is required for SUPER_ADMIN');
      return tenantId;
    }
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return user.tenantId;
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: WorkflowStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('tenantId') tenantId?: string,
  ) {
    // For findAll, allow null tenantId to return empty results
    const resolvedTenantId =
      user.role === UserRole.SUPER_ADMIN ? tenantId : user.tenantId;
    return this.workflowsService.findAll(resolvedTenantId ?? null, {
      status,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, tenantId);
    return this.workflowsService.findOne(id, resolvedTenantId);
  }

  @Post()
  create(
    @Body() dto: CreateWorkflowDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, tenantId);
    return this.workflowsService.create({ ...dto, tenantId: resolvedTenantId });
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, tenantId);
    return this.workflowsService.update(id, resolvedTenantId, dto);
  }

  @Post(':id/activate')
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, tenantId);
    return this.workflowsService.activate(id, resolvedTenantId);
  }

  /** POST /workflows/:id/execute — trigger workflow execution (fire & forget via WS events) */
  @Post(':id/execute')
  @HttpCode(HttpStatus.ACCEPTED)
  execute(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, tenantId);
    return this.workflowsService.execute(id, resolvedTenantId);
  }

  /** GET /workflows/:id/status — current execution summary */
  @Get(':id/status')
  getStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, tenantId);
    return this.workflowsService.getStatus(id, resolvedTenantId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const resolvedTenantId = this.resolveTenantId(user, tenantId);
    return this.workflowsService.remove(id, resolvedTenantId);
  }

  // ─── Supervisor-Worker orchestration (Phase 2.3) ──────────────────────

  /**
   * POST /workflows/supervised
   * Start a supervised multi-agent workflow: assign workers under a supervisor.
   */
  @Post('supervised')
  @HttpCode(HttpStatus.ACCEPTED)
  startSupervisedWorkflow(
    @Body() dto: SupervisedWorkflowDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = this.resolveTenantId(user, tenantId ?? dto.tenantId);
    return this.multiAgentOrchestrator.startSupervisedWorkflow(
      dto.supervisorId,
      dto.workerIds,
      dto.goalDescription,
      tid,
    );
  }

  /**
   * GET /workflows/supervisors/:supervisorId/workers
   * List worker agents currently assigned to a supervisor.
   */
  @Get('supervisors/:supervisorId/workers')
  getWorkers(
    @Param('supervisorId', ParseUUIDPipe) supervisorId: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = this.resolveTenantId(user, tenantId);
    return this.multiAgentOrchestrator.getWorkers(supervisorId, tid);
  }
}
