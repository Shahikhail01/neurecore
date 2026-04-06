/**
 * Feature Flags Configuration - Phase 7
 *
 * Centralized feature flag management for rollout and testing.
 * Supports environment-based and tenant-based feature toggling.
 *
 * Integration with LaunchDarkly, Unleash, or similar services.
 */

/**
 * Feature flag definitions
 */
export const FEATURE_FLAGS = {
  // Analytics & Dashboards (Phase 6)
  ANALYTICS_DASHBOARD: "analytics-dashboard",
  COST_ANALYTICS: "cost-analytics",
  ADVANCED_FILTERING: "advanced-filtering",
  EXPORT_REPORTS: "export-reports",

  // Approvals & Workflow (Phase 4)
  APPROVAL_WORKFLOW: "approval-workflow",
  BULK_APPROVALS: "bulk-approvals",
  APPROVAL_COMMENTS: "approval-comments",

  // Telegram Integration (Phase 5)
  TELEGRAM_INTEGRATION: "telegram-integration",
  TELEGRAM_NOTIFICATIONS: "telegram-notifications",
  TELEGRAM_OFFLINE_MODE: "telegram-offline-mode",

  // Chat & Communication
  MULTI_CHANNEL_CHAT: "multi-channel-chat",
  CHAT_CHANNELS: "chat-channels",
  MESSAGE_THREADS: "message-threads",

  // Departments
  DEPARTMENT_MANAGEMENT: "department-management",
  DEPARTMENT_BUDGET_TRACKING: "department-budget-tracking",

  // UI/UX Polish (Phase 7)
  NEW_UI_LAYOUT: "new-ui-layout",
  DARK_MODE: "dark-mode",
  SMOOTH_ANIMATIONS: "smooth-animations",
  ADVANCED_FILTERS: "advanced-filters",

  // Experimental
  AI_POWERED_INSIGHTS: "ai-powered-insights",
  PREDICTIVE_ANALYTICS: "predictive-analytics",
} as const;

/**
 * Feature flag type
 */
export type FeatureFlag = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/**
 * Feature flag context (tenant, user, session data)
 */
export interface FeatureFlagContext {
  /** Tenant ID */
  tenantId?: string;
  /** User ID */
  userId?: string;
  /** User email */
  userEmail?: string;
  /** Is user admin? */
  isAdmin?: boolean;
  /** Custom attributes */
  custom?: Record<string, unknown>;
}

/**
 * Feature flag service interface
 * Implement this with LaunchDarkly, Unleash, or custom service
 */
export interface IFeatureFlagService {
  /**
   * Check if a feature is enabled
   */
  isEnabled(flag: FeatureFlag, context?: FeatureFlagContext): Promise<boolean>;

  /**
   * Get feature flag value (variation)
   */
  getVariation<T>(
    flag: FeatureFlag,
    context?: FeatureFlagContext,
    defaultValue?: T,
  ): Promise<T | undefined>;

  /**
   * Get all flags for context
   */
  getAllFlags(context?: FeatureFlagContext): Promise<Record<string, boolean>>;

  /**
   * Track an event
   */
  trackEvent(eventName: string, data?: Record<string, unknown>): Promise<void>;
}

/**
 * Mock feature flag service for development
 */
export class MockFeatureFlagService implements IFeatureFlagService {
  private flags: Record<FeatureFlag, boolean> = {
    [FEATURE_FLAGS.ANALYTICS_DASHBOARD]: true,
    [FEATURE_FLAGS.COST_ANALYTICS]: true,
    [FEATURE_FLAGS.ADVANCED_FILTERING]: true,
    [FEATURE_FLAGS.EXPORT_REPORTS]: true,
    [FEATURE_FLAGS.APPROVAL_WORKFLOW]: true,
    [FEATURE_FLAGS.BULK_APPROVALS]: true,
    [FEATURE_FLAGS.APPROVAL_COMMENTS]: true,
    [FEATURE_FLAGS.TELEGRAM_INTEGRATION]: true,
    [FEATURE_FLAGS.TELEGRAM_NOTIFICATIONS]: true,
    [FEATURE_FLAGS.TELEGRAM_OFFLINE_MODE]: true,
    [FEATURE_FLAGS.MULTI_CHANNEL_CHAT]: true,
    [FEATURE_FLAGS.CHAT_CHANNELS]: true,
    [FEATURE_FLAGS.MESSAGE_THREADS]: false, // Not implemented yet
    [FEATURE_FLAGS.DEPARTMENT_MANAGEMENT]: true,
    [FEATURE_FLAGS.DEPARTMENT_BUDGET_TRACKING]: true,
    [FEATURE_FLAGS.NEW_UI_LAYOUT]: true,
    [FEATURE_FLAGS.DARK_MODE]: true,
    [FEATURE_FLAGS.SMOOTH_ANIMATIONS]: true,
    [FEATURE_FLAGS.ADVANCED_FILTERS]: true,
    [FEATURE_FLAGS.AI_POWERED_INSIGHTS]: false, // Future
    [FEATURE_FLAGS.PREDICTIVE_ANALYTICS]: false, // Future
  };

  async isEnabled(flag: FeatureFlag): Promise<boolean> {
    return this.flags[flag] ?? false;
  }

  async getVariation<T>(
    flag: FeatureFlag,
    context?: FeatureFlagContext,
    defaultValue?: T,
  ): Promise<T | undefined> {
    // For mock service, just return the boolean flag as-is
    // In production, variations would return different values
    return (this.flags[flag] as T) ?? defaultValue;
  }

  async getAllFlags(): Promise<Record<string, boolean>> {
    return { ...this.flags };
  }

  async trackEvent(): Promise<void> {
    // No-op for mock
  }

  /**
   * Set flag for testing (dev only)
   */
  setFlag(flag: FeatureFlag, enabled: boolean): void {
    this.flags[flag] = enabled;
  }
}

/**
 * Global feature flag service instance
 */
let featureFlagService: IFeatureFlagService = new MockFeatureFlagService();

/**
 * Initialize feature flag service
 * Call this in app initialization
 */
export function initializeFeatureFlags(service: IFeatureFlagService): void {
  featureFlagService = service;
}

/**
 * Get the feature flag service
 */
export function getFeatureFlagService(): IFeatureFlagService {
  return featureFlagService;
}

/**
 * Default rollout plan for Phase 6-7 features
 */
export const ROLLOUT_PLAN = {
  "Week 1": {
    percentage: 10,
    audience: "early-adopters",
    features: [FEATURE_FLAGS.ANALYTICS_DASHBOARD, FEATURE_FLAGS.COST_ANALYTICS],
  },
  "Week 2": {
    percentage: 50,
    audience: "premium-tenants",
    features: [
      FEATURE_FLAGS.ANALYTICS_DASHBOARD,
      FEATURE_FLAGS.COST_ANALYTICS,
      FEATURE_FLAGS.ADVANCED_FILTERING,
    ],
  },
  "Week 3": {
    percentage: 100,
    audience: "all-tenants",
    features: [
      FEATURE_FLAGS.ANALYTICS_DASHBOARD,
      FEATURE_FLAGS.COST_ANALYTICS,
      FEATURE_FLAGS.ADVANCED_FILTERING,
      FEATURE_FLAGS.EXPORT_REPORTS,
      FEATURE_FLAGS.NEW_UI_LAYOUT,
      FEATURE_FLAGS.SMOOTH_ANIMATIONS,
    ],
  },
} as const;
