// src/modules/enterprise-initiation/domain/ports/initiation-repository.port.ts
import { InitiationStatus } from '../initiation-states';
import type { ITransactionalClient } from '../../../../common/ports/transaction.interface';

export const INITIATION_REPOSITORY = Symbol('INITIATION_REPOSITORY');

export interface IInitiationRepository {
  findById(tenantId: string, id: string, tx?: ITransactionalClient): Promise<InitiationAggregate | null>;
  findApprovedForUpdate(tenantId: string, id: string, tx?: ITransactionalClient): Promise<InitiationAggregate | null>;
  markMaterializing(
    tenantId: string,
    id: string,
    projectId: string,
    expectedVersion: number,
    tx?: ITransactionalClient,
  ): Promise<InitiationAggregate>;
  approve(
    tenantId: string,
    id: string,
    expectedVersion: number,
    approvedByActorId: string,
    approvalComment: string | undefined,
    tx?: ITransactionalClient,
  ): Promise<InitiationAggregate>;
  create(input: CreateInitiationInput, tx?: ITransactionalClient): Promise<InitiationAggregate>;
}

export interface InitiationAggregate {
  id: string;
  tenantId: string;
  customerId: string | null;
  status: InitiationStatus;
  projectName: string;
  projectDescription: string | null;
  targetDate: Date | null;
  approvedByActorId: string | null;
  approvedAt: Date | null;
  approvalComment: string | null;
  projectId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInitiationInput {
  tenantId: string;
  customerId?: string | null;
  projectName: string;
  projectDescription?: string;
  targetDate?: Date;
}
