import { Router } from 'express';
import authRoutes from './auth';
import teamRoutes from './teams';
import projectRoutes from './projects';
import secretRoutes from './secrets';
import shareRoutes from './share';
import credentialRoutes from './credentials';

const router = Router();

router.use('/auth', authRoutes);
router.use('/teams', teamRoutes);
router.use('/projects', projectRoutes);
router.use('/share', shareRoutes);
router.use('/credentials', credentialRoutes);
router.use('/', secretRoutes);

export default router;
