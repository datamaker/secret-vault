export interface User {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  createdAt: Date;
  user?: User;
}

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  description?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  color: string;
  orderIndex: number;
  createdAt: Date;
}

export interface Secret {
  id: string;
  environmentId: string;
  key: string;
  value?: string; // Decrypted value (optional)
  description?: string;
  isSensitive: boolean;
  version: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecretHistory {
  id: string;
  secretId: string;
  version: number;
  changedBy?: string;
  changedAt: Date;
}

export type ProjectPermission = 'read' | 'write' | 'admin';

export interface ApiToken {
  id: string;
  projectId: string;
  environmentId?: string;
  name: string;
  tokenPrefix: string;
  permissions: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdBy?: string;
  createdAt: Date;
  isRevoked: boolean;
}

export interface AuditLog {
  id: string;
  userId?: string;
  teamId?: string;
  projectId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export type AuditAction =
  | 'secret.created'
  | 'secret.updated'
  | 'secret.deleted'
  | 'secret.viewed'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'team.created'
  | 'team.member_added'
  | 'team.member_removed'
  | 'user.login'
  | 'user.logout'
  | 'user.password_changed'
  | 'api_token.created'
  | 'api_token.revoked';

// API Request/Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface CreateEnvironmentRequest {
  name: string;
  color?: string;
}

export interface CreateSecretRequest {
  key: string;
  value: string;
  description?: string;
  isSensitive?: boolean;
}

export interface UpdateSecretRequest {
  value?: string;
  description?: string;
  isSensitive?: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
