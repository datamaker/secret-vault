import { Router } from 'express';
import * as projectController from '../controllers/projectController';
import * as apiTokenController from '../controllers/apiTokenController';
import { authenticate } from '../middleware/auth';
import { requireTeamRole, requireProjectPermission } from '../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Project CRUD (within team context)
router.get('/teams/:teamId/projects', requireTeamRole('viewer', 'member', 'admin', 'owner'), projectController.getProjects);
router.post('/teams/:teamId/projects', requireTeamRole('member', 'admin', 'owner'), projectController.createProject);

// Project routes (direct access)
router.get('/:projectId', requireProjectPermission('read', 'write', 'admin'), projectController.getProject);
router.put('/:projectId', requireProjectPermission('admin'), projectController.updateProject);
router.delete('/:projectId', requireProjectPermission('admin'), projectController.deleteProject);

// API Tokens (project scope, optionally narrowed to one environment — project admin only)
router.get('/:projectId/tokens', requireProjectPermission('admin'), apiTokenController.getProjectTokens);
router.post('/:projectId/tokens', requireProjectPermission('admin'), apiTokenController.createProjectToken);
router.delete('/:projectId/tokens/:tokenId', requireProjectPermission('admin'), apiTokenController.revokeProjectToken);

// Environments
router.get('/:projectId/environments', requireProjectPermission('read', 'write', 'admin'), projectController.getEnvironments);
router.post('/:projectId/environments', requireProjectPermission('admin'), projectController.createEnvironment);
router.delete('/environments/:envId', projectController.deleteEnvironment);

export default router;
