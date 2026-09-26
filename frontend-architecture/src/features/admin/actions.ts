'use server';

import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require';
import type {
  AdminUserRow,
  GroupDetail,
  GroupItem,
  InvitePayload,
  PermissionCatalogueItem,
  RoleDetail,
  RoleItem
} from './types';

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
    const directRoleIds = (userRoles ?? []).filter((ur) => ur.user_id === u.id).map((ur) => ur.role_id);
    const directRoles = directRoleIds.map((id) => rolesMap.get(id)).filter(Boolean) as RoleItem[];

    const userGroupIds = (groupMembers ?? []).filter((gm) => gm.user_id === u.id).map((gm) => gm.group_id);
    const userGroups = userGroupIds.map((id) => groupsMap.get(id)).filter(Boolean) as GroupItem[];

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

  const { error: delRolesErr } = await supabase.from('user_roles').delete().eq('user_id', userId);
  if (delRolesErr) return { ok: false, error: delRolesErr.message };

  if (roleIds.length > 0) {
    const { error: insRolesErr } = await supabase
      .from('user_roles')
      .insert(roleIds.map((role_id) => ({ user_id: userId, role_id })));
    if (insRolesErr) return { ok: false, error: insRolesErr.message };
  }

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

// =================== GROUPS ACTIONS ===================

export async function getAdminGroupsData(): Promise<{
  groups: GroupDetail[];
  allRoles: RoleItem[];
  allUsers: { id: string; email: string; full_name: string | null }[];
}> {
  await requirePermission('groups.manage');
  const supabase = await createClient();

  const [{ data: groups }, { data: members }, { data: groupRoles }, { data: allRoles }, { data: rawUsers }] =
    await Promise.all([
      supabase.from('groups').select('*').order('name'),
      supabase.from('group_members').select('*'),
      supabase.from('group_roles').select('*'),
      supabase.from('roles').select('*'),
      supabase.rpc('admin_list_users')
    ]);

  const groupDetails: GroupDetail[] = (groups ?? []).map((g) => {
    const gMembers = (members ?? []).filter((m) => m.group_id === g.id);
    const gRoles = (groupRoles ?? []).filter((gr) => gr.group_id === g.id);
    return {
      id: g.id,
      slug: g.slug,
      name: g.name,
      description: g.description,
      is_system: g.is_system,
      memberCount: gMembers.length,
      memberIds: gMembers.map((m) => m.user_id),
      roleIds: gRoles.map((gr) => gr.role_id)
    };
  });

  const usersList = (rawUsers ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name
  }));

  return {
    groups: groupDetails,
    allRoles: (allRoles ?? []) as RoleItem[],
    allUsers: usersList
  };
}

export async function saveGroupAction(group: {
  id?: string;
  slug: string;
  name: string;
  description?: string;
}) {
  await requirePermission('groups.manage');
  const supabase = await createClient();

  if (group.id) {
    const { error } = await supabase
      .from('groups')
      .update({
        slug: group.slug,
        name: group.name,
        description: group.description ?? null
      })
      .eq('id', group.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('groups').insert({
      slug: group.slug,
      name: group.name,
      description: group.description ?? null
    });
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deleteGroupAction(groupId: string) {
  await requirePermission('groups.manage');
  const supabase = await createClient();

  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateGroupRolesAction(groupId: string, roleIds: string[]) {
  await requirePermission('roles.manage');
  const supabase = await createClient();

  const { error: delErr } = await supabase.from('group_roles').delete().eq('group_id', groupId);
  if (delErr) return { ok: false, error: delErr.message };

  if (roleIds.length > 0) {
    const { error: insErr } = await supabase
      .from('group_roles')
      .insert(roleIds.map((role_id) => ({ group_id: groupId, role_id })));
    if (insErr) return { ok: false, error: insErr.message };
  }

  return { ok: true };
}

export async function updateGroupMembersAction(groupId: string, userIds: string[]) {
  await requirePermission('groups.manage');
  const supabase = await createClient();

  const { error: delErr } = await supabase.from('group_members').delete().eq('group_id', groupId);
  if (delErr) return { ok: false, error: delErr.message };

  if (userIds.length > 0) {
    const { error: insErr } = await supabase
      .from('group_members')
      .insert(userIds.map((user_id) => ({ group_id: groupId, user_id })));
    if (insErr) return { ok: false, error: insErr.message };
  }

  return { ok: true };
}

// =================== ROLES & PERMISSIONS ACTIONS ===================

export async function getAdminRolesData(): Promise<{
  roles: RoleDetail[];
  allPermissions: { key: string; module: string; description: string }[];
  userPermissions: string[];
}> {
  await requirePermission('roles.manage');
  const supabase = await createClient();

  const [
    { data: roles },
    { data: rolePerms },
    { data: permissions },
    { data: userRoles },
    { data: groupRoles },
    { data: groupMembers },
    { data: claimsData }
  ] = await Promise.all([
    supabase.from('roles').select('*').order('name'),
    supabase.from('role_permissions').select('*'),
    supabase.from('permissions').select('*').order('module'),
    supabase.from('user_roles').select('*'),
    supabase.from('group_roles').select('*'),
    supabase.from('group_members').select('*'),
    supabase.auth.getClaims()
  ]);

  const claims = claimsData?.claims as { app_permissions?: string[] } | undefined;
  const userPermissions = claims?.app_permissions ?? [];

  const rolesList: RoleDetail[] = (roles ?? []).map((r) => {
    const pKeys = (rolePerms ?? []).filter((rp) => rp.role_id === r.id).map((rp) => rp.permission_key);
    const directUsers = new Set((userRoles ?? []).filter((ur) => ur.role_id === r.id).map((ur) => ur.user_id));

    const inheritedUsers = new Set<string>();
    const gIdsWithRole = (groupRoles ?? []).filter((gr) => gr.role_id === r.id).map((gr) => gr.group_id);
    for (const gid of gIdsWithRole) {
      const gMembers = (groupMembers ?? []).filter((gm) => gm.group_id === gid).map((gm) => gm.user_id);
      for (const uid of gMembers) {
        if (!directUsers.has(uid)) inheritedUsers.add(uid);
      }
    }

    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      is_system: r.is_system,
      permissionKeys: pKeys,
      directHolderCount: directUsers.size,
      inheritedHolderCount: inheritedUsers.size,
      totalHoldersCount: directUsers.size + inheritedUsers.size
    };
  });

  return {
    roles: rolesList,
    allPermissions: (permissions ?? []) as { key: string; module: string; description: string }[],
    userPermissions
  };
}

export async function saveRoleAction(role: {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}) {
  await requirePermission('roles.manage');
  const supabase = await createClient();

  let roleId = role.id;

  if (roleId) {
    const { error: updErr } = await supabase
      .from('roles')
      .update({
        slug: role.slug,
        name: role.name,
        description: role.description ?? null
      })
      .eq('id', roleId);
    if (updErr) return { ok: false, error: updErr.message };

    const { error: delPermsErr } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);
    if (delPermsErr) return { ok: false, error: delPermsErr.message };
  } else {
    const { data: newRole, error: insErr } = await supabase
      .from('roles')
      .insert({
        slug: role.slug,
        name: role.name,
        description: role.description ?? null
      })
      .select('id')
      .single();
    if (insErr) return { ok: false, error: insErr.message };
    roleId = newRole.id;
  }

  if (role.permissionKeys.length > 0 && roleId) {
    const { error: insPermsErr } = await supabase
      .from('role_permissions')
      .insert(role.permissionKeys.map((permission_key) => ({ role_id: roleId, permission_key })));
    if (insPermsErr) return { ok: false, error: insPermsErr.message };
  }

  return { ok: true };
}

export async function deleteRoleAction(roleId: string) {
  await requirePermission('roles.manage');
  const supabase = await createClient();

  const { error } = await supabase.from('roles').delete().eq('id', roleId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getAdminPermissionsCatalogueData(): Promise<{
  permissions: PermissionCatalogueItem[];
}> {
  await requirePermission('roles.manage');
  const supabase = await createClient();

  const [{ data: permissions }, { data: rolePerms }, { data: roles }] = await Promise.all([
    supabase.from('permissions').select('*').order('module'),
    supabase.from('role_permissions').select('*'),
    supabase.from('roles').select('*')
  ]);

  const rolesMap = new Map((roles ?? []).map((r) => [r.id, r]));

  const catalogue: PermissionCatalogueItem[] = (permissions ?? []).map((p) => {
    const grantingRoleIds = (rolePerms ?? [])
      .filter((rp) => rp.permission_key === p.key)
      .map((rp) => rp.role_id);
    const grantingRoles = grantingRoleIds
      .map((id) => rolesMap.get(id))
      .filter(Boolean)
      .map((r) => ({ id: r!.id, name: r!.name, slug: r!.slug }));

    return {
      key: p.key,
      module: p.module,
      description: p.description,
      grantingRoles
    };
  });

  return { permissions: catalogue };
}
