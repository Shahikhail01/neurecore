/**
 * Workflow Stage Indicator - Phase 4
 *
 * Displays approval workflow progress as horizontal stages.
 * Shows pending, approved, rejected, and completed stages.
 *
 * Features:
 * - Horizontal progress indication
 * - Color-coded by status (pending, in-progress, completed, error)
 * - Animated transitions between stages
 * - Accessible with ARIA labels and semantic HTML
 * - Responsive design (full width with flexible spacing)
 * - Design token colors throughout
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";
import type { ApprovalChainItem } from "@/types/approval.types";

interface WorkflowStageIndicatorProps {
  /**
   * List of approvers in the workflow chain
   */
  approvers: ApprovalChainItem[];

  /**
   * Overall status ("pending", "approved", "rejected")
   */
  status?: "pending" | "approved" | "rejected";

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show labels? (default: true)
   */
  showLabels?: boolean;
}

/**
 * Workflow Stage Indicator Component
 *
 * Visual indicator of approval workflow progress.
 * Shows each approver as a stage with status indicator.
 *
 * @example
 * <WorkflowStageIndicator
 *   approvers={approval.approvers}
 *   status={approval.status}
 *   showLabels={true}
 * />
 */
export function WorkflowStageIndicator({
  approvers,
  status = "pending",
  className,
  showLabels = true,
}: WorkflowStageIndicatorProps) {
  if (approvers.length === 0) return null;

  return (
    <div
      className={cn("flex items-center gap-2 sm:gap-3 lg:gap-4", className)}
      role="progressbar"
      aria-label="Approval workflow progress"
      aria-valuenow={approvers.filter((a) => a.status !== "pending").length}
      aria-valuemin={0}
      aria-valuemax={approvers.length}
    >
      {approvers.map((approver, index) => (
        <React.Fragment key={approver.approverId}>
          {/* Approval Stage Circle */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            {/* Stage Indicator */}
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                "transition-all duration-300 font-semibold text-sm",
                "border-2",
                approver.status === "approved"
                  ? "bg-status-success border-status-success text-white"
                  : approver.status === "rejected"
                    ? "bg-status-danger border-status-danger text-white"
                    : "bg-surface-base border-surface-border text-text-muted",
              )}
              title={`${approver.approverName}: ${approver.status}`}
            >
              {approver.status === "approved" ? (
                <CheckCircle className="w-5 h-5" />
              ) : approver.status === "rejected" ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>

            {/* Approver Name (if showLabels) */}
            {showLabels && (
              <span className="text-xs text-center text-text-muted max-w-[60px] truncate">
                {approver.approverName.split(" ")[0]}
              </span>
            )}

            {/* Status Label */}
            <span className="text-xs font-medium text-text-muted capitalize">
              {approver.status}
            </span>
          </div>

          {/* Connector Line (if not last) */}
          {index < approvers.length - 1 && (
            <div
              className={cn(
                "flex-1 h-1 rounded-full transition-colors duration-300",
                approver.status === "approved"
                  ? "bg-status-success"
                  : "bg-surface-border",
              )}
              aria-hidden="true"
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export type { WorkflowStageIndicatorProps };
