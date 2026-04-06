/**
 * Telegram Integration Types - Phase 5
 *
 * Represents Telegram integration for offline notifications.
 * Handles linking, verification, and per-agent notification settings.
 */

/**
 * Telegram Integration State
 *
 * Represents a user's Telegram account linkage
 */
export interface TelegramIntegration {
  /** Integration ID */
  id: string;

  /** Tenant ID */
  tenantId: string;

  /** User ID */
  userId: string;

  /** Telegram chat ID (numeric) */
  telegramChatId: string;

  /** Is integration enabled? */
  enabled: boolean;

  /** Is integration verified? */
  isVerified: boolean;

  /** When created */
  createdAt: Date;

  /** When last verified */
  lastVerifiedAt?: Date;

  /** When last notification sent */
  lastSentAt?: Date;

  /** Notification send count */
  notificationCount?: number;

  /** Username on Telegram (if available) */
  telegramUsername?: string;

  /** First name on Telegram */
  telegramFirstName?: string;
}

/**
 * Per-Agent Telegram Notification Settings
 */
export interface AgentTelegramNotification {
  /** Agent ID */
  agentId: string;

  /** User ID */
  userId: string;

  /** Is notification enabled for this agent? */
  enabled: boolean;

  /** Notification types to send (task_complete, approval_needed, error, etc) */
  notificationTypes?: (
    | "task_complete"
    | "approval_needed"
    | "error"
    | "status_change"
  )[];

  /** When settings were last updated */
  updatedAt: Date;
}

/**
 * Telegram Notification Format
 *
 * Structure of a notification sent to Telegram
 */
export interface TelegramNotification {
  /** Notification ID */
  id: string;

  /** Recipient Telegram chat ID */
  telegramChatId: string;

  /** User ID */
  userId: string;

  /** The actual message text (HTML formatted) */
  message: string;

  /** Optional buttons/actions */
  buttons?: TelegramButton[];

  /** Type of notification */
  type:
    | "task_complete"
    | "approval_needed"
    | "error"
    | "status_change"
    | "custom";

  /** Related entity (e.g., task, approval ID) */
  relatedEntityId?: string;

  /** When sent */
  sentAt: Date;

  /** Whether send was successful */
  success: boolean;

  /** Error message if failed */
  error?: string;
}

/**
 * Telegram Button (for inline keyboards)
 */
export interface TelegramButton {
  /** Button label */
  text: string;

  /** Callback data or URL */
  callbackData?: string;
  url?: string;
}

/**
 * Telegram Store State
 */
export interface TelegramState {
  /** Current integration status */
  integration: TelegramIntegration | null;

  /** Is linked? */
  isLinked: boolean;

  /** Is verified? */
  isVerified: boolean;

  /** Per-agent notification settings */
  agentNotifications: Record<string, AgentTelegramNotification>;

  /** Link flow state */
  linkFlow: {
    step: "initial" | "link" | "verify" | "linked";
    chatId?: string;
    pin?: string;
    error?: string;
  };

  /** Loading/error states */
  isLoading: boolean;
  error: string | null;
}

/**
 * Telegram Store Actions
 */
export interface TelegramActions {
  /** Fetch current integration status */
  fetchIntegrationStatus: () => Promise<void>;

  /** Start linking process (send Telegram link request) */
  linkAccount: (chatId: string) => Promise<void>;

  /** Verify Telegram link with PIN */
  verifyLink: (pin: string) => Promise<void>;

  /** Unlink Telegram account */
  unlinkAccount: () => Promise<void>;

  /** Fetch per-agent notification settings */
  fetchAgentNotifications: () => Promise<void>;

  /** Update notification setting for an agent */
  updateAgentNotificationSetting: (
    agentId: string,
    enabled: boolean,
  ) => Promise<void>;

  /** Update notification types for an agent */
  updateAgentNotificationTypes: (
    agentId: string,
    types: AgentTelegramNotification["notificationTypes"],
  ) => Promise<void>;

  /** Set link flow step */
  setLinkFlowStep: (step: TelegramState["linkFlow"]["step"]) => void;

  /** Set chat ID in link flow */
  setLinkFlowChatId: (chatId: string) => void;

  /** Set PIN in link flow */
  setLinkFlowPin: (pin: string) => void;

  /** Clear error */
  clearError: () => void;

  /** Reset link flow */
  resetLinkFlow: () => void;

  /** Reset all state */
  reset: () => void;
}

/**
 * Combined Telegram Store Type
 */
export type TelegramStore = TelegramState & TelegramActions;
