import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * Adapter boundary for legacy tool data access.
 *
 * Tools should not import PrismaService directly. This keeps legacy behavior
 * stable while giving reconstruction work one migration choke point.
 */
@Injectable()
export class ToolDataAccessService {
  constructor(private readonly prisma: PrismaService) {}

  get activityEvent(): any { return this.prisma.activityEvent; }
  get agent(): any { return this.prisma.agent; }
  get approvalRequest(): any { return this.prisma.approvalRequest; }
  get budgetPolicy(): any { return this.prisma.budgetPolicy; }
  get costRecord(): any { return this.prisma.costRecord; }
  get customer(): any { return this.prisma.customer; }
  get customerContact(): any { return this.prisma.customerContact; }
  get department(): any { return this.prisma.department; }
  get goal(): any { return this.prisma.goal; }
  get governanceRule(): any { return this.prisma.governanceRule; }
  get memoryEntry(): any { return this.prisma.memoryEntry; }
  get notification(): any { return this.prisma.notification; }
  get project(): any { return this.prisma.project; }
  get projectMember(): any { return this.prisma.projectMember; }
  get projectStage(): any { return this.prisma.projectStage; }
  get task(): any { return this.prisma.task; }
  get tenant(): any { return this.prisma.tenant; }
  get workflow(): any { return this.prisma.workflow; }
  get workflowExecution(): any { return this.prisma.workflowExecution; }
}
