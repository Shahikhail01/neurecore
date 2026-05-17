"use client";
// ─── useAIChat.ts ─────────────────────────────────────────────────────────────
// SRP: Bridges ConversationalAIService ↔ React component state.
// DIP: Depends on IConversationalAIService abstraction.

import { useState, useCallback, useEffect, useRef } from "react";
import { conversationalAIService } from "@/core/services/ConversationalAIService";
import type {
  ChatMessage,
  ConversationContext,
} from "@/core/services/interfaces/IConversationalAIService";
import { useAgentStore } from "@/stores/agentStore";

interface UseAIChatReturn {
  messages: ChatMessage[];
  isTyping: boolean;
  error: string | null;
  isAvailable: boolean;
  /** Send a message */
  send: (text: string) => Promise<void>;
  /** Apply a suggestion */
  applySuggestion: (text: string) => Promise<void>;
  /** Reset conversation */
  clear: () => void;
  /** Auto-scroll ref — attach to message container */
  bottomRef: React.RefObject<HTMLDivElement | null>;
}

export function useAIChat(pageContext?: string): UseAIChatReturn {
  const agents = useAgentStore((s) => s.agents);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    conversationalAIService.getHistory(),
  );
  const [isTyping, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep local messages in sync with service history
  const syncMessages = useCallback(() => {
    setMessages([...conversationalAIService.getHistory()]);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildContext = useCallback(
    (): ConversationContext => ({
      currentPage: pageContext,
      systemContext:
        agents.length > 0
          ? `Active agents: ${agents.filter((a) => a.status === "ACTIVE").length}/${agents.length}.`
          : undefined,
    }),
    [agents, pageContext],
  );

  const send = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setError(null);
      syncMessages(); // show user message immediately
      setTyping(true);
      try {
        await conversationalAIService.sendMessage(text, buildContext());
        syncMessages();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send message");
      } finally {
        setTyping(false);
      }
    },
    [buildContext, syncMessages],
  );

  const applySuggestion = useCallback((text: string) => send(text), [send]);

  const clear = useCallback(() => {
    conversationalAIService.clearHistory();
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isTyping,
    error,
    isAvailable: conversationalAIService.isAvailable(),
    send,
    applySuggestion,
    clear,
    bottomRef,
  };
}
