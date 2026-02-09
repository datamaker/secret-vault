import { Router } from 'express';
import * as projectController from '../controllers/projectController';
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

// Environments
router.get('/:projectId/environments', requireProjectPermission('read', 'write', 'admin'), projectController.getEnvironments);
router.post('/:projectId/environments', requireProjectPermission('admin'), projectController.createEnvironment);
router.delete('/environments/:envId', projectController.deleteEnvironment);

export default router;
