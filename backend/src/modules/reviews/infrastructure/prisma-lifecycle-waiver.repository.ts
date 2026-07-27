// src/modules/reviews/infrastructure/prisma-lifecycle-waiver.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma, type LifecycleWaiver } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  type ILifecycleWaiverRepository,
  type LifecycleWaiverEntity,
  type CreateLifecycleWaiverInput,
} from '../domain/ports/lifecycle-waiver-repository.port';

type TxClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PrismaLifecycleWaiverRepository implements ILifecycleWaiverRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(row: LifecycleWaiver): LifecycleWaiverEntity {
    return {
      id: row.id,
      tenantId: row.tenantId,
      scope: row.scope,
      entityType: row.entityType,
      entityId: row.entityId,
      fromStage: row.fromStage,
      toStage: row.toStage,
      reason: row.reason,
      waivedByActorId: row.waivedByActorId,
      waivedByActorType: row.waivedByActorType,
      guardFailureReason: row.guardFailureReason,
      occurredAt: row.occurredAt,
      version: row.version,
    };
  }

  async create(
    input: CreateLifecycleWaiverInput,
    tx?: Prisma.TransactionClient,
  ): Promise<LifecycleWaiverEntity> {
    const client = (tx ?? this.prisma) as TxClient;
    const row = await client.lifecycleWaiver.create({
      data: {
        tenantId: input.tenantId,
        scope: input.scope,
        entityType: input.entityType,
        entityId: input.entityId,
        fromStage: input.fromStage,
        toStage: input.toStage,
        reason: input.reason,
        waivedByActorId: input.waivedByActorId,
        waivedByActorType: input.waivedByActorType ?? 'HUMAN',
        guardFailureReason: input.guardFailureReason,
      },
    });
    return this.toEntity(row);
  }

  async findById(
    tenantId: string,
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<LifecycleWaiverEntity | null> {
    const client = (tx ?? this.prisma) as TxClient;
    const row = await client.lifecycleWaiver.findFirst({
      where: { id, tenantId },
    });
    return row ? this.toEntity(row) : null;
  }

  async listForEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<LifecycleWaiverEntity[]> {
    const client = (tx ?? this.prisma) as TxClient;
    const rows = await client.lifecycleWaiver.findMany({
      where: { tenantId, entityType, entityId },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }
}
