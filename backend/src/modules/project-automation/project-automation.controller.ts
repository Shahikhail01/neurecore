// src/modules/project-automation/project-automation.controller.ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectAutomationService } from './project-automation.service';

@Controller('project-automation')
@UseGuards(JwtAuthGuard)
export class ProjectAutomationController {
  constructor(private readonly service: ProjectAutomationService) {}

  @Get(':projectId/status')
  async getStatus(@Param('projectId') projectId: string) {
    return this.service.getAutomationStatus(projectId);
  }
}
