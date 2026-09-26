'use client';

import * as React from 'react';
import type { NavGroup, NavItem } from '@/types';
import { visibleNav, visibleNavGroups } from '@/lib/auth/nav';
import { createClient } from '@/lib/supabase/client';

export function usePermissions(): string[] {
  const [permissions, setPermissions] = React.useState<string[]>([]);
  const supabase = createClient();

  React.useEffect(() => {
    supabase.auth.getClaims().then(({ data }) => {
      const claims = data?.claims as { app_permissions?: string[] } | undefined;
      setPermissions(claims?.app_permissions ?? []);
    });
  }, [supabase]);

  return permissions;
}

export function useFilteredNavItems(items: NavItem[]): NavItem[] {
  const permissions = usePermissions();
  return React.useMemo(() => visibleNav(items, permissions), [items, permissions]);
}

export function useFilteredNavGroups(groups: NavGroup[]): NavGroup[] {
  const permissions = usePermissions();
  return React.useMemo(() => visibleNavGroups(groups, permissions), [groups, permissions]);
}
