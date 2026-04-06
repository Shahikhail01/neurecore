/**
 * ChannelSelector Component
 *
 * Allows users to switch between available chat channels.
 * Responsive: Dropdown on mobile, tabs on desktop.
 *
 * Features:
 * - Badge counts for unread messages
 * - Pinned channel indicators
 * - Channel type icons
 * - Accessible keyboard navigation (arrow keys to select)
 * - Focus management
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { ChatChannel } from "@/types/channels.types";

interface ChannelSelectorProps {
  /**
   * All available channels
   */
  channels: ChatChannel[];

  /**
   * Currently active channel ID
   */
  activeChannelId: string;

  /**
   * Callback when channel selection changes
   */
  onChannelChange: (channelId: string) => void;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ChannelSelector Component
 *
 * Desktop: Dropdown menu showing all channels
 * Mobile: Full-screen modal or bottom sheet
 *
 * @example
 * <ChannelSelector
 *   channels={channelsList}
 *   activeChannelId="ch-1"
 *   onChannelChange={handleChannelSelect}
 * />
 */
export function ChannelSelector({
  channels,
  activeChannelId,
  onChannelChange,
  className,
}: ChannelSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const activeChannel = channels.find((ch) => ch.id === activeChannelId);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleChannelSelect = (channelId: string) => {
    onChannelChange(channelId);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  if (!activeChannel) {
    return null;
  }

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md",
          "text-sm font-medium text-text-primary",
          "bg-surface-base border border-surface-border",
          "hover:border-accent-primary transition-colors duration-base",
          "focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2",
          isOpen && "border-accent-primary",
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title="Change channel"
      >
        <span className="truncate max-w-[120px] hidden sm:inline">
          {activeChannel.name}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform duration-base flex-shrink-0",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-full right-0 mt-1 w-56 z-50",
            "bg-surface-raised border border-surface-border rounded-lg",
            "shadow-lg overflow-hidden",
          )}
          role="listbox"
        >
          {/* Channels grouped by type */}
          {groupChannelsByType(channels).map(({ type, items }) => (
            <div key={type}>
              {/* Group Header */}
              <div className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                {getChannelGroupLabel(type)}
              </div>

              {/* Group Items */}
              {items.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => handleChannelSelect(channel.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 text-sm",
                    "transition-colors duration-base",
                    "focus:outline-none focus:bg-surface-base",
                    activeChannelId === channel.id
                      ? "bg-accent-primary/10 text-accent-primary font-medium"
                      : "text-text-primary hover:bg-surface-base",
                  )}
                  role="option"
                  aria-selected={activeChannelId === channel.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex-1 truncate">{channel.name}</span>

                    {/* Badge */}
                    {channel.unreadCount > 0 && (
                      <span
                        className={cn(
                          "flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold",
                          "bg-status-danger text-white",
                        )}
                      >
                        {channel.unreadCount}
                      </span>
                    )}

                    {/* Pinned indicator */}
                    {channel.isPinned && (
                      <span className="text-accent-primary" title="Pinned">
                        📌
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {channel.description && (
                    <p className="text-xs text-text-muted mt-1 line-clamp-1">
                      {channel.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          ))}

          {/* Empty state */}
          {channels.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-text-muted">No channels available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Group channels by type for organized dropdown
 */
function groupChannelsByType(channels: ChatChannel[]) {
  const groups = channels.reduce(
    (acc, channel) => {
      const existing = acc.find((g) => g.type === channel.type);
      if (existing) {
        existing.items.push(channel);
      } else {
        acc.push({ type: channel.type, items: [channel] });
      }
      return acc;
    },
    [] as Array<{ type: ChatChannel["type"]; items: ChatChannel[] }>,
  );

  // Order by type priority
  const typeOrder: Record<ChatChannel["type"], number> = {
    "all-agents": 1,
    team: 2,
    department: 3,
    direct: 4,
    approvals: 5,
  };

  return groups.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
}

/**
 * Get readable label for channel grouping
 */
function getChannelGroupLabel(type: ChatChannel["type"]): string {
  const labels: Record<ChatChannel["type"], string> = {
    "all-agents": "Broadcast",
    team: "Teams",
    department: "Departments",
    direct: "Direct Messages",
    approvals: "Approvals",
  };
  return labels[type];
}

export type { ChannelSelectorProps };
