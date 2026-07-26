// src/modules/enterprise-initiation/infrastructure/prisma-initiation.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  IInitiationRepository,
  InitiationAggregate,
  CreateInitiationInput,
} from '../domain/ports/initiation-repository.port';
import { InitiationStatus } from '../domain/initiation-states';

/**
 * Prisma adapter for IInitiationRepository.
 *
 * This is the ONLY place in the initiation module that imports Prisma directly.
 * Application handlers use IInitiationRepository (port).
 */
@Injectable()
export class PrismaInitiationRepository implements IInitiationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toAggregate(row: any): InitiationAggregate | null {
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenantId,
      customerId: row.customerId,
      status: row.status as InitiationStatus,
      projectName: row.projectName,
      projectDescription: row.projectDescription,
      targetDate: row.targetDate,
      approvedByActorId: row.approvedByActorId,
      approvedAt: row.approvedAt,
      approvalComment: row.approvalComment,
      projectId: row.projectId,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findById(tenantId: string, id: string): Promise<InitiationAggregate | null> {
    const row = await this.prisma.enterpriseInitiation.findFirst({
      where: { id, tenantId },
    });
    return this.toAggregate(row);
  }

  async findApprovedForUpdate(
    tenantId: string,
    id: string,
  ): Promise<InitiationAggregate | null> {
    // Note: row-level locking requires explicit transaction.
    // The application handler is expected to call this within a UoW.execute()
    const row = await this.prisma.enterpriseInitiation.findFirst({
      where: { id, tenantId, status: InitiationStatus.APPROVED },
    });
    return this.toAggregate(row);
  }

  async markMaterializing(
    tenantId: string,
    id: string,
    projectId: string,
    expectedVersion: number,
  ): Promise<InitiationAggregate> {
    const result = await this.prisma.enterpriseInitiation.updateMany({
      where: { id, tenantId, version: expectedVersion },
      data: {
        status: InitiationStatus.MATERIALIZING,
        projectId,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      throw new Error('OPTIMISTIC_LOCK_FAILED');
    }
    const updated = await this.prisma.enterpriseInitiation.findUnique({ where: { id } });
    return this.toAggregate(updated)!;
  }

  async create(input: CreateInitiationInput): Promise<InitiationAggregate> {
    const row = await this.prisma.enterpriseInitiation.create({
      data: {
        tenantId: input.tenantId,
        customerId: input.customerId ?? null,
        projectName: input.projectName,
        projectDescription: input.projectDescription,
        targetDate: input.targetDate,
        status: InitiationStatus.DRAFT,
        version: 1,
      } as any,
    });
    return this.toAggregate(row)!;
  }

  // Approval is a special command — needs version-based optimistic locking
  async approve(
    tenantId: string,
    id: string,
    expectedVersion: number,
    approvedByActorId: string,
    approvalComment: string | undefined,
  ): Promise<InitiationAggregate> {
    const result = await this.prisma.enterpriseInitiation.updateMany({
      where: { id, tenantId, version: expectedVersion },
      data: {
        status: InitiationStatus.APPROVED,
        approvedByActorId,
        approvedAt: new Date(),
        approvalComment,
        version: { increment: 1 },
      },
    });
    if (result.count === 0) {
      throw new Error('OPTIMISTIC_LOCK_FAILED');
    }
    const updated = await this.prisma.enterpriseInitiation.findUnique({ where: { id } });
    return this.toAggregate(updated)!;
  }
}
