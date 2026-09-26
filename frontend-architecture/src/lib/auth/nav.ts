import type { NavGroup, NavItem } from '@/types';

/**
 * Filter individual navigation items based on claims permissions.
 * Items without a permission requirement remain visible to any signed-in user.
 */
export function visibleNav(items: NavItem[], permissions: string[]): NavItem[] {
  return items
    .filter((item) => {
      const requiredPermission = item.access?.permission;
      if (!requiredPermission) return true;
      return permissions.includes(requiredPermission);
    })
    .map((item) => {
      if (item.items && item.items.length > 0) {
        return {
          ...item,
          items: visibleNav(item.items, permissions)
        };
      }
      return item;
    });
}

/**
 * Filter navigation groups based on claims permissions.
 * Groups with no remaining visible items are filtered out.
 */
export function visibleNavGroups(groups: NavGroup[], permissions: string[]): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: visibleNav(group.items, permissions)
    }))
    .filter((group) => group.items.length > 0);
}
