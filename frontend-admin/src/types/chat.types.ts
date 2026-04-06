// ─── Chat / Conversational Control Types ─────────────────────────────────────
// Admin portal mirror — independent from tenant portal (no shared code)

export type ChatMessageRole = 'user' | 'assistant' | 'system';
export type ChatResponseType = 'info' | 'action' | 'error' | 'data';

export interface ChatInlineChart {
  type: 'area' | 'bar' | 'line' | 'donut';
  title?: string;
  data: Array<Record<string, unknown>>;
  xKey?: string;
  yKey?: string;
}

export interface ChatInlineTable {
  headers: string[];
  rows: Array<Record<string, string | number | boolean>>;
}

export interface ChatInlineMetrics {
  items: Array<{ label: string; value: string | number; color?: string }>;
}

export interface ChatMessageData {
  chart?: ChatInlineChart;
  table?: ChatInlineTable;
  metrics?: ChatInlineMetrics;
}

export interface ChatSuggestion {
  action: string;
  label: string;
  agentId?: string;
  tenantId?: string;
  params: Record<string, unknown>;
  requiresApproval: boolean;
  confirmationMessage: string;
}

export interface ConversationMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  channel?: string;
  type?: ChatResponseType;
  data?: ChatMessageData;
  suggestion?: ChatSuggestion;
  tokens?: { input: number; output: number };
  timestamp: string;
  streaming?: boolean;
}

export interface ChatRequest {
  query: string;
  context?: 'agent' | 'task' | 'workflow' | 'system' | 'tenant' | 'billing';
  conversationId?: string;
}

export interface ChatResponse {
  id: string;
  type: ChatResponseType;
  message: string;
  data?: ChatMessageData;
  suggestion?: ChatSuggestion;
  tokens: { input: number; output: number };
  timestamp: string;
}

export interface SlashCommand {
  trigger: string;
  label: string;
  context: ChatRequest['context'];
  suggestions: string[];
}

// Admin-specific strategy types are in @/types/strategy.types.ts
