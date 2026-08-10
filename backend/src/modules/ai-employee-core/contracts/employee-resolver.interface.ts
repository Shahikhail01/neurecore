import {
  AgentClassification,
  AgentStatus,
  AwlAgentAvailability,
} from '@prisma/client';

export interface ResolvedEmployee {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly role: string | null;
  readonly departmentId: string | null;
  readonly instructions: string | null;
  readonly systemPrompt: string | null;
  readonly capabilityNames: readonly string[];
  readonly permissionNames: readonly string[];
  readonly authorityInputs: Readonly<{
    dataClassification: AgentClassification;
    budgetPerDay: string | null;
  }>;
  readonly lifecycle: Readonly<{
    status: AgentStatus;
    availability: AwlAgentAvailability;
    maxConcurrency: number;
    activeWorkRuns: number;
  }>;
  readonly modelPreference: Readonly<{
    model: string;
    advisory: true;
  }>;
}

export interface IEmployeeResolver {
  resolve(tenantId: string, employeeId: string): Promise<ResolvedEmployee>;
}

export interface EmployeeIdentity {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly role: string | null;
}

export interface IEmployeeIdentityReader {
  find(tenantId: string, employeeId: string): Promise<EmployeeIdentity | null>;
}
