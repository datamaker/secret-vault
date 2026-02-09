export const TeamRoles = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

export const ProjectPermissions = {
  ADMIN: 'admin',
  WRITE: 'write',
  READ: 'read',
} as const;

export const TeamRoleHierarchy: Record<string, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

export const ProjectPermissionHierarchy: Record<string, number> = {
  admin: 3,
  write: 2,
  read: 1,
};

export const DefaultEnvironments = [
  { name: 'Development', slug: 'development', color: '#22c55e', orderIndex: 0 },
  { name: 'Staging', slug: 'staging', color: '#f59e0b', orderIndex: 1 },
  { name: 'Production', slug: 'production', color: '#ef4444', orderIndex: 2 },
];

export const SecretKeyPattern = /^[A-Z][A-Z0-9_]*$/;

export const PermissionMatrix = {
  team: {
    owner: ['delete', 'update', 'manage_members', 'manage_projects', 'view'],
    admin: ['update', 'manage_members', 'manage_projects', 'view'],
    member: ['manage_projects', 'view'],
    viewer: ['view'],
  },
  project: {
    admin: ['delete', 'update', 'manage_permissions', 'manage_secrets', 'view_secrets'],
    write: ['manage_secrets', 'view_secrets'],
    read: ['view_secrets'],
  },
};
