/**
 * Notification Service Utility
 * Centralized notification system using Ant Design message API
 */

import { message, notification } from "antd";

export type NotificationType = "success" | "info" | "warning" | "error";

/**
 * Show a toast notification (short-lived, centered)
 */
export function showNotification(
  type: NotificationType,
  text: string,
  duration: number = 3,
) {
  const config = {
    duration,
    maxCount: 3, // Don't show more than 3 notifications at once
  };

  switch (type) {
    case "success":
      message.success(text, config);
      break;
    case "error":
      message.error(text, config);
      break;
    case "warning":
      message.warning(text, config);
      break;
    case "info":
      message.info(text, config);
      break;
  }
}

/**
 * Show a persistent notification (top-right corner)
 */
export function showAlert(
  type: NotificationType,
  title: string,
  description?: string,
  duration: number = 4.5,
) {
  const config = {
    message: title,
    duration,
    top: 20,
    right: 20,
  };

  switch (type) {
    case "success":
      notification.success({
        ...config,
        description,
      });
      break;
    case "error":
      notification.error({
        ...config,
        description,
      });
      break;
    case "warning":
      notification.warning({
        ...config,
        description,
      });
      break;
    case "info":
      notification.info({
        ...config,
        description,
      });
      break;
  }
}

/**
 * Shorthand notification methods
 */
export const NotificationService = {
  success: (text: string, duration?: number) =>
    showNotification("success", text, duration),
  error: (text: string, duration?: number) =>
    showNotification("error", text, duration),
  warning: (text: string, duration?: number) =>
    showNotification("warning", text, duration),
  info: (text: string, duration?: number) =>
    showNotification("info", text, duration),

  successAlert: (title: string, description?: string, duration?: number) =>
    showAlert("success", title, description, duration),
  errorAlert: (title: string, description?: string, duration?: number) =>
    showAlert("error", title, description, duration),
  warningAlert: (title: string, description?: string, duration?: number) =>
    showAlert("warning", title, description, duration),
  infoAlert: (title: string, description?: string, duration?: number) =>
    showAlert("info", title, description, duration),

  /**
   * Show loading notification
   */
  loading: (text: string) => {
    return message.loading({
      content: text,
      maxCount: 1,
    });
  },

  /**
   * Close a loading notification
   */
  closeLoading: () => {
    message.destroy();
  },

  /**
   * Clear all notifications
   */
  clearAll: () => {
    message.destroy();
    notification.destroy();
  },
};
