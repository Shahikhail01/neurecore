// src/modules/project-automation/project-automation.controller.ts
import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectAutomationService } from './project-automation.service';

@Controller('project-automation')
@UseGuards(JwtAuthGuard)
export class ProjectAutomationController {
  constructor(private readonly service: ProjectAutomationService) {}

  @Get(':projectId/status')
  async getStatus(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    const auth = (req as any).user as
      | { tenantId?: string; id?: string }
      | undefined;
    if (!auth?.tenantId) {
      throw new ForbiddenException('TENANT_REQUIRED');
    }
    try {
      return await this.service.getAutomationStatus(auth.tenantId, projectId);
    } catch (e) {
      if ((e as Error)?.message === 'PROJECT_NOT_FOUND') {
        throw new NotFoundException('PROJECT_NOT_FOUND');
      }
      throw e;
    }
  }
}
