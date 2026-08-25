import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import * as oidcService from '../services/oidcService';
import { findOrCreateSsoUser } from '../services/oidcUserService';
import { logActivity } from '../services/auditService';
import { AppError } from '../middleware/errorHandler';

const OIDC_COOKIE = 'vault_oidc';

export const oidcStatus = (_req: Request, res: Response): void => {
  const enabled = oidcService.oidcEnabled();
  if (!enabled) {
    res.json({ enabled: false });
    return;
  }
  // issuer + cliClientId let the CLI run the device flow without local config.
  res.json({
    enabled: true,
    issuer: oidcService.issuer(),
    cliClientId: oidcService.cliClientId(),
  });
};

export const oidcStart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!oidcService.oidcEnabled()) throw new AppError('SSO is not configured', 404);
    const { url, state, verifier } = await oidcService.buildAuthUrl();
    res.cookie(OIDC_COOKIE, oidcService.signOidcState({ state, verifier }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/api/v1/auth/oidc',
    });
    res.redirect(url);
  } catch (error) {
    next(error);
  }
};

export const oidcCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!oidcService.oidcEnabled()) throw new AppError('SSO is not configured', 404);
    const stored = req.cookies[OIDC_COOKIE]
      ? oidcService.verifyOidcState(req.cookies[OIDC_COOKIE])
      : null;
    res.clearCookie(OIDC_COOKIE, { path: '/api/v1/auth/oidc' });

    const { code, state } = req.query as { code?: string; state?: string };
    if (!stored || !code || !state || stored.state !== state) {
      throw new AppError('SSO flow expired; start again', 400);
    }

    const identity = await oidcService.exchangeCode(code, stored.verifier);
    const user = await findOrCreateSsoUser(identity.email, identity.name);
    const tokens = authService.generateTokens(user);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // The SPA login page picks the access token out of the URL hash.
    res.redirect(`/login#sso=${tokens.accessToken}`);
  } catch (error) {
    next(error);
  }
};

/**
 * CLI SSO login: the CLI completes the device flow against the IdP itself and
 * hands us the resulting id_token. We verify it (JWKS signature, issuer,
 * aud = CLI client id, verified email), match/JIT the user, and return both
 * tokens in the body — the CLI cannot receive HttpOnly cookies.
 */
export const oidcExchange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!oidcService.oidcEnabled()) throw new AppError('SSO is not configured', 404);

    const { idToken } = req.body as { idToken?: unknown };
    if (!idToken || typeof idToken !== 'string') {
      throw new AppError('idToken is required', 400);
    }

    let identity;
    try {
      identity = await oidcService.verifyIdToken(idToken, oidcService.cliClientId());
    } catch {
      throw new AppError('Invalid SSO token', 401);
    }

    const user = await findOrCreateSsoUser(identity.email, identity.name);
    const tokens = authService.generateTokens(user);

    await logActivity({
      userId: user.id,
      action: 'user.login',
      resourceType: 'user',
      details: { method: 'sso-cli', email: user.email },
    });

    res.json({
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cookie-less refresh for the CLI: same verify/rotate logic as /auth/refresh,
 * but the refresh token travels in the body both ways.
 */
export const cliRefresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: unknown };
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new AppError('refreshToken is required', 400);
    }

    const tokens = await authService.refreshAccessToken(refreshToken);
    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (error) {
    next(error);
  }
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      throw new AppError('Email, password, and name are required', 400);
    }

    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    const user = await authService.createUser(email, password, name);
    const tokens = authService.generateTokens(user);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      user,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const user = await authService.validatePassword(email, password);
    const tokens = authService.generateTokens(user);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = (_req: Request, res: Response): void => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
};

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw new AppError('Refresh token not found', 401);
    }

    const tokens = await authService.refreshAccessToken(refreshToken);

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken: tokens.accessToken });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400);
    }

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters', 400);
    }

    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const user = await authService.getUserById(req.user.userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
};
