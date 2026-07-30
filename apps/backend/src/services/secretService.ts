import { query, getClient } from '../config/database';
import { Secret, SecretHistory } from '@secret-vault/shared';
import { encryptionService } from './encryptionService';
import { logSecretActivity } from './auditService';
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

  await logSecretActivity(environmentId, 'secret.created', key, userId);

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

    await logSecretActivity(environmentId, 'secret.updated', key, userId);

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

export const deleteSecret = async (
  environmentId: string,
  key: string,
  userId?: string
): Promise<void> => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const current = await client.query(
      `SELECT id, encrypted_value, iv, auth_tag, version
       FROM secrets WHERE environment_id = $1 AND key = $2`,
      [environmentId, key]
    );

    if (current.rows.length === 0) {
      throw new AppError('Secret not found', 404);
    }

    // 삭제 후에도 마지막 값을 볼 수 있도록 보관함에 남긴다
    const row = current.rows[0];
    await client.query(
      `INSERT INTO deleted_secrets (environment_id, key, encrypted_value, iv, auth_tag, version, deleted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [environmentId, key, row.encrypted_value, row.iv, row.auth_tag, row.version, userId ?? null]
    );

    await client.query('DELETE FROM secrets WHERE id = $1', [row.id]);

    await client.query('COMMIT');

    await logSecretActivity(environmentId, 'secret.deleted', key, userId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export interface DeletedSecret {
  id: string;
  environmentId: string;
  key: string;
  value: string;
  version: number;
  deletedBy: string | null;
  deletedByName: string | null;
  deletedAt: Date;
}

export const getDeletedSecrets = async (
  environmentId: string,
  projectId: string
): Promise<DeletedSecret[]> => {
  const result = await query(
    `SELECT d.id, d.environment_id, d.key, d.encrypted_value, d.iv, d.auth_tag,
            d.version, d.deleted_by, d.deleted_at, u.name AS deleted_by_name
     FROM deleted_secrets d
     LEFT JOIN users u ON u.id = d.deleted_by
     WHERE d.environment_id = $1
     ORDER BY d.deleted_at DESC`,
    [environmentId]
  );

  return result.rows.map(row => ({
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
    version: row.version,
    deletedBy: row.deleted_by,
    deletedByName: row.deleted_by_name,
    deletedAt: row.deleted_at,
  }));
};

export const getSecretHistory = async (secretId: string): Promise<SecretHistory[]> => {
  const result = await query(
    `SELECT h.id, h.secret_id, h.encrypted_value, h.iv, h.auth_tag, h.version, h.changed_by, h.changed_at,
            u.name AS changed_by_name, e.project_id
     FROM secret_history h
     JOIN secrets s ON s.id = h.secret_id
     JOIN environments e ON e.id = s.environment_id
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.secret_id = $1
     ORDER BY h.version DESC`,
    [secretId]
  );

  return result.rows.map(row => ({
    id: row.id,
    secretId: row.secret_id,
    version: row.version,
    value: encryptionService.decrypt(
      {
        encryptedValue: row.encrypted_value,
        iv: row.iv,
        authTag: row.auth_tag,
      },
      row.project_id
    ),
    changedBy: row.changed_by,
    changedByName: row.changed_by_name,
    changedAt: row.changed_at,
  }));
};

export const exportAsEnv = async (environmentId: string, projectId: string): Promise<string> => {
  const secrets = await getSecretsByEnvironment(environmentId, projectId, true);

  return secrets
    .map(s => `${s.key}=${s.value}`)
    .join('\n');
};

// KEY=value 형식과, AWS Lambda 콘솔에서 복사한 "키 줄 + 값 줄" 교차 형식을 모두 파싱한다.
export const parseEnvContent = (content: string): Array<[string, string]> => {
  const lines = content
    .split('\n')
    .map(line => line.replace(/\r$/, '').trim())
    .filter(line => line && !line.startsWith('#'));

  const entries: Array<[string, string]> = [];

  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (kv) {
      entries.push([kv[1], kv[2]]);
      continue;
    }

    // 키만 있는 줄: 다음 줄을 값으로 사용 (Lambda 콘솔 복사-붙여넣기 형식)
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(lines[i]) && i + 1 < lines.length) {
      entries.push([lines[i], lines[i + 1]]);
      i++;
    }
  }

  return entries;
};

export const importFromEnv = async (
  environmentId: string,
  projectId: string,
  content: string,
  userId: string
): Promise<number> => {
  let imported = 0;

  for (const [rawKey, value] of parseEnvContent(content)) {
    const key = rawKey.toUpperCase();
    try {
      // Check if key exists
      const existing = await query(
        'SELECT id FROM secrets WHERE environment_id = $1 AND key = $2',
        [environmentId, key]
      );

      if (existing.rows.length > 0) {
        // Update existing secret
        await updateSecret(environmentId, projectId, key, value, undefined, undefined, userId);
      } else {
        // Create new secret
        await createSecret(environmentId, projectId, key, value, undefined, true, userId);
      }
      imported++;
    } catch {
      // Skip on error
    }
  }

  return imported;
};
