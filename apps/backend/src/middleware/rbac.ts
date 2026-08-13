import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { TeamRole, ProjectPermission, TeamRoleHierarchy, ProjectPermissionHierarchy } from '@secret-vault/shared';

declare global {
  namespace Express {
    interface Request {
      teamRole?: TeamRole;
      projectPermission?: ProjectPermission;
    }
  }
}

export const requireTeamRole = (...allowedRoles: TeamRole[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { teamId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!teamId) {
      res.status(400).json({ error: 'Bad Request', message: 'Team ID is required' });
      return;
    }

    try {
      const result = await query(
        'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
        [teamId, userId]
      );

      if (result.rows.length === 0) {
        res.status(403).json({ error: 'Forbidden', message: 'Not a member of this team' });
        return;
      }

      const userRole = result.rows[0].role as TeamRole;

      // Check if user's role meets minimum required role
      const minRequiredLevel = Math.min(...allowedRoles.map(r => TeamRoleHierarchy[r]));
      if (TeamRoleHierarchy[userRole] < minRequiredLevel) {
        res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
        return;
      }

      req.teamRole = userRole;
      next();
    } catch (error) {
      console.error('RBAC team check error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
};

// 시크릿 읽기 라우트용: API 토큰이면 스코프(팀/프로젝트/환경)와 read 권한을 검증하고,
// JWT 사용자면 기존 동작 그대로 통과시킨다.
export const allowScopedApiTokenRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.apiToken) {
    next();
    return;
  }

  const { envId } = req.params;

  if (!req.apiToken.permissions.includes('read')) {
    res.status(403).json({ error: 'Forbidden', message: 'API token does not have read permission' });
    return;
  }

  if (!envId) {
    res.status(400).json({ error: 'Bad Request', message: 'Environment ID is required' });
    return;
  }

  if (req.apiToken.environmentId && req.apiToken.environmentId !== envId) {
    res.status(403).json({ error: 'Forbidden', message: 'API token is not scoped to this environment' });
    return;
  }

  try {
    const result = await query(
      `SELECT e.project_id, p.team_id FROM environments e
       JOIN projects p ON p.id = e.project_id
       WHERE e.id = $1`,
      [envId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Not Found', message: 'Environment not found' });
      return;
    }

    const { project_id: envProjectId, team_id: envTeamId } = result.rows[0];

    // 프로젝트 스코프 토큰: 해당 프로젝트만. 팀 스코프 토큰: 팀 내 모든 프로젝트.
    const inScope = req.apiToken.projectId
      ? req.apiToken.projectId === envProjectId
      : req.apiToken.teamId === envTeamId;

    if (!inScope) {
      res.status(403).json({ error: 'Forbidden', message: 'API token is not scoped to this environment' });
      return;
    }

    next();
  } catch (error) {
    console.error('API token scope check error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * A user's effective permission on a project, or `null` when they have none.
 *
 * Returning `null` for a non-member is the whole point: an earlier version
 * defaulted to `'read'`, which meant any authenticated user passed a
 * `requireProjectPermission('read', …)` gate on a project they had no
 * relationship to. Team role maps to a baseline (owner/admin→admin,
 * member→write, viewer→read); an explicit `project_permissions` row can raise
 * (never silently grant to a non-member unless such a row exists).
 */
async function effectivePermission(
  userId: string,
  projectId: string,
  envId: string | null
): Promise<ProjectPermission | null> {
  let permission: ProjectPermission | null = null;

  const teamResult = await query(
    `SELECT tm.role FROM team_members tm
     JOIN projects p ON p.team_id = tm.team_id
     WHERE p.id = $1 AND tm.user_id = $2`,
    [projectId, userId]
  );

  if (teamResult.rows.length > 0) {
    const teamRole = teamResult.rows[0].role as TeamRole;
    if (teamRole === 'owner' || teamRole === 'admin') {
      permission = 'admin';
    } else if (teamRole === 'member') {
      permission = 'write';
    } else {
      permission = 'read'; // viewer
    }
  }

  // A project-specific grant can raise the baseline (or grant access to a user
  // with no team membership, if such a row was explicitly created for them).
  const projectPermResult = await query(
    `SELECT permission FROM project_permissions
     WHERE project_id = $1 AND user_id = $2
     AND (environment_id IS NULL OR environment_id = $3)
     ORDER BY CASE WHEN environment_id IS NOT NULL THEN 0 ELSE 1 END
     LIMIT 1`,
    [projectId, userId, envId || null]
  );

  if (projectPermResult.rows.length > 0) {
    const explicitPerm = projectPermResult.rows[0].permission as ProjectPermission;
    if (permission === null || ProjectPermissionHierarchy[explicitPerm] > ProjectPermissionHierarchy[permission]) {
      permission = explicitPerm;
    }
  }

  return permission;
}

/** Resolve the project + team that own an environment. */
async function ownersOfEnv(envId: string): Promise<{ projectId: string; teamId: string } | null> {
  const result = await query(
    `SELECT e.project_id, p.team_id FROM environments e
     JOIN projects p ON p.id = e.project_id
     WHERE e.id = $1`,
    [envId]
  );
  if (result.rows.length === 0) return null;
  return { projectId: result.rows[0].project_id, teamId: result.rows[0].team_id };
}

/** Resolve the environment that owns a secret (for secret-id-keyed routes). */
async function envOfSecret(secretId: string): Promise<string | null> {
  const result = await query('SELECT environment_id FROM secrets WHERE id = $1', [secretId]);
  return result.rows.length > 0 ? (result.rows[0].environment_id as string) : null;
}

export const requireProjectPermission = (...allowedPermissions: ProjectPermission[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { projectId, envId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!projectId) {
      res.status(400).json({ error: 'Bad Request', message: 'Project ID is required' });
      return;
    }

    try {
      const permission = await effectivePermission(userId, projectId, envId || null);
      if (permission === null) {
        res.status(403).json({ error: 'Forbidden', message: 'No access to this project' });
        return;
      }

      const minRequiredLevel = Math.min(...allowedPermissions.map(p => ProjectPermissionHierarchy[p]));
      if (ProjectPermissionHierarchy[permission] < minRequiredLevel) {
        res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
        return;
      }

      req.projectPermission = permission;
      next();
    } catch (error) {
      console.error('RBAC project check error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
};

/**
 * Authorize a route keyed by `:envId` (or `:secretId`), for BOTH principals:
 * an `sv_` API token (scope + permission) or a JWT user (project permission).
 *
 * This is what the secret routes were missing entirely: they authenticated the
 * caller but never checked that the caller could reach *this* environment, so
 * any logged-in user could read or delete another team's secrets by supplying
 * its UUID. The environment's project/team is resolved from the database, never
 * trusted from the path beyond the id itself.
 */
export const requireEnvPermission = (...allowedPermissions: ProjectPermission[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let envId: string | null = req.params.envId ?? null;

    // Secret-id-keyed routes (history) carry no envId; derive it.
    if (!envId && req.params.secretId) {
      envId = await envOfSecret(req.params.secretId);
      if (!envId) {
        res.status(404).json({ error: 'Not Found', message: 'Secret not found' });
        return;
      }
    }

    if (!envId) {
      res.status(400).json({ error: 'Bad Request', message: 'Environment ID is required' });
      return;
    }

    const minRequiredLevel = Math.min(...allowedPermissions.map(p => ProjectPermissionHierarchy[p]));

    try {
      const owners = await ownersOfEnv(envId);
      if (!owners) {
        res.status(404).json({ error: 'Not Found', message: 'Environment not found' });
        return;
      }

      // API-token principal: check the token carries a high-enough permission
      // and is scoped to this environment's project/team.
      if (req.apiToken) {
        const tokenLevel = Math.max(
          0,
          ...req.apiToken.permissions.map(p => ProjectPermissionHierarchy[p] ?? 0)
        );
        if (tokenLevel < minRequiredLevel) {
          res.status(403).json({ error: 'Forbidden', message: 'API token lacks the required permission' });
          return;
        }
        if (req.apiToken.environmentId && req.apiToken.environmentId !== envId) {
          res.status(403).json({ error: 'Forbidden', message: 'API token is not scoped to this environment' });
          return;
        }
        const inScope = req.apiToken.projectId
          ? req.apiToken.projectId === owners.projectId
          : req.apiToken.teamId === owners.teamId;
        if (!inScope) {
          res.status(403).json({ error: 'Forbidden', message: 'API token is not scoped to this environment' });
          return;
        }
        next();
        return;
      }

      // JWT-user principal.
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const permission = await effectivePermission(userId, owners.projectId, envId);
      if (permission === null) {
        res.status(403).json({ error: 'Forbidden', message: 'No access to this environment' });
        return;
      }
      if (ProjectPermissionHierarchy[permission] < minRequiredLevel) {
        res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
        return;
      }
      req.projectPermission = permission;
      next();
    } catch (error) {
      console.error('RBAC environment check error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
};
