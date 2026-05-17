// ─── Inspector Store ──────────────────────────────────────────────────────────
// S — Single Responsibility: manages only inspector panel open/close state
import { create } from 'zustand';
import type { InspectorType } from '@/types/ui.types';

interface InspectorStore {
  open: boolean;
  type: InspectorType | null;
  id: string | null;
  openInspector: (type: InspectorType, id: string) => void;
  closeInspector: () => void;
}

export const useInspectorStore = create<InspectorStore>((set) => ({
  open: false,
  type: null,
  id: null,
  openInspector: (type, id) => set({ open: true, type, id }),
  closeInspector: () => set({ open: false, type: null, id: null }),
}));
