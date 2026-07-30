import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as apiTokenService from '../services/apiTokenService';
import { ApiTokenContext } from '../services/apiTokenService';

export interface JWTPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      apiToken?: ApiTokenContext;
    }
  }
}

const API_TOKEN_PREFIX = 'sv_';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }
};

// JWT 또는 API 토큰(sv_ 접두사) 둘 다 허용한다.
// API 토큰이면 req.apiToken이, JWT면 req.user가 설정된다.
export const authenticateUserOrToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (token.startsWith(API_TOKEN_PREFIX)) {
    try {
      const context = await apiTokenService.validateToken(token);
      if (!context) {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired API token' });
        return;
      }
      req.apiToken = context;
      next();
    } catch (error) {
      console.error('API token validation error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
    return;
  }

  authenticate(req, res, next);
};

// API 토큰 접근 차단 — 사용자(JWT) 전용 엔드포인트에 사용
export const requireUser = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(403).json({ error: 'Forbidden', message: 'This endpoint requires user authentication' });
    return;
  }
  next();
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    req.user = decoded;
  } catch {
    // Token invalid, but that's okay for optional auth
  }

  next();
};
