import { Router } from 'express';
import * as teamController from '../controllers/teamController';
import { authenticate } from '../middleware/auth';
import { requireTeamRole } from '../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Team CRUD
router.get('/', teamController.getTeams);
router.post('/', teamController.createTeam);
router.get('/:teamId', requireTeamRole('viewer', 'member', 'admin', 'owner'), teamController.getTeam);
router.put('/:teamId', requireTeamRole('admin', 'owner'), teamController.updateTeam);
router.delete('/:teamId', requireTeamRole('owner'), teamController.deleteTeam);

// Team members
router.get('/:teamId/members', requireTeamRole('viewer', 'member', 'admin', 'owner'), teamController.getMembers);
router.post('/:teamId/members', requireTeamRole('admin', 'owner'), teamController.addMember);
router.put('/:teamId/members/:userId', requireTeamRole('admin', 'owner'), teamController.updateMember);
router.delete('/:teamId/members/:userId', requireTeamRole('admin', 'owner'), teamController.removeMember);

// Invitations
router.get('/:teamId/invitations', requireTeamRole('admin', 'owner'), teamController.getInvitations);
router.delete('/:teamId/invitations/:invitationId', requireTeamRole('admin', 'owner'), teamController.cancelInvitation);

export default router;
