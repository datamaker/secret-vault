import { Request, Response, NextFunction } from 'express';
import * as teamService from '../services/teamService';
import { AppError } from '../middleware/errorHandler';
import { TeamMember } from '@secret-vault/shared';

export const createTeam = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description } = req.body;

    if (!name) {
      throw new AppError('Team name is required', 400);
    }

    const team = await teamService.createTeam(name, description, req.user!.userId);
    res.status(201).json(team);
  } catch (error) {
    next(error);
  }
};

export const getTeams = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const teams = await teamService.getTeamsByUser(req.user!.userId);
    res.json(teams);
  } catch (error) {
    next(error);
  }
};

export const getTeam = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const team = await teamService.getTeamById(req.params.teamId);
    if (!team) {
      throw new AppError('Team not found', 404);
    }
    res.json(team);
  } catch (error) {
    next(error);
  }
};

export const updateTeam = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description } = req.body;
    const team = await teamService.updateTeam(req.params.teamId, name, description);
    res.json(team);
  } catch (error) {
    next(error);
  }
};

export const deleteTeam = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await teamService.deleteTeam(req.params.teamId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const members = await teamService.getTeamMembers(req.params.teamId);
    res.json(members);
  } catch (error) {
    next(error);
  }
};

export const addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, role } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    const result = await teamService.addTeamMember(
      req.params.teamId,
      email,
      role || 'member',
      req.user!.userId
    );

    // Check if it's an invitation or a member
    const isInvitation = 'expiresAt' in result;
    res.status(201).json({
      ...result,
      type: isInvitation ? 'invitation' : 'member',
    });
  } catch (error) {
    next(error);
  }
};

export const updateMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role } = req.body;

    if (!role) {
      throw new AppError('Role is required', 400);
    }

    await teamService.updateTeamMemberRole(req.params.teamId, req.params.userId, role);
    res.json({ message: 'Member role updated' });
  } catch (error) {
    next(error);
  }
};

export const removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await teamService.removeTeamMember(req.params.teamId, req.params.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invitations = await teamService.getTeamInvitations(req.params.teamId);
    res.json(invitations);
  } catch (error) {
    next(error);
  }
};

export const cancelInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await teamService.cancelInvitation(req.params.teamId, req.params.invitationId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
