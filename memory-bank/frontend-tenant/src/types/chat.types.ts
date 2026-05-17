// ─── Chat / Conversational Control Types ─────────────────────────────────────
// I — Interface Segregation: each type covers exactly its concern
// These are frontend-only mirrors of backend contracts — no shared code

export type ChatMessageRole = 'user' | 'assistant' | 'system';
export type ChatResponseType = 'info' | 'action' | 'error' | 'data';

// Inline data attachments the assistant can embed in a response
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

// Suggested action the AI proposes but does NOT auto-execute
export interface ChatSuggestion {
  action: string;                          // e.g. 'pause_agent', 'assign_task'
  label: string;                           // human-readable button label
  agentId?: string;
  params: Record<string, unknown>;
  requiresApproval: boolean;
  confirmationMessage: string;
}

// A single message in the thread
export interface ConversationMessage {
  id: string;
  role: ChatMessageRole;
  content: string;                         // markdown string
  type?: ChatResponseType;
  data?: ChatMessageData;
  suggestion?: ChatSuggestion;
  tokens?: { input: number; output: number };
  timestamp: string;                       // ISO 8601
  streaming?: boolean;                     // true while tokens are arriving
}

// Request payload sent to backend
export interface ChatRequest {
  query: string;
  context?: 'agent' | 'task' | 'workflow' | 'system';
  conversationId?: string;
}

// Response from backend
export interface ChatResponse {
  id: string;
  type: ChatResponseType;
  message: string;
  data?: ChatMessageData;
  suggestion?: ChatSuggestion;
  tokens: { input: number; output: number };
  timestamp: string;
}

// Slash command registry entry
export interface SlashCommand {
  trigger: string;                         // e.g. '/agents'
  label: string;
  context: ChatRequest['context'];
  suggestions: string[];
}
