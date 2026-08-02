// src/modules/agent-templates/agent-skills.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseUUIDPipe,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';
import { AgentSkillDefinitionRepository } from './agent-skill-definition.repository';
import { AgentTemplateLifecycleService } from './agent-template-lifecycle.service';
import {
  CreateSkillDto,
  SkillTransitionDto,
  SkillCertificationDto,
} from './dto/agent-template-lifecycle.dto';
import { AgentSkillBuilderService } from './agent-skill-builder.service';

/**
 * AgentSkillsController — /api/v1/agent-skills
 *
 * CRUD + lifecycle for AgentSkillDefinition rows. Tenant-scoped via JWT.
 * Actor identity comes from `req.user.sub` only.
 */
@Controller({ path: 'agent-skills', version: '1' })
@ApiCommon('agent_skills')
export class AgentSkillsController {
  constructor(
    private readonly skills: AgentSkillDefinitionRepository,
    private readonly lifecycle: AgentTemplateLifecycleService,
    private readonly builder: AgentSkillBuilderService,
  ) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.skills.list(user.tenantId);
  }

  @Get(':id')
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    const skill = await this.skills.getById(user.tenantId, id);
    if (!skill) {
      return { statusCode: 404, message: `Skill ${id} not found` };
    }
    return skill;
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  async create(@Body() dto: CreateSkillDto, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');

    // Server-derived fields — NEVER trust the DTO for these.
    const composedOf = dto.composedOf ?? [];
    const composedSkills =
      composedOf.length > 0
        ? await this.skills.findReferencedSkills(
            user.tenantId,
            Array.from(new Set(composedOf.map((r) => r.skillKey))),
          )
        : [];
    const derived = this.builder.aggregate(composedSkills);

    return this.skills.create({
      tenantId: user.tenantId,
      skillKey: dto.skillKey,
      semanticVersion: dto.semanticVersion,
      inputSchema: dto.inputSchema as never,
      outputSchema: dto.outputSchema as never,
      composedOf: composedOf as never,
      maxEffect: derived.maxEffect,
      requiredAuthority: derived.requiredAuthority,
      approvalSensitive: derived.approvalSensitive,
      preconditions: dto.preconditions as never,
      postconditions: dto.postconditions as never,
      timeoutMs: dto.timeoutMs ?? 30000,
      retryPolicy: dto.retryPolicy as never,
      idempotencyKeyPattern: dto.idempotencyKeyPattern,
      responseEnvelopeMapping: dto.responseEnvelopeMapping as never,
      testExamples: dto.testExamples as never,
    });
  }

  @Post(':id/certify')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  certify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SkillCertificationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.certifySkill({
      tenantId: user.tenantId,
      actorId: user.sub,
      skillId: id,
      certifiedVersion: dto.certifiedVersion,
      reason: dto.reason,
    });
  }

  @Post(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SkillTransitionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.activateSkill({
      tenantId: user.tenantId,
      actorId: user.sub,
      skillId: id,
      reason: dto.reason,
    });
  }

  @Post(':id/suspend')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SkillTransitionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.suspendSkill({
      tenantId: user.tenantId,
      actorId: user.sub,
      skillId: id,
      reason: dto.reason,
    });
  }

  @Post(':id/resume')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  resume(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SkillTransitionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.resumeSkill({
      tenantId: user.tenantId,
      actorId: user.sub,
      skillId: id,
      reason: dto.reason,
    });
  }

  @Post(':id/retire')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  retire(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SkillTransitionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.retireSkill({
      tenantId: user.tenantId,
      actorId: user.sub,
      skillId: id,
      reason: dto.reason,
    });
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    await this.skills.remove(user.tenantId, id);
  }
}
