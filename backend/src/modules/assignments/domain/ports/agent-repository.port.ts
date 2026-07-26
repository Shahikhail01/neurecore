// src/modules/assignments/domain/ports/agent-repository.port.ts
import type { AwlAgentAvailability } from '@prisma/client';

export const AGENT_REPOSITORY = Symbol('AGENT_REPOSITORY');

export interface AgentEntity {
  id: string;
  tenantId: string;
  name: string;
  role: string | null;
  capabilities: string[];
  maxConcurrency: number | null;
  availability: AwlAgentAvailability | null;
  archived: boolean;
}

export interface IAgentRepository {
  findEligible(
    tenantId: string,
    departmentId?: string,
    role?: string,
  ): Promise<AgentEntity[]>;

  findById(tenantId: string, id: string): Promise<AgentEntity | null>;
}
