import { Router, Request, Response, NextFunction } from 'express';
import * as shareService from '../services/shareService';
import { authenticate } from '../middleware/auth';

const router = Router();

// 링크 생성은 로그인한 사용자만
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ciphertext, iv, expiresInHours, maxViews } = req.body;
    const result = await shareService.createShare(
      ciphertext,
      iv,
      Number(expiresInHours) || 24,
      maxViews === null || maxViews === undefined ? null : Number(maxViews),
      req.user!.userId
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// 열람은 링크만 있으면 가능 (비로그인) — 복호화 키는 URL fragment라 서버에 오지 않는다
router.post('/:id/reveal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    void shareService.purgeExpired();
    const result = await shareService.revealShare(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
