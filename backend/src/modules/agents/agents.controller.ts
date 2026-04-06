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
import { AgentVersionService } from './services/agent-version.service';
import {
  CreateAgentVersionDto,
  RollbackAgentVersionDto,
} from './dto/agent-version.dto';
import { AgentsService } from './services/agents.service';
import { AgentExecutorService } from './services/agent-executor.service';
import { EvaluationService } from './services/evaluation.service';
import { CreateEvaluationRunDto } from './dto/evaluation.dto';
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
    private readonly agentVersionService: AgentVersionService,
    private readonly evaluationService: EvaluationService,
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

  // ─── Version history ─────────────────────────────────────

  /**
   * GET /agents/:id/versions
   * Returns full version history for an agent (newest first).
   */
  @Get(':id/versions')
  listVersions(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.agentVersionService.listVersions(
      id,
      this.resolveTenantId(user, tenantId),
    );
  }

  /**
   * POST /agents/:id/versions
   * Manually snapshot the current agent config as a named version.
   */
  @Post(':id/versions')
  async createVersion(
    @Param('id') id: string,
    @Body() dto: CreateAgentVersionDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const effectiveTenantId = this.resolveTenantId(user, tenantId);
    const agent = (await this.agentsService.findOne(
      id,
      effectiveTenantId,
    )) as Record<string, unknown>;

    return this.agentVersionService.snapshotAgent({
      agentId: id,
      tenantId: effectiveTenantId,
      label: dto.label,
      changeNote: dto.changeNote,
      changedBy: user.sub,
      configSnapshot: this.agentVersionService.buildSnapshot(agent),
    });
  }

  /**
   * POST /agents/:id/rollback
   * Restore the agent to the given version number.
   */
  @Post(':id/rollback')
  @HttpCode(HttpStatus.OK)
  rollback(
    @Param('id') id: string,
    @Body() dto: RollbackAgentVersionDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.agentVersionService.rollback(
      id,
      this.resolveTenantId(user, tenantId),
      dto.versionNumber,
    );
  }

  // ─── Staging / Evaluation (Phase 2.1) ────────────────────

  /**
   * POST /agents/:id/clone-to-staging
   * Clone an agent as a STAGING copy for safe evaluation.
   */
  @Post(':id/clone-to-staging')
  @HttpCode(HttpStatus.CREATED)
  async cloneToStaging(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = this.resolveTenantId(user, tenantId);
    const source = (await this.agentsService.findOne(id, tid)) as Record<
      string,
      unknown
    >;
    const clone = (await this.agentsService.create(
      {
        name: `${source['name'] as string} [STAGING]`,
        description: source['description'] as string | undefined,
        type: source['type'] as string | undefined,
        model: source['model'] as string | undefined,
        systemPrompt: source['systemPrompt'] as string | undefined,
        instructions: source['instructions'] as string | undefined,
        budgetPerDay:
          source['budgetPerDay'] != null
            ? String(source['budgetPerDay'])
            : undefined,
        permissions: source['permissions'] as string[] | undefined,
        config: {
          ...(source['config'] as Record<string, unknown>),
          deploymentMode: 'STAGING',
        },
        metadata: {
          ...(source['metadata'] as Record<string, unknown>),
          stagingParentId: id,
          clonedAt: new Date().toISOString(),
        },
        departmentId: source['departmentId'] as string | undefined,
        tierAgentPoolId: source['tierAgentPoolId'] as string | undefined,
      },
      tid,
      user.sub,
    )) as Record<string, unknown>;
    return {
      message: 'Staging clone created',
      stagingAgentId: clone['id'],
      sourceAgentId: id,
    };
  }

  /**
   * POST /agents/:id/evaluation-runs
   * Start an evaluation against a staging agent.
   */
  @Post(':id/evaluation-runs')
  @HttpCode(HttpStatus.CREATED)
  startEvaluation(
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() dto: CreateEvaluationRunDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = this.resolveTenantId(user, tenantId);
    return this.evaluationService.startEvaluation(
      agentId,
      tid,
      dto.testCases,
      user.sub,
      dto.notes,
    );
  }

  /**
   * GET /agents/:id/evaluation-runs
   * List all evaluation runs for an agent.
   */
  @Get(':id/evaluation-runs')
  listEvaluationRuns(
    @Param('id', ParseUUIDPipe) agentId: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = this.resolveTenantId(user, tenantId);
    return this.evaluationService.getRunsForAgent(agentId, tid);
  }

  /**
   * GET /agents/evaluation-runs/:runId
   * Get a single evaluation run by ID.
   */
  @Get('evaluation-runs/:runId')
  getEvaluationRun(@Param('runId', ParseUUIDPipe) runId: string) {
    return this.evaluationService.getRunById(runId);
  }

  /**
   * POST /agents/:id/promote
   * Promote a STAGING agent to PRODUCTION (requires a passing evaluation).
   */
  @Post(':id/promote')
  @HttpCode(HttpStatus.OK)
  async promote(
    @Param('id', ParseUUIDPipe) agentId: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = this.resolveTenantId(user, tenantId);
    await this.evaluationService.promoteToProduction(agentId, tid);
    return { message: 'Agent promoted to production', agentId };
  }
}
