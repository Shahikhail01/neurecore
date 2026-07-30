import { Injectable, Logger } from '@nestjs/common';
import { DeploymentService } from '../../agents/services/deployment.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { certifiedPlatformTemplateWhere } from '../../agent-templates/agent-template-certification';

export interface CosAssignResult {
  assigned: boolean;
  agentId: string | null;
  skipped: boolean;
  error: string | null;
}

@Injectable()
export class ChiefOfStaffService {
  private readonly logger = new Logger(ChiefOfStaffService.name);

  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly prisma: PrismaService,
  ) {}

  async autoAssign(projectId: string, tenantId: string, actorId: string): Promise<CosAssignResult> {
    try {
      const cosTemplate = await this.prisma.agentTemplate.findFirst({
        where: certifiedPlatformTemplateWhere({
          name: { contains: 'chief of staff', mode: 'insensitive' },
        }),
        select: { id: true, name: true },
      });

      if (!cosTemplate) {
        this.logger.warn(`No "Chief of Staff" agent template found — skipping CoS assignment for project ${projectId}`);
        return { assigned: false, agentId: null, skipped: true, error: null };
      }

      const agent = await this.deploymentService.spawnFromTemplate(
        cosTemplate.id,
        {
          name: `Chief of Staff — Project ${projectId.slice(0, 8)}`,
          tenantId,
          departmentId: undefined,
        },
        actorId,
        tenantId,
        'SYSTEM',
      );

      await this.prisma.projectMember.create({
        data: {
          projectId,
          actorId: agent.id,
          actorType: 'AI',
          role: 'CHIEF_OF_STAFF',
          assignedAt: new Date(),
        },
      });

      this.logger.log(`Assigned Chief of Staff agent ${agent.id} to project ${projectId}`);
      return { assigned: true, agentId: agent.id, skipped: false, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to auto-assign CoS for project ${projectId}: ${msg}`);
      return { assigned: false, agentId: null, skipped: false, error: msg };
    }
  }
}
