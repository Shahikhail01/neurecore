/**
 * ModelLifecycleController — Phase 5 P5
 *
 * REST endpoints for the 11-stage AnalyticsModel lifecycle:
 *   GET    /analytics/models/:id/lifecycle                — read state
 *   POST   /analytics/models/:id/lifecycle/transition     — advance stage
 *   GET    /analytics/models/:id/model-card               — published card
 *   GET    /analytics/models/:id/drift                    — ad-hoc drift check
 *   POST   /analytics/models                              — create custom model
 *
 * Mutations require ADMIN/OWNER/SUPER_ADMIN; reads are exposed to all
 * roles. Every endpoint is tenant-scoped via `req.user.tenantId`;
 * cross-tenant ids return 404.
 */

import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  ModelLifecycleService,
  MODEL_LIFECYCLE_STAGES,
  type ModelLifecycleDecision,
} from '../services/model-lifecycle.service';
import { ModelCardService } from '../services/model-card.service';
import { DriftMonitorService } from '../services/drift-monitor.service';

interface TransitionDto {
  stage: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' | 'BLOCKED';
  notes?: string;
  metrics?: Record<string, number | string | boolean>;
}

interface CreateModelDto {
  name: string;
  version: string;
  description?: string;
  metadata: Record<string, unknown>;
}

@Roles(
  UserRole.ADMIN,
  UserRole.OWNER,
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SUPPORT,
  UserRole.USER,
)
@ApiCommon('analytics/models')
@Controller({ path: 'analytics/models', version: '1' })
export class ModelLifecycleController {
  constructor(
    private readonly lifecycle: ModelLifecycleService,
    private readonly cards: ModelCardService,
    private readonly drift: DriftMonitorService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id/lifecycle')
  async getLifecycle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.lifecycle.getLifecycle(id, user.tenantId);
  }

  @Post(':id/lifecycle/transition')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.ADMIN,
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
  )
  async transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    if (!MODEL_LIFECYCLE_STAGES.includes(body.stage as never)) {
      throw new BadRequestException(
        `stage must be one of ${MODEL_LIFECYCLE_STAGES.join(', ')}`,
      );
    }
    const decision: ModelLifecycleDecision = {
      stage: body.stage as never,
      status: body.status,
      notes: body.notes,
      metrics: body.metrics,
    };
    return this.lifecycle.transition({
      tenantId: user.tenantId,
      actorId: user.sub,
      modelId: id,
      decision,
    });
  }

  @Get(':id/model-card')
  async modelCard(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.cards.forModel(id, user.tenantId);
  }

  @Get(':id/drift')
  async driftCheck(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.drift.checkModel(id, user.tenantId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    UserRole.ADMIN,
    UserRole.OWNER,
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
  )
  async createModel(
    @Body() body: CreateModelDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.prisma.analyticsModel.create({
      data: {
        name: body.name,
        version: body.version,
        description: body.description ?? null,
        metadata: body.metadata as unknown as Prisma.InputJsonValue,
        tenantId: user.tenantId,
      },
    });
  }
}
