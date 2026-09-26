'use server';

import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require';
import type { AdminUserRow, GroupItem, InvitePayload, RoleItem } from './types';

export async function getAdminUsersData(): Promise<{
  users: AdminUserRow[];
  roles: RoleItem[];
  groups: GroupItem[];
}> {
  await requirePermission('users.read');
  const supabase = await createClient();

  // 1. Fetch user list from admin helper
  const { data: rawUsers, error: usersErr } = await supabase.rpc('admin_list_users');
  if (usersErr) throw new Error(usersErr.message);

  // 2. Fetch all metadata
  const [{ data: roles }, { data: groups }, { data: userRoles }, { data: groupMembers }, { data: groupRoles }] =
    await Promise.all([
      supabase.from('roles').select('*'),
      supabase.from('groups').select('*'),
      supabase.from('user_roles').select('*'),
      supabase.from('group_members').select('*'),
      supabase.from('group_roles').select('*')
    ]);

  const allRoles: RoleItem[] = (roles ?? []) as RoleItem[];
  const allGroups: GroupItem[] = (groups ?? []) as GroupItem[];
  const rolesMap = new Map<string, RoleItem>(allRoles.map((r) => [r.id, r]));
  const groupsMap = new Map<string, GroupItem>(allGroups.map((g) => [g.id, g]));

  const users: AdminUserRow[] = (rawUsers ?? []).map((u) => {
    // User's direct roles
    const directRoleIds = (userRoles ?? []).filter((ur) => ur.user_id === u.id).map((ur) => ur.role_id);
    const directRoles = directRoleIds.map((id) => rolesMap.get(id)).filter(Boolean) as RoleItem[];

    // User's groups
    const userGroupIds = (groupMembers ?? []).filter((gm) => gm.user_id === u.id).map((gm) => gm.group_id);
    const userGroups = userGroupIds.map((id) => groupsMap.get(id)).filter(Boolean) as GroupItem[];

    // User's inherited roles
    const inheritedRoles: { id: string; slug: string; name: string; viaGroup: string }[] = [];
    for (const group of userGroups) {
      const grs = (groupRoles ?? []).filter((gr) => gr.group_id === group.id);
      for (const gr of grs) {
        const role = rolesMap.get(gr.role_id);
        if (role && !directRoles.some((dr) => dr.id === role.id)) {
          inheritedRoles.push({
            id: role.id,
            slug: role.slug,
            name: role.name,
            viaGroup: group.name
          });
        }
      }
    }

    return {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      status: u.status,
      last_sign_in_at: u.last_sign_in_at,
      created_at: u.created_at,
      groups: userGroups,
      directRoles,
      inheritedRoles
    };
  });

  return { users, roles: allRoles, groups: allGroups };
}

export async function inviteUsersAction(invites: InvitePayload[], sendEmail = true) {
  await requirePermission('users.manage');
  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: {
      action: 'invite',
      invites,
      sendEmail
    }
  });

  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, invited: data?.invited ?? invites.length };
}

export async function toggleUserSuspensionAction(userId: string, action: 'suspend' | 'reactivate') {
  await requirePermission('users.manage');
  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: {
      action,
      userId
    }
  });

  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}

export async function updateUserMembershipsAction(
  userId: string,
  roleIds: string[],
  groupIds: string[]
) {
  await requirePermission('users.manage');
  const supabase = await createClient();

  // 1. Update roles: delete current, insert new
  const { error: delRolesErr } = await supabase.from('user_roles').delete().eq('user_id', userId);
  if (delRolesErr) return { ok: false, error: delRolesErr.message };

  if (roleIds.length > 0) {
    const { error: insRolesErr } = await supabase
      .from('user_roles')
      .insert(roleIds.map((role_id) => ({ user_id: userId, role_id })));
    if (insRolesErr) return { ok: false, error: insRolesErr.message };
  }

  // 2. Update groups: preserve system 'all-members', update others
  const { data: allMembersGroup } = await supabase
    .from('groups')
    .select('id')
    .eq('slug', 'all-members')
    .single();

  const finalGroupIds = Array.from(
    new Set([...groupIds, ...(allMembersGroup?.id ? [allMembersGroup.id] : [])])
  );

  const { error: delGroupsErr } = await supabase.from('group_members').delete().eq('user_id', userId);
  if (delGroupsErr) return { ok: false, error: delGroupsErr.message };

  if (finalGroupIds.length > 0) {
    const { error: insGroupsErr } = await supabase
      .from('group_members')
      .insert(finalGroupIds.map((group_id) => ({ user_id: userId, group_id })));
    if (insGroupsErr) return { ok: false, error: insGroupsErr.message };
  }

  return { ok: true };
}
