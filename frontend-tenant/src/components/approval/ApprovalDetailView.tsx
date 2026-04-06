/**
 * Approval Detail View - Phase 4
 *
 * Full-featured approval detail modal/page with tabs and workflow visualization.
 * Shows complete context, approval chain, and action buttons.
 *
 * Tabs:
 * - Overview: What's being approved, request reason
 * - Workflow: Approval chain with status indicators
 * - Comments: Approver comments and activity log
 * - Details: Additional context and related records
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  X,
  CheckCircle,
  AlertTriangle,
  MessageCircle,
  FileText,
  Clock,
} from "lucide-react";
import { WorkflowStageIndicator } from "./WorkflowStageIndicator";
import type { Approval } from "@/types/approval.types";
import { formatDistanceToNow } from "date-fns";

interface ApprovalDetailViewProps {
  /**
   * Approval to display
   */
  approval: Approval;

  /**
   * Callback when closing
   */
  onClose: () => void;

  /**
   * Callback when approving
   */
  onApprove?: (approvalId: string, comment?: string) => void;

  /**
   * Callback when rejecting
   */
  onReject?: (approvalId: string, reason: string) => void;

  /**
   * Show as modal or inspector
   */
  layout?: "modal" | "inspector";
}

type TabType = "overview" | "workflow" | "comments" | "details";

/**
 * Approval Detail View Component
 *
 * Full-featured approval detail page with tabbed interface.
 * Shows request context, approval chain, comments, and action buttons.
 *
 * @example
 * <ApprovalDetailView
 *   approval={selectedApproval}
 *   onClose={handleClose}
 *   onApprove={handleApprove}
 *   onReject={handleReject}
 * />
 */
export function ApprovalDetailView({
  approval,
  onClose,
  onApprove,
  onReject,
  layout = "modal",
}: ApprovalDetailViewProps) {
  const [activeTab, setActiveTab] = React.useState<TabType>("overview");
  const [rejectReason, setRejectReason] = React.useState("");
  const [showRejectForm, setShowRejectForm] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      onApprove?.(approval.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setIsSubmitting(true);
    try {
      onReject?.(approval.id, rejectReason);
      setShowRejectForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: "overview",
      label: "Overview",
      icon: <FileText className="w-4 h-4" />,
    },
    { id: "workflow", label: "Workflow", icon: <Clock className="w-4 h-4" /> },
    {
      id: "comments",
      label: "Comments",
      icon: <MessageCircle className="w-4 h-4" />,
    },
    { id: "details", label: "Details", icon: <FileText className="w-4 h-4" /> },
  ];

  const content = (
    <div
      className={cn(
        "flex flex-col h-full bg-surface-base",
        layout === "modal" && "max-h-[90vh]",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-surface-border">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Approval Request
          </h2>
          <p className="text-xs text-text-muted mt-1">
            {approval.initiatorName} • {approval.type.replace(/_/g, " ")}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-surface-overlay rounded transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-text-muted hover:text-text-primary" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 py-3 border-b border-surface-border bg-surface-overlay overflow-x-auto">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t-lg",
              "flex items-center gap-2 whitespace-nowrap",
              "transition-colors duration-base",
              activeTab === id
                ? "text-accent-primary bg-surface-base border-b-2 border-accent-primary"
                : "text-text-muted hover:text-text-primary hover:bg-surface-base",
            )}
            role="tab"
            aria-selected={activeTab === id}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "overview" && <OverviewTab approval={approval} />}
        {activeTab === "workflow" && <WorkflowTab approval={approval} />}
        {activeTab === "comments" && <CommentsTab approval={approval} />}
        {activeTab === "details" && <DetailsTab approval={approval} />}
      </div>

      {/* Footer Actions */}
      {approval.status === "pending" && (
        <div className="border-t border-surface-border p-4 bg-surface-overlay space-y-3">
          {showRejectForm ? (
            // Reject form
            <div className="space-y-3">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why you're rejecting this approval..."
                className={cn(
                  "w-full px-3 py-2 rounded-lg border",
                  "bg-surface-base text-text-primary resize-none",
                  "border-surface-border focus:border-accent-primary",
                  "focus:ring-2 focus:ring-accent-primary focus:ring-opacity-10",
                  "min-h-[100px]",
                )}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRejectForm(false)}
                  className={cn(
                    "flex-1 px-4 py-2 text-sm font-medium rounded-lg",
                    "border border-surface-border text-text-primary",
                    "hover:bg-surface-base transition-colors",
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || isSubmitting}
                  className={cn(
                    "flex-1 px-4 py-2 text-sm font-semibold rounded-lg",
                    "text-white bg-status-danger hover:bg-status-danger/90",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "transition-colors",
                  )}
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          ) : (
            // Action buttons
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                disabled={isSubmitting}
                className={cn(
                  "flex-1 px-4 py-2 text-sm font-semibold rounded-lg",
                  "text-white bg-status-success hover:bg-status-success/90",
                  "flex items-center justify-center gap-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-colors",
                )}
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={isSubmitting}
                className={cn(
                  "flex-1 px-4 py-2 text-sm font-semibold rounded-lg",
                  "text-status-danger border border-status-danger/50",
                  "hover:bg-status-danger/10",
                  "flex items-center justify-center gap-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-colors",
                )}
              >
                <AlertTriangle className="w-4 h-4" />
                Reject
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status Badge (if not pending) */}
      {approval.status !== "pending" && (
        <div className="border-t border-surface-border p-4 bg-surface-overlay">
          <div
            className={cn(
              "p-3 rounded-lg text-sm font-semibold flex items-center gap-2",
              approval.status === "approved"
                ? "bg-status-success/10 text-status-success"
                : "bg-status-danger/10 text-status-danger",
            )}
          >
            {approval.status === "approved" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            {approval.status === "approved" ? "Approved" : "Rejected"}
          </div>
        </div>
      )}
    </div>
  );

  if (layout === "modal") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-surface-base rounded-lg shadow-xl w-full max-w-2xl mx-4">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-screen w-full max-w-lg bg-surface-base border-l border-surface-border shadow-xl">
      {content}
    </div>
  );
}

/**
 * Overview Tab
 */
function OverviewTab({ approval }: { approval: Approval }) {
  return (
    <div className="p-6 space-y-6">
      {/* Request Summary */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          What's Being Approved
        </h3>
        <p className="text-sm text-text-muted mb-3">
          {approval.requestReason || "No description provided"}
        </p>

        {/* Context Details */}
        <div className="bg-surface-overlay rounded-lg p-4 space-y-2">
          {Object.entries(approval.context).map(([key, value]) => (
            <div
              key={key}
              className="flex items-start justify-between py-1 border-b border-surface-border last:border-0"
            >
              <span className="text-xs font-medium text-text-muted capitalize">
                {key.replace(/_/g, " ")}
              </span>
              <span className="text-sm text-text-primary font-medium">
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-text-muted mb-1">Initiator</p>
          <p className="text-sm font-semibold text-text-primary">
            {approval.initiatorName}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1">Priority</p>
          <p className="text-sm font-semibold text-text-primary capitalize">
            {approval.priority}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1">Type</p>
          <p className="text-sm font-semibold text-text-primary capitalize">
            {approval.type.replace(/_/g, " ")}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted mb-1">Created</p>
          <p className="text-sm font-semibold text-text-primary">
            {formatDistanceToNow(new Date(approval.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Workflow Tab
 */
function WorkflowTab({ approval }: { approval: Approval }) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-4">
          Approval Chain
        </h3>
        <WorkflowStageIndicator
          approvers={approval.approvers}
          status={approval.status as any}
          showLabels={true}
        />
      </div>

      {/* Approver Details */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          Approvers
        </h3>
        <div className="space-y-2">
          {approval.approvers.map((approver) => (
            <div
              key={approver.approverId}
              className="p-3 rounded-lg bg-surface-overlay border border-surface-border"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {approver.approverName}
                  </p>
                  <p className="text-xs text-text-muted">
                    Approver {approver.order}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-1 rounded capitalize",
                    approver.status === "approved"
                      ? "bg-status-success/20 text-status-success"
                      : approver.status === "rejected"
                        ? "bg-status-danger/20 text-status-danger"
                        : "bg-status-info/20 text-status-info",
                  )}
                >
                  {approver.status}
                </span>
              </div>
              {approver.approvedAt && (
                <p className="text-xs text-text-muted">
                  {formatDistanceToNow(new Date(approver.approvedAt), {
                    addSuffix: true,
                  })}
                </p>
              )}
              {approver.comment && (
                <p className="text-xs text-text-muted mt-2 italic">
                  "{approver.comment}"
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Comments Tab
 */
function CommentsTab({ approval }: { approval: Approval }) {
  const comments = approval.approvers.filter((a) => a.comment);

  return (
    <div className="p-6">
      {comments.length === 0 ? (
        <div className="text-center py-8">
          <MessageCircle className="w-10 h-10 text-text-muted/30 mx-auto mb-2" />
          <p className="text-sm text-text-muted">No comments yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((approver) => (
            <div
              key={approver.approverId}
              className="p-4 rounded-lg bg-surface-overlay border border-surface-border"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-text-primary">
                  {approver.approverName}
                </p>
                {approver.approvedAt && (
                  <p className="text-xs text-text-muted">
                    {formatDistanceToNow(new Date(approver.approvedAt), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
              <p className="text-sm text-text-secondary">{approver.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Details Tab
 */
function DetailsTab({ approval }: { approval: Approval }) {
  return (
    <div className="p-6 space-y-4">
      {approval.relatedEntityId && (
        <div>
          <p className="text-xs font-semibold text-text-muted mb-1">
            Related Entity
          </p>
          <p className="text-sm text-text-primary">
            {approval.relatedEntityType}: {approval.relatedEntityId}
          </p>
        </div>
      )}

      {approval.estimatedCost && (
        <div>
          <p className="text-xs font-semibold text-text-muted mb-1">
            Estimated Cost
          </p>
          <p className="text-sm text-text-primary">
            ${approval.estimatedCost.toFixed(2)}
          </p>
        </div>
      )}

      {approval.tags && approval.tags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted mb-2">Tags</p>
          <div className="flex flex-wrap gap-2">
            {approval.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 text-xs rounded-full bg-accent-primary/20 text-accent-primary font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export type { ApprovalDetailViewProps };
