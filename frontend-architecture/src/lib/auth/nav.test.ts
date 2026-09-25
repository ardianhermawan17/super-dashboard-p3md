import { describe, it, expect } from 'bun:test';
import { visibleNav, visibleNavGroups } from './nav';
import type { NavGroup, NavItem } from '@/types';

describe('visibleNav unit tests', () => {
  const items: NavItem[] = [
    { title: 'Overview', url: '/dashboard/overview' },
    { title: 'AI Chat', url: '/dashboard/ai-chat', access: { permission: 'agent.chat' } },
    { title: 'Users', url: '/dashboard/admin/users', access: { permission: 'users.read' } },
    { title: 'Groups', url: '/dashboard/admin/groups', access: { permission: 'groups.manage' } }
  ];

  it('shows items without permission to everyone', () => {
    const result = visibleNav(items, []);
    expect(result.map((i) => i.title)).toEqual(['Overview']);
  });

  it('filters items correctly based on granted permissions', () => {
    const result = visibleNav(items, ['agent.chat', 'users.read']);
    expect(result.map((i) => i.title)).toEqual(['Overview', 'AI Chat', 'Users']);
  });

  it('filters nested items recursively', () => {
    const nestedItems: NavItem[] = [
      {
        title: 'Admin',
        url: '#',
        items: [
          { title: 'Users', url: '/admin/users', access: { permission: 'users.read' } },
          { title: 'Roles', url: '/admin/roles', access: { permission: 'roles.manage' } }
        ]
      }
    ];

    const result = visibleNav(nestedItems, ['users.read']);
    expect(result[0].items?.map((i) => i.title)).toEqual(['Users']);
  });
});

describe('visibleNavGroups unit tests', () => {
  const groups: NavGroup[] = [
    {
      label: 'General',
      items: [{ title: 'Overview', url: '/dashboard/overview' }]
    },
    {
      label: 'Admin',
      items: [
        { title: 'Users', url: '/dashboard/admin/users', access: { permission: 'users.read' } }
      ]
    }
  ];

  it('hides empty groups when no items are visible', () => {
    const result = visibleNavGroups(groups, []);
    expect(result.map((g) => g.label)).toEqual(['General']);
  });

  it('includes admin group when permission matches', () => {
    const result = visibleNavGroups(groups, ['users.read']);
    expect(result.map((g) => g.label)).toEqual(['General', 'Admin']);
  });
});
