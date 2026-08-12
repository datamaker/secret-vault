import { Router } from 'express';
import * as secretController from '../controllers/secretController';
import { authenticateUserOrToken, requireUser } from '../middleware/auth';
import { requireEnvPermission } from '../middleware/rbac';

const router = Router();

// All routes require authentication (JWT user or sv_ API token)...
router.use(authenticateUserOrToken);

// ...but authentication alone is not authorization. Every route below also
// checks that the caller may reach *this* environment (or the secret's
// environment), for both principals — see requireEnvPermission. Without it,
// any authenticated caller could read or mutate another team's secrets by id.

// Import/Export/Deleted (MUST be before :key routes to avoid matching them as keys)
router.get('/environments/:envId/secrets/export', requireEnvPermission('read'), secretController.exportSecrets);
router.post('/environments/:envId/secrets/import', requireUser, requireEnvPermission('write'), secretController.importSecrets);
router.get('/environments/:envId/secrets/deleted', requireUser, requireEnvPermission('read'), secretController.getDeletedSecrets);

// Secret CRUD — reads allow scoped API tokens, writes are user-only
router.get('/environments/:envId/secrets', requireEnvPermission('read'), secretController.getSecrets);
router.post('/environments/:envId/secrets', requireUser, requireEnvPermission('write'), secretController.createSecret);
router.get('/environments/:envId/secrets/:key', requireEnvPermission('read'), secretController.getSecret);
router.put('/environments/:envId/secrets/:key', requireUser, requireEnvPermission('write'), secretController.updateSecret);
router.delete('/environments/:envId/secrets/:key', requireUser, requireEnvPermission('write'), secretController.deleteSecret);

// History — keyed by secret id; the guard resolves the owning environment.
router.get('/secrets/:secretId/history', requireUser, requireEnvPermission('read'), secretController.getSecretHistory);

export default router;
