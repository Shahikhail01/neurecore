// ─── VoiceAnalyticsLogger.ts ──────────────────────────────────────────────────
// SRP: Voice analytics event collection and session management.
// OCP: New event types added to IVoiceAnalyticsLogger, no class modification needed.
// DIP: Consumers depend on IVoiceAnalyticsLogger abstraction.

import type {
  IVoiceAnalyticsLogger,
  VoiceAnalyticsEvent,
  VoiceSessionSummary,
  VoiceEventType,
} from './interfaces/IVoiceAnalyticsLogger';

let _sessionCounter = 0;

function genSessionId(): string {
  return `voice_session_${Date.now()}_${++_sessionCounter}`;
}

export class VoiceAnalyticsLogger implements IVoiceAnalyticsLogger {
  private currentSessionId: string | null = null;
  private sessionStartMs:   number       = 0;
  private events:           VoiceAnalyticsEvent[] = [];
  private sessions:         VoiceSessionSummary[] = [];

  // ─── IVoiceAnalyticsLogger ───────────────────────────────────────────────

  log(event: Omit<VoiceAnalyticsEvent, 'timestamp' | 'sessionId'>): void {
    if (!this.currentSessionId) this.startSession();

    const full: VoiceAnalyticsEvent = {
      ...event,
      timestamp:  new Date().toISOString(),
      sessionId:  this.currentSessionId!,
      elapsedMs:  Date.now() - this.sessionStartMs,
    };

    this.events.push(full);
  }

  startSession(): string {
    // Close existing session first
    if (this.currentSessionId) this.endSession();

    this.currentSessionId = genSessionId();
    this.sessionStartMs   = Date.now();
    this.events           = [];

    this.log({ type: 'recognition_started' });
    return this.currentSessionId;
  }

  endSession(): VoiceSessionSummary | null {
    if (!this.currentSessionId) return null;

    this.log({ type: 'recognition_stopped' });

    const summary = this._buildSummary(this.currentSessionId);
    this.sessions = [summary, ...this.sessions].slice(0, 50); // keep last 50 sessions

    this.currentSessionId = null;
    this.events           = [];
    return summary;
  }

  getSessions(): VoiceSessionSummary[] {
    return [...this.sessions];
  }

  getCurrentSession(): VoiceSessionSummary | null {
    if (!this.currentSessionId) return null;
    return this._buildSummary(this.currentSessionId);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _buildSummary(sessionId: string): VoiceSessionSummary {
    const matched = this.events.filter((e) => e.type === 'command_matched');
    const unmatched = this.events.filter((e) => e.type === 'command_unmatched');
    const total = matched.length + unmatched.length;

    // Tally top actions
    const actionCounts: Record<string, number> = {};
    for (const e of matched) {
      if (e.action) actionCounts[e.action] = (actionCounts[e.action] ?? 0) + 1;
    }
    const topActions = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));

    return {
      sessionId,
      startedAt:    new Date(this.sessionStartMs).toISOString(),
      endedAt:      this.currentSessionId ? undefined : new Date().toISOString(),
      commandCount: matched.length,
      matchRate:    total > 0 ? Math.round((matched.length / total) * 100) : 0,
      topActions,
      events:       [...this.events],
    };
  }
}

/**
 * Module-level singleton — lazy so no SSR issues.
 * Reuse the same logger instance across the app.
 */
let _logger: VoiceAnalyticsLogger | null = null;
export function getVoiceAnalyticsLogger(): VoiceAnalyticsLogger {
  if (!_logger) _logger = new VoiceAnalyticsLogger();
  return _logger;
}
