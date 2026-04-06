/**
 * Approval Queue - Phase 4
 *
 * Main view for browsing and managing approval requests.
 * Displays cards/grid of pending approvals with filtering and sorting.
 *
 * Features:
 * - Card grid layout (responsive)
 * - Filterable by: status, priority, initiator, type, date range
 * - Sortable: priority (desc), newest first
 * - Bulk approval actions
 * - Search/quick filter
 * - Empty state handling
 * - Loading skeleton states
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Filter,
  SearchIcon,
  SortDesc,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useApprovalStore } from "@/stores/approvalStore";
import { ApprovalCard } from "./ApprovalCard";
import { ApprovalDetailView } from "./ApprovalDetailView";
import type { ApprovalStatus, ApprovalPriority } from "@/types/approval.types";

/**
 * Approval Queue Component
 *
 * Main approval management interface showing queue of pending approvals.
 * Supports filtering, sorting, bulk actions, and detail view modals.
 *
 * @example
 * <ApprovalQueue />
 */
export function ApprovalQueue() {
  const [showFilters, setShowFilters] = React.useState(false);
  const [showDetailView, setShowDetailView] = React.useState(false);
  const [selectedForBulk, setSelectedForBulk] = React.useState<Set<string>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = React.useState("");

  const {
    approvals,
    selectedApprovalId,
    filters,
    sortBy,
    isLoading,
    error,
    fetchApprovals,
    selectApproval,
    setFilters,
    setSortBy,
    approveApproval,
    rejectApproval,
    bulkApprove,
    clearError,
  } = useApprovalStore();

  // Fetch approvals on mount
  React.useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals, filters, sortBy]);

  const filteredApprovals = approvals.filter((approval) => {
    if (
      searchQuery &&
      !approval.context.subject
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) &&
      !approval.initiatorName.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const selectedApproval = approvals.find((a) => a.id === selectedApprovalId);

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedForBulk);
    if (ids.length === 0) return;

    await bulkApprove(ids);
    setSelectedForBulk(new Set());
  };

  const toggleBulkSelect = (approvalId: string) => {
    const newSelected = new Set(selectedForBulk);
    if (newSelected.has(approvalId)) {
      newSelected.delete(approvalId);
    } else {
      newSelected.add(approvalId);
    }
    setSelectedForBulk(newSelected);
  };

  const toggleAllSelected = () => {
    if (selectedForBulk.size === filteredApprovals.length) {
      setSelectedForBulk(new Set());
    } else {
      setSelectedForBulk(new Set(filteredApprovals.map((a) => a.id)));
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-base">
      {/* Header */}
      <div className="border-b border-surface-border p-4 bg-surface-overlay">
        <h1 className="text-2xl font-bold text-text-primary mb-4">Approvals</h1>

        {/* Search + Controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search approvals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-9 pr-3 py-2 rounded-lg border",
                "bg-surface-base text-text-primary placeholder-text-muted",
                "border-surface-border focus:border-accent-primary",
                "focus:ring-2 focus:ring-accent-primary focus:ring-opacity-10",
                "transition-colors duration-base",
              )}
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-2 rounded-lg border transition-colors",
              showFilters
                ? "bg-accent-primary/10 border-accent-primary text-accent-primary"
                : "border-surface-border text-text-muted hover:bg-surface-raised",
            )}
            aria-label="Toggle filters"
          >
            <Filter className="w-5 h-5" />
          </button>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={cn(
              "px-3 py-2 rounded-lg border",
              "bg-surface-base text-text-primary",
              "border-surface-border focus:border-accent-primary",
              "focus:ring-2 focus:ring-accent-primary focus:ring-opacity-10",
              "transition-colors duration-base",
            )}
          >
            <option value="priority-desc">Priority (High → Low)</option>
            <option value="priority-asc">Priority (Low → High)</option>
            <option value="date-new">Newest First</option>
            <option value="date-old">Oldest First</option>
          </select>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-3 p-3 rounded-lg bg-status-danger/10 border border-status-danger text-status-danger text-sm flex items-start justify-between">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="hover:opacity-70 transition-opacity"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          onFiltersChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          // Loading skeleton
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-lg bg-surface-overlay animate-pulse"
              />
            ))}
          </div>
        ) : filteredApprovals.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CheckCircle className="w-16 h-16 text-status-success/30 mb-4" />
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              No Approvals
            </h2>
            <p className="text-text-muted">
              {approvals.length === 0
                ? "You're all caught up!"
                : "No approvals match your filters"}
            </p>
          </div>
        ) : (
          <>
            {/* Bulk Actions Bar (if any selected) */}
            {selectedForBulk.size > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-accent-primary/10 border border-accent-primary flex items-center justify-between">
                <span className="text-sm font-medium text-accent-primary">
                  {selectedForBulk.size} selected
                </span>
                <button
                  onClick={handleBulkApprove}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded",
                    "text-white bg-status-success hover:bg-status-success/90",
                    "transition-colors",
                  )}
                >
                  Approve All
                </button>
              </div>
            )}

            {/* Approval Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredApprovals.map((approval) => (
                <div key={approval.id} className="relative">
                  {/* Bulk Select Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedForBulk.has(approval.id)}
                    onChange={() => toggleBulkSelect(approval.id)}
                    className="absolute top-2 left-2 z-10 cursor-pointer"
                    aria-label={`Select ${approval.type}`}
                  />

                  <ApprovalCard
                    approval={approval}
                    isActive={selectedApprovalId === approval.id}
                    onClick={() => {
                      selectApproval(approval.id);
                      setShowDetailView(true);
                    }}
                    onApprove={() => {
                      approveApproval(approval.id);
                    }}
                    onReject={() => {
                      rejectApproval(approval.id, "Rejected");
                    }}
                    onPreview={() => {
                      selectApproval(approval.id);
                      setShowDetailView(true);
                    }}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Detail View Modal */}
      {showDetailView && selectedApproval && (
        <ApprovalDetailView
          approval={selectedApproval}
          onClose={() => setShowDetailView(false)}
          onApprove={() => {
            approveApproval(selectedApproval.id);
            setShowDetailView(false);
          }}
          onReject={() => {
            rejectApproval(selectedApproval.id, "Rejected");
            setShowDetailView(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Filter Panel Component
 */
function FilterPanel({
  filters,
  onFiltersChange,
  onClose,
}: {
  filters: any;
  onFiltersChange: (filters: any) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = React.useState<ApprovalStatus | "">(
    filters.status || "",
  );
  const [priority, setPriority] = React.useState<ApprovalPriority | "">(
    filters.priority || "",
  );

  return (
    <div className="border-b border-surface-border p-4 bg-surface-overlay space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-text-primary">Filters</h3>
        <button
          onClick={onClose}
          className="text-sm text-text-muted hover:text-text-primary"
        >
          Hide
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ApprovalStatus | "");
              onFiltersChange({
                ...filters,
                status: e.target.value || undefined,
              });
            }}
            className="w-full px-2 py-1.5 text-xs rounded border border-surface-border bg-surface-base text-text-primary"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value as ApprovalPriority | "");
              onFiltersChange({
                ...filters,
                priority: e.target.value || undefined,
              });
            }}
            className="w-full px-2 py-1.5 text-xs rounded border border-surface-border bg-surface-base text-text-primary"
          >
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
    </div>
  );
}
