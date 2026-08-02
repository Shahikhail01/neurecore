// ─── ChatService.ts ─────────────────────────────────────────────────────────────
// SRP: Backend communication + response parsing for chat operations.
// DIP: Depends on IApiClient, ChatConfig, IFallbackReply, IJsonExtractor (all abstractions).
// OCP: Context enrichment open for extension via ISystemPromptBuilder.

import type { IApiClient } from '@/core/services/api/interfaces/IApiClient';
import type {
  IChatService,
  IFallbackReply,
  IJsonExtractor,
  ISystemPromptBuilder,
} from '@/core/services/interfaces/IChatService';
import type { ChatMessage, ChatRequest, ChatResponse, ChatConfig } from '@/shared/types/chat.types';

export class ChatService implements IChatService {
  constructor(
    private readonly apiClient: IApiClient,
    private readonly config: ChatConfig,
    private readonly fallback: IFallbackReply,
    private readonly jsonExtractor: IJsonExtractor,
    private readonly systemPromptBuilder: ISystemPromptBuilder,
  ) {}

  isAvailable(): boolean {
    return typeof window !== 'undefined';
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      const autonomousTimeout = /\bonboard\b/i.test(request.message)
        && /\b(q3|quarter|return|workflow)\b/i.test(request.message)
        ? 120_000
        : undefined;
      const apiResponse = await this.apiClient.post<{
        reply: string;
        conversationId: string;
        tokens?: { input: number; output: number; total: number };
        model?: string;
        provider?: string;
        liveData?: Record<string, unknown>;
        autonomousExecution?: ChatResponse['autonomousExecution'];
        provenance?: import('@/shared/types/chat.types').ChatProvenance;
      }>(this.config.apiEndpoint, {
        message: request.message,
        conversationId: request.conversationId ?? undefined,
        context: request.context ?? {},
        systemPrompt: request.systemPrompt ?? this.systemPromptBuilder.build(request.context),
        history: request.history ?? [],
      }, { timeoutMs: autonomousTimeout });

      // Handle backend-level errors (structured error responses)
      if (apiResponse.status === 'error' || !apiResponse.data) {
        const errorCode = apiResponse.error?.code ?? 'UNKNOWN_ERROR';
        const errorMessage = apiResponse.error?.message ?? 'An unexpected error occurred';
        return {
          reply: this.classifyBackendError(errorCode, errorMessage),
          conversationId: '',
          tokens: { input: 0, output: 0 },
          suggestions: [],
        };
      }

      const response = apiResponse.data;

      if (!response || !response.reply) {
        // Empty backend reply → run the keyword fallback for the
        // user's actual message (the original design that the chat
        // tests assert). If the fallback also has nothing useful,
        // surface the canonical offline copy.
        const keyword = this.fallback.generate(request.message);
        if (keyword.reply) {
          return {
            reply: keyword.reply,
            conversationId: response?.conversationId ?? '',
            tokens: { input: 0, output: 0 },
            suggestions: keyword.suggestions ?? [],
          };
        }
        return {
          reply: "I'm currently offline. Please check your connection and try again.",
          conversationId: response?.conversationId ?? '',
          tokens: { input: 0, output: 0 },
          suggestions: [],
        };
      }

      // Backend does NOT return chartType/chartData/suggestions as top-level fields.
      // The LLM embeds chart JSON inside the reply string (per system prompt).
      // Parse it out client-side using the brace-balanced JSON extractor.
      const parsed = this.jsonExtractor.extract(response.reply ?? '');
      const reply = parsed?.cleaned ?? response.reply;

      const chartData = parsed?.chartData as Array<{ label: string; value: number }> | undefined;
      const chartType = parsed?.chartType as 'bar' | undefined;

      // Backend does NOT return suggestions. Infer client-side via fallback.
      const suggestions = this.fallback.generateSuggestions(reply);

      return {
        reply,
        conversationId: response.conversationId ?? '',
        tokens: response.tokens ?? { input: 0, output: 0 },
        model: response.model,
        provider: response.provider,
        liveData: response.liveData,
        chartData,
        chartType,
        suggestions,
        autonomousExecution: response.autonomousExecution,
        provenance: response.provenance,
      };
    } catch (err) {
      // Network errors, parse errors, or unexpected exceptions.
      //
      // If the user's message contains a recognisable keyword
      // (e.g. "agent", "task", "revenue"), the keyword fallback can
      // give a more useful reply than the generic classifier. The
      // classifier remains the safety net for true errors that don't
      // map to a keyword.
      const errorMessage = err instanceof Error ? err.message : String(err);
      const keyword = this.fallback.generate(request.message);
      if (keyword.reply && !keyword.reply.includes("I'm currently offline")) {
        return {
          reply: keyword.reply,
          conversationId: '',
          tokens: { input: 0, output: 0 },
          suggestions: keyword.suggestions ?? [],
        };
      }
      return {
        reply: this.classifyError(errorMessage),
        conversationId: '',
        tokens: { input: 0, output: 0 },
        suggestions: [],
      };
    }
  }

  async submitAutonomousApproval(
    executionId: string,
    approvalId: string,
    decision: 'approve' | 'reject',
  ): Promise<ChatResponse['autonomousExecution']> {
    const response = await this.apiClient.post<NonNullable<ChatResponse['autonomousExecution']>>(
      `/hermes-adapter/executions/${encodeURIComponent(executionId)}/approvals/${encodeURIComponent(approvalId)}`,
      { decision },
    );
    if (response.status === 'error') {
      throw new Error(response.error?.message ?? 'Approval decision failed');
    }
    let execution = response.data;
    for (let attempt = 0; execution?.status === 'RUNNING' && attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      const status = await this.apiClient.get<NonNullable<ChatResponse['autonomousExecution']>>(
        `/hermes-adapter/executions/${encodeURIComponent(executionId)}`,
      );
      if (status.status === 'error' || !status.data) {
        throw new Error(status.error?.message ?? 'Unable to read autonomous execution status');
      }
      execution = status.data;
    }
    if (execution?.status === 'RUNNING') {
      throw new Error('Autonomous execution did not reach a checkpoint in time');
    }
    return execution;
  }

  /**
   * Classify backend error codes into user-friendly messages.
   * Addresses Phase 6.2: Surface real error messages in chat UI.
   */
  private classifyBackendError(code: string, message: string): string {
    const codeLower = code.toLowerCase();
    if (codeLower.includes('unauthorized') || codeLower.includes('401')) {
      return 'Session expired. Please log in again.';
    }
    if (codeLower.includes('forbidden') || codeLower.includes('403') || codeLower.includes('access denied')) {
      return "You don't have access to this operation.";
    }
    if (codeLower.includes('not_found') || codeLower.includes('404')) {
      return 'The requested resource was not found.';
    }
    if (codeLower.includes('rate_limit') || codeLower.includes('429')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (codeLower.includes('server_error') || codeLower.includes('500') || codeLower.includes('503') || codeLower.includes('bad_gateway')) {
      return 'Service temporarily unavailable. Please try again later.';
    }
    if (codeLower.includes('validation') || codeLower.includes('bad_request') || codeLower.includes('400')) {
      return `Request error: ${message}`;
    }
    if (codeLower.includes('network') || codeLower.includes('timeout') || codeLower.includes('ECONNREFUSED')) {
      return 'Connection issue. Please check your network and try again.';
    }
    // Generic fallback — never expose raw error details to users
    return 'Something went wrong. Please try again.';
  }

  /**
   * Classify caught exceptions into user-friendly messages.
   * Addresses Phase 6.1: Remove catch-all keyword fallback for unexpected errors.
   */
  private classifyError(errorMessage: string): string {
    const msg = errorMessage.toLowerCase();
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('econnrefused') || msg.includes('fetch')) {
      return 'Connection issue. Please check your network and try again.';
    }
    if (msg.includes('abort')) {
      return 'Request was cancelled.';
    }
    if (msg.includes('parse') || msg.includes('json')) {
      return 'Received an invalid response from the server.';
    }
    // Generic fallback — do not expose raw error details
    return 'Something went wrong. Please try again.';
  }

  async getHistory(_limit?: number): Promise<ChatMessage[]> {
    try {
      const apiResponse = await this.apiClient.get<{ messages?: ChatMessage[]; data?: ChatMessage[] }>(
        '/chat/history',
        _limit ? { params: { limit: String(_limit) } } : undefined,
      );
      const data = apiResponse.data;
      if (data?.messages) return data.messages;
      if (data?.data) return data.data;
      return [];
    } catch {
      return [];
    }
  }

  async clearHistory(): Promise<void> {
    try {
      await this.apiClient.delete('/chat/history');
    } catch {
      // ignore
    }
  }

  async getSuggestions(_query: string, _context?: string): Promise<string[]> {
    try {
      const apiResponse = await this.apiClient.post<{ suggestions?: string[] }>('/chat/suggestions', {
        query: _query,
        context: _context,
      });
      return apiResponse.data?.suggestions ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Stream chat response tokens via SSE.
   * Returns a cleanup function that aborts the request.
   *
   * Events from /chat/stream:
   *   event: delta  data: {"text":"...", "envelope":{...}?}
   *   event: done   data: {"conversationId":"...","tokens":{...}}
   *   event: error  data: {"message":"..."}
   *
   * Phase 9: accepts an optional `onEnvelope` callback. When the SSE delta
   * carries an `envelope` field (service-gateway single-tool response), the
   * callback receives the raw envelope object so the UI can render chart /
   * table / metrics components without re-parsing the text content. The
   * callback is optional — callers that omit it keep the legacy text-only
   * behaviour and are backward-compatible.
   */
  sendMessageStream(
    request: ChatRequest,
    onDelta: (text: string) => void,
    onDone: (conversationId: string) => void,
    onError: (error: string) => void,
    onFinish: () => void,
    onEnvelope?: (envelope: Record<string, unknown>) => void,
  ): () => void {
    const baseUrl = (typeof window !== 'undefined' && (window as unknown as { env?: { NEXT_PUBLIC_API_URL?: string } }).env?.NEXT_PUBLIC_API_URL)
      ?? process.env.NEXT_PUBLIC_API_URL
      ?? '/api/v1';
    const endpoint = `${baseUrl}/chat/stream`;

    const controller = new AbortController();

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: request.message,
        conversationId: request.conversationId ?? undefined,
        context: request.context ?? {},
        systemPrompt: request.systemPrompt ?? this.systemPromptBuilder.build(request.context),
        history: request.history ?? [],
      }),
      credentials: 'include',
      signal: controller.signal,
    }).then(async (res) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        onFinish();
      };

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        onError(`HTTP ${res.status}: ${text}`);
        finish();
        return;
      }
      if (!res.body) {
        onError('Empty response body');
        finish();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEventType = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim();
              continue;
            }
            if (line.startsWith('data: ')) {
              const rawData = line.slice(6).trim();
              const eventType = currentEventType;
              currentEventType = '';
              if (!rawData) continue;
              try {
                const data = JSON.parse(rawData) as Record<string, unknown>;
                if (eventType === 'delta') {
                  if ('text' in data && typeof data.text === 'string') {
                    onDelta(data.text);
                  }
                  // Phase 9: forward the response envelope so the UI
                  // can render chart / table / metrics without parsing
                  // the text content. Absent when the SSE path is a
                  // plain conversation reply (query intent).
                  if ('envelope' in data && data.envelope && onEnvelope) {
                    onEnvelope(data.envelope as Record<string, unknown>);
                  }
                } else if (eventType === 'done' && 'conversationId' in data) {
                  onDone(String(data.conversationId));
                  finish();
                } else if (eventType === 'error' && 'message' in data && typeof data.message === 'string') {
                  onError(data.message);
                  finish();
                }
              } catch {
                /* ignore malformed JSON */
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          onError((err as Error).message);
        }
        finish();
      }
      finish();
    }).catch((err) => {
      if ((err as Error).name !== 'AbortError') {
        onError((err as Error).message);
      }
      onFinish();
    });

    return () => controller.abort();
  }
}
