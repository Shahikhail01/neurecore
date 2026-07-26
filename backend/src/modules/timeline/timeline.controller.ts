// src/modules/timeline/timeline.controller.ts
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TimelineService } from './timeline.service';

@Controller('timeline')
@UseGuards(JwtAuthGuard)
export class TimelineController {
  constructor(private readonly service: TimelineService) {}

  @Get(':entityType/:entityId')
  async getTimeline(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('since') since: string,
    @CurrentUser() user: { tenantId: string },
  ) {
    return this.service.findSince(
      since ? new Date(since) : new Date(0),
      entityType,
      entityId,
      user.tenantId,
    );
  }
}
