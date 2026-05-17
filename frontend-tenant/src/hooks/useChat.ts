'use client';
// ─── useChat Hook ─────────────────────────────────────────────────────────────
// S — Single Responsibility: message send/receive pipeline only
// D — Dependency Inversion: depends on chatService abstraction, not api directly
import { useCallback, useState } from 'react';
import { useChatStore } from '@/stores/chatStore';
import chatService from '@/services/chat.service';
import type { ChatRequest, ConversationMessage } from '@/types/chat.types';

function makeId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useChat() {
  const { messages, conversationId, addMessage, updateStreamingMessage, clearHistory: storeClear, setConversationId } = useChatStore();
  const [sending, setSending] = useState(false);

  const sendMessage = useCallback(
    async (query: string, context?: ChatRequest['context']) => {
      if (!query.trim() || sending) return;

      // Optimistically add user message
      const userMsg: ConversationMessage = {
        id: makeId(),
        role: 'user',
        content: query.trim(),
        timestamp: new Date().toISOString(),
      };
      addMessage(userMsg);

      // Placeholder assistant message (streaming state)
      const assistantId = makeId();
      const placeholder: ConversationMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        streaming: true,
        timestamp: new Date().toISOString(),
      };
      addMessage(placeholder);
      setSending(true);

      try {
        const response = await chatService.sendMessage({
          query: query.trim(),
          context,
          conversationId: conversationId ?? undefined,
        });

        if (response.id && !conversationId) {
          setConversationId(response.id);
        }

        updateStreamingMessage(assistantId, response.message, true);

        // Patch in data/suggestion/type on the final message
        const finalMsg: ConversationMessage = {
          id: assistantId,
          role: 'assistant',
          content: response.message,
          type: response.type,
          data: response.data,
          suggestion: response.suggestion,
          tokens: response.tokens,
          timestamp: response.timestamp,
          streaming: false,
        };
        // Replace placeholder with full message
        useChatStore.getState().updateStreamingMessage(assistantId, response.message, true);
        // Manually set the full object (updateStreamingMessage only patches content+streaming)
        useChatStore.setState((s) => ({
          messages: s.messages.map((m) => (m.id === assistantId ? finalMsg : m)),
        }));
      } catch {
        updateStreamingMessage(
          assistantId,
          '_Sorry, something went wrong. Please try again._',
          true,
        );
      } finally {
        setSending(false);
      }
    },
    [sending, conversationId, addMessage, updateStreamingMessage, setConversationId],
  );

  const clearHistory = useCallback(async () => {
    storeClear();
    await chatService.clearHistory();
  }, [storeClear]);

  return { messages, sending, sendMessage, clearHistory };
}
