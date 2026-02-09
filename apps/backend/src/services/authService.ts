import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { User } from '@secret-vault/shared';
import { AppError } from '../middleware/errorHandler';
import { processInvitationsForUser } from './teamService';

const BCRYPT_ROUNDS = 12;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const createUser = async (email: string, password: string, name: string): Promise<User> => {
  // Check if user already exists
  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    throw new AppError('User with this email already exists', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const result = await query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, is_active, is_admin, created_at, updated_at`,
    [email.toLowerCase(), passwordHash, name]
  );

  const row = result.rows[0];
  const user: User = {
    id: row.id,
    email: row.email,
    name: row.name,
    isActive: row.is_active,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  // Process any pending team invitations for this email
  await processInvitationsForUser(user.id, user.email);

  return user;
};

export const validatePassword = async (email: string, password: string): Promise<User> => {
  const result = await query(
    `SELECT id, email, name, password_hash, is_active, is_admin, created_at, updated_at
     FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    throw new AppError('Invalid email or password', 401);
  }

  const row = result.rows[0];

  if (!row.is_active) {
    throw new AppError('Account is disabled', 403);
  }

  const isValid = await bcrypt.compare(password, row.password_hash);
  if (!isValid) {
    throw new AppError('Invalid email or password', 401);
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isActive: row.is_active,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const generateTokens = (user: User): TokenPair => {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, isAdmin: user.isAdmin },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

export const refreshAccessToken = async (refreshToken: string): Promise<TokenPair> => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
      userId: string;
      type: string;
    };

    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid token type', 401);
    }

    const result = await query(
      `SELECT id, email, name, is_active, is_admin, created_at, updated_at
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 401);
    }

    const row = result.rows[0];
    if (!row.is_active) {
      throw new AppError('Account is disabled', 403);
    }

    const user: User = {
      id: row.id,
      email: row.email,
      name: row.name,
      isActive: row.is_active,
      isAdmin: row.is_admin,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return generateTokens(user);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid refresh token', 401);
  }
};

export const getUserById = async (userId: string): Promise<User | null> => {
  const result = await query(
    `SELECT id, email, name, is_active, is_admin, created_at, updated_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isActive: row.is_active,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};
