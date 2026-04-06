/**
 * Approval Store - Zustand
 *
 * Manages approval queue, filtering, sorting, and approval actions.
 * Integrates with backend API for creating, approving, and rejecting approvals.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  Approval,
  ApprovalStore,
  ApprovalStatus,
  ApprovalPriority,
} from "@/types/approval.types";

/**
 * Default error message for API failures
 */
const DEFAULT_ERROR_MESSAGE = "Failed to process approval. Please try again.";

/**
 * Mock approval data for development
 */
const MOCK_APPROVALS: Approval[] = [
  {
    id: "apr-1",
    tenantId: "tenant-1",
    initiatorId: "agent-1",
    initiatorType: "agent",
    initiatorName: "Email Manager",
    type: "email_send",
    context: {
      emailCount: 500,
      recipientGroup: "Q1 Leads",
      subject: "Spring Sale Alert",
      estimatedCost: 2.5,
    },
    priority: "high",
    status: "pending",
    createdAt: new Date(Date.now() - 300000), // 5 min ago
    approvers: [
      {
        approverId: "user-1",
        approverName: "John Doe",
        status: "pending",
        order: 1,
      },
      {
        approverId: "user-2",
        approverName: "Jane Smith",
        status: "pending",
        order: 2,
      },
    ],
    requestReason: "Sending promotional emails to Q1 leads",
    relatedEntityId: "task-101",
    relatedEntityType: "task",
    estimatedCost: 2.5,
    tags: ["marketing", "email"],
  },
  {
    id: "apr-2",
    tenantId: "tenant-1",
    initiatorId: "agent-2",
    initiatorType: "agent",
    initiatorName: "Sales Agent",
    type: "budget_increase",
    context: {
      currentBudget: 10000,
      requestedBudget: 15000,
      reason: "Q2 campaign expansion",
    },
    priority: "medium",
    status: "pending",
    createdAt: new Date(Date.now() - 600000), // 10 min ago
    approvers: [
      {
        approverId: "user-1",
        approverName: "John Doe",
        status: "approved",
        approvedAt: new Date(Date.now() - 100000),
        order: 1,
      },
      {
        approverId: "user-2",
        approverName: "Jane Smith",
        status: "pending",
        order: 2,
      },
    ],
    requestReason: "Additional budget for Q2 promotional campaigns",
    relatedEntityId: "dept-3",
    relatedEntityType: "department",
    estimatedCost: 5000,
    tags: ["budget", "sales"],
  },
  {
    id: "apr-3",
    tenantId: "tenant-1",
    initiatorId: "agent-3",
    initiatorType: "agent",
    initiatorName: "Data Processor",
    type: "data_access",
    context: {
      dataType: "Customer Email Database",
      accessLevel: "read",
      duration: "30 days",
    },
    priority: "critical",
    status: "pending",
    createdAt: new Date(Date.now() - 1200000), // 20 min ago
    approvers: [
      {
        approverId: "user-3",
        approverName: "Security Officer",
        status: "pending",
        order: 1,
      },
    ],
    requestReason: "Need access to customer emails for bulk data import",
    relatedEntityId: "task-102",
    relatedEntityType: "task",
    tags: ["security", "data"],
  },
];

/**
 * Zustand store for approval management
 *
 * @example
 * const { approvals, fetchApprovals, approveApproval } = useApprovalStore();
 */
export const useApprovalStore = create<ApprovalStore>()(
  immer((set, get) => ({
    // State
    approvals: [],
    selectedApprovalId: null,
    filters: {},
    sortBy: "priority-desc",
    page: 1,
    pageSize: 10,
    total: 0,
    isLoading: false,
    error: null,

    // Actions

    /**
     * Fetch approvals from backend
     */
    fetchApprovals: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // TODO: Replace with actual API call
        // const response = await fetch('/api/v1/approvals?...');
        // const data = await response.json();

        // Mock data for development
        const filteredApprovals = MOCK_APPROVALS.filter((apr) => {
          const filters = get().filters;
          if (filters.status && apr.status !== filters.status) return false;
          if (filters.priority && apr.priority !== filters.priority)
            return false;
          if (filters.type && apr.type !== filters.type) return false;
          if (filters.initiatorId && apr.initiatorId !== filters.initiatorId)
            return false;
          return true;
        }).sort((a, b) => {
          const sortBy = get().sortBy;
          if (sortBy === "priority-desc") {
            const priorityOrder: Record<ApprovalPriority, number> = {
              critical: 4,
              high: 3,
              medium: 2,
              low: 1,
            };
            return (
              (priorityOrder[b.priority] || 0) -
              (priorityOrder[a.priority] || 0)
            );
          } else if (sortBy === "date-new") {
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          }
          return 0;
        });

        set((state) => {
          state.approvals = filteredApprovals;
          state.total = filteredApprovals.length;
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Fetch single approval detail
     */
    fetchApprovalDetail: async (approvalId: string) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // TODO: Replace with actual API call
        // const response = await fetch(`/api/v1/approvals/${approvalId}`);
        // const approval = await response.json();

        const approval = MOCK_APPROVALS.find((a) => a.id === approvalId);

        if (approval) {
          set((state) => {
            state.selectedApprovalId = approvalId;
            state.isLoading = false;
          });
        }
      } catch (error) {
        set((state) => {
          state.error = DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Select an approval
     */
    selectApproval: (approvalId: string | null) => {
      set((state) => {
        state.selectedApprovalId = approvalId;
      });
    },

    /**
     * Approve an approval
     */
    approveApproval: async (approvalId: string, comment?: string) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // TODO: Replace with actual API call
        // await fetch(`/api/v1/approvals/${approvalId}/approve`, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ comment }),
        // });

        set((state) => {
          const approval = state.approvals.find((a) => a.id === approvalId);
          if (approval) {
            // Update approver status (mock: use first pending approver)
            const pendingApprover = approval.approvers.find(
              (a) => a.status === "pending",
            );
            if (pendingApprover) {
              pendingApprover.status = "approved";
              pendingApprover.approvedAt = new Date();
              if (comment) {
                pendingApprover.comment = comment;
              }
            }

            // If all approved, mark approval as approved
            if (approval.approvers.every((a) => a.status === "approved")) {
              approval.status = "approved";
            }
          }
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Reject an approval
     */
    rejectApproval: async (approvalId: string, reason: string) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // TODO: Replace with actual API call

        set((state) => {
          const approval = state.approvals.find((a) => a.id === approvalId);
          if (approval) {
            approval.status = "rejected";
            // Update first pending approver
            const pendingApprover = approval.approvers.find(
              (a) => a.status === "pending",
            );
            if (pendingApprover) {
              pendingApprover.status = "rejected";
              pendingApprover.comment = reason;
            }
          }
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Bulk approve multiple approvals
     */
    bulkApprove: async (approvalIds: string[], comment?: string) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // TODO: Replace with actual API call

        set((state) => {
          approvalIds.forEach((id) => {
            const approval = state.approvals.find((a) => a.id === id);
            if (approval && approval.status === "pending") {
              const pendingApprover = approval.approvers.find(
                (a) => a.status === "pending",
              );
              if (pendingApprover) {
                pendingApprover.status = "approved";
                pendingApprover.approvedAt = new Date();
                if (comment) {
                  pendingApprover.comment = comment;
                }
              }
              if (approval.approvers.every((a) => a.status === "approved")) {
                approval.status = "approved";
              }
            }
          });
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Bulk reject multiple approvals
     */
    bulkReject: async (approvalIds: string[], reason?: string) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // TODO: Replace with actual API call

        set((state) => {
          approvalIds.forEach((id) => {
            const approval = state.approvals.find((a) => a.id === id);
            if (approval && approval.status === "pending") {
              approval.status = "rejected";
              const pendingApprover = approval.approvers.find(
                (a) => a.status === "pending",
              );
              if (pendingApprover) {
                pendingApprover.status = "rejected";
                if (reason) {
                  pendingApprover.comment = reason;
                }
              }
            }
          });
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Revoke an approved approval
     */
    revokeApproval: async (approvalId: string, reason?: string) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // TODO: Replace with actual API call

        set((state) => {
          const approval = state.approvals.find((a) => a.id === approvalId);
          if (approval) {
            approval.status = "revoked";
            approval.revokedBy = "current-user-id";
            approval.revokedAt = new Date();
          }
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Set filters
     */
    setFilters: (filters) => {
      set((state) => {
        state.filters = filters;
        state.page = 1; // Reset to page 1 when filters change
      });
    },

    /**
     * Set sort order
     */
    setSortBy: (sortBy) => {
      set((state) => {
        state.sortBy = sortBy;
      });
    },

    /**
     * Set page
     */
    setPage: (page) => {
      set((state) => {
        state.page = page;
      });
    },

    /**
     * Clear error
     */
    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },

    /**
     * Reset all state
     */
    reset: () => {
      set((state) => {
        state.approvals = [];
        state.selectedApprovalId = null;
        state.filters = {};
        state.sortBy = "priority-desc";
        state.page = 1;
        state.pageSize = 10;
        state.total = 0;
        state.isLoading = false;
        state.error = null;
      });
    },
  })),
);

/**
 * Selectors for common use cases
 */
export const approvalSelectors = {
  /**
   * Get selected approval
   */
  getSelected: () => {
    const state = useApprovalStore.getState();
    return state.approvals.find((a) => a.id === state.selectedApprovalId);
  },

  /**
   * Get pending approval count
   */
  getPendingCount: () => {
    const state = useApprovalStore.getState();
    return state.approvals.filter((a) => a.status === "pending").length;
  },

  /**
   * Get critical approval count
   */
  getCriticalCount: () => {
    const state = useApprovalStore.getState();
    return state.approvals.filter(
      (a) => a.status === "pending" && a.priority === "critical",
    ).length;
  },

  /**
   * Subscribe to selected approval changes
   */
  subscribeToSelected: (callback: (approval: Approval | undefined) => void) => {
    return (useApprovalStore.subscribe as any)(
      (state: any) => state.selectedApprovalId,
      (selectedId: any) => {
        callback(approvalSelectors.getSelected());
      },
    );
  },
};
