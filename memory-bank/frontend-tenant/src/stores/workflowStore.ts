// ─── workflowStore.ts ────────────────────────────────────────────────────────
// Refactored: uses WorkflowRepository + domain Workflow type.
// Backward-compatible export: useWorkflowStore

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { workflowRepository } from '@/core/repositories/WorkflowRepository';
import type { Workflow, WorkflowStatus } from '@/shared/types/domain.types';

export type { Workflow };

interface WorkflowState {
  workflows: Workflow[];
  total: number;
  page: number;
  loading: boolean;
  error: string | null;

  fetchWorkflows: (page?: number, limit?: number) => Promise<void>;
  updateWorkflowStatus: (id: string, status: WorkflowStatus) => void;
  setPage: (page: number) => void;
  reset: () => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set) => ({
      workflows: [],
      total: 0,
      page: 1,
      loading: false,
      error: null,

      fetchWorkflows: async (page = 1, limit = 20) => {
        set({ loading: true, page, error: null });
        try {
          const { items, total } = await workflowRepository.findAll({ page, limit });
          set({ workflows: items, total });
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      updateWorkflowStatus: (id, status) =>
        set((state) => ({
          workflows: state.workflows.map((w) => (w.id === id ? { ...w, status } : w)),
        })),

      setPage: (page) => set({ page }),

      reset: () => set({ workflows: [], total: 0, page: 1, loading: false, error: null }),
    }),
    {
      name: 'hq_workflow_store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ workflows: state.workflows, total: state.total, page: state.page }),
    },
  ),
);
