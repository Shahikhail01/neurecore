// src/modules/assignments/domain/ports/agent-repository.port.ts
import type { AwlAgentAvailability } from '@prisma/client';
import type { AgentDataClassification } from '../agent-capability';
import { AGENT_REPOSITORY } from '../../../../common/ports/di-tokens';

export { AGENT_REPOSITORY };

export interface AgentEntity {
  id: string;
  tenantId: string;
  name: string;
  role: string | null;
  capabilities: string[];
  permissions: string[];
  maxConcurrency: number | null;
  availability: AwlAgentAvailability | null;
  archived: boolean;
  dataClassification: AgentDataClassification;
  departmentId: string | null;
}

export interface AgentWorkload {
  agentId: string;
  activeCount: number;
  assignedCount: number;
  inProgressCount: number;
  queuedCount: number;
  blockedCount: number;
}

export interface AgentPerformance {
  agentId: string;
  totalAttempts: number;
  succeededAttempts: number;
  successRate: number;
}

export type AssignmentStatusForCapacity =
  | 'ASSIGNED'
  | 'QUEUED'
  | 'IN_PROGRESS'
  | 'BLOCKED';

export interface IAgentRepository {
  findEligible(
    tenantId: string,
    filter: {
      departmentId?: string | null;
      role?: string | null;
      requiredCapabilities?: string[];
      dataClassification?: AgentDataClassification;
    },
  ): Promise<AgentEntity[]>;

  findById(tenantId: string, id: string): Promise<AgentEntity | null>;

  loadWorkloads(
    tenantId: string,
    agentIds: string[],
    statuses: AssignmentStatusForCapacity[],
  ): Promise<AgentWorkload[]>;

  loadPerformance(
    tenantId: string,
    agentIds: string[],
    windowSize: number,
  ): Promise<AgentPerformance[]>;
}
