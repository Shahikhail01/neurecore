/**
 * Approval Card - Phase 4
 *
 * Compact card displaying an approval request summary.
 * Shows initiator, context, priority, approvers status, and action buttons.
 *
 * Features:
 * - Horizontal card layout with hover effects
 * - Priority color coding (low/medium/high/critical)
 * - Approval chain progress indicator
 * - Quick action buttons (Approve, Reject, Preview)
 * - Unread badge support
 * - Responsive design
 * - Full keyboard accessibility
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import type { Approval } from "@/types/approval.types";
import { formatDistanceToNow } from "date-fns";

interface ApprovalCardProps {
  /**
   * Approval to display
   */
  approval: Approval;

  /**
   * Whether card is selected/active
   */
  isActive?: boolean;

  /**
   * Callback when card is clicked
   */
  onClick?: (approvalId: string) => void;

  /**
   * Callback for approve action
   */
  onApprove?: (approvalId: string) => void;

  /**
   * Callback for reject action
   */
  onReject?: (approvalId: string) => void;

  /**
   * Callback for preview/view details
   */
  onPreview?: (approvalId: string) => void;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Approval Card Component
 *
 * Compact card for displaying approval in queue list.
 * Used in ApprovalQueue grid/table.
 *
 * @example
 * <ApprovalCard
 *   approval={approval}
 *   isActive={selectedId === approval.id}
 *   onClick={handleSelect}
 *   onApprove={handleApprove}
 *   onReject={handleReject}
 * />
 */
export function ApprovalCard({
  approval,
  isActive = false,
  onClick,
  onApprove,
  onReject,
  onPreview,
  className,
}: ApprovalCardProps) {
  const [hovered, setHovered] = React.useState(false);

  // Priority color mapping
  const priorityConfig = {
    low: {
      bg: "bg-status-info/10",
      border: "border-status-info",
      text: "text-status-info",
    },
    medium: {
      bg: "bg-status-warning/10",
      border: "border-status-warning",
      text: "text-status-warning",
    },
    high: {
      bg: "bg-status-danger/10",
      border: "border-status-danger",
      text: "text-status-danger",
    },
    critical: {
      bg: "bg-status-danger/20",
      border: "border-status-danger",
      text: "text-status-danger",
    },
  };

  const colors = priorityConfig[approval.priority];

  // Count approved/pending approvers
  const approvedCount = approval.approvers.filter(
    (a) => a.status === "approved",
  ).length;
  const rejectedCount = approval.approvers.filter(
    (a) => a.status === "rejected",
  ).length;

  return (
    <div
      className={cn(
        "p-4 rounded-lg border-2 transition-all duration-base cursor-pointer",
        "hover:shadow-md",
        isActive
          ? `${colors.bg} ${colors.border} border-2`
          : "border-surface-border bg-surface-base hover:bg-surface-raised",
        "focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-accent-primary",
        className,
      )}
      onClick={() => onClick?.(approval.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={`Approval: ${approval.context.subject || approval.type}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(approval.id);
        }
      }}
    >
      {/* Header: Type + Priority Badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              "text-sm font-semibold text-text-primary truncate",
              isActive && colors.text,
            )}
          >
            {approval.context.subject || approval.type.replace(/_/g, " ")}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {approval.initiatorName}
          </p>
        </div>

        {/* Priority Badge */}
        <div
          className={cn(
            "px-2 py-1 rounded text-xs font-semibold flex-shrink-0",
            colors.bg,
            colors.text,
          )}
        >
          {approval.priority}
        </div>
      </div>

      {/* Context Description */}
      <p className="text-xs text-text-muted mb-3 line-clamp-2">
        {approval.requestReason || "No description provided"}
      </p>

      {/* Approvers Chain Progress */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1 text-xs">
          {approvedCount > 0 && (
            <span className="flex items-center gap-0.5 text-status-success">
              <CheckCircle className="w-3 h-3" />
              {approvedCount}
            </span>
          )}
          {rejectedCount > 0 && (
            <span className="flex items-center gap-0.5 text-status-danger">
              <XCircle className="w-3 h-3" />
              {rejectedCount}
            </span>
          )}
          {approval.approvers.filter((a) => a.status === "pending").length >
            0 && (
            <span className="flex items-center gap-0.5 text-text-muted">
              <Clock className="w-3 h-3" />
              {approval.approvers.filter((a) => a.status === "pending").length}
            </span>
          )}
        </div>

        {/* Created time */}
        <span className="text-xs text-text-muted ml-auto">
          {formatDistanceToNow(new Date(approval.createdAt), {
            addSuffix: true,
          })}
        </span>
      </div>

      {/* Progress bar showing approver progress */}
      <div className="w-full h-1.5 bg-surface-overlay rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-status-success transition-all duration-300"
          style={{
            width: `${(approvedCount / approval.approvers.length) * 100}%`,
          }}
          role="progressbar"
          aria-valuenow={approvedCount}
          aria-valuemin={0}
          aria-valuemax={approval.approvers.length}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {approval.status === "pending" && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApprove?.(approval.id);
              }}
              className={cn(
                "px-2 py-1.5 text-xs font-medium rounded",
                "text-status-success border border-status-success/50",
                "hover:bg-status-success/10 transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-status-success",
              )}
              aria-label={`Approve ${approval.type}`}
            >
              Approve
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReject?.(approval.id);
              }}
              className={cn(
                "px-2 py-1.5 text-xs font-medium rounded",
                "text-status-danger border border-status-danger/50",
                "hover:bg-status-danger/10 transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-status-danger",
              )}
              aria-label={`Reject ${approval.type}`}
            >
              Reject
            </button>
          </>
        )}

        {/* Preview/Details Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview?.(approval.id);
          }}
          className={cn(
            "ml-auto px-2 py-1.5 text-xs font-medium rounded",
            "text-accent-primary border border-accent-primary/30",
            "hover:bg-accent-primary/10 transition-colors",
            "flex items-center gap-1",
            "focus:outline-none focus:ring-2 focus:ring-accent-primary",
          )}
          aria-label={`View ${approval.type} details`}
        >
          View
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Status Badge (if not pending) */}
      {approval.status !== "pending" && (
        <div className="absolute top-2 right-2">
          {approval.status === "approved" && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-status-success/20 text-status-success text-xs font-semibold">
              <CheckCircle className="w-3 h-3" />
              Approved
            </div>
          )}
          {approval.status === "rejected" && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-status-danger/20 text-status-danger text-xs font-semibold">
              <AlertTriangle className="w-3 h-3" />
              Rejected
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type { ApprovalCardProps };
