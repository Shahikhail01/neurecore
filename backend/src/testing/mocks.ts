/**
 * Mock implementations for testing
 * SOLID: Liskov Substitution - Mocks are substitutable for real implementations
 * Location: src/testing/mocks.ts
 */

import {
  Agent,
  Task,
  Approval,
  AgentStatus,
  TaskStatus,
  ApprovalStatus,
  CreateAgentInput,
  CreateTaskInput,
  CreateApprovalInput,
  AgentFilters,
  TaskFilters,
  ApprovalFilters,
} from '../domain/models';
import {
  IAgentRepository,
  ITaskRepository,
  IApprovalRepository,
  IEventBus,
  ILogger,
} from '../domain/interfaces';

/**
 * Mock Agent Repository
 */
export class MockAgentRepository implements IAgentRepository {
  private agents = new Map<string, Agent>();

  async findById(id: string): Promise<Agent | null> {
    return this.agents.get(id) || null;
  }

  async findAll(filters: AgentFilters): Promise<Agent[]> {
    return Array.from(this.agents.values()).filter((agent) => {
      if (agent.tenantId !== filters.tenantId) return false;
      if (filters.status && agent.status !== filters.status) return false;
      if (filters.departmentId && agent.departmentId !== filters.departmentId)
        return false;
      if (
        filters.search &&
        !agent.name.toLowerCase().includes(filters.search.toLowerCase())
      )
        return false;
      return true;
    });
  }

  async create(input: CreateAgentInput): Promise<Agent> {
    const agent: Agent = {
      ...input,
      id: `mock-agent-${Date.now()}`,
      status: input.status || AgentStatus.ACTIVE,
      mood: input.mood || 50,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.agents.set(agent.id, agent);
    return agent;
  }

  async update(id: string, input: any): Promise<Agent> {
    const agent = this.agents.get(id);
    if (!agent) throw new Error('Agent not found');

    const updated = {
      ...agent,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    this.agents.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.agents.delete(id);
  }
}

/**
 * Mock Task Repository
 */
export class MockTaskRepository implements ITaskRepository {
  private tasks = new Map<string, Task>();

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) || null;
  }

  async findAll(filters: TaskFilters): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter((task) => {
      if (filters.agentId && task.agentId !== filters.agentId) return false;
      if (filters.status && task.status !== filters.status) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.assignedTo && task.assignedTo !== filters.assignedTo)
        return false;
      return true;
    });
  }

  async findByAgentId(agentId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter((t) => t.agentId === agentId);
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const task: Task = {
      ...input,
      id: `mock-task-${Date.now()}`,
      status: input.status || TaskStatus.PENDING,
      cost: input.cost || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async update(id: string, input: any): Promise<Task> {
    const task = this.tasks.get(id);
    if (!task) throw new Error('Task not found');

    const updated = { ...task, ...input, updatedAt: new Date().toISOString() };
    this.tasks.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.tasks.delete(id);
  }
}

/**
 * Mock Approval Repository
 */
export class MockApprovalRepository implements IApprovalRepository {
  private approvals = new Map<string, Approval>();

  async findById(id: string): Promise<Approval | null> {
    return this.approvals.get(id) || null;
  }

  async findAll(filters: ApprovalFilters): Promise<Approval[]> {
    return Array.from(this.approvals.values()).filter((approval) => {
      if (filters.requestedBy && approval.requestedBy !== filters.requestedBy)
        return false;
      if (filters.status && approval.status !== filters.status) return false;
      if (filters.priority && approval.priority !== filters.priority)
        return false;
      return true;
    });
  }

  async findExpiredApprovals(): Promise<Approval[]> {
    const now = new Date().toISOString();
    return Array.from(this.approvals.values()).filter(
      (a) => a.expiresAt < now && a.status === ApprovalStatus.PENDING,
    );
  }

  async create(input: CreateApprovalInput): Promise<Approval> {
    const approval: Approval = {
      ...input,
      id: `mock-approval-${Date.now()}`,
      status: ApprovalStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.approvals.set(approval.id, approval);
    return approval;
  }

  async update(id: string, input: any): Promise<Approval> {
    const approval = this.approvals.get(id);
    if (!approval) throw new Error('Approval not found');

    const updated = {
      ...approval,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    this.approvals.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.approvals.delete(id);
  }
}

/**
 * Mock Event Bus
 */
export class MockEventBus implements IEventBus {
  public emittedEvents: Array<{ event: string; payload: unknown }> = [];

  async emit(event: string, payload: unknown): Promise<void> {
    this.emittedEvents.push({ event, payload });
  }

  subscribe(): void {
    // Mock implementation
  }

  unsubscribe(): void {
    // Mock implementation
  }
}

/**
 * Mock Logger
 */
export class MockLogger implements ILogger {
  public logs: Array<{ level: string; message: string }> = [];

  info(message: string): void {
    this.logs.push({ level: 'info', message });
  }

  warn(message: string): void {
    this.logs.push({ level: 'warn', message });
  }

  error(message: string): void {
    this.logs.push({ level: 'error', message });
  }

  debug(message: string): void {
    this.logs.push({ level: 'debug', message });
  }
}
