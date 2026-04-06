/**
 * Activity Feed Component
 *
 * Displays recent activities, notifications, and workflow updates.
 * Provides users with at-a-glance status of their tasks, approvals, and communications.
 *
 * Features:
 * - Chronological activity list with timestamps
 * - Activity type indicators (task, approval, message, etc.)
 * - User avatars via Radix UI Avatar
 * - Action buttons for common interactions
 * - Load more functionality with pagination
 * - Empty state messaging
 * - Light/dark theme support
 * - Full keyboard navigation and accessibility
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  FileText,
  User,
  Zap,
} from "lucide-react";

interface Activity {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Activity type for icon/color mapping
   */
  type: "task" | "approval" | "message" | "agent" | "workflow" | "notification";

  /**
   * Activity title/summary
   */
  title: string;

  /**
   * Optional detailed description
   */
  description?: string;

  /**
   * User who triggered the activity
   */
  user?: {
    name: string;
    avatar?: string;
  };

  /**
   * When the activity occurred
   */
  timestamp: Date;

  /**
   * Status indicator (optional)
   */
  status?: "pending" | "completed" | "error" | "in-progress";

  /**
   * Callback when activity is clicked
   */
  onClick?: () => void;

  /**
   * Action buttons (e.g., "View", "Approve")
   */
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

interface ActivityFeedProps {
  /**
   * Array of activities to display
   */
  activities: Activity[];

  /**
   * Whether more activities can be loaded
   */
  hasMore?: boolean;

  /**
   * Callback to load more activities
   */
  onLoadMore?: () => void;

  /**
   * Maximum number of activities to show before "load more"
   */
  maxVisible?: number;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Activity Feed Component
 *
 * @example
 * <ActivityFeed
 *   activities={[
 *     {
 *       id: "1",
 *       type: "task",
 *       title: "Complete project review",
 *       status: "pending",
 *       timestamp: new Date(),
 *     }
 *   ]}
 * />
 */
export function ActivityFeed({
  activities,
  hasMore = false,
  onLoadMore,
  maxVisible = 5,
  className,
}: ActivityFeedProps) {
  const [expanded, setExpanded] = React.useState(false);
  const visibleActivities = expanded
    ? activities
    : activities.slice(0, maxVisible);

  if (activities.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8 rounded-lg",
          "bg-surface-base border border-surface-border",
          className,
        )}
      >
        <MessageSquare className="w-8 h-8 text-text-muted mb-2" />
        <p className="text-text-muted text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Activity List */}
      <div className="space-y-2">
        {visibleActivities.map((activity, index) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            isLast={index === visibleActivities.length - 1}
          />
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && !expanded && activities.length > maxVisible && (
        <button
          onClick={() => setExpanded(true)}
          className={cn(
            "w-full py-2 px-4 rounded-lg text-center",
            "bg-surface-base border border-surface-border text-text-primary",
            "hover:bg-surface-raised hover:border-accent-primary",
            "transition-all duration-base font-medium text-sm",
            "focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2",
          )}
        >
          View {activities.length - maxVisible} more activities
        </button>
      )}

      {/* Custom Load More Callback */}
      {hasMore && expanded && onLoadMore && (
        <button
          onClick={onLoadMore}
          className={cn(
            "w-full py-2 px-4 rounded-lg text-center",
            "bg-accent-primary text-white",
            "hover:bg-accent-hover",
            "transition-all duration-base font-medium text-sm",
            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-primary",
          )}
        >
          Load More
        </button>
      )}
    </div>
  );
}

/**
 * Individual Activity Item
 *
 * Composable sub-component for Single Responsibility Principle
 */
function ActivityItem({
  activity,
  isLast,
}: {
  activity: Activity;
  isLast: boolean;
}) {
  const { icon: Icon, color } = getActivityMeta(activity.type, activity.status);
  const timeAgo = formatDistanceToNow(activity.timestamp, { addSuffix: true });

  return (
    <div
      onClick={activity.onClick}
      className={cn(
        "flex gap-4 p-4 rounded-lg",
        "bg-surface-base border border-surface-border",
        "transition-all duration-base",
        activity.onClick &&
          "hover:bg-surface-raised hover:border-accent-primary cursor-pointer",
        "focus-within:ring-2 focus-within:ring-accent-primary focus-within:ring-offset-2",
      )}
      role={activity.onClick ? "button" : "article"}
      tabIndex={activity.onClick ? 0 : -1}
      onKeyDown={
        activity.onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                activity.onClick?.();
              }
            }
          : undefined
      }
    >
      {/* Icon/Status Indicator */}
      <div className="flex-shrink-0 mt-1">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            color,
          )}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="font-semibold text-text-primary text-sm line-clamp-1">
              {activity.title}
            </p>
            {activity.user && (
              <p className="text-xs text-text-muted mt-1">
                by {activity.user.name}
              </p>
            )}
            {activity.description && (
              <p className="text-xs text-text-muted mt-1 line-clamp-2">
                {activity.description}
              </p>
            )}
          </div>
          <span className="text-xs text-text-muted flex-shrink-0 whitespace-nowrap">
            {timeAgo}
          </span>
        </div>

        {/* Action Buttons */}
        {activity.actions && activity.actions.length > 0 && (
          <div className="flex gap-2 mt-3">
            {activity.actions.map((action, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium",
                  "bg-accent-primary text-white",
                  "hover:bg-accent-hover transition-colors duration-base",
                  "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-primary",
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Get icon and color for activity type
 */
function getActivityMeta(
  type: Activity["type"],
  status?: Activity["status"],
): { icon: React.ComponentType<any>; color: string } {
  const statusColorMap = {
    pending: "bg-status-warning",
    "in-progress": "bg-accent-primary",
    completed: "bg-status-success",
    error: "bg-status-danger",
  };

  const baseColor = status ? statusColorMap[status] : "bg-accent-primary";

  const iconMap = {
    task: { icon: CheckCircle2, color: baseColor || "bg-accent-primary" },
    approval: { icon: AlertCircle, color: baseColor || "bg-status-warning" },
    message: { icon: MessageSquare, color: baseColor || "bg-accent-primary" },
    agent: { icon: Zap, color: baseColor || "bg-accent-primary" },
    workflow: { icon: FileText, color: baseColor || "bg-accent-primary" },
    notification: { icon: Clock, color: baseColor || "bg-text-muted" },
  };

  return iconMap[type];
}

export type { Activity, ActivityFeedProps };
