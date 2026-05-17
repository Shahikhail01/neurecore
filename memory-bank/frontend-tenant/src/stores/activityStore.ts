// ─── Activity Stream Store ────────────────────────────────────────────────────
// S — Single Responsibility: ring-buffer of real-time activity events
import { create } from 'zustand';
import type { ActivityEvent } from '@/types/ui.types';

const MAX_EVENTS = 50;

interface ActivityStore {
  events: ActivityEvent[];
  addEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useActivityStore = create<ActivityStore>((set) => ({
  events: [],
  addEvent: (event) =>
    set((state) => ({
      events: [
        { ...event, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
        ...state.events,
      ].slice(0, MAX_EVENTS),
    })),
  dismiss: (id) => set((state) => ({ events: state.events.filter((e) => e.id !== id) })),
  clear: () => set({ events: [] }),
}));
