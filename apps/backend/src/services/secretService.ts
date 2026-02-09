import { query, getClient } from '../config/database';
import { Secret, SecretHistory } from '@secret-vault/shared';
import { encryptionService } from './encryptionService';
import { AppError } from '../middleware/errorHandler';

export const createSecret = async (
  environmentId: string,
  projectId: string,
  key: string,
  value: string,
  description: string | undefined,
  isSensitive: boolean,
  userId: string
): Promise<Secret> => {
  // Validate key format
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
    throw new AppError('Secret key must start with a letter and contain only uppercase letters, numbers, and underscores', 400);
  }

  // Check if key exists
  const existing = await query(
    'SELECT id FROM secrets WHERE environment_id = $1 AND key = $2',
    [environmentId, key]
  );
  if (existing.rows.length > 0) {
    throw new AppError('A secret with this key already exists in this environment', 409);
  }

  // Encrypt the value
  const encrypted = encryptionService.encrypt(value, projectId);

  const result = await query(
    `INSERT INTO secrets (environment_id, key, encrypted_value, iv, auth_tag, description, is_sensitive, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, environment_id, key, description, is_sensitive, version, created_by, created_at, updated_at`,
    [environmentId, key, encrypted.encryptedValue, encrypted.iv, encrypted.authTag, description, isSensitive, userId]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    environmentId: row.environment_id,
    key: row.key,
    description: row.description,
    isSensitive: row.is_sensitive,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const getSecretsByEnvironment = async (
  environmentId: string,
  projectId: string,
  includeValues: boolean = false
): Promise<Secret[]> => {
  const result = await query(
    `SELECT id, environment_id, key, encrypted_value, iv, auth_tag, description, is_sensitive, version, created_by, created_at, updated_at
     FROM secrets WHERE environment_id = $1
     ORDER BY key`,
    [environmentId]
  );

  return result.rows.map(row => {
    const secret: Secret = {
      id: row.id,
      environmentId: row.environment_id,
      key: row.key,
      description: row.description,
      isSensitive: row.is_sensitive,
      version: row.version,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    if (includeValues) {
      secret.value = encryptionService.decrypt(
        {
          encryptedValue: row.encrypted_value,
          iv: row.iv,
          authTag: row.auth_tag,
        },
        projectId
      );
    }

    return secret;
  });
};

export const getSecretByKey = async (
  environmentId: string,
  projectId: string,
  key: string
): Promise<Secret | null> => {
  const result = await query(
    `SELECT id, environment_id, key, encrypted_value, iv, auth_tag, description, is_sensitive, version, created_by, created_at, updated_at
     FROM secrets WHERE environment_id = $1 AND key = $2`,
    [environmentId, key]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    environmentId: row.environment_id,
    key: row.key,
    value: encryptionService.decrypt(
      {
        encryptedValue: row.encrypted_value,
        iv: row.iv,
        authTag: row.auth_tag,
      },
      projectId
    ),
    description: row.description,
    isSensitive: row.is_sensitive,
    version: row.version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const updateSecret = async (
  environmentId: string,
  projectId: string,
  key: string,
  value: string | undefined,
  description: string | undefined,
  isSensitive: boolean | undefined,
  userId: string
): Promise<Secret> => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Get current secret
    const current = await client.query(
      `SELECT id, encrypted_value, iv, auth_tag, version
       FROM secrets WHERE environment_id = $1 AND key = $2`,
      [environmentId, key]
    );

    if (current.rows.length === 0) {
      throw new AppError('Secret not found', 404);
    }

    const currentRow = current.rows[0];

    // Save to history if value is changing
    if (value !== undefined) {
      await client.query(
        `INSERT INTO secret_history (secret_id, encrypted_value, iv, auth_tag, version, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [currentRow.id, currentRow.encrypted_value, currentRow.iv, currentRow.auth_tag, currentRow.version, userId]
      );
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (value !== undefined) {
      const encrypted = encryptionService.encrypt(value, projectId);
      updates.push(`encrypted_value = $${paramCount}`);
      values.push(encrypted.encryptedValue);
      paramCount++;

      updates.push(`iv = $${paramCount}`);
      values.push(encrypted.iv);
      paramCount++;

      updates.push(`auth_tag = $${paramCount}`);
      values.push(encrypted.authTag);
      paramCount++;

      updates.push(`version = version + 1`);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (isSensitive !== undefined) {
      updates.push(`is_sensitive = $${paramCount}`);
      values.push(isSensitive);
      paramCount++;
    }

    updates.push(`updated_at = NOW()`);
    values.push(environmentId, key);

    const result = await client.query(
      `UPDATE secrets SET ${updates.join(', ')}
       WHERE environment_id = $${paramCount} AND key = $${paramCount + 1}
       RETURNING id, environment_id, key, encrypted_value, iv, auth_tag, description, is_sensitive, version, created_by, created_at, updated_at`,
      values
    );

    await client.query('COMMIT');

    const row = result.rows[0];
    return {
      id: row.id,
      environmentId: row.environment_id,
      key: row.key,
      value: encryptionService.decrypt(
        {
          encryptedValue: row.encrypted_value,
          iv: row.iv,
          authTag: row.auth_tag,
        },
        projectId
      ),
      description: row.description,
      isSensitive: row.is_sensitive,
      version: row.version,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const deleteSecret = async (environmentId: string, key: string): Promise<void> => {
  const result = await query(
    'DELETE FROM secrets WHERE environment_id = $1 AND key = $2',
    [environmentId, key]
  );

  if (result.rowCount === 0) {
    throw new AppError('Secret not found', 404);
  }
};

export const getSecretHistory = async (secretId: string): Promise<SecretHistory[]> => {
  const result = await query(
    `SELECT id, secret_id, version, changed_by, changed_at
     FROM secret_history WHERE secret_id = $1
     ORDER BY version DESC`,
    [secretId]
  );

  return result.rows.map(row => ({
    id: row.id,
    secretId: row.secret_id,
    version: row.version,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
  }));
};

export const exportAsEnv = async (environmentId: string, projectId: string): Promise<string> => {
  const secrets = await getSecretsByEnvironment(environmentId, projectId, true);

  return secrets
    .map(s => `${s.key}=${s.value}`)
    .join('\n');
};

export const importFromEnv = async (
  environmentId: string,
  projectId: string,
  content: string,
  userId: string
): Promise<number> => {
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  let imported = 0;

  for (const line of lines) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      try {
        await createSecret(environmentId, projectId, key, value, undefined, true, userId);
        imported++;
      } catch {
        // Skip if already exists
      }
    }
  }

  return imported;
};
