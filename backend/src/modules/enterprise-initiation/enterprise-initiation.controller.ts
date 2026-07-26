// src/modules/enterprise-initiation/enterprise-initiation.controller.ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorrelationService } from '../../common/correlation/correlation.service';
import { EnterpriseInitiationService } from './enterprise-initiation.service';

@Controller('enterprise-initiation')
@UseGuards(JwtAuthGuard)
export class EnterpriseInitiationController {
  constructor(
    private readonly service: EnterpriseInitiationService,
    private readonly correlation: CorrelationService,
  ) {}

  @Post('approve')
  async approve(
    @Body() body: { initiationId: string; approvalComment?: string },
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    const context = this.correlation.createContext({
      tenantId: user.tenantId,
      actorId: user.id,
      actorType: 'HUMAN',
    });
    const metadata = this.correlation.buildMetadata(
      context,
      `approve:${body.initiationId}`,
    );

    return this.service.approveInitiation(
      {
        initiationId: body.initiationId,
        approvedByActorId: user.id,
        approvalComment: body.approvalComment,
      },
      metadata,
    );
  }

  @Post('create-project')
  async createProject(
    @Body() body: {
      initiationId: string;
      projectName: string;
      projectDescription?: string;
    },
    @CurrentUser() user: { id: string; tenantId: string },
  ) {
    const context = this.correlation.createContext({
      tenantId: user.tenantId,
      actorId: user.id,
      actorType: 'HUMAN',
    });
    const metadata = this.correlation.buildMetadata(
      context,
      `create-project:${body.initiationId}`,
    );

    return this.service.createProjectFromInitiation(
      {
        initiationId: body.initiationId,
        projectName: body.projectName,
        projectDescription: body.projectDescription,
      },
      metadata,
    );
  }
}
