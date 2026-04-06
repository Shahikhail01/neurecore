/**
 * Approval Management Types - Phase 4
 *
 * Represents the approval workflow system for AI agent actions.
 * Supports multi-step approvals, priority levels, and audit trails.
 */

/**
 * Approval Status Enum
 */
export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "revoked"
  | "expired";

/**
 * Approval Priority Enum
 */
export type ApprovalPriority = "low" | "medium" | "high" | "critical";

/**
 * Approval Type (action being approved)
 */
export type ApprovalType =
  | "email_send"
  | "budget_increase"
  | "data_access"
  | "agent_deployment"
  | "workflow_update"
  | "custom";

/**
 * Approval Chain Item
 *
 * Represents one approver in the approval workflow
 */
export interface ApprovalChainItem {
  /** Approver user ID */
  approverId: string;

  /** Approver name */
  approverName: string;

  /** Approval status (pending/approved/rejected) */
  status: "pending" | "approved" | "rejected";

  /** When approval was made (null if pending) */
  approvedAt?: Date;

  /** Optional comment from approver */
  comment?: string;

  /** Order in approval chain (1, 2, 3...) */
  order?: number;
}

/**
 * Approval Request Entity
 *
 * Represents a request for approval of an agent action
 */
export interface Approval {
  /** Unique approval ID */
  id: string;

  /** Tenant ID (multi-tenancy) */
  tenantId: string;

  /** Who initiated the approval (agent or human) */
  initiatorId: string;

  /** Initiator type */
  initiatorType: "agent" | "human";

  /** Initiator name (denormalized for display) */
  initiatorName: string;

  /** Type of action being approved */
  type: ApprovalType;

  /** The actual data/context being approved (e.g., email content, budget amount, access request) */
  context: Record<string, any>;

  /** Priority level */
  priority: ApprovalPriority;

  /** Current status */
  status: ApprovalStatus;

  /** When created */
  createdAt: Date;

  /** When expires (optional) */
  expiresAt?: Date;

  /** Approvers in the workflow */
  approvers: ApprovalChainItem[];

  /** Overall approval notes/request reason */
  requestReason?: string;

  /** Related entity (e.g., task ID) */
  relatedEntityId?: string;

  /** Related entity type */
  relatedEntityType?: "task" | "agent" | "department" | "custom";

  /** Who revoked the approval (if applicable) */
  revokedBy?: string;

  /** When revoked */
  revokedAt?: Date;

  /** Overall cost estimate (if applicable) */
  estimatedCost?: number;

  /** Tags for filtering/organization */
  tags?: string[];
}

/**
 * Approval State (for Zustand store)
 */
export interface ApprovalState {
  /** All approvals */
  approvals: Approval[];

  /** Selected approval ID */
  selectedApprovalId: string | null;

  /** Filter options */
  filters: {
    initiatorId?: string;
    status?: ApprovalStatus;
    priority?: ApprovalPriority;
    type?: ApprovalType;
    dateRange?: {
      from: Date;
      to: Date;
    };
  };

  /** Sort options */
  sortBy: "priority-desc" | "priority-asc" | "date-new" | "date-old";

  /** Pagination */
  page: number;
  pageSize: number;
  total: number;

  /** Loading/error states */
  isLoading: boolean;
  error: string | null;
}

/**
 * Approval Actions (for Zustand store)
 */
export interface ApprovalActions {
  /** Fetch all approvals matching filters */
  fetchApprovals: () => Promise<void>;

  /** Fetch single approval detail */
  fetchApprovalDetail: (approvalId: string) => Promise<void>;

  /** Select an approval */
  selectApproval: (approvalId: string | null) => void;

  /** Approve an approval */
  approveApproval: (approvalId: string, comment?: string) => Promise<void>;

  /** Reject an approval */
  rejectApproval: (approvalId: string, reason: string) => Promise<void>;

  /** Bulk approve multiple approvals */
  bulkApprove: (approvalIds: string[], comment?: string) => Promise<void>;

  /** Bulk reject multiple approvals */
  bulkReject: (approvalIds: string[], reason?: string) => Promise<void>;

  /** Revoke an already-approved approval */
  revokeApproval: (approvalId: string, reason?: string) => Promise<void>;

  /** Update filters */
  setFilters: (filters: ApprovalState["filters"]) => void;

  /** Update sort order */
  setSortBy: (sortBy: ApprovalState["sortBy"]) => void;

  /** Set page for pagination */
  setPage: (page: number) => void;

  /** Clear error message */
  clearError: () => void;

  /** Clear all state */
  reset: () => void;
}

/**
 * Combined Approval Store Type
 */
export type ApprovalStore = ApprovalState & ApprovalActions;
