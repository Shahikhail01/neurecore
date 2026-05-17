'use client';
// ─── useChat Hook (Admin Portal) ──────────────────────────────────────────────
// Mirror of tenant useChat — no shared code (D principle)
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

      const userMsg: ConversationMessage = {
        id: makeId(),
        role: 'user',
        content: query.trim(),
        timestamp: new Date().toISOString(),
      };
      addMessage(userMsg);

      const assistantId = makeId();
      addMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        streaming: true,
        timestamp: new Date().toISOString(),
      });
      setSending(true);

      try {
        const response = await chatService.sendMessage({
          query: query.trim(),
          context,
          conversationId: conversationId ?? undefined,
        });

        if (response.id && !conversationId) setConversationId(response.id);

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
        useChatStore.setState((s) => ({
          messages: s.messages.map((m) => (m.id === assistantId ? finalMsg : m)),
        }));
      } catch {
        updateStreamingMessage(assistantId, '_Error. Try again._', true);
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
