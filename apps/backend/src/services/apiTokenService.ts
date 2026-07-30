import crypto from 'crypto';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export interface ApiToken {
  id: string;
  teamId: string | null;
  projectId: string | null;
  environmentId: string | null;
  name: string;
  tokenPrefix: string;
  permissions: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  isRevoked: boolean;
}

export interface ApiTokenContext {
  id: string;
  teamId: string | null;
  projectId: string | null;
  environmentId: string | null;
  permissions: string[];
}

// 토큰 스코프: 팀 전체(teamId) 또는 프로젝트(projectId, 선택적으로 환경까지) 중 하나
export interface ApiTokenScope {
  teamId?: string;
  projectId?: string;
  environmentId?: string;
}

const TOKEN_PREFIX_LENGTH = 12;

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const mapRow = (row: Record<string, unknown>): ApiToken => ({
  id: row.id as string,
  teamId: row.team_id as string | null,
  projectId: row.project_id as string | null,
  environmentId: row.environment_id as string | null,
  name: row.name as string,
  tokenPrefix: row.token_prefix as string,
  permissions: row.permissions as string[],
  expiresAt: row.expires_at as Date | null,
  lastUsedAt: row.last_used_at as Date | null,
  createdBy: row.created_by as string | null,
  createdAt: row.created_at as Date,
  isRevoked: row.is_revoked as boolean,
});

export const createToken = async (
  scope: ApiTokenScope,
  name: string,
  permissions: string[],
  expiresAt: Date | null,
  userId: string
): Promise<{ token: string; apiToken: ApiToken }> => {
  if (!scope.teamId && !scope.projectId) {
    throw new AppError('Token scope requires a team or a project', 400);
  }

  if (scope.environmentId) {
    if (!scope.projectId) {
      throw new AppError('Environment scope requires a project', 400);
    }
    const env = await query(
      'SELECT id FROM environments WHERE id = $1 AND project_id = $2',
      [scope.environmentId, scope.projectId]
    );
    if (env.rows.length === 0) {
      throw new AppError('Environment not found in this project', 404);
    }
  }

  const token = `sv_${crypto.randomBytes(24).toString('base64url')}`;
  const tokenPrefix = token.slice(0, TOKEN_PREFIX_LENGTH);

  const result = await query(
    `INSERT INTO api_tokens (team_id, project_id, environment_id, name, token_hash, token_prefix, permissions, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      scope.teamId ?? null,
      scope.projectId ?? null,
      scope.environmentId ?? null,
      name,
      hashToken(token),
      tokenPrefix,
      permissions,
      expiresAt,
      userId,
    ]
  );

  return { token, apiToken: mapRow(result.rows[0]) };
};

export const getTokensByTeam = async (teamId: string): Promise<ApiToken[]> => {
  // 팀 전체 스코프 토큰 + 팀 소속 프로젝트 스코프 토큰을 모두 보여준다
  const result = await query(
    `SELECT t.* FROM api_tokens t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.team_id = $1 OR p.team_id = $1
     ORDER BY t.created_at DESC`,
    [teamId]
  );
  return result.rows.map(mapRow);
};

export const getTokensByProject = async (projectId: string): Promise<ApiToken[]> => {
  const result = await query(
    `SELECT * FROM api_tokens WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId]
  );
  return result.rows.map(mapRow);
};

export const revokeTeamToken = async (tokenId: string, teamId: string): Promise<void> => {
  const result = await query(
    `UPDATE api_tokens SET is_revoked = true
     WHERE id = $1
       AND (team_id = $2 OR project_id IN (SELECT id FROM projects WHERE team_id = $2))`,
    [tokenId, teamId]
  );
  if (result.rowCount === 0) {
    throw new AppError('API token not found', 404);
  }
};

export const revokeProjectToken = async (tokenId: string, projectId: string): Promise<void> => {
  const result = await query(
    `UPDATE api_tokens SET is_revoked = true WHERE id = $1 AND project_id = $2`,
    [tokenId, projectId]
  );
  if (result.rowCount === 0) {
    throw new AppError('API token not found', 404);
  }
};

export const validateToken = async (token: string): Promise<ApiTokenContext | null> => {
  const tokenPrefix = token.slice(0, TOKEN_PREFIX_LENGTH);
  const tokenHash = hashToken(token);

  const result = await query(
    `SELECT id, team_id, project_id, environment_id, permissions, token_hash, expires_at
     FROM api_tokens
     WHERE token_prefix = $1 AND is_revoked = false`,
    [tokenPrefix]
  );

  for (const row of result.rows) {
    const stored = Buffer.from(row.token_hash as string);
    const candidate = Buffer.from(tokenHash);
    if (stored.length !== candidate.length || !crypto.timingSafeEqual(stored, candidate)) {
      continue;
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return null;
    }

    await query('UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1', [row.id]);

    return {
      id: row.id,
      teamId: row.team_id,
      projectId: row.project_id,
      environmentId: row.environment_id,
      permissions: row.permissions,
    };
  }

  return null;
};
