import { Request, Response, NextFunction } from 'express';
import * as credentialService from '../services/credentialService';
import { AppError } from '../middleware/errorHandler';

export const getCredentials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const credentials = await credentialService.getCredentialsByTeam(req.params.teamId, true);
    res.json(credentials);
  } catch (error) {
    next(error);
  }
};

export const createCredential = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, url, username, password, notes } = req.body;
    const credential = await credentialService.createCredential(
      req.params.teamId,
      name,
      url ?? null,
      username ?? null,
      password,
      notes ?? null,
      req.user!.userId
    );
    res.status(201).json(credential);
  } catch (error) {
    next(error);
  }
};

export const updateCredential = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, url, username, password, notes } = req.body;
    const credential = await credentialService.updateCredential(
      req.params.teamId,
      req.params.credentialId,
      { name, url, username, password, notes },
      req.user!.userId
    );
    res.json(credential);
  } catch (error) {
    next(error);
  }
};

export const deleteCredential = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await credentialService.deleteCredential(req.params.teamId, req.params.credentialId, req.user!.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// 크롬 익스텐션용:
// - JWT 로그인: 사용자가 속한 모든 팀의 크리덴셜 반환
// - 팀 스코프 API 토큰(sv_...): 토큰의 팀 크리덴셜 반환
export const getCredentialsByToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user) {
      const credentials = await credentialService.getCredentialsForUser(req.user.userId);
      res.json(credentials);
      return;
    }

    if (!req.apiToken) {
      throw new AppError('Authentication required', 401);
    }
    if (!req.apiToken.teamId) {
      throw new AppError('A team-scoped API token is required for credential access', 403);
    }
    if (!req.apiToken.permissions.includes('read')) {
      throw new AppError('API token does not have read permission', 403);
    }

    const credentials = await credentialService.getCredentialsByTeam(req.apiToken.teamId, true);
    res.json(credentials);
  } catch (error) {
    next(error);
  }
};
