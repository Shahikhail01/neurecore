// ─── Chat Store (Admin Portal) ────────────────────────────────────────────────
// S — Single Responsibility: conversational message history only
import { create } from 'zustand';
import type { ConversationMessage } from '@/types/chat.types';
import type { Scenario } from '@/types/strategy.types';

const MAX_MESSAGES = 100;

interface ChatState {
  open: boolean;
  // messages for the currently selected channel
  messages: ConversationMessage[];
  // mapping channel -> messages
  messagesByChannel: Record<string, ConversationMessage[]>;
  // currently active channel
  currentChannel: string;
  // mapping channel -> conversation id
  conversationIdByChannel: Record<string, string | null>;

  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setChannel: (channel: string) => void;
  addMessage: (msg: ConversationMessage) => void;
  updateStreamingMessage: (id: string, content: string, done?: boolean) => void;
  clearHistory: () => void;
  setConversationId: (id: string | null) => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  open: false,
  messages: [],
  messagesByChannel: {},
  currentChannel: 'all',
  conversationIdByChannel: {},

  setOpen: (open) => set({ open }),
  toggleOpen: () => set((s) => ({ open: !s.open })),

  setChannel: (channel) =>
    set((s) => ({ currentChannel: channel, messages: s.messagesByChannel[channel] ?? [] })),

  addMessage: (msg) =>
    set((s) => {
      const ch = (msg as any).channel ?? s.currentChannel ?? 'all';
      const list = [...(s.messagesByChannel[ch] ?? []).slice(-(MAX_MESSAGES - 1)), msg];
      const byChannel = { ...s.messagesByChannel, [ch]: list };
      return { messagesByChannel: byChannel, messages: ch === s.currentChannel ? list : s.messages };
    }),

  updateStreamingMessage: (id, content, done = false) =>
    set((s) => {
      const byChannel = Object.fromEntries(
        Object.entries(s.messagesByChannel).map(([k, arr]) => [
          k,
          arr.map((m) => (m.id === id ? { ...m, content, streaming: !done } : m)),
        ]),
      );
      return { messagesByChannel: byChannel, messages: byChannel[s.currentChannel] ?? [] };
    }),

  clearHistory: () =>
    set((s) => {
      const ch = s.currentChannel;
      const byChannel = { ...s.messagesByChannel, [ch]: [] };
      return { messagesByChannel: byChannel, messages: [], conversationIdByChannel: { ...s.conversationIdByChannel, [ch]: null } };
    }),

  setConversationId: (conversationId) =>
    set((s) => ({ conversationIdByChannel: { ...s.conversationIdByChannel, [s.currentChannel]: conversationId } })),
}));

// ─── Strategy Store (Admin only) ──────────────────────────────────────────────
// S — Single Responsibility: saved scenario management only
interface StrategyState {
  scenarios: Scenario[];
  currentScenarioId: string | null;

  addScenario: (s: Scenario) => void;
  removeScenario: (id: string) => void;
  setCurrentScenario: (id: string | null) => void;
  setScenarios: (s: Scenario[]) => void;
}

export const useStrategyStore = create<StrategyState>()((set) => ({
  scenarios: [],
  currentScenarioId: null,

  addScenario: (s) => set((prev) => ({ scenarios: [...prev.scenarios, s] })),
  removeScenario: (id) =>
    set((prev) => ({ scenarios: prev.scenarios.filter((s) => s.id !== id) })),
  setCurrentScenario: (id) => set({ currentScenarioId: id }),
  setScenarios: (scenarios) => set({ scenarios }),
}));
