// ─── notificationStore.ts ────────────────────────────────────────────────────
// SRP: In-app notification queue management only.
// Cap at 100 notifications; newest first.

import { create } from 'zustand';
import type { Notification } from '@/shared/types/domain.types';

const MAX_NOTIFICATIONS = 100;

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;

  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

let _notifCounter = 0;
function nextId(): string {
  return `notif_${Date.now()}_${++_notifCounter}`;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (payload) => {
    const notification: Notification = {
      ...payload,
      id: nextId(),
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    set((state) => {
      const next = [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      return {
        notifications: next,
        unreadCount: next.filter((n) => !n.isRead).length,
      };
    });
  },

  markAsRead: (id) => {
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      );
      return { notifications, unreadCount: notifications.filter((n) => !n.isRead).length };
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  dismiss: (id) => {
    set((state) => {
      const notifications = state.notifications.filter((n) => n.id !== id);
      return { notifications, unreadCount: notifications.filter((n) => !n.isRead).length };
    });
  },

  dismissAll: () => set({ notifications: [], unreadCount: 0 }),
}));

// ─── Convenience selectors ────────────────────────────────────────────────────
export const selectCriticalNotifications = (state: NotificationState) =>
  state.notifications.filter((n) => n.priority === 'critical' && !n.isRead);

export const selectUnreadNotifications = (state: NotificationState) =>
  state.notifications.filter((n) => !n.isRead);
