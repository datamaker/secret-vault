import { Request, Response, NextFunction } from 'express';
import * as integrationService from '../services/integrationService';

export const getIntegrations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const integrations = await integrationService.getIntegrationsByTeam(req.params.teamId);
    res.json(integrations);
  } catch (error) {
    next(error);
  }
};

export const createIntegration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, environmentId, ownerSlug, contextName, token } = req.body;
    const integration = await integrationService.createIntegration(
      req.params.teamId,
      name,
      environmentId,
      ownerSlug,
      contextName,
      token,
      req.user!.userId
    );
    res.status(201).json(integration);
  } catch (error) {
    next(error);
  }
};

export const updateIntegration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, ownerSlug, contextName, token, autoSync } = req.body;
    const integration = await integrationService.updateIntegration(
      req.params.teamId,
      req.params.integrationId,
      { name, ownerSlug, contextName, token, autoSync }
    );
    res.json(integration);
  } catch (error) {
    next(error);
  }
};

export const deleteIntegration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await integrationService.deleteIntegration(
      req.params.teamId,
      req.params.integrationId,
      req.user!.userId
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const syncIntegration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await integrationService.syncIntegration(
      req.params.integrationId,
      req.user!.userId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};
