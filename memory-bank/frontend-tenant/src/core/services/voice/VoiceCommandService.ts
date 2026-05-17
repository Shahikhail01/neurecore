// ─── VoiceCommandService.ts ───────────────────────────────────────────────────
// Concrete implementation of IVoiceCommandService using the Web Speech API.
//
// SOLID notes:
//  SRP : Manages recognition lifecycle + command matching only.
//  OCP : New commands registered via registerCommand() — no class modification.
//  DIP : Consumers depend on IVoiceCommandService, not this class.

import type {
  VoiceCommand,
  VoiceCommandAction,
  VoiceTranscript,
  IVoiceCommandService,
} from './interfaces/IVoiceCommandService';

// ─── Web Speech API — use explicit interfaces (availability varies by target) ──
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface ISpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror:  ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend:    (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

// ─── Built-in command library (OCP: add entries, never touch logic) ───────────
const BUILT_IN_COMMANDS: VoiceCommand[] = [
  {
    phrases: ['go to dashboard', 'show dashboard', 'open dashboard', 'home'],
    action: 'navigateToDashboard',
    label: 'Go to Dashboard',
  },
  {
    phrases: ['show me agents', 'go to agents', 'open agents', 'my agents'],
    action: 'navigateToAgents',
    label: 'Go to Agents',
  },
  {
    phrases: ['show tasks', 'go to tasks', 'open tasks', 'my tasks'],
    action: 'navigateToTasks',
    label: 'Go to Tasks',
  },
  {
    phrases: ['show workflows', 'go to workflows', 'open workflows'],
    action: 'navigateToWorkflows',
    label: 'Go to Workflows',
  },
  {
    phrases: ['show approvals', 'pending approvals', 'go to approvals'],
    action: 'navigateToApprovals',
    label: 'Go to Approvals',
  },
  {
    phrases: ['show analytics', 'go to analytics', 'open analytics', 'reports'],
    action: 'navigateToAnalytics',
    label: 'Go to Analytics',
  },
  {
    phrases: ['open command palette', 'command palette', 'search'],
    action: 'openCommandPalette',
    label: 'Open Command Palette',
  },
  {
    phrases: ['create new task', 'new task', 'add task'],
    action: 'openNewTask',
    label: 'Create New Task',
  },
  {
    phrases: ['approve all', 'bulk approve', 'approve all pending'],
    action: 'bulkApprove',
    label: 'Approve All Pending',
  },
  {
    phrases: ['stop listening', 'cancel', 'never mind'],
    action: 'stopListening',
    label: 'Stop Voice Commands',
  },
];

type TranscriptHandler = (t: VoiceTranscript) => void;
type CommandHandler    = (cmd: VoiceCommand) => void;
type ErrorHandler      = (err: Error) => void;

export class VoiceCommandService implements IVoiceCommandService {
  private commands: VoiceCommand[]                = [...BUILT_IN_COMMANDS];
  private transcriptHandlers: TranscriptHandler[] = [];
  private commandHandlers: CommandHandler[]        = [];
  private errorHandlers: ErrorHandler[]            = [];
  private recognition: ISpeechRecognition | null   = null;
  private _isListening = false;

  constructor() {
    this._init();
  }

  // ─── IVoiceCommandListener ───────────────────────────────────────────────

  get isListening(): boolean {
    return this._isListening;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' &&
      (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);
  }

  start(): void {
    if (!this.isSupported() || this._isListening) return;
    this.recognition?.start();
    this._isListening = true;
  }

  stop(): void {
    if (!this._isListening) return;
    this.recognition?.stop();
    this._isListening = false;
  }

  // ─── IVoiceCommandRegistry ───────────────────────────────────────────────

  getCommands(): VoiceCommand[] {
    return [...this.commands];
  }

  registerCommand(cmd: VoiceCommand): void {
    const isDup = this.commands.some((c) => c.action === cmd.action);
    if (!isDup) this.commands.push(cmd);
  }

  match(transcript: string): VoiceCommand | null {
    const lower = transcript.toLowerCase().trim();
    for (const cmd of this.commands) {
      if (cmd.guard && !cmd.guard()) continue;
      if (cmd.phrases.some((p) => lower.includes(p))) return cmd;
    }
    return null;
  }

  // ─── Event subscriptions (ISP) ───────────────────────────────────────────

  onTranscript(handler: TranscriptHandler): () => void {
    this.transcriptHandlers.push(handler);
    return () => { this.transcriptHandlers = this.transcriptHandlers.filter((h) => h !== handler); };
  }

  onCommand(handler: CommandHandler): () => void {
    this.commandHandlers.push(handler);
    return () => { this.commandHandlers = this.commandHandlers.filter((h) => h !== handler); };
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.push(handler);
    return () => { this.errorHandlers = this.errorHandlers.filter((h) => h !== handler); };
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _init(): void {
    if (typeof window === 'undefined') return;

    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    this.recognition = new Ctor();
    this.recognition.continuous     = true;
    this.recognition.interimResults = true;
    this.recognition.lang           = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: ISpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex];
      const transcript: VoiceTranscript = {
        text: result[0].transcript,
        confidence: result[0].confidence,
        isFinal: result.isFinal,
      };

      this.transcriptHandlers.forEach((h) => h(transcript));

      if (transcript.isFinal) {
        const cmd = this.match(transcript.text);
        if (cmd) this.commandHandlers.forEach((h) => h(cmd));
      }
    };

    this.recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      const err = new Error(`Voice recognition error: ${event.error}`);
      this._isListening = false;
      this.errorHandlers.forEach((h) => h(err));
    };

    this.recognition.onend = () => {
      // Auto-restart unless explicitly stopped
      if (this._isListening) {
        this.recognition?.start();
      }
    };
  }
}

// Lazy singleton — only constructed client-side
let _instance: VoiceCommandService | null = null;

export function getVoiceCommandService(): VoiceCommandService {
  if (!_instance) _instance = new VoiceCommandService();
  return _instance;
}
