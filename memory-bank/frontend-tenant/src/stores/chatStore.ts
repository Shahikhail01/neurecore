// ─── Chat Store (Tenant Portal) ───────────────────────────────────────────────
// S — Single Responsibility: conversational message history only
import { create } from 'zustand';
import type { ConversationMessage } from '@/types/chat.types';

const MAX_MESSAGES = 100;

interface ChatState {
  open: boolean;
  messages: ConversationMessage[];
  conversationId: string | null;

  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  addMessage: (msg: ConversationMessage) => void;
  updateStreamingMessage: (id: string, content: string, done?: boolean) => void;
  clearHistory: () => void;
  setConversationId: (id: string) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  open: false,
  messages: [],
  conversationId: null,

  setOpen: (open) => set({ open }),
  toggleOpen: () => set((s) => ({ open: !s.open })),

  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages.slice(-(MAX_MESSAGES - 1)), msg],
    })),

  updateStreamingMessage: (id, content, done = false) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content, streaming: !done } : m,
      ),
    })),

  clearHistory: () => set({ messages: [], conversationId: null }),

  setConversationId: (conversationId) => set({ conversationId }),
}));
