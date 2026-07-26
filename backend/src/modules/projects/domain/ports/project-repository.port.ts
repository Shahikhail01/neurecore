// src/modules/projects/domain/ports/project-repository.port.ts
import { AwlExecutionEngine } from '@prisma/client';
import type { ITransactionalClient } from '../../../../common/ports/transaction.interface';

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface ProjectAggregate {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  customerId: string | null;
  targetDate: Date | null;
  status: string;
  executionEngineVersion: AwlExecutionEngine;
  initiationId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  tenantId: string;
  name: string;
  description?: string;
  customerId?: string;
  targetDate?: Date;
  initiationId?: string;
  executionEngineVersion: AwlExecutionEngine;
  status?: string;
}

export interface IProjectRepository {
  findById(tenantId: string, id: string, tx?: ITransactionalClient): Promise<ProjectAggregate | null>;
  findByInitiationId(tenantId: string, initiationId: string, tx?: ITransactionalClient): Promise<ProjectAggregate | null>;
  create(input: CreateProjectInput, tx?: ITransactionalClient): Promise<ProjectAggregate>;
}
