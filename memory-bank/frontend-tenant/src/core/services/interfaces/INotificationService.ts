// ─── INotificationService.ts ─────────────────────────────────────────────────
// Strategy pattern: each channel (in-app, email, socket) registers a strategy.

export type NotificationChannel = 'in-app' | 'email' | 'socket';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface NotificationPayload {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  channel: NotificationChannel;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface NotificationPreferences {
  enabled: boolean;
  channels: NotificationChannel[];
  muteUntil?: string;            // ISO date string
}

/** OCP: add new channels without modifying the service. */
export interface INotificationStrategy {
  readonly channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<void>;
  supports(severity: NotificationSeverity): boolean;
}

export interface INotificationService {
  notify(payload: Omit<NotificationPayload, 'id' | 'timestamp'>): Promise<void>;
  registerStrategy(strategy: INotificationStrategy): void;
  setPreferences(prefs: Partial<NotificationPreferences>): void;
  getPreferences(): NotificationPreferences;
}
