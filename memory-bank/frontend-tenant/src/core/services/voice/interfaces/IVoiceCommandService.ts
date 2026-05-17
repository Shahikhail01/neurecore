// ─── IVoiceCommandService.ts ──────────────────────────────────────────────────
// ISP: Segregated into listen / commands / lifecycle concerns so consumers
//      depend only on the subset they need.

export type VoiceCommandAction =
  | 'navigateToDashboard'
  | 'navigateToAgents'
  | 'navigateToTasks'
  | 'navigateToWorkflows'
  | 'navigateToApprovals'
  | 'navigateToAnalytics'
  | 'openCommandPalette'
  | 'openNewTask'
  | 'bulkApprove'
  | 'stopListening';

export interface VoiceCommand {
  /** Lower-cased spoken phrase(s) to match */
  phrases: string[];
  action: VoiceCommandAction;
  label: string;
  /** Optional guard — command only fires when predicate returns true */
  guard?: () => boolean;
}

export interface VoiceTranscript {
  text: string;
  confidence: number;
  isFinal: boolean;
}

export interface IVoiceCommandListener {
  /** Start listening; returns teardown */
  start(): void;
  stop(): void;
  readonly isListening: boolean;
}

export interface IVoiceCommandRegistry {
  getCommands(): VoiceCommand[];
  /** OCP: register additional commands without modifying existing */
  registerCommand(cmd: VoiceCommand): void;
  match(transcript: string): VoiceCommand | null;
}

export interface IVoiceCommandService extends IVoiceCommandListener, IVoiceCommandRegistry {
  onTranscript(handler: (t: VoiceTranscript) => void): () => void;
  onCommand(handler: (cmd: VoiceCommand) => void): () => void;
  onError(handler: (err: Error) => void): () => void;
  isSupported(): boolean;
}
