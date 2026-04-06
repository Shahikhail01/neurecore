/**
 * Department Management Types - Phase 3
 *
 * Represents organizational structure with departments, their heads, and associated metrics.
 * Supports hierarchical navigation and filtering of chat channels by department.
 */

/**
 * Department Entity
 */
export interface Department {
  /** Unique department identifier */
  id: string;

  /** Display name (e.g., "Finance", "Marketing", "Engineering") */
  name: string;

  /** Optional description */
  description?: string;

  /** Department head (agent ID) */
  headAgentId?: string;

  /** Parent department ID (for hierarchical orgs) */
  parentDepartmentId?: string;

  /** Total budget for this department (in cents) */
  budget?: number;

  /** Current spend (in cents) */
  currentSpend?: number;

  /** Number of agents in this department */
  agentCount?: number;

  /** Number of active tasks */
  taskCount?: number;

  /** Unread message count */
  unreadCount?: number;

  /** Is department expanded in tree view? */
  isExpanded?: boolean;

  /** Department color for visualization (hex) */
  color?: string;

  /** Last activity timestamp */
  lastActivityAt?: Date;

  /** Department status (active, paused, archived) */
  status?: "active" | "paused" | "archived";
}

/**
 * Department with Populated Relations
 */
export interface DepartmentWithDetails extends Department {
  /** Full agent information for head */
  headAgent?: {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
  };

  /** Child departments */
  childDepartments?: Department[];

  /** Department KPIs */
  metrics?: {
    avgTaskTime?: number; // milliseconds
    completedTaskCount?: number;
    failedTaskCount?: number;
    costPerTask?: number; // in cents
    utilization?: number; // percentage (0-100)
  };
}

/**
 * Department Tree State (for Zustand store)
 */
export interface DepartmentTreeState {
  /** All departments */
  departments: Department[];

  /** Expanded department IDs */
  expandedDepartmentIds: Set<string>;

  /** Selected department ID */
  selectedDepartmentId?: string;

  /** Is loadingDepartment data? */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;
}

/**
 * Department Tree Actions
 */
export interface DepartmentTreeActions {
  /** Fetch all departments */
  fetchDepartments: () => Promise<void>;

  /** Toggle department expansion */
  toggleDepartmentExpanded: (departmentId: string) => void;

  /** Select a department */
  selectDepartment: (departmentId: string) => void;

  /** Get child departments for a given parent */
  getChildDepartments: (parentId: string) => Department[];

  /** Clear selected department */
  clearSelection: () => void;

  /** Clear error */
  clearError: () => void;
}

/**
 * Department Activity Entry
 *
 * Represents a recent action in a department
 */
export interface DepartmentActivity {
  /** Activity ID */
  id: string;

  /** Activity type */
  type:
    | "task_created"
    | "task_completed"
    | "approval_requested"
    | "agent_added"
    | "budget_update";

  /** Human-readable description */
  description: string;

  /** Who performed the action */
  performedBy: {
    id: string;
    name: string;
    type: "agent" | "human";
  };

  /** When the activity occurred */
  timestamp: Date;

  /** Related entity (e.g., task ID, agent ID) */
  relatedEntityId?: string;

  /** Related entity type */
  relatedEntityType?: "task" | "agent" | "approval";
}
