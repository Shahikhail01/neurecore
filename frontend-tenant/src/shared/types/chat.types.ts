// ─── Unified Chat Types ────────────────────────────────────────────────────────
// Single source of truth for all chat type definitions across tenant + admin.
// Replaces: types/chat.types.ts + core/services/interfaces/IConversationalAIService.ts
//
// NOTE: chartType and chartData are NOT top-level backend response fields.
// The LLM embeds chart JSON inside the `reply` string per system prompt.
// Frontend extracts via IJsonExtractor (brace-balanced parser).
//
// NOTE: suggestions are NOT returned by the backend.
// Frontend infers them client-side via IFallbackReply.generateSuggestions().

export type MessageRole = 'user' | 'assistant' | 'system';

// ── Inline Data (rendered inside message bubbles) ───────────────────────────
export interface ChartData {
  chartType: 'bar'; // only bar for now
  chartData: Array<{ label: string; value: number }>;
}

export interface MetricsData {
  items: Array<{ label: string; value: string | number; color?: string }>;
}

export interface TableData {
  headers: string[];
  rows: Array<Record<string, string | number | boolean>>;
}

export interface EnvelopeData {
  text?: string;
  components?: Array<{
    type: 'chart' | 'table' | 'metrics';
    props: Record<string, unknown>;
  }>;
}

export interface SuggestionData {
  label: string;
  action?: string;
  params?: Record<string, unknown>;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

export interface AutonomousApprovalData {
  executionId: string;
  approvalId: string;
  toolName: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

// ── Messages ────────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  tokens?: { input: number; output: number };
  metadata?: {
    chart?: ChartData;
    metrics?: MetricsData;
    table?: TableData;
    envelope?: EnvelopeData;
    suggestions?: SuggestionData[];
    isStreaming?: boolean;
    autonomousApproval?: AutonomousApprovalData;
  };
}

// ── Request / Response ──────────────────────────────────────────────────────
// CHATREQUEST  Maps to backend SendChatMessageDto.message.
// The field is named 'message' here (matching backend), not 'query' (old name).
// ChatService.sendMessage() handles the mapping internally.

export interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: Record<string, unknown>;
  systemPrompt?: string;
  history?: Array<{ role: MessageRole; content: string }>;
}

// Backend ChatService.send() returns:
//   { reply, conversationId, tokens?, model?, provider?, liveData? }
// chartType / chartData / suggestions are client-extracted (not backend fields).
export interface ChatResponse {
  reply: string;
  conversationId: string;
  tokens: { input: number; output: number; total?: number };
  model?: string;
  provider?: string;
  liveData?: Record<string, unknown>;
  chartType?: 'bar';
  chartData?: Array<{ label: string; value: number }>;
  suggestions?: string[];
  autonomousExecution?: {
    executionId: string;
    status: string;
    pendingApproval?: {
      approvalId: string;
      toolName: string;
      reason: string;
    } | null;
  };
}

// ── Slash Commands ──────────────────────────────────────────────────────────
export interface SlashCommand {
  trigger: string;
  label: string;
  context?: string;
  suggestions: string[];
}

// ── Config ──────────────────────────────────────────────────────────────────
export interface ChatConfig {
  panelTitle: string;
  badgeLabel: string;
  badgeColor: string;
  triggerIcon: string;
  placeholder: string;
  maxMessages: number;
  storageKey: string;
  apiEndpoint: string;
  starterPrompts: string[];
  homeHeroChips?: string[];
}
