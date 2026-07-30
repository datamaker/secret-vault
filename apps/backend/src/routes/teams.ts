import { Router } from 'express';
import * as teamController from '../controllers/teamController';
import * as apiTokenController from '../controllers/apiTokenController';
import * as credentialController from '../controllers/credentialController';
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

// Shared credentials (1Password-style team logins)
router.get('/:teamId/credentials', requireTeamRole('viewer', 'member', 'admin', 'owner'), credentialController.getCredentials);
router.post('/:teamId/credentials', requireTeamRole('member', 'admin', 'owner'), credentialController.createCredential);
router.put('/:teamId/credentials/:credentialId', requireTeamRole('member', 'admin', 'owner'), credentialController.updateCredential);
router.delete('/:teamId/credentials/:credentialId', requireTeamRole('member', 'admin', 'owner'), credentialController.deleteCredential);

// Activity feed (team-wide audit log)
router.get('/:teamId/activity', requireTeamRole('viewer', 'member', 'admin', 'owner'), teamController.getActivity);

// API Tokens (team-wide scope — reads every project in the team; admin/owner only)
router.get('/:teamId/tokens', requireTeamRole('admin', 'owner'), apiTokenController.getTeamTokens);
router.post('/:teamId/tokens', requireTeamRole('admin', 'owner'), apiTokenController.createTeamToken);
router.delete('/:teamId/tokens/:tokenId', requireTeamRole('admin', 'owner'), apiTokenController.revokeTeamToken);

// Invitations
router.get('/:teamId/invitations', requireTeamRole('admin', 'owner'), teamController.getInvitations);
router.delete('/:teamId/invitations/:invitationId', requireTeamRole('admin', 'owner'), teamController.cancelInvitation);

export default router;
