// ─── ToastStrategy.ts ────────────────────────────────────────────────────────
// OCP: New display channels added as new strategies — no service modification.
// SRP: This strategy only handles toast/browser-visible notification display.

import type {
  INotificationStrategy,
  NotificationPayload,
  NotificationSeverity,
} from '@/core/services/interfaces/INotificationService';

/**
 * Renders an ephemeral toast via a CustomEvent so any mounted ToastContainer
 * can listen — zero coupling to a specific UI library.
 *
 * Usage: window dispatches 'hq:toast' → ToastContainer renders.
 */
export class ToastStrategy implements INotificationStrategy {
  readonly channel = 'in-app' as const;

  private readonly supportedSeverities: NotificationSeverity[] = [
    'info',
    'success',
    'warning',
    'error',
  ];

  send(payload: NotificationPayload): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();

    window.dispatchEvent(
      new CustomEvent<NotificationPayload>('hq:toast', { detail: payload }),
    );
    return Promise.resolve();
  }

  supports(severity: NotificationSeverity): boolean {
    return this.supportedSeverities.includes(severity);
  }
}

export const toastStrategy = new ToastStrategy();
