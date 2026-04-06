/**
 * Telegram Store - Zustand
 *
 * Manages Telegram integration status, linking flow, and per-agent settings.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  TelegramStore,
  TelegramIntegration,
  AgentTelegramNotification,
} from "@/types/telegram.types";

/**
 * Default error message
 */
const DEFAULT_ERROR_MESSAGE =
  "Failed to process Telegram integration. Please try again.";

/**
 * Zustand store for Telegram integration
 *
 * @example
 * const { integration, linkAccount, verifyLink } = useTelegramStore();
 */
export const useTelegramStore = create<TelegramStore>()(
  immer((set, get) => ({
    // State
    integration: null,
    isLinked: false,
    isVerified: false,
    agentNotifications: {},
    linkFlow: {
      step: "initial",
      chatId: undefined,
      pin: undefined,
      error: undefined,
    },
    isLoading: false,
    error: null,

    // Actions

    /**
     * Fetch current integration status
     */
    fetchIntegrationStatus: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // TODO: Replace with actual API call
        // const response = await fetch('/api/v1/integrations/telegram/status');
        // const integration = await response.json();

        // Mock: No integration by default
        set((state) => {
          state.integration = null;
          state.isLinked = false;
          state.isVerified = false;
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Link Telegram account (step 1: send link request)
     */
    linkAccount: async (chatId: string) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
        state.linkFlow.chatId = chatId;
      });

      try {
        // TODO: Replace with actual API call
        // const response = await fetch('/api/v1/integrations/telegram/link', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ chatId }),
        // });

        // Mock: Simulate sending PIN to Telegram
        console.log(`[MOCK] PIN sent to Telegram chat ${chatId}`);

        set((state) => {
          state.linkFlow.step = "verify";
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = DEFAULT_ERROR_MESSAGE;
          state.linkFlow.error = DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Verify Telegram link (step 2: submit PIN)
     */
    verifyLink: async (pin: string) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
        state.linkFlow.pin = pin;
      });

      try {
        // TODO: Replace with actual API call
        // const response = await fetch('/api/v1/integrations/telegram/verify', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ pin }),
        // });
        // const integration = await response.json();

        // Mock: Accept PIN "123456"
        if (pin !== "123456") {
          throw new Error("Invalid PIN. Please try again.");
        }

        const mockIntegration: TelegramIntegration = {
          id: "tg-int-1",
          tenantId: "tenant-1",
          userId: "user-1",
          telegramChatId: get().linkFlow.chatId || "",
          enabled: true,
          isVerified: true,
          createdAt: new Date(),
          lastVerifiedAt: new Date(),
          telegramUsername: "user_handle",
          telegramFirstName: "John",
        };

        set((state) => {
          state.integration = mockIntegration;
          state.isLinked = true;
          state.isVerified = true;
          state.linkFlow.step = "linked";
          state.linkFlow.error = undefined;
          state.isLoading = false;
          // Fetch agent settings after linking
        });

        // Fetch agent notification settings
        await get().fetchAgentNotifications();
      } catch (error) {
        set((state) => {
          state.error = (error as Error).message || DEFAULT_ERROR_MESSAGE;
          state.linkFlow.error =
            (error as Error).message || DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Unlink Telegram account
     */
    unlinkAccount: async () => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // TODO: Replace with actual API call
        // await fetch('/api/v1/integrations/telegram', {
        //   method: 'DELETE',
        // });

        set((state) => {
          state.integration = null;
          state.isLinked = false;
          state.isVerified = false;
          state.agentNotifications = {};
          state.linkFlow = {
            step: "initial",
            chatId: undefined,
            pin: undefined,
            error: undefined,
          };
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Fetch per-agent notification settings
     */
    fetchAgentNotifications: async () => {
      if (!get().isLinked) return;

      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // TODO: Replace with actual API call
        // const response = await fetch('/api/v1/integrations/telegram/agent-settings');
        // const settings = await response.json();

        // Mock: Generate settings for 5 agents
        const mockSettings: Record<string, AgentTelegramNotification> = {
          "agent-1": {
            agentId: "agent-1",
            userId: "user-1",
            enabled: true,
            notificationTypes: ["task_complete", "approval_needed"],
            updatedAt: new Date(),
          },
          "agent-2": {
            agentId: "agent-2",
            userId: "user-1",
            enabled: true,
            notificationTypes: ["task_complete", "error"],
            updatedAt: new Date(),
          },
          "agent-3": {
            agentId: "agent-3",
            userId: "user-1",
            enabled: false,
            notificationTypes: [],
            updatedAt: new Date(),
          },
        };

        set((state) => {
          state.agentNotifications = mockSettings;
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Update notification setting for an agent
     */
    updateAgentNotificationSetting: async (
      agentId: string,
      enabled: boolean,
    ) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // TODO: Replace with actual API call
        // await fetch(
        //   `/api/v1/integrations/telegram/agent-settings/${agentId}`,
        //   {
        //     method: 'PATCH',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ enabled }),
        //   }
        // );

        set((state) => {
          if (state.agentNotifications[agentId]) {
            state.agentNotifications[agentId].enabled = enabled;
            state.agentNotifications[agentId].updatedAt = new Date();
          }
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Update notification types for an agent
     */
    updateAgentNotificationTypes: async (agentId: string, types) => {
      set((state) => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        // TODO: Replace with actual API call

        set((state) => {
          if (state.agentNotifications[agentId]) {
            state.agentNotifications[agentId].notificationTypes = types;
            state.agentNotifications[agentId].updatedAt = new Date();
          }
          state.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = DEFAULT_ERROR_MESSAGE;
          state.isLoading = false;
        });
      }
    },

    /**
     * Set link flow step
     */
    setLinkFlowStep: (step) => {
      set((state) => {
        state.linkFlow.step = step;
      });
    },

    /**
     * Set chat ID in link flow
     */
    setLinkFlowChatId: (chatId) => {
      set((state) => {
        state.linkFlow.chatId = chatId;
      });
    },

    /**
     * Set PIN in link flow
     */
    setLinkFlowPin: (pin) => {
      set((state) => {
        state.linkFlow.pin = pin;
      });
    },

    /**
     * Clear error
     */
    clearError: () => {
      set((state) => {
        state.error = null;
        state.linkFlow.error = undefined;
      });
    },

    /**
     * Reset link flow
     */
    resetLinkFlow: () => {
      set((state) => {
        state.linkFlow = {
          step: "initial",
          chatId: undefined,
          pin: undefined,
          error: undefined,
        };
      });
    },

    /**
     * Reset all state
     */
    reset: () => {
      set((state) => {
        state.integration = null;
        state.isLinked = false;
        state.isVerified = false;
        state.agentNotifications = {};
        state.linkFlow = {
          step: "initial",
          chatId: undefined,
          pin: undefined,
          error: undefined,
        };
        state.isLoading = false;
        state.error = null;
      });
    },
  })),
);

/**
 * Selectors for common use cases
 */
export const telegramSelectors = {
  /**
   * Check if Telegram is linked and verified
   */
  isReady: () => {
    const state = useTelegramStore.getState();
    return state.isLinked && state.isVerified;
  },

  /**
   * Get enabled agent count
   */
  getEnabledAgentCount: () => {
    const state = useTelegramStore.getState();
    return Object.values(state.agentNotifications).filter((s) => s.enabled)
      .length;
  },

  /**
   * Subscribe to integration status changes
   */
  subscribeToStatus: (
    callback: (isLinked: boolean, isVerified: boolean) => void,
  ) => {
    return (useTelegramStore.subscribe as any)(
      (state: any) => ({
        isLinked: state.isLinked,
        isVerified: state.isVerified,
      }),
      (status: any) => {
        callback(status.isLinked, status.isVerified);
      },
    );
  },
};
