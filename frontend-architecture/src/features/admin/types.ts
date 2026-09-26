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

export type GroupDetail = GroupItem & {
  memberCount: number;
  memberIds: string[];
  roleIds: string[];
};

export type RoleDetail = RoleItem & {
  permissionKeys: string[];
  directHolderCount: number;
  inheritedHolderCount: number;
  totalHoldersCount: number;
};

export type PermissionCatalogueItem = {
  key: string;
  module: string;
  description: string;
  grantingRoles: { id: string; name: string; slug: string }[];
};

// ============ Google Integrations (PSI-067) ============

export type DriveRootItem = {
  id: string;
  folder_id: string;
  name: string;
  enabled: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  accessRoles: RoleItem[];
  accessGroups: GroupItem[];
};

export type GoogleCalendarItem = {
  id: string;
  calendar_id: string;
  name: string;
  direction: 'pull' | 'push' | 'both';
  role_id: string | null;
  group_id: string | null;
  role: RoleItem | null;
  group: GroupItem | null;
  enabled: boolean;
  last_synced_at: string | null;
  last_error: string | null;
};

export type AdminIntegrationsData = {
  saEmail: string;
  driveRoots: DriveRootItem[];
  calendars: GoogleCalendarItem[];
  allRoles: RoleItem[];
  allGroups: GroupItem[];
  canManageIntegrations: boolean;
  canManageDocuments: boolean;
};
