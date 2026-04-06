/**
 * Telegram Agent Notification Toggle - Phase 5
 *
 * Per-agent notification settings with type toggles.
 * Allows users to enable/disable notifications for specific agents
 * and choose which notification types to receive.
 *
 * Notification Types:
 * - task_complete: Task completion notifications
 * - approval_needed: Approval request notifications
 * - error: Error and failure notifications
 * - status_change: Agent status change notifications
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Bell } from "lucide-react";
import { useTelegramStore } from "@/stores/telegramStore";

interface TelegramAgentNotificationToggleProps {
  /**
   * Agent ID
   */
  agentId: string;

  /**
   * Agent display name
   */
  agentName: string;

  /**
   * Optional custom icon/avatar
   */
  icon?: React.ReactNode;

  /**
   * Optional callback when settings change
   */
  onChange?: (agentId: string, enabled: boolean, types: string[]) => void;
}

/**
 * Telegram Agent Notification Toggle Component
 *
 * Manages per-agent notification settings with granular control
 * over notification types (tasks, approvals, errors, status changes).
 *
 * Features:
 * - Enable/disable notifications per agent
 * - Toggle individual notification types
 * - Persistent settings via Zustand
 * - Expandable detail view
 *
 * @example
 * <TelegramAgentNotificationToggle
 *   agentId="agent-1"
 *   agentName="Marketing Agent"
 *   onChange={handleSettingsChange}
 * />
 */
export function TelegramAgentNotificationToggle({
  agentId,
  agentName,
  icon,
  onChange,
}: TelegramAgentNotificationToggleProps) {
  const {
    agentNotifications,
    updateAgentNotificationSetting,
    updateAgentNotificationTypes,
  } = useTelegramStore();

  const [isExpanded, setIsExpanded] = React.useState(false);

  const agentSettings = agentNotifications[agentId] || {
    agentId,
    enabled: true,
    notificationTypes: ["task_complete", "approval_needed", "error"],
  };

  const notificationTypeOptions = [
    {
      key: "task_complete",
      label: "Task Completed",
      description: "When tasks complete successfully",
    },
    {
      key: "approval_needed",
      label: "Approval Needed",
      description: "When approval is required",
    },
    {
      key: "error",
      label: "Errors",
      description: "When errors occur",
    },
    {
      key: "status_change",
      label: "Status Changes",
      description: "When agent status changes",
    },
  ];

  const handleToggleEnabled = async () => {
    const newEnabled = !agentSettings.enabled;
    await updateAgentNotificationSetting(agentId, newEnabled);
    onChange?.(agentId, newEnabled, agentSettings.notificationTypes || []);
  };

  const handleToggleType = async (typeKey: string) => {
    const currentTypes = agentSettings.notificationTypes || [];
    const newTypes = currentTypes.includes(
      typeKey as
        | "error"
        | "task_complete"
        | "approval_needed"
        | "status_change",
    )
      ? currentTypes.filter((t) => t !== typeKey)
      : [...currentTypes, typeKey];
    await updateAgentNotificationTypes(
      agentId,
      newTypes as (
        | "error"
        | "task_complete"
        | "approval_needed"
        | "status_change"
      )[],
    );
    onChange?.(agentId, agentSettings.enabled, newTypes);
  };

  return (
    <div className="rounded-lg border border-surface-border bg-surface-base">
      {/* Header / Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full px-4 py-3 flex items-center justify-between gap-3",
          "hover:bg-surface-overlay transition-colors duration-base",
          isExpanded && "border-b border-surface-border",
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Icon */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center">
            {icon ? icon : <Bell className="w-4 h-4 text-accent-primary" />}
          </div>

          {/* Agent Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">
              {agentName}
            </p>
            <p className="text-xs text-text-muted truncate">
              {agentSettings.enabled ? (
                <span className="text-status-success">● Notifications on</span>
              ) : (
                <span className="text-text-muted">● Notifications off</span>
              )}
            </p>
          </div>
        </div>

        {/* Main Toggle Switch */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggleEnabled();
          }}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full",
            "transition-colors duration-base flex-shrink-0",
            agentSettings.enabled ? "bg-status-success" : "bg-surface-border",
          )}
          role="switch"
          aria-checked={agentSettings.enabled}
          aria-label={`Toggle notifications for ${agentName}`}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 rounded-full bg-white",
              "transition-transform duration-base",
              agentSettings.enabled ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>

        {/* Expand Indicator */}
        <ChevronDown
          className={cn(
            "w-4 h-4 text-text-muted flex-shrink-0",
            "transition-transform duration-base",
            isExpanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded Content - Notification Type Toggles */}
      {isExpanded && (
        <div className="px-4 py-3 space-y-2 bg-surface-overlay/50">
          {/* Info text */}
          <p className="text-xs text-text-muted mb-3">
            Choose which types of notifications to receive:
          </p>

          {/* Type Toggles */}
          <div className="space-y-2">
            {notificationTypeOptions.map(({ key, label, description }) => (
              <button
                key={key}
                onClick={() => handleToggleType(key)}
                disabled={!agentSettings.enabled}
                className={cn(
                  "w-full flex items-start gap-3 p-2 rounded-lg",
                  "transition-colors duration-base",
                  "hover:bg-surface-base disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {/* Checkbox */}
                <div
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                    "transition-colors duration-base",
                    agentSettings.notificationTypes?.includes(
                      key as
                        | "error"
                        | "task_complete"
                        | "approval_needed"
                        | "status_change",
                    )
                      ? "bg-accent-primary border-accent-primary"
                      : "border-surface-border",
                  )}
                >
                  {agentSettings.notificationTypes?.includes(
                    key as
                      | "error"
                      | "task_complete"
                      | "approval_needed"
                      | "status_change",
                  ) && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>

                {/* Label & Description */}
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {label}
                  </p>
                  <p className="text-xs text-text-muted">{description}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Empty State Message */}
          {!agentSettings.enabled && (
            <div className="p-2 rounded-lg bg-surface-base border border-surface-border">
              <p className="text-xs text-text-muted text-center">
                Enable notifications to manage notification types
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type { TelegramAgentNotificationToggleProps };
