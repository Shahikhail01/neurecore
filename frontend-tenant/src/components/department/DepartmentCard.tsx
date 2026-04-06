/**
 * DepartmentCard Component - Phase 3
 *
 * Brief overview card for departments used in lists and grid displays.
 * Shows department name, head agent, task count, and budget utilization.
 *
 * Features:
 * - Head agent avatar badge
 * - Task count indicator
 * - Unread message badge
 * - Budget utilization progress bar
 * - Hover effects
 * - Active/selected state
 * - Status indicator (active/paused/archived)
 * - Responsive layout (horizontal card)
 * - WCAG AA accessibility
 * - Light/dark theme via design tokens
 *
 * Usage:
 * Used in grid layouts, lists, and preview panels
 * when showing multiple departments at once
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, PauseCircle, AlertCircle } from "lucide-react";
import type { DepartmentWithDetails } from "@/types/department.types";

interface DepartmentCardProps {
  /**
   * Department to display
   */
  department: DepartmentWithDetails;

  /**
   * Whether this card is selected/active
   */
  isActive?: boolean;

  /**
   * Callback when card is clicked
   */
  onSelect: (departmentId: string) => void;

  /**
   * Callback for view details action
   */
  onViewDetails?: (departmentId: string) => void;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show/hide budget bar
   */
  showBudget?: boolean;

  /**
   * Show/hide agent info
   */
  showAgent?: boolean;
}

/**
 * DepartmentCard Component
 *
 * Horizontal card layout with department overview.
 * Intended for grid displays or list items.
 *
 * @example
 * <DepartmentCard
 *   department={dept}
 *   isActive={selectedId === dept.id}
 *   onSelect={handleSelect}
 *   showBudget
 *   showAgent
 * />
 */
export function DepartmentCard({
  department,
  isActive = false,
  onSelect,
  onViewDetails,
  className,
  showBudget = true,
  showAgent = true,
}: DepartmentCardProps) {
  const budgetPercentage = department.budget
    ? ((department.currentSpend || 0) / department.budget) * 100
    : 0;

  const statusConfig = {
    active: {
      icon: CheckCircle,
      color: "text-status-success",
      bgColor: "bg-status-success/10",
      label: "Active",
    },
    paused: {
      icon: PauseCircle,
      color: "text-status-warning",
      bgColor: "bg-status-warning/10",
      label: "Paused",
    },
    archived: {
      icon: AlertCircle,
      color: "text-text-muted",
      bgColor: "bg-surface-overlay",
      label: "Archived",
    },
  };

  const status = department.status || "active";
  const statusConfig_ = statusConfig[status as keyof typeof statusConfig];
  const StatusIcon = statusConfig_.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        "transition-all duration-base cursor-pointer",
        isActive
          ? "border-accent-primary bg-accent-primary/5 shadow-md"
          : "border-surface-border bg-surface-base hover:bg-surface-raised hover:border-surface-border/75",
        "focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-accent-primary",
        className,
      )}
      onClick={() => onSelect(department.id)}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={`Department: ${department.name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(department.id);
        }
      }}
    >
      {/* Left Section: Department Info */}
      <div className="flex-1 min-w-0">
        {/* Header with name and status */}
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                "text-sm font-semibold text-text-primary truncate",
                isActive && "text-accent-700 dark:text-accent-300",
              )}
            >
              {department.name}
            </h3>
            {department.description && (
              <p className="text-xs text-text-muted truncate mt-0.5">
                {department.description}
              </p>
            )}
          </div>
          <StatusIcon
            className={cn("w-4 h-4 flex-shrink-0", statusConfig_.color)}
          />
        </div>

        {/* Metrics Row */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Agent Count */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-text-muted">
              {department.agentCount || 0}
            </span>
            <span className="text-xs text-text-muted">
              {department.agentCount === 1 ? "agent" : "agents"}
            </span>
          </div>

          {/* Task Count */}
          {department.taskCount !== undefined && department.taskCount > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
              <span className="text-xs font-medium text-accent-primary">
                {department.taskCount} task
                {department.taskCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Unread Badge */}
          {department.unreadCount !== undefined &&
            department.unreadCount > 0 && (
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-status-danger" />
                <span className="text-xs font-medium text-status-danger">
                  {department.unreadCount} unread
                </span>
              </div>
            )}
        </div>

        {/* Budget Progress Bar */}
        {showBudget && department.budget && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-text-muted">
                Budget: ${department.currentSpend?.toFixed(0) || 0} / $
                {department.budget.toFixed(0)}
              </span>
              <span className="text-xs font-semibold text-text-primary">
                {Math.round(budgetPercentage)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-surface-overlay rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  budgetPercentage > 90
                    ? "bg-status-danger"
                    : budgetPercentage > 70
                      ? "bg-status-warning"
                      : "bg-status-success",
                )}
                style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                role="progressbar"
                aria-valuenow={Math.round(budgetPercentage)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}
      </div>

      {/* Right Section: Agent Avatar (if available) */}
      {showAgent && department.headAgent && (
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              "text-xs font-semibold text-white",
              "bg-accent-primary",
              "border border-surface-border",
            )}
            title={`Head Agent: ${department.headAgent.name}`}
          >
            {department.headAgent.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <span className="text-xs text-text-muted text-center truncate max-w-[60px]">
            {department.headAgent.name?.split(" ")[0] || "Agent"}
          </span>
        </div>
      )}

      {/* Action Button (Details) */}
      {onViewDetails && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(department.id);
          }}
          className={cn(
            "px-2 py-1 text-xs font-medium rounded",
            "text-accent-primary border border-accent-primary/30",
            "hover:bg-accent-primary/10 hover:border-accent-primary/50",
            "transition-colors duration-base",
            "focus:outline-none focus:ring-2 focus:ring-accent-primary",
          )}
          aria-label={`View details for ${department.name}`}
        >
          View
        </button>
      )}
    </div>
  );
}

export type { DepartmentCardProps };
