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
  BadRequestException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { AgentTemplatesService } from './agent-templates.service';
import { AgentTemplateLifecycleService } from './agent-template-lifecycle.service';
import {
  CreateAgentTemplateDto,
  UpdateAgentTemplateDto,
  CloneAgentTemplateDto,
} from './dto/agent-template.dto';
import {
  CreateVersionDto,
  CertifyVersionDto,
  LifecycleTransitionDto,
  RollbackDto,
} from './dto/agent-template-lifecycle.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import type { AgentType } from '@prisma/client';
import { UserRole } from '@prisma/client';

/**
 * AgentTemplatesController  — /api/v1/agent-templates
 *
 * Exposes the template library to tenant users and admins.
 * All mutations are restricted to ADMIN/OWNER roles.
 */
@Controller({ path: 'agent-templates', version: '1' })
@ApiCommon('agent_templates')
export class AgentTemplatesController {
  constructor(
    private readonly templatesService: AgentTemplatesService,
    private readonly lifecycle: AgentTemplateLifecycleService,
  ) {}

  // ─── Platform (SUPER_ADMIN) ──────────────────────────────────────────────

  @Get('platform')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
  )
  findAllPlatform(
    @Query('type') type?: AgentType,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.templatesService.findAllPlatform({
      type,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get('platform/:id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
  )
  findOnePlatform(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.findOnePlatform(id);
  }

  @Post('platform')
  @Roles(UserRole.SUPER_ADMIN)
  createPlatform(@Body() dto: CreateAgentTemplateDto) {
    return this.templatesService.createPlatform(dto);
  }

  @Patch('platform/:id')
  @Roles(UserRole.SUPER_ADMIN)
  updatePlatform(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentTemplateDto,
  ) {
    return this.templatesService.updatePlatform(id, dto);
  }

  @Delete('platform/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  removePlatform(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.removePlatform(id);
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('type') type?: AgentType,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if (user.role === UserRole.SUPER_ADMIN) {
      // SUPER_ADMIN: allow listing platform templates via the platform route.
      throw new BadRequestException(
        'Use /api/v1/agent-templates/platform for platform template listing',
      );
    }

    if (!user.tenantId) throw new ForbiddenException('Tenant context required');

    return this.templatesService.findAll(user.tenantId, {
      type,
      page: Number(page),
      limit: Number(limit),
    });
  }

  // ─── Read one ─────────────────────────────────────────────────────────────

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.templatesService.findOne(id, user.tenantId);
  }

  /**
   * Phase 1 Gap 8 — Template version history + drift detection.
   * Returns deprecation status, supersession chain, and agents with
   * outdated template versions.
   */
  @Get(':id/changelog')
  getChangelog(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.templatesService.getChangelog(id, user.tenantId);
  }

  // ─── Instantiate template → agent create payload ──────────────────────────

  @Get(':id/instantiate')
  instantiate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.templatesService.instantiate(id, user.tenantId);
  }

  // ─── Clone platform template into tenant scope ───────────────────────────

  @Post(':id/clone')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  cloneToTenant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloneAgentTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.templatesService.cloneToTenant(id, user.tenantId, {
      name: dto.name,
    });
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  create(@Body() dto: CreateAgentTemplateDto, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.templatesService.create(user.tenantId, dto);
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.templatesService.update(id, user.tenantId, dto);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.templatesService.remove(id, user.tenantId);
  }

  // ─── Phase 4 — versioned lifecycle endpoints ────────────────────────────
  //
  // Every endpoint is tenant-scoped via `req.user.tenantId` (JWT). The
  // actor identity is taken from `req.user.sub` — NEVER from the request
  // body — and passed to the lifecycle service.

  @Post(':id/versions')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  createVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVersionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.createVersion(user.tenantId, user.sub, {
      agentTemplateId: id,
      version: dto.version,
      definition: dto.definition as never,
      composedSkillRefs: dto.composedSkillRefs,
      escalationActorId: dto.escalationActorId,
      budgetLimit: dto.budgetLimit as never,
      rateLimits: dto.rateLimits as never,
      channelBindings: dto.channelBindings as never,
      approvalPolicyRefs: dto.approvalPolicyRefs,
      evaluationMinScore: dto.evaluationMinScore,
      evaluationDatasetId: dto.evaluationDatasetId,
    });
  }

  @Post(':id/versions/:version/certify')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  certifyVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version') version: string,
    @Body() dto: CertifyVersionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.certify(user.tenantId, user.sub, {
      agentTemplateId: id,
      version,
      evaluationReport: dto.evaluationReport as never,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      reason: dto.reason,
    });
  }

  @Post(':id/versions/:version/activate')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  activateVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version') version: string,
    @Body() dto: LifecycleTransitionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.activate(user.tenantId, user.sub, {
      agentTemplateId: id,
      version,
      reason: dto.reason,
    });
  }

  @Post(':id/versions/:version/suspend')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  suspendVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version') version: string,
    @Body() dto: LifecycleTransitionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.suspend(user.tenantId, user.sub, {
      agentTemplateId: id,
      version,
      reason: dto.reason,
    });
  }

  @Post(':id/versions/:version/resume')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  resumeVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version') version: string,
    @Body() dto: LifecycleTransitionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.resume(user.tenantId, user.sub, {
      agentTemplateId: id,
      version,
      reason: dto.reason,
    });
  }

  @Post(':id/versions/:version/retire')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  retireVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version') version: string,
    @Body() dto: LifecycleTransitionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.retire(user.tenantId, user.sub, {
      agentTemplateId: id,
      version,
      reason: dto.reason,
    });
  }

  @Post(':id/rollback')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  rollbackVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RollbackDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.rollback(user.tenantId, user.sub, {
      agentTemplateId: id,
      targetVersion: dto.targetVersion,
      reason: dto.reason,
    });
  }

  @Get(':id/audit')
  listAudit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.listAudit({
      tenantId: user.tenantId,
      templateId: id,
    });
  }
}
