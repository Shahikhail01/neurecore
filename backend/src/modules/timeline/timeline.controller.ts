// src/modules/timeline/timeline.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TimelineService } from './timeline.service';
import { isSupportedEntityType } from './timeline.types';

@Controller('timeline')
@UseGuards(JwtAuthGuard)
export class TimelineController {
  constructor(private readonly service: TimelineService) {}

  /**
   * Phase 7 — per-entity timeline.
   *
   * Used by:
   *  - The unified timeline component on the project / task / attempt
   *    inspector screens.
   *  - The polling fallback (Phase 7 §9.3) when Socket.IO is unavailable.
   */
  @Get(':entityType/:entityId')
  async getTimeline(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('since') since: string,
    @Query('limit') limit: string,
    @CurrentUser() user: { tenantId: string },
  ) {
    if (!isSupportedEntityType(entityType)) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_ENTITY_TYPE',
        message: `Entity type ${entityType} is not supported on the unified timeline.`,
      });
    }
    const parsedLimit = limit ? Math.max(1, Math.min(Number(limit), 500)) : 200;
    return this.service.findEntityTimeline(
      entityType,
      entityId,
      user.tenantId,
      since ? new Date(since) : undefined,
      parsedLimit,
    );
  }

  /**
   * Phase 7 — project-wide timeline, used by the project inspector's
   * "Timeline" tab to render the entire golden path in one stream.
   */
  @Get('project/:projectId')
  async getProjectTimeline(
    @Param('projectId') projectId: string,
    @Query('since') since: string,
    @Query('limit') limit: string,
    @CurrentUser() user: { tenantId: string },
  ) {
    const parsedLimit = limit ? Math.max(1, Math.min(Number(limit), 500)) : 200;
    return this.service.findProjectTimeline(
      projectId,
      user.tenantId,
      since ? new Date(since) : undefined,
      parsedLimit,
    );
  }
}
