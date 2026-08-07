import { randomBytes } from 'crypto';
import { User } from '@secret-vault/shared';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { createUser } from './authService';

/**
 * Resolves an SSO identity to a vault user: existing account by email, or
 * JIT-provisioned (the IdP already vouched for the workspace member).
 * SSO-created accounts get a random password; password login stays possible
 * only after an admin/reset sets one.
 */
export const findOrCreateSsoUser = async (email: string, name: string): Promise<User> => {
  const result = await query(
    `SELECT id, email, name, is_active, is_admin, created_at, updated_at
     FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );

  if (result.rows.length > 0) {
    const row = result.rows[0];
    if (!row.is_active) {
      throw new AppError('Account is disabled', 403);
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
  }

  return createUser(email, randomBytes(24).toString('base64url'), name);
};
