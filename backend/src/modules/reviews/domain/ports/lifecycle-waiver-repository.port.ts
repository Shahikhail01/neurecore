// src/modules/reviews/domain/ports/lifecycle-waiver-repository.port.ts
import { LifecycleWaiverScope, Prisma } from '@prisma/client';

export const LIFECYCLE_WAIVER_REPOSITORY = Symbol(
  'LIFECYCLE_WAIVER_REPOSITORY',
);

export interface LifecycleWaiverEntity {
  id: string;
  tenantId: string;
  scope: LifecycleWaiverScope;
  entityType: string;
  entityId: string;
  fromStage: string;
  toStage: string;
  reason: string;
  waivedByActorId: string;
  waivedByActorType: string;
  guardFailureReason: string | null;
  occurredAt: Date;
  version: number;
}

export interface CreateLifecycleWaiverInput {
  tenantId: string;
  scope: LifecycleWaiverScope;
  entityType: string;
  entityId: string;
  fromStage: string;
  toStage: string;
  reason: string;
  waivedByActorId: string;
  waivedByActorType?: string;
  guardFailureReason?: string;
}

export interface ILifecycleWaiverRepository {
  create(
    input: CreateLifecycleWaiverInput,
    tx?: any,
  ): Promise<LifecycleWaiverEntity>;
  findById(
    tenantId: string,
    id: string,
    tx?: any,
  ): Promise<LifecycleWaiverEntity | null>;
  listForEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
    tx?: any,
  ): Promise<LifecycleWaiverEntity[]>;
}

export type LifecycleWaiverTxClient = Prisma.TransactionClient;
