// src/modules/projects/domain/ports/project-repository.port.ts
import { AwlExecutionEngine as ExecutionEngine } from '@prisma/client';

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface ProjectAggregate {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  customerId: string | null;
  targetDate: Date | null;
  status: string;
  executionEngineVersion: ExecutionEngine;
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
  executionEngineVersion: ExecutionEngine;
  status?: string;
}

export interface IProjectRepository {
  findById(tenantId: string, id: string): Promise<ProjectAggregate | null>;
  findByInitiationId(tenantId: string, initiationId: string): Promise<ProjectAggregate | null>;
  create(input: CreateProjectInput): Promise<ProjectAggregate>;
}
