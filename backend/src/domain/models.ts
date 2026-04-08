/**
 * Domain Models (Pure Data Types)
 * SOLID: Single Responsibility - Models only represent data, no logic
 * Location: src/domain/models.ts
 */

// Enums for type safety
export enum AgentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SLEEPING = 'sleeping',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum CostType {
  TOKEN_USAGE = 'token_usage',
  API_CALL = 'api_call',
  STORAGE = 'storage',
  COMPUTE = 'compute',
}

// Domain Models
export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  mood: number; // 0-100
  version: string;
  tenantId: string;
  departmentId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  agentId: string; // FK to agents
  assignedTo: string | null;
  deadline: string | null;
  cost: number;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: string;
  title: string;
  description: string;
  status: ApprovalStatus;
  requestedBy: string;
  expiresAt: string;
  priority: Priority;
  relatedTaskId: string | null; // FK to tasks
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  managerId: string;
  budget: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CostTracking {
  id: string;
  agentId: string; // FK to agents
  amount: number;
  type: CostType;
  period: string; // 'daily' | 'weekly' | 'monthly'
  metadata: Record<string, unknown>;
  createdAt: string;
}

// Input DTOs (Data Transfer Objects)
export interface CreateAgentInput {
  name: string;
  status?: AgentStatus;
  mood?: number;
  version: string;
  tenantId: string;
  departmentId?: string;
  createdBy: string;
}

export interface UpdateAgentInput {
  name?: string;
  status?: AgentStatus;
  mood?: number;
  version?: string;
  departmentId?: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  agentId: string;
  assignedTo?: string;
  deadline?: string;
  cost?: number;
  priority?: Priority;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  assignedTo?: string | null;
  deadline?: string | null;
  cost?: number;
  priority?: Priority;
}

export interface CreateApprovalInput {
  title: string;
  description?: string;
  requestedBy: string;
  expiresAt: string;
  priority?: Priority;
  relatedTaskId?: string;
}

export interface UpdateApprovalInput {
  status?: ApprovalStatus;
  priority?: Priority;
}

export interface CreateDepartmentInput {
  name: string;
  managerId: string;
  budget: number;
  active?: boolean;
}

export interface CreateCostTrackingInput {
  agentId: string;
  amount: number;
  type: CostType;
  period: string;
  metadata?: Record<string, unknown>;
}

// Query/Filter DTOs
export interface AgentFilters {
  tenantId: string;
  status?: AgentStatus;
  departmentId?: string;
  search?: string; // for name search
}

export interface TaskFilters {
  agentId?: string;
  status?: TaskStatus;
  priority?: Priority;
  assignedTo?: string;
}

export interface ApprovalFilters {
  requestedBy?: string;
  status?: ApprovalStatus;
  priority?: Priority;
}
