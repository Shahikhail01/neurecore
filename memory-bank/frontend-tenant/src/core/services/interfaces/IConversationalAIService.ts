// ─── IConversationalAIService.ts ──────────────────────────────────────────────
// ISP: Segregated into IMessageSender (send) and IConversationHistory (history).

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessageMetadata {
  chartType?:     'bar' | 'line' | 'pie';
  chartData?:     { label: string; value: number }[];
  suggestions?:   string[];
  isStreaming?:   boolean;
  sourceSummary?: string;
}

export interface ChatMessage {
  id:        string;
  role:      MessageRole;
  content:   string;
  timestamp: string;
  /** Optional structured data attached alongside the text response */
  metadata?: ChatMessageMetadata;
}

export interface ConversationContext {
  /** Tenant id for scoped queries */
  tenantId?:      string;
  /** Current page context ("dashboard", "agents", etc.) */
  currentPage?:   string;
  /** Short summary injected as system context */
  systemContext?: string;
}

export interface IMessageSender {
  sendMessage(
    message: string,
    context?: ConversationContext,
  ): Promise<ChatMessage>;
}

export interface IConversationHistory {
  getHistory(): ChatMessage[];
  clearHistory(): void;
  getConversationId(): string | null;
}

export interface IConversationalAIService
  extends IMessageSender, IConversationHistory {
  isAvailable(): boolean;
}
