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
      // First, check if user has team-level access to the project
      const teamResult = await query(
        `SELECT tm.role FROM team_members tm
         JOIN projects p ON p.team_id = tm.team_id
         WHERE p.id = $1 AND tm.user_id = $2`,
        [projectId, userId]
      );

      let permission: ProjectPermission = 'read';

      if (teamResult.rows.length > 0) {
        const teamRole = teamResult.rows[0].role as TeamRole;
        // Map team role to project permission
        if (teamRole === 'owner' || teamRole === 'admin') {
          permission = 'admin';
        } else if (teamRole === 'member') {
          permission = 'write';
        }
      }

      // Check for project-specific permissions (overrides team role)
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
        if (ProjectPermissionHierarchy[explicitPerm] > ProjectPermissionHierarchy[permission]) {
          permission = explicitPerm;
        }
      }

      // Check if permission meets requirement
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
