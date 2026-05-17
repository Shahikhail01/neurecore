// ─── taskStore.ts ─────────────────────────────────────────────────────────────
// Refactored: uses TaskRepository + domain Task type.
// Backward-compatible export: useTaskStore

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { taskRepository } from '@/core/repositories/TaskRepository';
import type { Task, TaskStatus } from '@/shared/types/domain.types';

export type { Task };

interface TaskState {
  tasks: Task[];
  total: number;
  page: number;
  loading: boolean;
  error: string | null;

  fetchTasks: (page?: number, limit?: number, agentId?: string) => Promise<void>;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  setPage: (page: number) => void;
  reset: () => void;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set) => ({
      tasks: [],
      total: 0,
      page: 1,
      loading: false,
      error: null,

      fetchTasks: async (page = 1, limit = 20, agentId?: string) => {
        set({ loading: true, page, error: null });
        try {
          type QP = import('@/core/repositories/interfaces/IRepository').QueryParams;
          const query: QP = { page, limit };
          if (agentId) query.agentId = agentId;
          const { items, total } = await taskRepository.findAll(query);
          set({ tasks: items, total });
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      updateTaskStatus: (id, status) =>
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
        })),

      setPage: (page) => set({ page }),

      reset: () => set({ tasks: [], total: 0, page: 1, loading: false, error: null }),
    }),
    {
      name: 'hq_task_store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tasks: state.tasks, total: state.total, page: state.page }),
    },
  ),
);
