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
