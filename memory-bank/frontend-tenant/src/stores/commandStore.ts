// ─── Command Palette Store ────────────────────────────────────────────────────
// S — Single Responsibility: manages command palette open/close and query state
import { create } from 'zustand';

interface CommandStore {
  open: boolean;
  query: string;
  openPalette: () => void;
  closePalette: () => void;
  setQuery: (q: string) => void;
}

export const useCommandStore = create<CommandStore>((set) => ({
  open: false,
  query: '',
  openPalette: () => set({ open: true, query: '' }),
  closePalette: () => set({ open: false, query: '' }),
  setQuery: (q) => set({ query: q }),
}));
