// ─── domain.types.ts ─────────────────────────────────────────────────────────
// Pure domain objects for the tenant frontend ("HeadQuarter").
// NEVER import from the backend — these are mirror types only.

// ─── Primitives ───────────────────────────────────────────────────────────────

export type EntityId = string;
export type ISODateString = string;

// ─── Auth / Users ─────────────────────────────────────────────────────────────

export type UserRole =
  | 'SUPER_ADMIN'
  | 'PLATFORM_ADMIN'
  | 'SECURITY_OFFICER'
  | 'SUPPORT'
  | 'OWNER'
  | 'ADMIN'
  | 'USER'
  | 'AUDITOR';

export interface User {
  id: EntityId;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  tenantId: EntityId | null;
  isActive: boolean;
  avatarUrl?: string;
  createdAt: ISODateString;
}

// ─── Tenant ───────────────────────────────────────────────────────────────────

export type TenantPlan = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'CANCELLED';

export interface Tenant {
  id: EntityId;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  agentLimit: number;
  logoUrl?: string;
  website?: string;
  industry?: string;
  createdAt: ISODateString;
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export type AgentStatus = 'ACTIVE' | 'INACTIVE' | 'TRAINING' | 'ERROR' | 'PAUSED';
export type AgentMood = 'busy' | 'idle' | 'optimistic' | 'stressed' | 'offline';

export interface AgentPerformance {
  successRate: number;        // 0–100
  avgTaskDuration: number;    // seconds
  tasksCompleted: number;
  tasksInProgress: number;
  tasksFailed: number;
  lastEvaluationScore?: number;
  streak: number;             // consecutive successes
}

export interface Agent {
  id: EntityId;
  name: string;
  description?: string;
  type: string;
  status: AgentStatus;
  mood: AgentMood;
  model: string;
  isActive: boolean;
  tenantId: EntityId;
  departmentId?: EntityId;
  departmentName?: string;
  performance: AgentPerformance;
  avatarUrl?: string;
  workloadGauge: number;      // 0–100 (visual meter)
  tags: string[];
  createdAt: ISODateString;
  lastActiveAt?: ISODateString;
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Task {
  id: EntityId;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  tenantId: EntityId;
  agentId?: EntityId;
  agentName?: string;
  workflowId?: EntityId;
  dueAt?: ISODateString;
  completedAt?: ISODateString;
  estimatedDuration?: number; // minutes
  actualDuration?: number;    // minutes
  metadata?: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export type WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'ERROR';

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'agent' | 'condition' | 'delay' | 'notification';
  label: string;
  agentId?: EntityId;
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface Workflow {
  id: EntityId;
  name: string;
  description?: string;
  status: WorkflowStatus;
  isActive: boolean;
  tenantId: EntityId;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  lastExecutedAt?: ISODateString;
  executionCount: number;
  successRate: number;  // 0–100
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ─── Department ───────────────────────────────────────────────────────────────

export interface Department {
  id: EntityId;
  name: string;
  description?: string;
  tenantId: EntityId;
  agentCount: number;
  activeAgentCount: number;
  completedTasksToday: number;
  harmonyScore: number; // 0–100
  createdAt: ISODateString;
}

// ─── Execution Log ────────────────────────────────────────────────────────────

export type ExecutionStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ExecutionLog {
  id: EntityId;
  agentId: EntityId;
  agentName?: string;
  taskId?: EntityId;
  workflowId?: EntityId;
  status: ExecutionStatus;
  startedAt: ISODateString;
  completedAt?: ISODateString;
  durationMs?: number;
  evaluationScore?: number;
  errorMessage?: string;
  inputTokens?: number;
  outputTokens?: number;
}

// ─── Activity Event (Newsfeed) ─────────────────────────────────────────────────

export type ActivityEventType =
  | 'task.completed'
  | 'task.failed'
  | 'agent.activated'
  | 'agent.error'
  | 'workflow.started'
  | 'workflow.completed'
  | 'approval.requested'
  | 'approval.approved'
  | 'approval.rejected'
  | 'collaboration'
  | 'alert';

export interface ActivityEvent {
  id: EntityId;
  type: ActivityEventType;
  title: string;
  description?: string;
  entityId?: EntityId;
  entityType?: string;
  agentId?: EntityId;
  agentName?: string;
  impact?: 'positive' | 'negative' | 'neutral';
  metadata?: Record<string, unknown>;
  timestamp: ISODateString;
}

// ─── Company Metrics (Dashboard KPIs) ────────────────────────────────────────

export interface CompanyMetrics {
  totalAgents: number;
  activeAgents: number;
  teamHarmony: number;          // 0–100
  tasksCompletedToday: number;
  tasksPending: number;
  activeWorkflows: number;
  pendingApprovals: number;
  companyScore: number;         // 0–100
  revenueImpact?: number;
  alertCount: number;
  criticalAlertCount: number;
}

// ─── Approval ─────────────────────────────────────────────────────────────────

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface Approval {
  id: EntityId;
  title: string;
  description?: string;
  status: ApprovalStatus;
  requestedById: EntityId;
  requestedByName?: string;
  reviewedById?: EntityId;
  entityType?: string;
  entityId?: EntityId;
  impactDescription?: string;
  impactValue?: number;
  expiresAt?: ISODateString;
  createdAt: ISODateString;
  reviewedAt?: ISODateString;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'collaboration';
export type NotificationPriority = 'critical' | 'important' | 'info';

export interface Notification {
  id: EntityId;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  entityId?: EntityId;
  entityType?: string;
  isRead: boolean;
  createdAt: ISODateString;
}

// ─── Time Range ───────────────────────────────────────────────────────────────

export type TimeRange = '1h' | '24h' | '7d' | '30d' | '90d';

// ─── Analytics Trend Data ─────────────────────────────────────────────────────

export interface TrendPoint {
  label: string;          // e.g. "Mon", "Jan 12", "14:00"
  value: number;
  baseline?: number;
}

export interface AgentPerformanceTrend {
  agentId: EntityId;
  agentName: string;
  successRate: number;    // 0–100
  taskCount: number;
  avgDurationMs?: number;
}
