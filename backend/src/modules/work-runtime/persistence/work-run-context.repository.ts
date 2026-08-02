import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface WorkRunContextSnapshotInput {
  workRunId: string;
  tenantId: string;
  actorType: string;
  actorId: string;
  authority: number;
  governanceBlocked: boolean;
  organizationSummary: Record<string, unknown>;
  policySource: string;
  planVersion: string;
  toolRegistrationsVersion: string;
}

@Injectable()
export class WorkRunContextRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(input: WorkRunContextSnapshotInput) {
    return this.prisma.workRunContextSnapshot.create({
      data: {
        ...input,
        organizationSummary: input.organizationSummary as Prisma.InputJsonValue,
      },
    });
  }

  async loadByRunId(tenantId: string, runId: string) {
    return this.prisma.workRunContextSnapshot.findFirst({
      where: { tenantId, workRunId: runId },
    });
  }
}
