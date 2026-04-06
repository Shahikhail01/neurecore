/**
 * Agent Status Panel Component
 * 
 * Displays status and metrics for AI agents and autonomous workflows.
 * Shows agent availability, mode (Assist/Copilot/Autopilot), and active tasks.
 * 
 * Features:
 * - Agent availability indicators (online, offline, in-use)
 * - Mode/autonomy level display (Assist, Copilot, Autopilot)
 * - Quick mode switcher
 * - Active task counter
 * - Error/warning indicators
 * - Responsive layout
 * - Light/dark theme support with design tokens
 * - Full accessibility with ARIA labels
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Radio,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Volume2,
} from "lucide-react";

type AgentMode = "assist" | "copilot" | "autopilot";
type AgentStatus = "online" | "offline" | "in-use" | "error";

interface Agent {
  /**
   * Unique agent identifier
   */
  id: string;

  /**
   * Display name
   */
  name: string;

  /**
   * Current operational status
   */
  status: AgentStatus;

  /**
   * Autonomy mode
   */
  mode: AgentMode;

  /**
   * Number of currently active tasks
   */
  activeTasks?: number;

  /**
   * Optional description or specialty
   */
  description?: string;
}

interface AgentStatusPanelProps {
  /**
   * Array of agents to display
   */
  agents: Agent[];

  /**
   * Callback when agent mode is changed
   */
  onModeChange?: (agentId: string, newMode: AgentMode) => void;

  /**
   * Callback when agent is clicked
   */
  onAgentClick?: (agentId: string) => void;

  /**
   * Highlighted/primary agent ID
   */
  primaryAgentId?: string;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Agent Status Panel Component
 * 
 * @example
 * <AgentStatusPanel
 *   agents={[
 *     {
 *       id: "agent-1",
 *       name: "Marketing Agent",
 *       status: "online",
 *       mode: "copilot",
 *       activeTasks: 3
 *     }
 *   ]}
 *   primaryAgentId="agent-1"
 * />
 */
export function AgentStatusPanel({
  agents,
  onModeChange,
  onAgentClick,
  primaryAgentId,
  className,
}: AgentStatusPanelProps) {
  if (agents.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center p-6 rounded-lg",
          "bg-surface-base border border-surface-border",
          className,
        )}
      >
        <p className="text-text-muted text-sm">No agents available</p>
      </div>
    );
  }

  // Separate primary agent from others
  const primary = agents.find((a) => a.id === primaryAgentId) || agents[0];
  const others = agents.filter((a) => a.id !== primary.id);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Primary Agent (Full Card) */}
      <AgentCard
        agent={primary}
        isPrimary
        onModeChange={onModeChange}
        onAgentClick={onAgentClick}
      />

      {/* Secondary Agents (Compact List) */}
      {others.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">
            Other Agents
          </p>
          {others.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isPrimary={false}
              onModeChange={onModeChange}
              onAgentClick={onAgentClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Individual Agent Card Component
 * 
 * Composable sub-component for Single Responsibility Principle
 */
function AgentCard({
  agent,
  isPrimary,
  onModeChange,
  onAgentClick,
}: {
  agent: Agent;
  isPrimary: boolean;
  onModeChange?: (agentId: string, newMode: AgentMode) => void;
  onAgentClick?: (agentId: string) => void;
}) {
  const [modeMenuOpen, setModeMenuOpen] = React.useState(false);
  const { icon: StatusIcon, color: statusColor } = getStatusMeta(agent.status);
  const modes: AgentMode[] = ["assist", "copilot", "autopilot"];

  const handleCardClick = () => {
    onAgentClick?.(agent.id);
  };

  const handleModeSelect = (newMode: AgentMode) => {
    onModeChange?.(agent.id, newMode);
    setModeMenuOpen(false);
  };

  if (isPrimary) {
    return (
      <div
        className={cn(
          "p-6 rounded-lg border",
          "bg-surface-raised border-surface-border",
          "hover:border-accent-primary transition-all duration-base",
          onAgentClick && "cursor-pointer"
        )}
        onClick={handleCardClick}
        role="region"
        aria-label={`${agent.name} agent status`}
      >
        {/* Header with Status */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-1">
            <div className={cn("w-3 h-3 rounded-full", statusColor)} />
            <div>
              <h3 className="font-semibold text-text-primary">
                {agent.name}
              </h3>
              {agent.description && (
                <p className="text-xs text-text-muted mt-1">
                  {agent.description}
                </p>
              )}
            </div>
          </div>
          <StatusIcon className={cn("w-5 h-5 flex-shrink-0", statusColor)} />
        </div>

        {/* Stats Row */}
        {agent.activeTasks !== undefined && (
          <div className="mb-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-text-muted" />
              <span className="text-text-muted">
                {agent.activeTasks} active task{agent.activeTasks !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Mode Selector */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setModeMenuOpen(!modeMenuOpen);
            }}
            className={cn(
              "w-full px-4 py-3 rounded-lg",
              "bg-surface-base border border-surface-border",
              "text-text-primary font-semibold text-sm",
              "hover:border-accent-primary transition-all duration-base",
              "focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2",
              "flex items-center justify-between",
            )}
            aria-label={`Agent mode selector, currently ${agent.mode}`}
            aria-expanded={modeMenuOpen}
            aria-haspopup="listbox"
          >
            <span>Mode: <span className="capitalize">{agent.mode}</span></span>
            <Zap className={cn(
              "w-4 h-4 transition-transform duration-base",
              modeMenuOpen ? "rotate-180" : ""
            )} />
          </button>

          {/* Mode Menu */}
          {modeMenuOpen && (
            <div
              className={cn(
                "absolute top-full left-0 right-0 mt-2 z-10",
                "bg-surface-base border border-surface-border rounded-lg",
                "shadow-lg overflow-hidden",
              )}
              role="listbox"
            >
              {modes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeSelect(mode)}
                  className={cn(
                    "w-full px-4 py-2 text-left text-sm font-medium",
                    "transition-colors duration-base",
                    agent.mode === mode
                      ? "bg-accent-primary text-white"
                      : "bg-surface-base text-text-primary hover:bg-surface-raised",
                    "focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-primary",
                  )}
                  role="option"
                  aria-selected={agent.mode === mode}
                >
                  <div className="flex items-center gap-2">
                    {React.createElement(getModeIcon(mode), { className: "w-4 h-4" })}
                    <span className="capitalize">{mode}</span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {getModeDescription(mode)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Compact Card for Secondary Agents
  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "p-4 rounded-lg border",
        "bg-surface-base border-surface-border",
        "hover:border-accent-primary transition-all duration-base",
        onAgentClick && "cursor-pointer",
        "flex items-center justify-between gap-3",
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      aria-label={`${agent.name} agent, ${agent.status}, mode ${agent.mode}`}
    >
      <div className="flex items-center gap-3 flex-1">
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColor)} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-text-primary truncate">
            {agent.name}
          </p>
          <p className="text-xs text-text-muted">
            <span className="capitalize">{agent.mode}</span>
            {agent.activeTasks !== undefined && ` • ${agent.activeTasks} task${agent.activeTasks !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
      <StatusIcon className={cn("w-4 h-4 flex-shrink-0", statusColor)} />
    </div>
  );
}

/**
 * Get icon and color for status
 */
function getStatusMeta(
  status: AgentStatus,
): { icon: React.ComponentType<any>; color: string } {
  const statusMap = {
    online: { icon: Radio, color: "text-status-success" },
    offline: { icon: Radio, color: "text-text-muted" },
    "in-use": { icon: Zap, color: "text-accent-primary" },
    error: { icon: AlertTriangle, color: "text-status-danger" },
  };

  return statusMap[status];
}

/**
 * Get mode icon
 */
function getModeIcon(mode: AgentMode) {
  const modeIcons = {
    assist: Volume2,
    copilot: Zap,
    autopilot: Radio,
  };
  return modeIcons[mode];
}

/**
 * Get mode description
 */
function getModeDescription(mode: AgentMode): string {
  const descriptions = {
    assist: "AI suggests actions, you decide",
    copilot: "AI works alongside you in real-time",
    autopilot: "AI handles tasks autonomously",
  };
  return descriptions[mode];
}

export type { Agent, AgentStatusPanelProps, AgentMode, AgentStatus };