import { Request, Response, NextFunction } from 'express';
import * as secretService from '../services/secretService';
import * as projectService from '../services/projectService';
import { AppError } from '../middleware/errorHandler';

const getProjectIdFromEnv = async (envId: string): Promise<string> => {
  const env = await projectService.getEnvironmentById(envId);
  if (!env) {
    throw new AppError('Environment not found', 404);
  }
  return env.projectId;
};

export const createSecret = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { key, value, description, isSensitive } = req.body;

    if (!key || value === undefined) {
      throw new AppError('Key and value are required', 400);
    }

    const projectId = await getProjectIdFromEnv(req.params.envId);

    const secret = await secretService.createSecret(
      req.params.envId,
      projectId,
      key,
      value,
      description,
      isSensitive ?? true,
      req.user!.userId
    );

    res.status(201).json(secret);
  } catch (error) {
    next(error);
  }
};

export const getSecrets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projectId = await getProjectIdFromEnv(req.params.envId);
    const includeValues = req.query.values === 'true';

    const secrets = await secretService.getSecretsByEnvironment(
      req.params.envId,
      projectId,
      includeValues
    );

    res.json(secrets);
  } catch (error) {
    next(error);
  }
};

export const getSecret = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projectId = await getProjectIdFromEnv(req.params.envId);

    const secret = await secretService.getSecretByKey(
      req.params.envId,
      projectId,
      req.params.key
    );

    if (!secret) {
      throw new AppError('Secret not found', 404);
    }

    res.json(secret);
  } catch (error) {
    next(error);
  }
};

export const updateSecret = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { value, description, isSensitive } = req.body;
    const projectId = await getProjectIdFromEnv(req.params.envId);

    const secret = await secretService.updateSecret(
      req.params.envId,
      projectId,
      req.params.key,
      value,
      description,
      isSensitive,
      req.user!.userId
    );

    res.json(secret);
  } catch (error) {
    next(error);
  }
};

export const deleteSecret = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await secretService.deleteSecret(req.params.envId, req.params.key);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getSecretHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const history = await secretService.getSecretHistory(req.params.secretId);
    res.json(history);
  } catch (error) {
    next(error);
  }
};

export const exportSecrets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projectId = await getProjectIdFromEnv(req.params.envId);
    const format = req.query.format || 'env';

    if (format === 'env') {
      const content = await secretService.exportAsEnv(req.params.envId, projectId);
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename=".env"');
      res.send(content);
    } else if (format === 'json') {
      const secrets = await secretService.getSecretsByEnvironment(req.params.envId, projectId, true);
      const obj: Record<string, string> = {};
      secrets.forEach(s => {
        if (s.value) obj[s.key] = s.value;
      });
      res.json(obj);
    } else {
      throw new AppError('Invalid format. Use "env" or "json"', 400);
    }
  } catch (error) {
    next(error);
  }
};

export const importSecrets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { content } = req.body;

    if (!content) {
      throw new AppError('Content is required', 400);
    }

    const projectId = await getProjectIdFromEnv(req.params.envId);
    const count = await secretService.importFromEnv(
      req.params.envId,
      projectId,
      content,
      req.user!.userId
    );

    res.json({ imported: count });
  } catch (error) {
    next(error);
  }
};
