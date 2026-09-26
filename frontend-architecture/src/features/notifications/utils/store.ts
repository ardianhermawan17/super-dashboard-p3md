import { create } from 'zustand';
import type { NotificationStatus, NotificationAction } from '@/components/ui/notification-card';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction
} from '../actions';

export type Notification = {
  id: string;
  title: string;
  body: string | null;
  status: NotificationStatus;
  createdAt: string;
  link?: string | null;
  type?: string;
  actions?: NotificationAction[];
};

type NotificationState = {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (items: Notification[], unread: number) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  addNotification: (notification: Omit<Notification, 'status'>) => void;
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (items, unread) => {
    set({ notifications: items, unreadCount: unread });
  },

  markAsRead: (id) => {
    const prev = get().notifications;
    const target = prev.find((n) => n.id === id);
    if (!target || target.status === 'read') return;

    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, status: 'read' } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1)
    }));

    markNotificationReadAction(id).catch(() => {});
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, status: 'read' })),
      unreadCount: 0
    }));

    markAllNotificationsReadAction().catch(() => {});
  },

  removeNotification: (id) => {
    set((state) => {
      const removed = state.notifications.find((n) => n.id === id);
      const isUnread = removed?.status === 'unread';
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: isUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
      };
    });
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [
        {
          ...notification,
          status: 'unread'
        },
        ...state.notifications
      ],
      unreadCount: state.unreadCount + 1
    }));
  }
}));
