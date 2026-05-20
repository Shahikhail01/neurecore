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
  UseGuards,
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
import {
  AssignAgentDepartmentDto,
  AssignAgentTierSlotDto,
} from './dto/agent-assignment.dto';
import { DispatchTaskDto } from './dto/dispatch-task.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLog } from '../../common/decorators/auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { AgentStatus, AgentType } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TierEnforcementService } from '../tiers/services/tier-enforcement.service';
import { AssignmentService } from '../tiers/services/assignment.service';
import { TenantResourcePolicyService } from '../tiers/services/tenant-resource-policy.service';
import { isPlatformOperatorRole } from '../../common/types/user-role.utils';

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
    private readonly assignmentService: AssignmentService,
    private readonly tenantPolicy: TenantResourcePolicyService,
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

  private isPlatformRole(user: JwtPayload): boolean {
    return isPlatformOperatorRole(user.role);
  }

  private async resolveExistingAgentTenantId(
    user: JwtPayload,
    agentId: string,
    tenantId?: string,
  ): Promise<string> {
    if (!this.isPlatformRole(user)) {
      return this.resolveTenantId(user, tenantId);
    }

    const agent = (await this.agentsService.findOneForPlatform(agentId)) as {
      tenantId?: string;
    };

    if (!agent.tenantId) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }

    return agent.tenantId;
  }

  // ─── List ────────────────────────────────────────────────

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('scope') scope?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: AgentStatus,
    @Query('type') type?: AgentType,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const isPlatformRole = this.isPlatformRole(user);

    const effectiveTenantId = isPlatformRole ? tenantId : user.tenantId;

    if (!isPlatformRole && !user.tenantId)
      throw new ForbiddenException('Tenant context required');

    if (isPlatformRole && !tenantId && scope !== 'platform') {
      throw new BadRequestException(
        'tenantId is required unless scope=platform is explicitly provided',
      );
    }

    return this.agentsService.findAll({
      tenantId: effectiveTenantId,
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
    @Query('scope') scope?: string,
  ) {
    if (this.isPlatformRole(user) && scope === 'platform') {
      return this.agentsService.findOneForPlatform(id);
    }

    return this.agentsService.findOne(id, this.resolveTenantId(user, tenantId));
  }

  // ─── Status ──────────────────────────────────────────────

  @Get(':id/status')
  getStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
    @Query('scope') scope?: string,
  ) {
    if (this.isPlatformRole(user) && scope === 'platform') {
      return this.agentsService.findOneForPlatform(id);
    }

    return this.agentsService.findOne(id, this.resolveTenantId(user, tenantId));
  }

  // ─── Create ──────────────────────────────────────────────

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog('AGENT_CREATE')
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OWNER)
  @AuditLog('AGENT_UPDATE')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    const sanitizedDto =
      user.role === UserRole.SUPER_ADMIN
        ? dto
        : this.tenantPolicy.assertAllowedTenantAgentUpdate(
            dto as Record<string, unknown>,
          );

    return this.resolveExistingAgentTenantId(user, id, tenantId).then(
      (effectiveTenantId) =>
        this.agentsService.update(id, sanitizedDto, effectiveTenantId),
    );
  }

  @Post(':id/assign-department')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OWNER)
  @AuditLog('AGENT_ASSIGN_DEPARTMENT')
  assignDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignAgentDepartmentDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.resolveExistingAgentTenantId(user, id, tenantId).then(
      (effectiveTenantId) =>
        this.assignmentService.assignAgentToDepartment(
          effectiveTenantId,
          id,
          dto.departmentId,
        ),
    );
  }

  @Post(':id/unassign-department')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OWNER)
  @AuditLog('AGENT_UNASSIGN_DEPARTMENT')
  unassignDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.resolveExistingAgentTenantId(user, id, tenantId).then(
      (effectiveTenantId) =>
        this.assignmentService.assignAgentToDepartment(
          effectiveTenantId,
          id,
          null,
        ),
    );
  }

  @Post(':id/assign-tier-slot')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OWNER)
  @AuditLog('AGENT_ASSIGN_TIER_SLOT')
  assignTierSlot(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignAgentTierSlotDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.resolveExistingAgentTenantId(user, id, tenantId).then(
      (effectiveTenantId) =>
        this.assignmentService.assignAgentToTierSlot(
          effectiveTenantId,
          id,
          dto.slotId,
        ),
    );
  }

  // ─── Permissions ─────────────────────────────────────────

  /** PATCH /agents/:id/permissions — update allowed actions & budget */
  @Patch(':id/permissions')
  @Roles(UserRole.SUPER_ADMIN)
  @AuditLog('AGENT_UPDATE_PERMISSIONS')
  updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionsDto,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.resolveExistingAgentTenantId(user, id, tenantId).then(
      (effectiveTenantId) =>
        this.agentsService.update(
          id,
          {
            permissions: dto.permissions,
            budgetPerDay: dto.budgetPerDay,
          } as UpdateAgentDto,
          effectiveTenantId,
        ),
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
      await this.resolveExistingAgentTenantId(user, id, tenantId),
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
      await this.resolveExistingAgentTenantId(user, id, tenantId),
    );
    return { message: 'Agent resumed', agent };
  }

  // ─── Delete ──────────────────────────────────────────────

  @Delete(':id')
  @UseGuards(RolesGuard) // PoolSlotGuard temporarily disabled — requires TiersModule in AgentsModule
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.resolveExistingAgentTenantId(user, id, tenantId).then(
      (effectiveTenantId) => this.agentsService.remove(id, effectiveTenantId),
    );
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
    const effectiveTenantId = await this.resolveExistingAgentTenantId(
      user,
      agentId,
      tenantId,
    );
    void this.executorService.executeTask(
      dto.taskId,
      agentId,
      effectiveTenantId,
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
    const effectiveTenantId = await this.resolveExistingAgentTenantId(
      user,
      agentId,
      tenantId,
    );
    void this.executorService.executeTask(
      dto.taskId,
      agentId,
      effectiveTenantId,
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
    return this.resolveExistingAgentTenantId(user, id, tenantId).then(
      (effectiveTenantId) =>
        this.agentVersionService.listVersions(id, effectiveTenantId),
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
    const effectiveTenantId = await this.resolveExistingAgentTenantId(
      user,
      id,
      tenantId,
    );
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
    return this.resolveExistingAgentTenantId(user, id, tenantId).then(
      (effectiveTenantId) =>
        this.agentVersionService.rollback(
          id,
          effectiveTenantId,
          dto.versionNumber,
        ),
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
    const tid = await this.resolveExistingAgentTenantId(user, id, tenantId);
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
    return this.resolveExistingAgentTenantId(user, agentId, tenantId).then(
      (effectiveTenantId) =>
        this.evaluationService.startEvaluation(
          agentId,
          effectiveTenantId,
          dto.testCases,
          user.sub,
          dto.notes,
        ),
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
    return this.resolveExistingAgentTenantId(user, agentId, tenantId).then(
      (effectiveTenantId) =>
        this.evaluationService.getRunsForAgent(agentId, effectiveTenantId),
    );
  }

  /**
   * GET /agents/evaluation-runs/:runId
   * Get a single evaluation run by ID.
   */
  @Get('evaluation-runs/:runId')
  getEvaluationRun(
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentUser() user: JwtPayload,
    @Query('scope') scope?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    if (this.isPlatformRole(user) && scope === 'platform') {
      return this.evaluationService.getRunById(runId);
    }

    return this.evaluationService.getRunByIdForTenant(
      runId,
      this.resolveTenantId(user, tenantId),
    );
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
    const tid = await this.resolveExistingAgentTenantId(
      user,
      agentId,
      tenantId,
    );
    await this.evaluationService.promoteToProduction(agentId, tid);
    return { message: 'Agent promoted to production', agentId };
  }
}
