import { Router } from 'express';
import * as secretController from '../controllers/secretController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Import/Export (MUST be before :key routes to avoid matching "export"/"import" as key)
router.get('/environments/:envId/secrets/export', secretController.exportSecrets);
router.post('/environments/:envId/secrets/import', secretController.importSecrets);

// Secret CRUD
router.get('/environments/:envId/secrets', secretController.getSecrets);
router.post('/environments/:envId/secrets', secretController.createSecret);
router.get('/environments/:envId/secrets/:key', secretController.getSecret);
router.put('/environments/:envId/secrets/:key', secretController.updateSecret);
router.delete('/environments/:envId/secrets/:key', secretController.deleteSecret);

// History
router.get('/secrets/:secretId/history', secretController.getSecretHistory);

export default router;
