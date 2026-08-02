// ─── useChat.ts (Unified) ──────────────────────────────────────────────────────
// SRP: Orchestrates ChatService + ChatStore + UI state for the chat panel.
// DIP: Depends on IChatService + ISlashCommandProvider + IJsonExtractor (abstractions).
// Uses React Zustand selectors (reactive, consistent with all 19 stores).

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  IChatService,
  ISlashCommandProvider,
  IJsonExtractor,
} from '@/core/services/interfaces/IChatService';
import type { ChatMessage, ChatConfig } from '@/shared/types/chat.types';
import { useChatStore } from '@/core/services/chat/chat.factory';
import type { IEnvelopeParser, Envelope } from '@/core/services/chat/envelope/interfaces/IEnvelopeParser';

let _msgId = 0;
function generateId(): string {
  return `msg_${Date.now()}_${++_msgId}`;
}

export function useChat(
  chatService: IChatService,
  slashCommands: ISlashCommandProvider,
  jsonExtractor: IJsonExtractor,
  envelopeParser: IEnvelopeParser,
  _config: ChatConfig,
  pageContext?: string,
) {
  const messagesRaw = useChatStore((s) => s.messages);
  const messages = Array.isArray(messagesRaw) ? messagesRaw : [];
  const open = useChatStore((s) => s.open);
  const sending = useChatStore((s) => s.sending);
  const conversationId = useChatStore((s) => s.conversationId);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const clearHistory = useChatStore((s) => s.clearHistory);
  const setConversationId = useChatStore((s) => s.setConversationId);
  const setOpen = useChatStore((s) => s.setOpen);
  const toggleOpen = useChatStore((s) => s.toggleOpen);
  const setSending = useChatStore((s) => s.setSending);
  const pendingExternalMessage = useChatStore((s) => s.pendingExternalMessage);
  const consumeExternalMessage = useChatStore((s) => s.consumeExternalMessage);

  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const sendMessageRef = useRef<((content: string) => Promise<void>) | null>(null);
  const storedEnvelopeRef = useRef<Envelope | undefined>(undefined);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || sending) return;

      setError(null);
      setSending(true);

      if (abortRef.current) {
        abortRef.current();
      }

      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };
      addMessage(userMsg);

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        metadata: { isStreaming: true },
      };
      addMessage(assistantMsg);

      const context = slashCommands.getContextForTrigger(content.toLowerCase());
      const isAutonomousOnboarding = /\bonboard\b/i.test(content) && /\b(q3|quarter|return|workflow)\b/i.test(content);
      if (isAutonomousOnboarding) {
        try {
          const response = await chatService.sendMessage({
            message: content.trim(),
            conversationId: conversationId ?? undefined,
            context: { pageContext, slashContext: context },
          });
          const pending = response.autonomousExecution?.pendingApproval;
          updateMessage(assistantMsg.id, {
            content: response.reply,
            timestamp: new Date().toISOString(),
            metadata: {
              isStreaming: false,
              autonomousApproval: pending && response.autonomousExecution
                ? {
                    executionId: response.autonomousExecution.executionId,
                    approvalId: pending.approvalId,
                    toolName: pending.toolName,
                    reason: pending.reason,
                    status: 'PENDING',
                  }
                : undefined,
            },
          });
          setConversationId(response.conversationId);
        } catch (err) {
          removeMessage(assistantMsg.id);
          setError(err instanceof Error ? err.message : 'Autonomous workflow failed');
        } finally {
          setSending(false);
        }
        return;
      }
      const accumulatedContent: string[] = [];
      storedEnvelopeRef.current = undefined;

      const cleanup = chatService.sendMessageStream(
        {
          message: content.trim(),
          conversationId: conversationId ?? undefined,
          context: { pageContext, slashContext: context },
        },
        (text) => {
          accumulatedContent.push(text);
          updateMessage(assistantMsg.id, { content: accumulatedContent.join('') });
        },
        (newConversationId) => {
          const finalContent = accumulatedContent.join('');
          const parsedChart = jsonExtractor.extract(finalContent);
          updateMessage(assistantMsg.id, {
            content: parsedChart?.cleaned ?? finalContent,
            timestamp: new Date().toISOString(),
            metadata: {
              isStreaming: false,
              chart:
                parsedChart?.chartData && parsedChart.chartType
                  ? {
                      chartType: parsedChart.chartType as 'bar',
                      chartData: parsedChart.chartData as Array<{ label: string; value: number }>,
                    }
                  : undefined,
              // Phase 9: preserve envelope from SSE delta so
              // UnifiedChatMessage can render chart/table/metrics
              // without re-parsing the content.
              ...(storedEnvelopeRef.current
                ? { envelope: storedEnvelopeRef.current }
                : {}),
            },
          });
          setConversationId(newConversationId);
        },
        (errorMessage) => {
          removeMessage(assistantMsg.id);
          setError(errorMessage ?? 'Sorry, something went wrong. Please try again.');
        },
        () => {
          setSending(false);
        },
        (envelope) => {
          // Envelope arrives as a sibling of `text` in the SSE delta
          // (Phase 9 wire format). Store it on the message metadata
          // so EnvelopeRenderer picks it up on the next render.
          storedEnvelopeRef.current = envelope as Envelope | undefined;
          updateMessage(assistantMsg.id, {
            metadata: {
              isStreaming: true,
              envelope: storedEnvelopeRef.current,
            },
          });
        },
      );

      abortRef.current = cleanup ?? null;
    },
    [
      chatService,
      slashCommands,
      jsonExtractor,
      envelopeParser,
      pageContext,
      sending,
      conversationId,
      addMessage,
      updateMessage,
      removeMessage,
      setConversationId,
      setSending,
    ],
  );

  // Keep latest sendMessage in a ref so external-trigger effect can call it
  // without re-running when its identity changes.
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  // Consume external message requests (e.g., HomeHero prompt bar).
  // Subscribe to pendingExternalMessage so the effect re-runs when a new
  // request arrives AFTER mount (Zustand selectors are stable references,
  // so depending only on `consumeExternalMessage` would never re-fire).
  useEffect(() => {
    if (!pendingExternalMessage) return;
    const pending = consumeExternalMessage();
    if (pending) {
      void sendMessageRef.current?.(pending);
    }
  }, [pendingExternalMessage, consumeExternalMessage]);

  return {
    messages,
    open,
    sending,
    error,
    sendMessage,
    clearHistory,
    setOpen,
    toggleOpen,
    setError,
  };
}
