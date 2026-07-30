import { Router } from 'express';
import * as secretController from '../controllers/secretController';
import { authenticateUserOrToken, requireUser } from '../middleware/auth';
import { allowScopedApiTokenRead } from '../middleware/rbac';

const router = Router();

// All routes require authentication (JWT user or sv_ API token)
router.use(authenticateUserOrToken);

// Import/Export/Deleted (MUST be before :key routes to avoid matching them as keys)
router.get('/environments/:envId/secrets/export', allowScopedApiTokenRead, secretController.exportSecrets);
router.post('/environments/:envId/secrets/import', requireUser, secretController.importSecrets);
router.get('/environments/:envId/secrets/deleted', requireUser, secretController.getDeletedSecrets);

// Secret CRUD — reads allow scoped API tokens, writes are user-only
router.get('/environments/:envId/secrets', allowScopedApiTokenRead, secretController.getSecrets);
router.post('/environments/:envId/secrets', requireUser, secretController.createSecret);
router.get('/environments/:envId/secrets/:key', allowScopedApiTokenRead, secretController.getSecret);
router.put('/environments/:envId/secrets/:key', requireUser, secretController.updateSecret);
router.delete('/environments/:envId/secrets/:key', requireUser, secretController.deleteSecret);

// History
router.get('/secrets/:secretId/history', requireUser, secretController.getSecretHistory);

export default router;
