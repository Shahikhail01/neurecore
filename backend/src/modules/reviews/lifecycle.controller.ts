// src/modules/reviews/lifecycle.controller.ts
//
// Phase 6 — Project lifecycle controller (plan §8.2).
//
// Hosts the AdvanceProjectStageCommand surface. This is a thin
// controller — all guard + atomicity work lives in the handler.

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorrelationService } from '../../common/correlation/correlation.service';
import { ReviewService } from './application/review.service';
import type {
  AdvanceProjectStageInput,
  TenantRole,
} from './commands/advance-project-stage.command';

const VALID_STAGES: AdvanceProjectStageInput['toStage'][] = [
  'LEAD',
  'PROPOSAL_SENT',
  'WON',
  'LOST',
  'ACTIVE',
  'ON_HOLD',
  'REVIEW',
  'COMPLETED',
  'ARCHIVED',
];

const VALID_ROLES: TenantRole[] = [
  'OWNER',
  'MANAGER',
  'LEAD',
  'MEMBER',
  'VIEWER',
];

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class LifecycleController {
  constructor(
    private readonly service: ReviewService,
    private readonly correlation: CorrelationService,
  ) {}

  @Post(':projectId/advance-stage')
  @HttpCode(HttpStatus.OK)
  async advanceStage(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      toStage: AdvanceProjectStageInput['toStage'];
      waiverReason?: string;
    },
    @CurrentUser()
    user: {
      id: string;
      tenantId: string;
      role?: string;
      type?: string;
    },
  ) {
    if (!body?.toStage || !VALID_STAGES.includes(body.toStage)) {
      throw new BadRequestException({
        code: 'INVALID_TARGET_STAGE',
        message: `toStage must be one of ${VALID_STAGES.join(', ')}`,
      });
    }
    const trimmedWaiver = body.waiverReason?.trim();
    if (body.waiverReason !== undefined && !trimmedWaiver) {
      throw new BadRequestException({
        code: 'WAIVER_REASON_EMPTY',
        message: 'waiverReason must be a non-empty string when supplied',
      });
    }
    if (user.type && user.type !== 'HUMAN') {
      throw new BadRequestException({
        code: 'HUMAN_ACTOR_REQUIRED',
        message: 'Only HUMAN actors may advance project lifecycle stages.',
      });
    }

    const actorRole = (user.role ?? 'MEMBER') as TenantRole;
    if (!VALID_ROLES.includes(actorRole)) {
      throw new BadRequestException({
        code: 'INVALID_ACTOR_ROLE',
        message: `actorRole must be one of ${VALID_ROLES.join(', ')}`,
      });
    }

    const context = this.correlation.createContext({
      tenantId: user.tenantId,
      actorId: user.id,
      actorType: 'HUMAN',
    });
    const metadata = this.correlation.buildMetadata(
      context,
      `advance-project-stage:${projectId}:${body.toStage}`,
    );

    return this.service.advanceProjectStage(
      {
        projectId,
        toStage: body.toStage,
        actorId: user.id,
        actorRole,
        waiverReason: trimmedWaiver,
      },
      metadata,
    );
  }
}
