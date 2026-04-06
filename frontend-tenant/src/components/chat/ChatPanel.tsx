/**
 * ChatPanel Component - Phase 2
 *
 * Consolidated chat interface for NeureCore with multi-channel support.
 * Combines desktop (right sidebar), tablet (bottom sheet), and mobile (full-screen modal) layouts.
 *
 * Features:
 * - Multi-channel support (All Agents, Departments, Direct, Approvals)
 * - Real-time presence indicators (online/offline/busy/error)
 * - Streaming message support with animated indicators
 * - Agent identity display with avatars, roles, and execution metadata
 * - Suggested actions and inline content (tables, charts, metrics)
 * - Message pagination and infinite scroll
 * - Full keyboard navigation and accessibility
 * - WCAG AA compliant color contrast
 * - Light/dark theme support via design tokens
 *
 * Architecture:
 * - Composable sub-components: ChannelSelector, MessageList, MessageInput
 * - Uses Zustand for state management (channels, messages, presence)
 * - WebSocket integration for real-time updates (future phase)
 * - Follows SOLID principles (Single Responsibility per component)
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  ChevronDown,
  Send,
  AlertCircle,
  Radio,
  Zap,
} from "lucide-react";
import type {
  ChatChannel,
  ChannelMessage,
  AgentPresence,
  ChatSuggestedAction,
} from "@/types/channels.types";
import { ChannelSelector } from "./ChannelSelector";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";

interface ChatPanelProps {
  /**
   * Available channels
   */
  channels: ChatChannel[];

  /**
   * Currently selected channel
   */
  activeChannel: ChatChannel;

  /**
   * Messages in active channel
   */
  messages: ChannelMessage[];

  /**
   * Agent presence data
   */
  presenceStatus: Record<string, AgentPresence>;

  /**
   * Is chat loading?
   */
  isLoading?: boolean;

  /**
   * Error message if any
   */
  error?: string | null;

  /**
   * Callback when channel changes
   */
  onChannelChange: (channelId: string) => void;

  /**
   * Callback when message is sent
   */
  onSendMessage: (text: string) => void;

  /**
   * Callback when action is clicked
   */
  onActionClick?: (action: ChatSuggestedAction) => void;

  /**
   * Is message currently sending?
   */
  isSending?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ChatPanel Component
 *
 * Main chat interface with channels, messages, and sender presence.
 *
 * @example
 * <ChatPanel
 *   channels={channels}
 *   activeChannel={currentChannel}
 *   messages={messages}
 *   presenceStatus={presenceData}
 *   onChannelChange={handleChannelChange}
 *   onSendMessage={handleSendMessage}
 * />
 */
export function ChatPanel({
  channels,
  activeChannel,
  messages,
  presenceStatus,
  isLoading = false,
  error = null,
  onChannelChange,
  onSendMessage,
  onActionClick,
  isSending = false,
  className,
}: ChatPanelProps) {
  const [inputText, setInputText] = React.useState("");
  const messageListRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message when messages change
  React.useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = React.useCallback(() => {
    if (inputText.trim() && !isSending) {
      onSendMessage(inputText.trim());
      setInputText("");
    }
  }, [inputText, isSending, onSendMessage]);

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-surface-base border-l border-surface-border",
        className,
      )}
      role="region"
      aria-label="Chat panel"
    >
      {/* Channel Info Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 border-b border-surface-border",
          "bg-surface-raised",
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Channel Icon */}
          <ChannelIcon type={activeChannel.type} />

          {/* Channel Name & Description */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-primary truncate text-sm md:text-base">
              {activeChannel.name}
            </h3>
            {activeChannel.description && (
              <p className="text-xs text-text-muted truncate">
                {activeChannel.description}
              </p>
            )}
          </div>
        </div>

        {/* Channel Selector Dropdown */}
        <ChannelSelector
          channels={channels}
          activeChannelId={activeChannel.id}
          onChannelChange={onChannelChange}
        />
      </div>

      {/* Error Alert */}
      {error && (
        <div
          className={cn(
            "mx-3 mt-3 px-3 py-2 rounded-md",
            "bg-status-danger/10 border border-status-danger/30",
            "flex items-start gap-2",
          )}
          role="alert"
        >
          <AlertCircle className="w-4 h-4 text-status-danger flex-shrink-0 mt-0.5" />
          <p className="text-xs text-status-danger">{error}</p>
        </div>
      )}

      {/* Message List */}
      <MessageList
        ref={messageListRef}
        messages={messages}
        presenceStatus={presenceStatus}
        isLoading={isLoading}
        onActionClick={onActionClick}
        className="flex-1 overflow-y-auto"
      />

      {/* Message Input */}
      {activeChannel.canSendMessage && (
        <MessageInput
          value={inputText}
          onChange={setInputText}
          onSubmit={handleSendMessage}
          isLoading={isLoading}
          isSending={isSending}
          placeholder={`Message ${activeChannel.name}...`}
          channelType={activeChannel.type}
          className="border-t border-surface-border"
        />
      )}
    </div>
  );
}

/**
 * Get icon component for channel type
 */
function ChannelIcon({ type }: { type: ChatChannel["type"] }) {
  const iconProps = "w-4 h-4 text-text-primary";

  switch (type) {
    case "all-agents":
      return <Radio className={iconProps} />;
    case "department":
      return <Zap className={iconProps} />;
    case "direct":
      return <MessageCircle className={iconProps} />;
    case "approvals":
      return <AlertCircle className={iconProps} />;
    case "team":
      return <MessageCircle className={cn(iconProps, "text-accent-primary")} />;
    default:
      return <MessageCircle className={iconProps} />;
  }
}

export type { ChatPanelProps };
