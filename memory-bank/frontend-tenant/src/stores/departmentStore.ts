// ─── departmentStore.ts ───────────────────────────────────────────────────────
// SRP: Department list state management.
// Uses DepartmentRepository + domain Department type.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { departmentRepository } from '@/core/repositories/DepartmentRepository';
import type { Department } from '@/shared/types/domain.types';

export type { Department };

interface DepartmentState {
  departments: Department[];
  selected: Department | null;
  total: number;
  loading: boolean;
  error: string | null;

  fetchDepartments: () => Promise<void>;
  fetchDepartment: (id: string) => Promise<void>;
  setSelected: (dept: Department | null) => void;
  reset: () => void;
}

export const useDepartmentStore = create<DepartmentState>()(
  persist(
    (set) => ({
      departments: [],
      selected: null,
      total: 0,
      loading: false,
      error: null,

      fetchDepartments: async () => {
        set({ loading: true, error: null });
        try {
          const { items, total } = await departmentRepository.findAll();
          set({ departments: items, total });
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      fetchDepartment: async (id) => {
        set({ loading: true, error: null });
        try {
          const dept = await departmentRepository.findById(id);
          set({ selected: dept });
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      setSelected: (selected) => set({ selected }),

      reset: () => set({ departments: [], selected: null, total: 0, loading: false, error: null }),
    }),
    {
      name: 'hq_department_store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ departments: state.departments, total: state.total }),
    },
  ),
);
