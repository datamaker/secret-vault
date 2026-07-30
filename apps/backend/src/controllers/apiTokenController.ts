import { Request, Response, NextFunction } from 'express';
import * as apiTokenService from '../services/apiTokenService';
import { ApiTokenScope } from '../services/apiTokenService';
import { logActivity } from '../services/auditService';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const resolveTeamId = async (scope: ApiTokenScope): Promise<string | null> => {
  if (scope.teamId) return scope.teamId;
  if (scope.projectId) {
    const result = await query('SELECT team_id FROM projects WHERE id = $1', [scope.projectId]);
    return result.rows[0]?.team_id ?? null;
  }
  return null;
};

const ALLOWED_PERMISSIONS = ['read'];

const parseTokenRequest = (req: Request): { name: string; permissions: string[]; expiresAt: Date | null } => {
  const { name, permissions, expiresAt } = req.body;

  if (!name) {
    throw new AppError('Name is required', 400);
  }

  const requestedPermissions: string[] = permissions ?? ['read'];
  const invalid = requestedPermissions.filter(p => !ALLOWED_PERMISSIONS.includes(p));
  if (invalid.length > 0) {
    throw new AppError(`Invalid permissions: ${invalid.join(', ')}. Allowed: ${ALLOWED_PERMISSIONS.join(', ')}`, 400);
  }

  let parsedExpiresAt: Date | null = null;
  if (expiresAt) {
    parsedExpiresAt = new Date(expiresAt);
    if (isNaN(parsedExpiresAt.getTime())) {
      throw new AppError('Invalid expiresAt date', 400);
    }
  }

  return { name, permissions: requestedPermissions, expiresAt: parsedExpiresAt };
};

const create = async (req: Request, res: Response, next: NextFunction, scope: ApiTokenScope): Promise<void> => {
  try {
    const { name, permissions, expiresAt } = parseTokenRequest(req);
    const { token, apiToken } = await apiTokenService.createToken(
      scope,
      name,
      permissions,
      expiresAt,
      req.user!.userId
    );

    await logActivity({
      userId: req.user!.userId,
      teamId: await resolveTeamId(scope),
      projectId: scope.projectId ?? null,
      action: 'api_token.created',
      resourceType: 'api_token',
      resourceId: apiToken.id,
      details: { name, scope: scope.teamId ? 'team' : scope.environmentId ? 'environment' : 'project' },
    });

    // The raw token is returned only once at creation time.
    res.status(201).json({ token, apiToken });
  } catch (error) {
    next(error);
  }
};

// Team-scoped tokens: can read every project in the team
export const createTeamToken = (req: Request, res: Response, next: NextFunction): Promise<void> =>
  create(req, res, next, { teamId: req.params.teamId });

export const getTeamTokens = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tokens = await apiTokenService.getTokensByTeam(req.params.teamId);
    res.json(tokens);
  } catch (error) {
    next(error);
  }
};

export const revokeTeamToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await apiTokenService.revokeTeamToken(req.params.tokenId, req.params.teamId);

    await logActivity({
      userId: req.user!.userId,
      teamId: req.params.teamId,
      action: 'api_token.revoked',
      resourceType: 'api_token',
      resourceId: req.params.tokenId,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Project-scoped tokens: optionally narrowed to one environment
export const createProjectToken = (req: Request, res: Response, next: NextFunction): Promise<void> =>
  create(req, res, next, {
    projectId: req.params.projectId,
    environmentId: req.body.environmentId ?? undefined,
  });

export const getProjectTokens = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tokens = await apiTokenService.getTokensByProject(req.params.projectId);
    res.json(tokens);
  } catch (error) {
    next(error);
  }
};

export const revokeProjectToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await apiTokenService.revokeProjectToken(req.params.tokenId, req.params.projectId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
