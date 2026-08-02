// ─── IChatService.ts ────────────────────────────────────────────────────────────
// ISP: Multiple segregated interfaces — each client depends on what it needs.
// DIP: Higher-level services depend on these abstractions, not concrete classes.

import type { ChatMessage, ChatRequest, ChatResponse, SlashCommand } from '@/shared/types/chat.types';

export interface IChatService {
  sendMessage(request: ChatRequest): Promise<ChatResponse>;
  sendMessageStream(
    request: ChatRequest,
    onDelta: (text: string) => void,
    onDone: (conversationId: string) => void,
    onError: (error: string) => void,
    onFinish: () => void,
    onEnvelope?: (envelope: Record<string, unknown>) => void,
  ): () => void;
  getHistory(limit?: number): Promise<ChatMessage[]>;
  clearHistory(): Promise<void>;
  getSuggestions(query: string, context?: string): Promise<string[]>;
  isAvailable(): boolean;
  submitAutonomousApproval(executionId: string, approvalId: string, decision: 'approve' | 'reject'): Promise<ChatResponse['autonomousExecution']>;
}

export interface ISlashCommandProvider {
  readonly commands: SlashCommand[];
  getSuggestions(input: string): SlashCommand[];
  getContextForTrigger(input: string): string | undefined;
}

export interface IFallbackReply {
  generate(message: string): { reply: string; suggestions?: string[] };
  generateSuggestions(replyText: string): string[];
}

export interface IJsonExtractor {
  extract(text: string): { cleaned: string; chartType?: string; chartData?: unknown[] } | null;
}

export interface ISystemPromptBuilder {
  build(context?: Record<string, unknown>): string;
}
