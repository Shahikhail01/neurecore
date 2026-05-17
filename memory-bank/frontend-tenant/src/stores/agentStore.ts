// ─── agentStore.ts ───────────────────────────────────────────────────────────
// Refactored: uses AgentRepository (repository pattern) + domain Agent type.
// Backward-compatible export: useAgentStore

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { agentRepository } from '@/core/repositories/AgentRepository';
import type { Agent, AgentStatus } from '@/shared/types/domain.types';

// Re-export domain type for consumers that imported the old local Agent
export type { Agent };

interface AgentState {
  agents: Agent[];
  selected: Agent | null;
  total: number;
  loading: boolean;
  error: string | null;

  fetchAgents: (page?: number, limit?: number) => Promise<void>;
  fetchAgent: (id: string) => Promise<void>;
  setAgents: (agents: Agent[]) => void;
  updateAgentStatus: (id: string, status: AgentStatus) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      agents: [],
      selected: null,
      total: 0,
      loading: false,
      error: null,

      fetchAgents: async (page = 1, limit = 20) => {
        set({ loading: true, error: null });
        try {
          const { items, total } = await agentRepository.findAll({ page, limit });
          set({ agents: items, total });
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      fetchAgent: async (id) => {
        set({ loading: true, error: null });
        try {
          const agent = await agentRepository.findById(id);
          set({ selected: agent });
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      setAgents: (agents) => set({ agents }),

      updateAgentStatus: (id, status) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, status } : a)),
          selected: state.selected?.id === id ? { ...state.selected, status } : state.selected,
        })),

      reset: () => set({ agents: [], selected: null, total: 0, loading: false, error: null }),
    }),
    {
      name: 'hq_agent_store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ agents: state.agents, total: state.total }),
    },
  ),
);
