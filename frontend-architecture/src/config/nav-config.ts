import { NavGroup } from '@/types';

/**
 * Navigation configuration with RBAC permissions support.
 *
 * Items without `access.permission` are visible to all signed-in users.
 * Privileged pages carry permission keys mapped from database permissions.
 */
export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard/overview',
        icon: 'dashboard',
        isActive: false,
        shortcut: ['d', 'd'],
        items: []
      },
      {
        title: 'Kanban',
        url: '/dashboard/kanban',
        icon: 'kanban',
        shortcut: ['k', 'k'],
        isActive: false,
        items: []
      },
      {
        title: 'Chat',
        url: '/dashboard/chat',
        icon: 'chat',
        shortcut: ['c', 'c'],
        isActive: false,
        items: []
      },
      {
        title: 'AI Chat',
        url: '/dashboard/ai-chat',
        icon: 'sparkles',
        shortcut: ['a', 'i'],
        isActive: false,
        access: {
          permission: 'agent.chat'
        },
        items: []
      }
    ]
  },
  {
    label: 'Administration',
    items: [
      {
        title: 'Users',
        url: '/dashboard/admin/users',
        icon: 'user',
        access: {
          permission: 'users.read'
        },
        items: []
      },
      {
        title: 'Groups',
        url: '/dashboard/admin/groups',
        icon: 'teams',
        access: {
          permission: 'groups.manage'
        },
        items: []
      },
      {
        title: 'Roles',
        url: '/dashboard/admin/roles',
        icon: 'lock',
        access: {
          permission: 'roles.manage'
        },
        items: []
      },
      {
        title: 'Permissions',
        url: '/dashboard/admin/permissions',
        icon: 'adjustments',
        access: {
          permission: 'roles.manage'
        },
        items: []
      },
      {
        title: 'Integrations',
        url: '/dashboard/admin/integrations',
        icon: 'settings',
        access: {
          permission: 'integrations.manage'
        },
        items: []
      }
    ]
  },
  {
    label: 'Account',
    items: [
      {
        title: 'Notifications',
        url: '/dashboard/notifications',
        icon: 'notification',
        shortcut: ['n', 'n'],
        items: []
      }
    ]
  }
];
