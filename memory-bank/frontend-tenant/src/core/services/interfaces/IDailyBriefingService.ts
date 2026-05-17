// ISP: Segregated into briefing fetch (IDailyBriefingReader) and narration
//      (IDailyBriefingNarrator) so consumers depend only on what they use.

export interface BriefingSection {
  /** Section heading, e.g. "Wins", "Alerts", "Today's Goals" */
  title: string;
  /** One-to-three sentence plain-text summary */
  summary: string;
  /** Optional numeric value for KPI callouts */
  value?: number;
  valueLabel?: string;
  trend?: 'up' | 'down' | 'flat';
  severity?: 'positive' | 'negative' | 'neutral' | 'warning';
}

export interface DailyBriefing {
  date: string;              // ISO date of the briefing
  headline: string;          // One-liner overall status
  overallScore: number;      // 0-100 company score
  sections: BriefingSection[];
  generatedAt: string;       // ISO datetime
}

export interface IDailyBriefingReader {
  /** Fetch (or compute) the briefing for today */
  getBriefing(): Promise<DailyBriefing>;
  /** Invalidate cache so next getBriefing() re-fetches */
  invalidate(): void;
}

export interface IDailyBriefingNarrator {
  /** Returns true if browser TTS is available */
  isNarrationSupported(): boolean;
  /** Speak the briefing aloud, returns cancel fn */
  narrate(briefing: DailyBriefing): () => void;
  /** Stop any in-progress narration */
  stopNarration(): void;
  readonly isSpeaking: boolean;
}

export interface IDailyBriefingService extends IDailyBriefingReader, IDailyBriefingNarrator {}
