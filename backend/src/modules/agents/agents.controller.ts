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
import { AgentsService } from './services/agents.service';
import { AgentExecutorService } from './services/agent-executor.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { DispatchTaskDto } from './dto/dispatch-task.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { AgentStatus, AgentType } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

class UpdatePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];

  @IsOptional()
  @IsString()
  budgetPerDay?: string;
}

class GraphResumeDto {
  @IsUUID()
  threadId!: string;

  @IsUUID()
  approvalId!: string;

  @IsEnum(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller({ path: 'agents', version: '1' })
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly executorService: AgentExecutorService,
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

  // ─── List ────────────────────────────────────────────────

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: AgentStatus,
    @Query('type') type?: AgentType,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    // SUPER_ADMIN may list globally (no tenantId) or for a specific tenant.
    const isPlatformRole =
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.PLATFORM_ADMIN ||
      user.role === UserRole.SUPPORT;

    if (!isPlatformRole && !user.tenantId)
      throw new ForbiddenException('Tenant context required');

    return this.agentsService.findAll({
      tenantId: user.role === UserRole.SUPER_ADMIN ? tenantId : user.tenantId,
      departmentId,
      status,
      type,
      page: Number(page),
      limit: Number(limit),
    });
  }

  // ─── Read one ────────────────────────────────────────────

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.agentsService.findOne(id, this.resolveTenantId(user, tenantId));
  }

  // ─── Status ──────────────────────────────────────────────

  @Get(':id/status')
  getStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.agentsService.findOne(id, this.resolveTenantId(user, tenantId));
  }

  // ─── Create ──────────────────────────────────────────────

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(
    @Body() dto: CreateAgentDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const effectiveTenantId = dto.tenantId ?? tenantId;
    return this.agentsService.create(
      dto,
      this.resolveTenantId(user, effectiveTenantId),
      user.sub,
    );
  }

  // ─── Update ──────────────────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.agentsService.update(
      id,
      dto,
      this.resolveTenantId(user, tenantId),
    );
  }

  // ─── Permissions ─────────────────────────────────────────

  /** PATCH /agents/:id/permissions — update allowed actions & budget */
  @Patch(':id/permissions')
  @Roles(UserRole.SUPER_ADMIN)
  updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionsDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.agentsService.update(
      id,
      {
        permissions: dto.permissions,
        budgetPerDay: dto.budgetPerDay,
      } as UpdateAgentDto,
      this.resolveTenantId(user, tenantId),
    );
  }

  // ─── Pause ───────────────────────────────────────────────

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  async pause(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const agent = await this.agentsService.updateStatus(
      id,
      AgentStatus.PAUSED,
      this.resolveTenantId(user, tenantId),
    );
    return { message: 'Agent paused', agent };
  }

  // ─── Resume ──────────────────────────────────────────────

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  async resume(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const agent = await this.agentsService.updateStatus(
      id,
      AgentStatus.IDLE,
      this.resolveTenantId(user, tenantId),
    );
    return { message: 'Agent resumed', agent };
  }

  // ─── Delete ──────────────────────────────────────────────

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.agentsService.remove(id, this.resolveTenantId(user, tenantId));
  }

  // ─── Dispatch task to agent ──────────────────────────────

  @Post(':id/dispatch')
  @HttpCode(HttpStatus.ACCEPTED)
  async dispatch(
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() dto: DispatchTaskDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    // Fire-and-forget; client tracks progress via WebSocket
    void this.executorService.executeTask(
      dto.taskId,
      agentId,
      this.resolveTenantId(user, tenantId),
    );
    return { message: 'Task dispatched', taskId: dto.taskId, agentId };
  }

  /** POST /agents/:id/task — spec alias for /dispatch */
  @Post(':id/task')
  @HttpCode(HttpStatus.ACCEPTED)
  async dispatchTask(
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() dto: DispatchTaskDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    void this.executorService.executeTask(
      dto.taskId,
      agentId,
      this.resolveTenantId(user, tenantId),
    );
    return { message: 'Task dispatched', taskId: dto.taskId, agentId };
  }

  // ─── Cancel task ─────────────────────────────────────────

  @Post(':id/cancel/:taskId')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.executorService.cancelTask(taskId);
  }

  // ─── Resume LangGraph after human-in-the-loop approval ───

  /**
   * POST /agents/:id/graph-resume
   *
   * Called by a human reviewer to resume a graph that was paused by an
   * interrupt() HITL node. Do NOT confuse with POST /agents/:id/resume
   * which resumes a PAUSED agent status.
   */
  @Post(':id/graph-resume')
  @HttpCode(HttpStatus.ACCEPTED)
  async graphResume(
    @Param('id', ParseUUIDPipe) _agentId: string,
    @Body() dto: GraphResumeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.executorService.resumeGraph(
      dto.threadId,
      dto.decision,
      dto.approvalId,
      this.resolveTenantId(user),
      user.sub,
    );
    return { message: 'Graph resumed', threadId: dto.threadId };
  }
}
