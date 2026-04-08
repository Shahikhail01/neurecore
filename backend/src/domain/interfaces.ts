/**
 * Repository Interfaces (Dependency Contracts)
 * SOLID: Interface Segregation - Segregate by responsibility
 * SOLID: Dependency Inversion - Services depend on these, not implementations
 * Location: src/domain/interfaces.ts
 */

import {
  Agent,
  Task,
  Approval,
  Department,
  CostTracking,
  AgentFilters,
  TaskFilters,
  ApprovalFilters,
  CreateAgentInput,
  CreateTaskInput,
  CreateApprovalInput,
  CreateDepartmentInput,
  CreateCostTrackingInput,
  UpdateAgentInput,
  UpdateTaskInput,
  UpdateApprovalInput,
} from './models';

/**
 * Agent Repository - Segregated by responsibility
 * SOLID: Interface Segregation - Only methods needed for agent operations
 */
export interface IAgentRepository {
  // Read operations
  findById(id: string): Promise<Agent | null>;
  findAll(filters: AgentFilters): Promise<Agent[]>;

  // Write operations
  create(input: CreateAgentInput): Promise<Agent>;
  update(id: string, input: UpdateAgentInput): Promise<Agent>;
  delete(id: string): Promise<void>;
}

/**
 * Task Repository
 */
export interface ITaskRepository {
  findById(id: string): Promise<Task | null>;
  findAll(filters: TaskFilters): Promise<Task[]>;
  findByAgentId(agentId: string): Promise<Task[]>;

  create(input: CreateTaskInput): Promise<Task>;
  update(id: string, input: UpdateTaskInput): Promise<Task>;
  delete(id: string): Promise<void>;
}

/**
 * Approval Repository
 */
export interface IApprovalRepository {
  findById(id: string): Promise<Approval | null>;
  findAll(filters: ApprovalFilters): Promise<Approval[]>;
  findExpiredApprovals(): Promise<Approval[]>;

  create(input: CreateApprovalInput): Promise<Approval>;
  update(id: string, input: UpdateApprovalInput): Promise<Approval>;
  delete(id: string): Promise<void>;
}

/**
 * Department Repository
 */
export interface IDepartmentRepository {
  findById(id: string): Promise<Department | null>;
  findAll(): Promise<Department[]>;

  create(input: CreateDepartmentInput): Promise<Department>;
  update(id: string, data: Partial<Department>): Promise<Department>;
  delete(id: string): Promise<void>;
}

/**
 * Cost Tracking Repository
 */
export interface ICostTrackingRepository {
  findById(id: string): Promise<CostTracking | null>;
  findByAgentId(agentId: string): Promise<CostTracking[]>;
  findByPeriod(period: string): Promise<CostTracking[]>;

  create(input: CreateCostTrackingInput): Promise<CostTracking>;
}

/**
 * Event Bus (for domain events)
 * SOLID: Dependency Inversion - Services use this abstraction
 */
export interface IEventBus {
  emit(event: string, payload: unknown): Promise<void>;
  subscribe(event: string, handler: (payload: unknown) => Promise<void>): void;
  unsubscribe(event: string): void;
}

/**
 * Logger (for cross-cutting concern)
 */
export interface ILogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error: Error, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

/**
 * Transaction Manager (for data consistency)
 * SOLID: Dependency Inversion
 */
export interface ITransactionManager {
  begin(): Promise<ITransaction>;
}

export interface ITransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/**
 * NocoDB Client wrapper
 * Abstracts the NocoDB SDK for cleaner testing and swappable implementations
 */
export interface INocoCoreClient {
  getCollection(name: string): Promise<any>;
  initialize(token: string, baseURL: string): Promise<void>;
  isInitialized(): boolean;
}
