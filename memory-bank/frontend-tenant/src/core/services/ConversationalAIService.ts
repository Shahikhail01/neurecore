// ─── ConversationalAIService.ts ───────────────────────────────────────────────
// SRP: Manages chat sessions + message exchange with the backend AI endpoint.
// DIP: Depends on IApiClient, IConversationalAIService — no direct fetch calls.
// OCP: Context enrichment open for extension via ConversationContext shape.

import type {
  IConversationalAIService,
  ChatMessage,
  ChatMessageMetadata,
  ConversationContext,
} from "@/core/services/interfaces/IConversationalAIService";
import { restClient } from "@/core/services/api/clients/RestClient";

const API_ENDPOINT = "/ai/chat";
let _msgId = 0;
const genId = () => `msg_${Date.now()}_${++_msgId}`;

const SYSTEM_PROMPT = `You are HeadQuarter's AI assistant — a concise, data-driven advisor for an AI-employee business platform.
Answer questions about company operations, agent performance, workflows, and tasks.
Keep answers brief (2–4 sentences). When data is available, provide actionable insights.
For visualisable data, include a JSON block (no markdown) with keys: chartType, chartData [{label, value}].`;

export class ConversationalAIService implements IConversationalAIService {
  private history: ChatMessage[] = [];
  private conversationId: string | null = null;

  isAvailable(): boolean {
    return typeof window !== "undefined";
  }

  // ─── IMessageSender ───────────────────────────────────────────────────────

  async sendMessage(
    message: string,
    context?: ConversationContext,
  ): Promise<ChatMessage> {
    // Append user message immediately (for optimistic UI)
    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    this.history.push(userMsg);

    try {
      const response = await restClient.post<{
        reply: string;
        conversationId: string;
        chartType?: ChatMessageMetadata["chartType"];
        chartData?: ChatMessageMetadata["chartData"];
        suggestions?: string[];
      }>(API_ENDPOINT, {
        message,
        conversationId: this.conversationId,
        context: context ?? {},
        systemPrompt: SYSTEM_PROMPT,
        history: this.history.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      if (response.data) {
        this.conversationId = response.data.conversationId;
      }

      const reply = response.data?.reply ?? this._fallbackReply(message);
      const rawMeta = response.data as
        | Record<string, unknown>
        | null
        | undefined;
      const { cleanedReply, ...metadata } = this._parseMetadata(
        reply,
        rawMeta ?? null,
      );

      const assistantMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: cleanedReply,
        timestamp: new Date().toISOString(),
        metadata,
      };

      this.history.push(assistantMsg);
      return assistantMsg;
    } catch {
      // Graceful fallback: simple rule-based responses
      const fallback = this._fallbackReply(message);
      const assistantMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: fallback,
        timestamp: new Date().toISOString(),
      };
      this.history.push(assistantMsg);
      return assistantMsg;
    }
  }

  // ─── IConversationHistory ─────────────────────────────────────────────────

  getHistory(): ChatMessage[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    this.conversationId = null;
  }

  getConversationId(): string | null {
    return this.conversationId;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _parseMetadata(
    reply: string,
    apiData?: Record<string, unknown> | null,
  ): ChatMessageMetadata & { cleanedReply: string } {
    let cleanedReply = reply;

    // Try to extract embedded JSON from reply
    const jsonMatch = reply.match(/\{[\s\S]*?"chartType"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
        cleanedReply = reply.replace(jsonMatch[0], "").trim();
        return {
          cleanedReply,
          chartType: parsed.chartType as ChatMessageMetadata["chartType"],
          chartData:
            (parsed.chartData as ChatMessageMetadata["chartData"]) ?? [],
          suggestions: (apiData?.suggestions as string[]) ?? [],
        };
      } catch {
        /* fall through */
      }
    }

    return {
      cleanedReply,
      chartType: apiData?.chartType as ChatMessageMetadata["chartType"],
      chartData: apiData?.chartData as ChatMessageMetadata["chartData"],
      suggestions:
        (apiData?.suggestions as string[]) ?? this._inferSuggestions(reply),
    };
  }

  /** Rule-based offline fallback — when API is unavailable */
  private _fallbackReply(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("revenue") || lower.includes("sales"))
      return "I'm unable to access live data right now. Check the Analytics page for revenue insights.";
    if (lower.includes("agent"))
      return "Head to the Agents page to review agent status and performance metrics.";
    if (lower.includes("task"))
      return "Open the Tasks page to review pending and in-progress tasks across all agents.";
    if (lower.includes("workflow"))
      return "The Workflows page shows all active process flows and their current status.";
    return "I'm currently offline. Please check your connection and try again.";
  }

  private _inferSuggestions(reply: string): string[] {
    const suggestions: string[] = [];
    if (reply.includes("agent")) suggestions.push("Show me all agents");
    if (reply.includes("task")) suggestions.push("Show pending tasks");
    if (reply.includes("revenue")) suggestions.push("Open analytics");
    return suggestions.slice(0, 3);
  }
}

export const conversationalAIService = new ConversationalAIService();
