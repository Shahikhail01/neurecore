/**
 * Channel-Based Chat Types for Phase 2
 *
 * Extends the existing chat.types with channel, presence, and multi-agent support.
 * Represents the consolidated chat system for all agent interactions.
 */

import type { ConversationMessage } from "./chat.types";

/**
 * Channel Types
 */
export type ChannelType =
  | "all-agents"
  | "department"
  | "direct"
  | "approvals"
  | "team";
export type AgentStatus = "online" | "offline" | "busy" | "error";

/**
 * Chat Channel Definition
 *
 * Represents a logical grouping of messages (e.g., "All Agents", "Finance Department", "Agent X (Direct)")
 */
export interface ChatChannel {
  /** Unique channel identifier */
  id: string;

  /** Display name for the channel */
  name: string;

  /** Channel type for icon/badge rendering */
  type: ChannelType;

  /** Optional description (shown in tooltip) */
  description?: string;

  /** For department channels: department ID */
  departmentId?: string;

  /** For direct channels: agent ID */
  agentId?: string;

  /** Unread message count */
  unreadCount: number;

  /** Timestamp of last message in channel */
  lastMessageAt?: Date;

  /** Badge content (e.g., "3" for 3 unread messages) */
  badge?: string | number;

  /** Badge variant (default, danger, warning, success) */
  badgeVariant?: "default" | "danger" | "warning" | "success";

  /** Is this channel pinned/favorite? */
  isPinned?: boolean;

  /** Channel permissions for current user */
  canSendMessage: boolean;
  canDeleteMessages?: boolean;
  canManageMembers?: boolean;
}

/**
 * Agent Presence Information
 *
 * Real-time status of an agent in the system
 */
export interface AgentPresence {
  /** Agent ID */
  agentId: string;

  /** Agent name (for display) */
  name: string;

  /** Avatar URL */
  avatar?: string;

  /** Current status */
  status: AgentStatus;

  /** Timestamp of last activity */
  lastActivityAt?: Date;

  /** Current task ID if executing */
  currentTaskId?: string;

  /** Brief description of current activity */
  activityDescription?: string;

  /** Deployment status (active, paused, error) */
  deploymentStatus?: "active" | "paused" | "error";

  /** Error message if status is "error" */
  errorMessage?: string;

  /** Agent role/title (e.g., "Meeting Manager", "Analytics Bot") */
  role?: string;
}

/**
 * Channel Message with Sender Identity and Metadata
 *
 * Enhanced message with sender information, execution metrics, and suggested actions
 */
export interface ChannelMessage extends ConversationMessage {
  /** Who sent the message */
  sender: {
    id: string;
    name: string;
    type: "agent" | "human" | "system";
    avatar?: string;
    role?: string; // e.g., "Meeting Manager"
  };

  /** Channel this message belongs to */
  channelId: string;

  /** Execution metrics for agent messages */
  metrics?: {
    executionTime?: number; // in milliseconds
    tokensUsed?: number;
    cost?: number; // in cents
    toolsCalled?: string[];
  };

  /** Is this message part of a thread? */
  threadId?: string;

  /** Number of replies in thread */
  replyCount?: number;

  /** Reactions (emoji counts) */
  reactions?: Record<string, number>;

  /** Inline suggested actions */
  suggestedActions?: Array<{
    id: string;
    label: string;
    icon?: string;
    action: string;
    params?: Record<string, unknown>;
    requiresApproval?: boolean;
  }>;
}

/**
 * Chat Panel State (for Zustand store)
 */
export interface ChatPanelState {
  /** All available channels */
  channels: ChatChannel[];

  /** Currently selected channel ID */
  activeChannelId: string;

  /** Messages per channel */
  messagesByChannel: Record<string, ChannelMessage[]>;

  /** Presence status for all agents */
  presenceStatus: Record<string, AgentPresence>;

  /** Is chat panel loading? */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;

  /** User's input in message field */
  inputText: string;

  /** Is a message currently being sent? */
  isSending: boolean;

  /** Stream completion percentage (0-100) for streaming messages */
  streamProgress?: number;
}

/**
 * Chat Panel Actions
 */
export interface ChatPanelActions {
  /** Fetch all channels for user */
  fetchChannels: () => Promise<void>;

  /** Select a channel */
  selectChannel: (channelId: string) => Promise<void>;

  /** Fetch messages for active channel */
  fetchMessages: (limit?: number, offset?: number) => Promise<void>;

  /** Send a message */
  sendMessage: (text: string) => Promise<void>;

  /** Update message input */
  setInputText: (text: string) => void;

  /** Mark channel as read */
  markChannelAsRead: (channelId: string) => Promise<void>;

  /** Update agent presence */
  updatePresence: (agentId: string, status: AgentStatus) => void;

  /** Clear error */
  clearError: () => void;
}

/**
 * Suggested Action for Chat Messages
 *
 * Action buttons shown below agent messages (e.g., "Approve", "Schedule", "View Details")
 */
export interface ChatSuggestedAction {
  /** Unique action ID */
  id: string;

  /** Button label */
  label: string;

  /** Icon name from lucide-react (optional) */
  icon?: string;

  /** Action type (determines behavior) */
  actionType: "navigate" | "approve" | "reject" | "inline" | "open-modal";

  /** Action payload (varies by type) */
  payload?: Record<string, unknown>;

  /** Is this action destructive? (red button) */
  isDangerous?: boolean;

  /** Requires confirmation before executing? */
  requiresConfirmation?: boolean;

  /** Confirmation message if needed */
  confirmationMessage?: string;
}

export type { ConversationMessage } from "./chat.types";
