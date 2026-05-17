// ─── NotificationService.ts ──────────────────────────────────────────────────
// OCP: New channels added by registering a new INotificationStrategy.
// SRP: Orchestration only — delegates display and storage to strategies.
// DIP: Depends on INotificationStrategy abstractions, not concrete classes.

import type {
  INotificationService,
  INotificationStrategy,
  NotificationPayload,
  NotificationPreferences,
} from '@/core/services/interfaces/INotificationService';
import { NotificationQueue } from '@/core/services/notification/NotificationQueue';
import { toastStrategy } from '@/core/services/notification/strategies/ToastStrategy';
import { inAppStrategy } from '@/core/services/notification/strategies/InAppStrategy';

let _notifCounter = 0;
function genId(): string {
  return `notif_svc_${Date.now()}_${++_notifCounter}`;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  channels: ['in-app'],
};

export class NotificationService implements INotificationService {
  private strategies: INotificationStrategy[];
  private preferences: NotificationPreferences;
  private readonly queue: NotificationQueue;

  constructor(
    strategies: INotificationStrategy[] = [toastStrategy, inAppStrategy],
    preferences: NotificationPreferences = DEFAULT_PREFERENCES,
  ) {
    this.strategies = [...strategies];
    this.preferences = { ...preferences };
    this.queue = new NotificationQueue();
  }

  async notify(
    payload: Omit<NotificationPayload, 'id' | 'timestamp'>,
  ): Promise<void> {
    if (!this._shouldNotify()) return;

    const full: NotificationPayload = {
      ...payload,
      id: genId(),
      timestamp: new Date().toISOString(),
    };

    // Deduplicate via queue
    const accepted = this.queue.enqueue(full);
    if (!accepted) return;

    // Fire all applicable strategies concurrently
    const applicable = this.strategies.filter(
      (s) =>
        this.preferences.channels.includes(s.channel) &&
        s.supports(full.severity),
    );

    await Promise.allSettled(applicable.map((s) => s.send(full)));
  }

  registerStrategy(strategy: INotificationStrategy): void {
    const exists = this.strategies.some((s) => s.channel === strategy.channel);
    if (!exists) {
      this.strategies.push(strategy);
    } else {
      // Replace same-channel strategy — OCP: extend without modifying others
      this.strategies = this.strategies.map((s) =>
        s.channel === strategy.channel ? strategy : s,
      );
    }
  }

  setPreferences(prefs: Partial<NotificationPreferences>): void {
    this.preferences = { ...this.preferences, ...prefs };
  }

  getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private _shouldNotify(): boolean {
    if (!this.preferences.enabled) return false;
    if (this.preferences.muteUntil) {
      const muteUntilMs = new Date(this.preferences.muteUntil).getTime();
      if (Date.now() < muteUntilMs) return false;
    }
    return true;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const notificationService = new NotificationService();
