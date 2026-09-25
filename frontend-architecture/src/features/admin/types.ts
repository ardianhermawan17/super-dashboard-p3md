export type RoleItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
};

export type GroupItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_system: boolean;
};

export type InheritedRole = {
  id: string;
  slug: string;
  name: string;
  viaGroup: string;
};

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  last_sign_in_at: string | null;
  created_at: string | null;
  groups: GroupItem[];
  directRoles: RoleItem[];
  inheritedRoles: InheritedRole[];
};

export type InvitePayload = {
  email: string;
  full_name?: string;
  role_ids: string[];
  group_ids: string[];
};
