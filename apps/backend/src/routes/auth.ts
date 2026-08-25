import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/oidc/status', authController.oidcStatus);
router.get('/oidc/start', authController.oidcStart);
router.get('/oidc/callback', authController.oidcCallback);
router.post('/oidc/exchange', authController.oidcExchange);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);
router.post('/cli/refresh', authController.cliRefresh);
router.get('/me', authenticate, authController.me);
router.put('/password', authenticate, authController.changePassword);

export default router;
