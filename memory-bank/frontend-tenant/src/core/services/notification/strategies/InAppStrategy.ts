// ─── InAppStrategy.ts ────────────────────────────────────────────────────────
// SRP: Persists notifications to the in-app notification store only.
// LSP: Substitutable for any INotificationStrategy.

import type {
  INotificationStrategy,
  NotificationPayload,
  NotificationSeverity,
} from '@/core/services/interfaces/INotificationService';
import { useNotificationStore } from '@/shared/stores/notificationStore';
import type { NotificationType, NotificationPriority } from '@/shared/types/domain.types';

const SEVERITY_TO_TYPE: Record<NotificationSeverity, NotificationType> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

const SEVERITY_TO_PRIORITY: Record<NotificationSeverity, NotificationPriority> = {
  info: 'info',
  success: 'info',
  warning: 'important',
  error: 'critical',
};

/**
 * Adds the notification to the Zustand notificationStore so the bell icon
 * and notification panel can surface it.
 */
export class InAppStrategy implements INotificationStrategy {
  readonly channel = 'in-app' as const;

  send(payload: NotificationPayload): Promise<void> {
    useNotificationStore.getState().addNotification({
      title: payload.title,
      message: payload.message,
      type: SEVERITY_TO_TYPE[payload.severity],
      priority: SEVERITY_TO_PRIORITY[payload.severity],
      entityId: payload.metadata?.entityId as string | undefined,
      entityType: payload.metadata?.entityType as string | undefined,
    });
    return Promise.resolve();
  }

  supports(_severity: NotificationSeverity): boolean {
    // In-app strategy supports all severities
    return true;
  }
}

export const inAppStrategy = new InAppStrategy();
