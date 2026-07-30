import { Router } from 'express';
import * as credentialController from '../controllers/credentialController';
import { authenticateUserOrToken } from '../middleware/auth';

const router = Router();

// 크롬 익스텐션 전용: 팀 스코프 API 토큰으로 자신의 팀 크리덴셜을 조회
router.get('/', authenticateUserOrToken, credentialController.getCredentialsByToken);

export default router;
