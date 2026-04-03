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
} from '@nestjs/common';
import { TasksService } from './services/tasks.service';
import { WorkflowsService } from './services/workflows.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/workflow.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';
import type { TaskStatus, WorkflowStatus } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// Tasks controller
// ─────────────────────────────────────────────────────────────

@Controller({ path: 'tasks', version: '1' })
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

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
  constructor(private readonly workflowsService: WorkflowsService) {}

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
}
