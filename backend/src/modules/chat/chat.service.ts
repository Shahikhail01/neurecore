import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MiniMaxClient } from '../models/services/minimax-client.service';
import { OfficialAgentGraph } from '../agents/langgraph/langgraph-official';
import { SendChatMessageDto } from './dto/chat.dto';
import { ActivityService } from '../hermes/services/activity.service';
import { FeatureFlagService } from '../../common/feature-flag/feature-flag.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { ChatHistoryService } from './chat-history.service';
import { LRUCache } from 'lru-cache';

// PERF-FIX: in-process LRU cache for the tenant-data snapshot used to
// ground chat replies. Six parallel Postgres queries per chat message
// (~200-500ms on Contabo) collapse to ~0ms for repeated calls inside
// the 30s window. Stale-by-at-most-30s is fine for the model's
// "how many active projects do I have?" context.
const TENANT_SNAPSHOT_TTL_MS = 30_000;
const tenantSnapshotCache = new LRUCache<string, Record<string, unknown>>({
  max: 500,
  ttl: TENANT_SNAPSHOT_TTL_MS,
});

/**
 * Chat Service
 *
 * Composes a tenant-data-grounded prompt and calls MiniMax for the reply.
 *
 * The service:
 *   1. Resolves the caller's tenantId from the JWT (set by JwtAuthGuard on `req.user`)
 *      — accepts it via `dto.context.tenantId` as a fallback for tests / internal calls
 *   2. Pulls live counters from Prisma: agents by status, tasks by status, departments,
 *      approvals, today's cost MTD
 *   3. Builds a compact JSON-shaped "LIVE TENANT DATA" block and prefixes it to the
 *      system prompt so the model answers with real numbers instead of hallucinating
 *   4. Falls back to a clear stub message if MiniMax is not configured
 *
 * When `AI_GATEWAY_V2` is on, the service routes through `AiGatewayService` for
 * true streaming, structured output, and cost attribution; otherwise it falls
 * back to the legacy `MiniMaxClient` direct injection (preserves F2 fix:
 * never returns the bogus `'MiniMax-Text-01'` literal).
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly minimax: MiniMaxClient,
    private readonly prisma: PrismaService,
    private readonly agentGraph: OfficialAgentGraph,
    private readonly activityService: ActivityService,
    private readonly featureFlags: FeatureFlagService,
    private readonly aiGateway: AiGatewayService,
    private readonly chatHistory: ChatHistoryService,
  ) {}

  private saveReply(
    conversationId: string,
    tenantId: string | null,
    userId: string,
    payload: {
      reply: string;
      tokens?: { input: number; output: number; total: number };
      model?: string;
      provider?: string;
    },
  ): void {
    void this.chatHistory.saveMessage({
      tenantId: tenantId ?? 'unknown',
      userId,
      conversationId,
      role: 'assistant',
      content: payload.reply,
      ...(payload.tokens ? { tokens: payload.tokens } : {}),
      ...(payload.model ? { model: payload.model } : {}),
      ...(payload.provider ? { provider: payload.provider } : {}),
    });
  }

  /**
   * Best-effort lookup of the model/provider that the gateway just resolved.
   * Returns `undefined` on any failure (never throws) so the streaming
   * terminal chunk can always be persisted.
   */
  private async tryGetLastResolved(tenantId: string | null): Promise<
    | {
        model?: { modelId: string };
        provider?: { slug: string };
      }
    | undefined
  > {
    try {
      const fn = (
        this.aiGateway as unknown as {
          getLastResolved?: (
            tenantId: string | null,
            capability: string,
          ) => Promise<
            | { model?: { modelId: string }; provider?: { slug: string } }
            | undefined
          >;
        }
      ).getLastResolved;
      if (typeof fn !== 'function') return undefined;
      return await fn(tenantId, 'conversation');
    } catch {
      return undefined;
    }
  }

  /**
   * SIM-04 G-08 — list chat-eligible AI agents for the current tenant.
   * The chat composer on the FE wants to know which agents exist and
   * their department/role/availability BEFORE the user starts a thread.
   * Returns a compact shape (id, name, roleKey, department, availability,
   * model, maxConcurrency) that the picker can render without a second
   * round-trip. Archived agents are filtered out so the FE never offers
   * a dead handle.
   */
  async listChatAgents(tenantId: string, take = 50) {
    const agents = await this.prisma.agent.findMany({
      where: { tenantId, archived: false, isActive: true },
      orderBy: [{ name: 'asc' }],
      take,
      select: {
        id: true,
        name: true,
        description: true,
        role: true,
        availability: true,
        status: true,
        model: true,
        maxConcurrency: true,
        config: true,
        hermesAgentId: true,
      },
    });
    const data = agents.map((a) => {
      const cfg = (a.config ?? {}) as Record<string, unknown>;
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        role: a.role,
        roleKey: typeof cfg.roleKey === 'string' ? cfg.roleKey : null,
        department: typeof cfg.department === 'string' ? cfg.department : null,
        availability: a.availability,
        status: a.status,
        model: a.model,
        maxConcurrency: a.maxConcurrency,
        hermesAgentId: a.hermesAgentId,
      };
    });
    return { data, total: data.length };
  }

  async send(
    dto: SendChatMessageDto,
    tenantIdFromJwt?: string,
    userIdFromJwt?: string,
  ): Promise<{
    reply: string;
    conversationId: string;
    tokens?: { input: number; output: number; total: number };
    model?: string;
    provider?: string;
    liveData?: Record<string, unknown>;
  }> {
    const conversationId =
      dto.conversationId ??
      `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const tenantIdForHistory = tenantIdFromJwt ?? null;
    const userIdForHistory = userIdFromJwt ?? 'anonymous';

    // Persist the user message immediately (fire-and-forget).
    void this.chatHistory.saveMessage({
      tenantId: tenantIdForHistory ?? 'unknown',
      userId: userIdForHistory,
      conversationId,
      role: 'user',
      content: dto.message,
    });

    // Fire-and-forget chat:user_message activity. Failures are logged but never
    // break the chat flow — the ActivityEvent feed is observability, not a
    // critical path.
    this.recordChatActivitySafe({
      tenantId: tenantIdFromJwt ?? null,
      actorType: 'USER',
      actorId: userIdFromJwt ?? 'anonymous',
      type: 'chat:user_message',
      title: dto.message.slice(0, 80),
      contextId: conversationId,
      payload: {
        intent: this.detectIntent(dto.message),
        historyLen: dto.history?.length ?? 0,
      },
      sourceEventId: `chat:${conversationId}:user`,
    });

    // REMOVED: MiniMax-not-configured short-circuit.
    // Previously this returned a fake "MiniMax is not configured" reply BEFORE
    // checking AI_GATEWAY_V2. That defeated multi-provider failover: even when
    // the gateway could resolve OpenAI/Anthropic/DeepSeek, this branch returned
    // a fake unconfigured reply. See Critical #8 in
    // memory-bank-new/plans/comprehensive-remediation-plan-2026-07-20.md.
    // The gateway's CapabilityResolver will throw a structured
    // AiGatewayUnconfiguredError if no provider is available — that is the
    // single source of truth and is handled below.

    // Resolve tenantId — prefer the JWT-supplied one (set by JwtAuthGuard)
    const tenantId =
      tenantIdFromJwt ??
      (dto.context?.['tenantId'] as string | undefined) ??
      null;

    // Detect if this is an action request or a query
    const intent = this.detectIntent(dto.message);

    // PERF-FIX: skip the tenant-snapshot fan-out for action intents.
    // The agent graph already gathers the context it needs from its
    // own tool calls; pre-fetching a 6-query snapshot was wasted
    // 200-500ms on every "create a project / invite a user" prompt.
    const liveData =
      tenantId && intent !== 'action'
        ? await this.fetchTenantSnapshot(tenantId)
        : { note: 'no tenant context required for this intent' };

    // PROJECT-CREATION INTENT: bypass the model entirely and drive a
    // human-style conversation ourselves. The MiniMax-M2.7-highspeed model
    // is heavily tuned to dump structured lists for project-creation queries,
    // which is the opposite of what users want. We own the conversation.
    const projectCreationReply = this.handleProjectCreationConversation(
      dto,
      conversationId,
    );
    if (projectCreationReply) {
      this.recordChatActivitySafe({
        tenantId: tenantIdFromJwt ?? null,
        actorType: 'SYSTEM',
        actorId: 'project-creation-flow',
        type: 'chat:assistant_reply',
        title: projectCreationReply.slice(0, 80),
        contextId: conversationId,
        payload: { intent: 'project_creation', model: 'deterministic' },
        sourceEventId: `chat:${conversationId}:assistant`,
      });
      const result = {
        reply: projectCreationReply,
        conversationId,
        tokens: { input: 0, output: 0, total: 0 },
        model: 'deterministic-project-flow',
        provider: 'system',
        liveData,
      };
      this.saveReply(
        conversationId,
        tenantIdForHistory,
        userIdForHistory,
        result,
      );
      return result;
    }

    // ACTION: Route to OfficialAgentGraph for tool execution
    if (intent === 'action' && tenantId) {
      try {
        this.logger.log(
          `[chat] Routing action request to agent graph: ${dto.message}`,
        );

        const result = await this.agentGraph.run({
          goal: dto.message,
          agentId: 'ai-assistant',
          tenantId,
          // Use the JWT subject (real user ID) — see Phase 1.4 of the
          // remediation plan. The previous literal 'user' violated the
          // users.id FK on Agent.createdById and broke audit attribution.
          userId: userIdFromJwt ?? 'anonymous',
          sessionId: conversationId,
        });

        // Extract reply from final message or tool results
        const messages = result.messages ?? [];
        const finalMessage = messages[messages.length - 1];
        const reply =
          finalMessage?.content ??
          (result.toolResults?.length > 0
            ? `Executed ${result.toolResults.length} tool(s).`
            : 'Action completed.');

        this.recordChatActivitySafe({
          tenantId,
          actorType: 'AI_AGENT',
          actorId: 'ai-assistant',
          type: 'chat:assistant_reply',
          title: (reply ?? '').slice(0, 80),
          contextId: conversationId,
          payload: {
            intent: 'action',
            model: this.minimax.model,
            toolResults: result.toolResults?.length ?? 0,
            messages: messages.length,
          },
          sourceEventId: `chat:${conversationId}:assistant`,
        });

        const replyPayload = {
          reply: this.sanitizeReply(reply),
          conversationId,
          tokens: { input: 0, output: 0, total: 0 },
          model: this.minimax.model,
          provider: 'minimax',
          liveData,
        };
        this.saveReply(
          conversationId,
          tenantIdForHistory,
          userIdForHistory,
          replyPayload,
        );
        return replyPayload;
      } catch (err) {
        this.logger.error(
          `[chat] Agent graph failed: ${(err as Error).message}`,
        );
        const errReply = `I tried to execute that action but encountered an error: ${(err as Error).message}`;
        this.recordChatActivitySafe({
          tenantId,
          actorType: 'SYSTEM',
          actorId: 'chat-service',
          type: 'chat:error',
          title: errReply.slice(0, 80),
          contextId: conversationId,
          severity: 'error',
          payload: { intent: 'action', error: (err as Error).message },
          sourceEventId: `chat:${conversationId}:error`,
        });
        const result = {
          reply: errReply,
          conversationId,
          tokens: { input: 0, output: 0, total: 0 },
          model: this.minimax.model,
          provider: 'minimax',
          liveData,
        };
        this.saveReply(
          conversationId,
          tenantIdForHistory,
          userIdForHistory,
          result,
        );
        return result;
      }
    }

    // QUERY: Use MiniMax for natural language response
    const systemPrompt = `You are a friendly, helpful AI assistant who talks like a real person texting a colleague. Plain sentences only. No markdown, no bullet points, no dashes for lists, no bold, no headers. No internal reasoning. No <think> tags.

When the user wants to create a project, your reply must be EXACTLY in this conversational form:

"Sure, I can help with that! What kind of project — and what should I call it?"

Then stop. Wait for the user's answer. On the next turn, ask one more question (e.g., deadline or budget). Never dump a list of fields. Never use structured formatting. Just chat.

For all other questions, answer using the LIVE TENANT DATA below in plain conversational sentences. No structured output, no lists. If data is missing, say so directly.

When relevant, include a JSON block (no markdown fences) with keys: chartType, chartData [{label, value}].`;

    const historyText = (dto.history ?? [])
      .slice(-10)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const prompt = [
      `SYSTEM: ${systemPrompt}`,
      `\nLIVE TENANT DATA (JSON):\n${JSON.stringify(liveData, null, 2)}`,
      historyText ? `\nCONVERSATION:\n${historyText}` : '',
      `\nUSER: ${dto.message}`,
      '\nASSISTANT:',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      // Feature-flagged routing: when AI_GATEWAY_V2 is on, the gateway
      // owns provider selection, failover, streaming, structured output,
      // and cost attribution. When off, the legacy MiniMaxClient path is
      // preserved (with F2 fix: real model id, never 'MiniMax-Text-01').
      const useGateway = this.featureFlags.isEnabled('AI_GATEWAY_V2');

      // PERF-FIX: capture the full response (content + model + provider)
      // from a SINGLE invoke() call. Previously the code called
      // getLastResolved() twice after invoke() — that's 2 extra DB hits
      // (resolver cache miss path) just to read model/provider that the
      // gateway already returned. The legacy `MiniMaxClient.invoke`
      // returns a 2-field shape, so we read model from the client
      // instance for that path.
      let replyContent: string;
      let replyModel: string;
      let replyProvider: string;
      if (useGateway) {
        const gwResp = await this.aiGateway.invoke({
          tenantId,
          capability: 'conversation',
          prompt,
          sourceModule: 'chat',
          ...(dto.temperature !== undefined
            ? { temperature: dto.temperature }
            : {}),
          ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
        });
        replyContent = gwResp.content;
        replyModel = gwResp.model ?? 'gateway';
        replyProvider = gwResp.provider ?? 'gateway';
      } else {
        const miniResp = await this.minimax.invoke(
          prompt,
          dto.temperature ?? 0.3,
          dto.maxTokens ?? 512,
        );
        replyContent = miniResp.content;
        replyModel = this.minimax.model;
        replyProvider = 'minimax';
      }

      const tokens = { input: 0, output: 0, total: 0 };

      this.recordChatActivitySafe({
        tenantId: tenantIdFromJwt ?? null,
        actorType: 'AI_AGENT',
        actorId: replyProvider,
        type: 'chat:assistant_reply',
        title: (replyContent ?? '').slice(0, 80),
        contextId: conversationId,
        payload: {
          intent: 'query',
          model: replyModel,
          provider: replyProvider,
          tokens,
        },
        sourceEventId: `chat:${conversationId}:assistant`,
      });

      const result = {
        reply: this.sanitizeReply(replyContent),
        conversationId,
        tokens,
        model: replyModel,
        provider: replyProvider,
        liveData,
      };
      this.saveReply(
        conversationId,
        tenantIdForHistory,
        userIdForHistory,
        result,
      );
      return result;
    } catch (err) {
      this.logger.error(
        `Chat invoke failed: ${(err as Error).message}`,
        ChatService.name,
      );
      const errReply = `I received your query, but the MiniMax API returned an error: ${(err as Error).message}`;
      this.recordChatActivitySafe({
        tenantId: tenantIdFromJwt ?? null,
        actorType: 'SYSTEM',
        actorId: 'chat-service',
        type: 'chat:error',
        title: errReply.slice(0, 80),
        contextId: conversationId,
        severity: 'error',
        payload: { intent: 'query', error: (err as Error).message },
        sourceEventId: `chat:${conversationId}:error`,
      });
      const result = {
        reply: errReply,
        conversationId,
        tokens: { input: 0, output: 0, total: 0 },
        model: this.minimax.model,
        provider: 'minimax',
        liveData,
      };
      this.saveReply(
        conversationId,
        tenantIdForHistory,
        userIdForHistory,
        result,
      );
      return result;
    }
  }

  /**
   * Strip thinking/reasoning blocks and excessive markdown formatting from the
   * model's reply so it reads like a natural human response.
   *
   * The MiniMax-M2.7-highspeed model trained with reasoning often leaks
   * `<think>...</think>` blocks into its output, plus it over-formats with
   * bold/headers/lists even when told not to. We strip:
   *   - `<think>...</think>` blocks (model internal reasoning)
   *   - `**bold**` markers (replace with plain text)
   *   - `## headers` (strip)
   *   - leading bullet lists (replace with prose where possible)
   *
   * If everything is stripped and we're left with empty whitespace, return a
   * short fallback message instead.
   */
  private sanitizeReply(raw: string | undefined | null): string {
    if (!raw) return '';
    let text = raw;

    // 1. Strip <think>...</think> blocks (model internal reasoning).
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // 2. Strip <thinking>...</thinking> variant just in case.
    text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    // 3. If a `</think>` opens without a closing tag (truncated), strip from
    //    the opening tag to end of string.
    text = text.replace(/<think>[\s\S]*$/gi, '');

    // 4. Strip chain-of-thought reasoning that the MiniMax-M2.7-highspeed model
    //    leaks as plain text (without using <think> tags). Patterns detected:
    //    a) The model describes what the user is asking / saying / requesting
    //    b) The model reasons about system instructions / context
    //    c) Meta-transition phrases like "Thus answer:", "So final answer:", "Thus final."
    //    The actual reply is typically a single conversational sentence.
    text = this.stripChainOfThought(text);

    // 5. Collapse repeated blank lines.
    text = text.replace(/\n{3,}/g, '\n\n');

    // 6. Strip leading/trailing whitespace.
    text = text.trim();

    // 7. Remove `**bold**` markers — keep the inner text.
    text = text.replace(/\*\*(.+?)\*\*/g, '$1');

    // 8. Strip markdown headers (## / ###).
    text = text.replace(/^#{1,6}\s+/gm, '');

    // 9. Strip horizontal rules.
    text = text.replace(/^---+$/gm, '');

    // 10. Strip leading bullet markers (`- `, `* `, `• `) from lines so the
    //     model can't sneak in dash-list formatting. Replace with a blank so
    //     the inner text runs together as prose.
    text = text.replace(/^\s*[-*•]\s+/gm, '');

    // 11. Strip leading numbered list markers (`1. `, `2) `, etc).
    text = text.replace(/^\s*\d+[.)]\s+/gm, '');

    // 12. Collapse runs of blank lines we created by stripping bullets.
    text = text.replace(/\n{3,}/g, '\n\n');

    // 13. Trim again after stripping.
    text = text.trim();

    // 14. If the response became empty, provide a short fallback so the user
    //     sees something useful instead of a blank bubble.
    if (!text || text.length < 2) {
      return "I'm here. What's on your mind?";
    }

    return text;
  }

  /**
   * Strip chain-of-thought reasoning that the MiniMax-M2.7-highspeed model emits
   * as plain text (without `<think>` tags). The model often writes paragraphs
   * like:
   *   "The user says 'Hello'. That's a simple question. According to system
   *    instruction: ... I should respond with ... Thus answer: Hey! ..."
   *
   * Detection strategy:
   *   1. If the response starts with a meta-reasoning opener (e.g. "The user
   *      says", "The user is asking"), strip everything up to the first
   *      "Thus answer:", "Thus final.", "So final answer:", or natural reply
   *      opener (e.g. "Hey!", "Sure,", "Got it,").
   *   2. If the response contains a meta-transition phrase like "Thus answer:"
   *      anywhere, take everything AFTER the LAST occurrence.
   *   3. As a last resort, if the response is extremely long (> 500 chars) and
   *      starts with reasoning, truncate to the first conversational sentence.
   */
  private stripChainOfThought(text: string): string {
    if (!text) return text;

    // Strategy 1: Look for explicit meta-transition markers and take what follows.
    const transitionMarkers = [
      /Thus\s+(?:final\s+)?answer:\s*/gi,
      /So\s+final\s+answer:\s*/gi,
      /Final\s+answer:\s*/gi,
      /Thus\s+final\.\s*/gi,
      /Thus\s+answer:\s*/gi,
      /\bAnswer:\s*/g,
    ];

    let lastTransitionIdx = -1;
    let lastTransitionLen = 0;
    for (const marker of transitionMarkers) {
      const matches = text.matchAll(marker);
      for (const m of matches) {
        if (m.index !== undefined && m.index > lastTransitionIdx) {
          lastTransitionIdx = m.index;
          lastTransitionLen = m[0].length;
        }
      }
    }
    if (lastTransitionIdx >= 0) {
      const tail = text.slice(lastTransitionIdx + lastTransitionLen).trim();
      if (tail.length >= 10) {
        return tail;
      }
    }

    // Strategy 2: Detect reasoning opener at the start. The MiniMax model often
    // starts with "The user says", "The user is asking", etc. If found, strip
    // until we hit a natural reply opener OR a blank-line break OR the end.
    const reasoningOpeners = [
      /^The\s+user\s+(?:says|saying|is\s+asking|asks|asked|requested|wants|wants\s+to)\s+/i,
      /^According\s+to\s+(?:system|the)\s+(?:instruction|prompt|instructions)/i,
      /^Looking\s+at\s+(?:the\s+)?(?:live|tenant|user)/i,
      /^The\s+assistant\s+(?:is|should|must)/i,
      /^I\s+(?:should|need\s+to|must|will)\s+/i,
    ];

    let startsWithReasoning = false;
    for (const opener of reasoningOpeners) {
      if (opener.test(text)) {
        startsWithReasoning = true;
        break;
      }
    }

    if (startsWithReasoning) {
      // Look for the start of the actual reply. Patterns:
      //  - Natural opener at start of a line/paragraph: "Hey!", "Sure,", "Got it,", "Hi", "Hello", "OK", "Okay"
      //  - Blank line break (paragraph break)
      //  - End of string
      const naturalOpeners = [
        /^(?:Hey|Hi|Hello|OK|Okay|Got it|Sure|No problem|Of course|Thanks|Absolutely|Great|Alright|Yeah|Yes)[\s!,.]/im,
        /^[A-Z][a-z]+,?\s+[a-z]/m, // "Sure, I can help"
      ];

      for (const opener of naturalOpeners) {
        const m = text.match(opener);
        if (m && m.index !== undefined && m.index > 20) {
          // Only strip if the opener is far enough from start (otherwise we
          // might be stripping legitimate content)
          const tail = text.slice(m.index).trim();
          if (tail.length >= 10) {
            return tail;
          }
        }
      }

      // Fallback: if there's a blank-line break, take content after the first one
      const blankLineIdx = text.indexOf('\n\n');
      if (blankLineIdx > 50 && blankLineIdx < text.length - 50) {
        const tail = text.slice(blankLineIdx + 2).trim();
        if (tail.length >= 10) {
          return tail;
        }
      }

      // Last resort: if the response is very long and seems to be mostly reasoning,
      // take the last sentence (often that's where the real answer lives)
      if (text.length > 800) {
        // Split by common sentence terminators and take the last 1-2 sentences
        const sentences = text.match(/[^.!?]+[.!?]+/g);
        if (sentences && sentences.length >= 3) {
          // Find a good break point — take from the sentence that looks like a real reply
          // (starts with capital letter, doesn't contain reasoning markers)
          const reasoningWords =
            /the user|system instruction|should|must|need to|according to|looking at/i;
          for (let i = sentences.length - 1; i >= 0; i--) {
            const s = sentences[i].trim();
            if (s.length >= 15 && s.length <= 300 && !reasoningWords.test(s)) {
              // Concatenate this sentence and the previous one if it's also clean
              let result = s;
              if (i > 0) {
                const prev = sentences[i - 1].trim();
                if (prev.length <= 200 && !reasoningWords.test(prev)) {
                  result = prev + ' ' + result;
                }
              }
              return result.trim();
            }
          }
        }
      }
    }

    return text;
  }

  /**
   * Handle project-creation conversation flows without involving the LLM.
   *
   * Returns a string reply if the message clearly asks to create a project,
   * otherwise returns null and the caller falls through to the normal
   * model-based flow.
   *
   * Why we do this: the MiniMax-M2.7-highspeed model is heavily instruction-
   * tuned to dump structured lists ("Required: Name, Description, ...")
   * whenever a user asks to create a project. That's the opposite of what
   * users want — they want a natural chat, one question at a time. Rather
   * than fight the model's training with prompts, we own the conversation
   * for this specific intent.
   *
   * The conversation is short and deterministic:
   *   - First turn ("I want to create a project"): greet and ask the first
   *     question (project name + what it is).
   *   - Second turn (user replied with details): ask about the deadline /
   *     target date.
   *   - Third turn: ask about budget.
   *   - Fourth turn: confirm and create.
   *
   * SIM-04 FIX: bypass the deterministic intercept when the user explicitly
   * names the createProject tool, supplies an industry slug, or supplies a
   * project name + an industry + priority in a single turn. In those
   * cases the user is signalling "fire the tool now", not "have a chat
   * with me about it". Letting those messages fall through to the agent
   * graph produces a one-shot createProject call instead of an endless
   * scripted Q&A loop.
   */
  private handleProjectCreationConversation(
    dto: SendChatMessageDto,
    conversationId: string,
  ): string | null {
    const msg = dto.message.toLowerCase().trim();
    // The conversationId is passed in for traceability — we use it as the
    // logger context so every scripted reply carries the conversation id
    // without needing the caller to thread the logger context through.
    void conversationId;
    this.logger.debug?.(
      `[chat] handleProjectCreationConversation: conv=${conversationId} message="${msg.slice(0, 80)}"`,
    );

    // Only trigger on the first user message. Once we've answered, the
    // next user messages are interpreted by the model (or routed to the
    // action path) so we don't lock the user into this scripted flow.
    const alreadyInFlow = (dto.history ?? []).some(
      (m) => m.role === 'assistant' && m.content.includes('project'),
    );
    if (alreadyInFlow) return null;

    const projectCreationTriggers = [
      'create a project',
      'new project',
      'start a project',
      'make a project',
      'i want to create',
      'want to start',
      'add a project',
      'create project',
      'launch a project',
      'set up a project',
      'open a project',
    ];

    const isProjectCreation = projectCreationTriggers.some((trigger) =>
      msg.includes(trigger),
    );

    if (!isProjectCreation) return null;

    // SIM-04 FIX (NC-SIM04-001): if the user mentions the createProject
    // tool by name, supplies a known industry slug, or pairs the
    // creation intent with both a project name AND enough fields to
    // call createProject in a single turn, fall through to the agent
    // graph. The deterministic Q&A would otherwise loop forever on
    // these inputs.
    const explicitToolCall =
      /\bcreateProject\b|please call createProject|invoke createProject/i.test(
        dto.message,
      );
    if (explicitToolCall) return null;

    // Known industry slugs the LLM recognises. If the user supplies one
    // plus a project name, the LLM can call createProject with
    // industryHint set to that slug in a single turn.
    const knownIndustrySlugs = [
      'accounting-audit-services',
      'banking',
      'insurance',
      'healthcare',
      'retail',
      'manufacturing',
      'real-estate',
      'legal',
      'marketing',
      'technology',
      'education',
      'hospitality',
    ];
    const hasIndustrySlug = knownIndustrySlugs.some((slug) =>
      msg.includes(slug),
    );
    // Also accept the user providing any of the canonical industry
    // groups (broader catch-all).
    const hasIndustryGroup =
      msg.includes('accounting') ||
      msg.includes('audit') ||
      msg.includes('banking') ||
      msg.includes('healthcare');

    // Heuristic: a single turn with the creation intent + industry +
    // at least one of {name, customer name, budget, priority, target
    // date} is treated as a complete createProject payload.
    const hasEnoughContext =
      hasIndustrySlug ||
      (hasIndustryGroup &&
        (msg.includes('budget') ||
          msg.includes('priority') ||
          msg.includes('target date') ||
          msg.includes('monthly') ||
          msg.includes('quarterly') ||
          msg.includes('annual') ||
          msg.includes('for ') ||
          /\bfor\s+[A-Z][a-zA-Z]/.test(dto.message)));

    if (hasEnoughContext) return null;

    return "Sure, I can help with that! What's the project called, and what kind of work is it?";
  }

  /**
   * V2 streaming entry point. Returns an async iterable of text
   * deltas. Activated by `AI_GATEWAY_V2`. The legacy REST endpoint
   * is unchanged.
   *
   * Phase 3.2: action-looking messages (e.g. "create project X")
   * routed through the streaming endpoint are now sent to the agent
   * graph (which executes tools) instead of the conversation LLM.
   * Previously this only worked for the non-streaming `send()` path.
   */
  async *stream(
    dto: SendChatMessageDto,
    tenantIdFromJwt?: string,
    userIdFromJwt?: string,
  ): AsyncGenerator<{ delta: string; done: boolean }> {
    const tenantId =
      tenantIdFromJwt ??
      (dto.context?.['tenantId'] as string | undefined) ??
      null;

    // Generate / reuse conversationId and persist the user message BEFORE
    // streaming begins. Without this, streaming responses never appear in
    // /chat/history (see Phase 3.1 of the remediation plan).
    const conversationId =
      dto.conversationId ??
      `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const userIdForHistory =
      (dto.context?.['userId'] as string | undefined) ?? 'anonymous';
    const tenantIdForHistory = tenantId ?? 'unknown';

    void this.chatHistory.saveMessage({
      tenantId: tenantIdForHistory,
      userId: userIdForHistory,
      conversationId,
      role: 'user',
      content: dto.message,
    });

    // Accumulated assistant reply so we can persist after streaming completes.
    let accumulatedAssistantReply = '';
    let resolvedModel: string | undefined;
    let resolvedProvider: string | undefined;

    // Phase 3.2: action-looking messages streamed via /chat/stream are
    // routed to the agent graph (which executes tools) instead of the
    // plain conversation LLM. Previously only the non-streaming
    // `send()` path did this — streaming was locked to capability
    // 'conversation' regardless of intent, so streamed action
    // messages silently produced a fake "I'm offline" reply.
    const intent = this.detectIntent(dto.message);
    if (intent === 'action' && tenantId) {
      try {
        this.logger.log(
          `[chat.stream] Routing action request to agent graph: ${dto.message}`,
        );
        const result = await this.agentGraph.run({
          goal: dto.message,
          agentId: 'ai-assistant',
          tenantId,
          userId: userIdFromJwt ?? 'anonymous',
          sessionId: conversationId,
        });
        const messages = result.messages ?? [];
        const finalMessage = messages[messages.length - 1];
        const reply =
          finalMessage?.content ??
          (result.toolResults?.length > 0
            ? `Executed ${result.toolResults.length} tool(s).`
            : 'Action completed.');
        accumulatedAssistantReply = reply;
        this.saveReply(conversationId, tenantIdForHistory, userIdForHistory, {
          reply,
        });
        yield { delta: reply, done: false };
        yield { delta: '', done: true };
        return;
      } catch (err) {
        this.logger.error(
          `[chat.stream] action graph failed: ${(err as Error).message}`,
        );
        // Fall through to the conversation LLM so the user still gets
        // SOMETHING (better than a blank SSE end).
      }
    }

    const systemPrompt = `You are a friendly, helpful AI assistant who talks like a real person texting a colleague. Plain sentences only. No markdown, no bullet points, no dashes for lists, no bold, no headers. No internal reasoning. No <think> tags.

When the user wants to create a project, your reply must be EXACTLY in this conversational form:

"Sure, I can help with that! What kind of project — and what should I call it?"

Then stop. Wait for the user's answer. On the next turn, ask one more question (e.g., deadline or budget). Never dump a list of fields. Never use structured formatting. Just chat.

For all other questions, answer using the LIVE TENANT DATA below in plain conversational sentences. No structured output, no lists. If data is missing, say so directly.

When relevant, include a JSON block (no markdown fences) with keys: chartType, chartData [{label, value}].`;
    const liveData = tenantId
      ? await this.fetchTenantSnapshot(tenantId)
      : { note: 'no tenant context available' };
    const historyText = (dto.history ?? [])
      .slice(-10)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');
    const prompt = [
      `SYSTEM: ${systemPrompt}`,
      `\nLIVE TENANT DATA (JSON):\n${JSON.stringify(liveData, null, 2)}`,
      historyText ? `\nCONVERSATION:\n${historyText}` : '',
      `\nUSER: ${dto.message}`,
      '\nASSISTANT:',
    ]
      .filter(Boolean)
      .join('\n');
    // Buffer chunks so we can strip `<think>...</think>` blocks that arrive
    // across multiple deltas. We accumulate until we see `</think>` (or the
    // stream ends), then flush the sanitized tail.
    let buffer = '';
    let insideThink = false;
    let thinkClosed = false;

    for await (const chunk of this.aiGateway.stream({
      tenantId,
      capability: 'conversation',
      prompt,
      sourceModule: 'chat.stream',
      ...(dto.temperature !== undefined
        ? { temperature: dto.temperature }
        : {}),
      ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
    })) {
      if (chunk.done) {
        // Flush whatever remains in the buffer through the sanitizer. If we
        // never closed the think block, the sanitizer will strip it.
        const cleaned = this.sanitizeReply(buffer);
        if (cleaned) {
          accumulatedAssistantReply += cleaned;
          yield { delta: cleaned, done: false };
        }
        // Persist the assistant message. Fire-and-forget to avoid blocking
        // the terminal yield (the SSE service needs to send 'done' ASAP).
        // `tryGetLastResolved` always exists and returns `undefined` on
        // any failure (no exception bubbles up).
        const lastResolved = await this.tryGetLastResolved(tenantId);
        if (lastResolved) {
          resolvedModel = lastResolved.model?.modelId;
          resolvedProvider = lastResolved.provider?.slug;
        }
        this.saveReply(conversationId, tenantIdForHistory, userIdForHistory, {
          reply: accumulatedAssistantReply,
          model: resolvedModel,
          provider: resolvedProvider,
        });
        yield { delta: '', done: true };
        return;
      }

      buffer += chunk.delta;

      // Track think-block boundaries as they stream in.
      if (!thinkClosed) {
        const openMatch = buffer.match(/<think>/i);
        const closeMatch = buffer.match(/<\/think>/i);
        if (openMatch && closeMatch && closeMatch.index! >= openMatch.index!) {
          // Think block opened and closed within this same buffer chunk.
          // Flush everything AFTER the closing tag, sanitized.
          const tail = buffer.slice(closeMatch.index! + closeMatch[0].length);
          buffer = '';
          thinkClosed = true;
          insideThink = false;
          const cleaned = this.sanitizeReply(tail);
          if (cleaned) {
            accumulatedAssistantReply += cleaned;
            yield { delta: cleaned, done: false };
          }
        } else if (insideThink && closeMatch && !openMatch) {
          // We entered a think block in a prior chunk (already sliced off the
          // opening tag), and now the closing tag has arrived. Flush the content
          // before the closing tag (which is already in buffer).
          const tail = buffer.slice(0, closeMatch.index);
          buffer = buffer.slice(closeMatch.index! + closeMatch[0].length);
          thinkClosed = true;
          insideThink = false;
          const cleaned = this.sanitizeReply(tail);
          if (cleaned) {
            accumulatedAssistantReply += cleaned;
            yield { delta: cleaned, done: false };
          }
        } else if (openMatch && !closeMatch) {
          // Entering a think block; slice off the opening tag, content goes into
          // buffer for later.
          buffer = buffer.slice(openMatch.index! + openMatch[0].length);
          insideThink = true;
        } else if (!openMatch && buffer.length > 2048) {
          // No think tag detected anywhere and buffer is large — flush it as-is
          // through the sanitizer (handles no-think responses).
          const flushed = this.sanitizeReply(buffer);
          buffer = '';
          thinkClosed = true;
          insideThink = false;
          if (flushed) {
            accumulatedAssistantReply += flushed;
            yield { delta: flushed, done: false };
          }
        }
        // else: insideThink && no closeMatch yet — keep buffering
      } else {
        // Past the think block — yield raw deltas so the user sees them
        // streaming. The sanitizer runs on the final flush in the done chunk.
        accumulatedAssistantReply += chunk.delta;
        yield { delta: chunk.delta, done: false };
      }
    }
  }

  /**
   * Fire-and-forget ActivityEvent recorder. Silently swallows failures so chat
   * flows never break because observability is offline. Resolves input context
   * (tenantId) is required to write the event; without it we skip.
   */
  private recordChatActivitySafe(params: {
    tenantId: string | null;
    actorType: 'USER' | 'AI_AGENT' | 'SYSTEM';
    actorId: string;
    type: string;
    title: string;
    contextId: string;
    payload: Record<string, unknown>;
    sourceEventId: string;
    severity?: 'info' | 'error' | 'warning';
  }): void {
    if (!this.activityService || !params.tenantId) return;
    this.activityService
      .record({
        tenantId: params.tenantId,
        actorType: params.actorType,
        actorId: params.actorId,
        type: params.type,
        title: params.title,
        contextType: 'CHAT_CONVERSATION',
        contextId: params.contextId,
        payload: params.payload,
        severity: params.severity ?? 'info',
        visibility: 'tenant',
        sourceEventId: params.sourceEventId,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
      .catch((err) =>
        this.logger.warn(
          `Activity record failed for ${params.type}: ${String(err)}`,
        ),
      );
  }

  /**
   * Detect if user message is an action request or a query
   */
  private detectIntent(message: string): 'action' | 'query' {
    const actionKeywords = [
      'create',
      'add',
      'new',
      'make',
      'pause',
      'stop',
      'resume',
      'start',
      'activate',
      'list',
      'show',
      'get',
      'find',
      'assign',
      'delegate',
      'set',
      'delete',
      'remove',
      'archive',
    ];
    const lower = message.toLowerCase();
    return actionKeywords.some((k) => lower.includes(k)) ? 'action' : 'query';
  }

  /**
   * Pull a compact snapshot of the tenant for grounding the LLM.
   * All counts are scoped to `tenantId`. Errors degrade gracefully to null
   * fields so a single failed query doesn't kill the chat reply.
   */
  private async fetchTenantSnapshot(
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    // PERF-FIX: short-circuit on the LRU before fanning out 6 parallel
    // DB queries. Window is 30s — fresh enough that the LLM isn't
    // quoting stale numbers, and large enough to collapse burst
    // conversations (e.g. user fires 3 messages in 5 seconds).
    const cached = tenantSnapshotCache.get(tenantId);
    if (cached) return cached;

    const snap: Record<string, unknown> = {
      tenantId,
      generatedAt: new Date().toISOString(),
    };

    try {
      const [
        agentsByStatus,
        departmentsCount,
        tasksByStatus,
        workflowsByStatus,
        pendingApprovals,
        costMonth,
      ] = await Promise.all([
        this.prisma.agent
          .groupBy({
            by: ['status'],
            where: { tenantId },
            _count: { _all: true },
          })
          .catch(() => []),
        this.prisma.department
          .count({ where: { tenantId, status: 'ACTIVE' } })
          .catch(() => null),
        this.prisma.task
          .groupBy({
            by: ['status'],
            where: { tenantId },
            _count: { _all: true },
          })
          .catch(() => []),
        this.prisma.workflow
          .groupBy({
            by: ['status'],
            where: { tenantId },
            _count: { _all: true },
          })
          .catch(() => []),
        this.prisma.approvalRequest
          .count({ where: { tenantId, status: 'PENDING' } })
          .catch(() => null),
        this.prisma.costRecord
          .aggregate({
            where: {
              tenantId,
              windowStart: {
                gte: new Date(
                  new Date().getFullYear(),
                  new Date().getMonth(),
                  1,
                ),
              },
            },
            _sum: { costCents: true },
          })
          .catch(() => null),
      ]);

      // Build agent counts map
      const agentCounts: Record<string, number> = {};
      let totalAgents = 0;
      for (const row of agentsByStatus) {
        const count = row._count?._all ?? 0;
        agentCounts[row.status] = count;
        totalAgents += count;
      }

      // Build task counts map
      const taskCounts: Record<string, number> = {};
      let totalTasks = 0;
      for (const row of tasksByStatus) {
        const count = row._count?._all ?? 0;
        taskCounts[row.status] = count;
        totalTasks += count;
      }

      // Build workflow counts map
      const workflowCounts: Record<string, number> = {};
      let totalWorkflows = 0;
      for (const row of workflowsByStatus) {
        const count = row._count?._all ?? 0;
        workflowCounts[row.status] = count;
        totalWorkflows += count;
      }

      snap.agents = {
        total: totalAgents,
        byStatus: agentCounts,
      };
      snap.departments = { active: departmentsCount };
      snap.tasks = {
        total: totalTasks,
        byStatus: taskCounts,
      };
      snap.workflows = {
        total: totalWorkflows,
        byStatus: workflowCounts,
      };
      snap.approvals = { pending: pendingApprovals };
      snap.cost = {
        monthToDateCents: costMonth?._sum?.costCents
          ? Number(costMonth._sum.costCents)
          : 0,
        currency: 'USD',
      };
    } catch (err) {
      this.logger.warn(
        `fetchTenantSnapshot failed for ${tenantId}: ${(err as Error).message}`,
      );
      snap.error = (err as Error).message;
    }

    // Cache the snapshot (success or partial-failure) so subsequent
    // chat messages within the TTL window skip the 6 parallel queries.
    tenantSnapshotCache.set(tenantId, snap);

    return snap;
  }
}
