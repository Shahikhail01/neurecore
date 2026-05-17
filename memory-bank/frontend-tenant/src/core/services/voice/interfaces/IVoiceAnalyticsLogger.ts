// ─── IVoiceAnalyticsLogger.ts ─────────────────────────────────────────────────
// SRP: Logging contract for voice interaction events.
// ISP: Separate from core IVoiceCommandService — consumers depend only on logging.

export type VoiceEventType =
  | 'command_matched'      // A spoken phrase matched a registered command
  | 'command_unmatched'    // Speech detected but no command matched
  | 'recognition_started'
  | 'recognition_stopped'
  | 'recognition_error';

export interface VoiceAnalyticsEvent {
  type:       VoiceEventType;
  /** The raw transcript from speech recognition */
  transcript?: string;
  /** The matched command action, if any */
  action?:     string;
  /** Confidence (0–1) returned by speech API */
  confidence?: number;
  /** Milliseconds from session start to this event */
  elapsedMs?:  number;
  timestamp:   string; // ISO
  sessionId:   string;
}

export interface VoiceSessionSummary {
  sessionId:    string;
  startedAt:    string;
  endedAt?:     string;
  commandCount: number;
  matchRate:    number;  // 0–100 %
  topActions:   { action: string; count: number }[];
  events:       VoiceAnalyticsEvent[];
}

export interface IVoiceAnalyticsLogger {
  /** Log a single voice analytics event */
  log(event: Omit<VoiceAnalyticsEvent, 'timestamp' | 'sessionId'>): void;
  /** Start a new session */
  startSession(): string;
  /** End the current session and return summary */
  endSession(): VoiceSessionSummary | null;
  /** Query past sessions */
  getSessions(): VoiceSessionSummary[];
  /** Get current session summary (live) */
  getCurrentSession(): VoiceSessionSummary | null;
}
