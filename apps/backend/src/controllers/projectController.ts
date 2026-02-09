import { Request, Response, NextFunction } from 'express';
import * as projectService from '../services/projectService';
import { AppError } from '../middleware/errorHandler';

export const createProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description } = req.body;

    if (!name) {
      throw new AppError('Project name is required', 400);
    }

    const project = await projectService.createProject(
      req.params.teamId,
      name,
      description,
      req.user!.userId
    );
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
};

export const getProjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projects = await projectService.getProjectsByTeam(req.params.teamId);
    res.json(projects);
  } catch (error) {
    next(error);
  }
};

export const getProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await projectService.getProjectById(req.params.projectId);
    if (!project) {
      throw new AppError('Project not found', 404);
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description } = req.body;
    const project = await projectService.updateProject(req.params.projectId, name, description);
    res.json(project);
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await projectService.deleteProject(req.params.projectId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Environment controllers
export const getEnvironments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const environments = await projectService.getEnvironmentsByProject(req.params.projectId);
    res.json(environments);
  } catch (error) {
    next(error);
  }
};

export const createEnvironment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, color } = req.body;

    if (!name) {
      throw new AppError('Environment name is required', 400);
    }

    const environment = await projectService.createEnvironment(req.params.projectId, name, color);
    res.status(201).json(environment);
  } catch (error) {
    next(error);
  }
};

export const deleteEnvironment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await projectService.deleteEnvironment(req.params.envId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
