import { query } from '../config/database';
import { encryptionService } from './encryptionService';
import { logActivity } from './auditService';
import { AppError } from '../middleware/errorHandler';

// 비밀번호는 프로젝트 시크릿과 동일한 AES-256-GCM으로 암호화하되,
// 파생 컨텍스트를 분리해 팀 단위 키를 사용한다.
const keyContext = (teamId: string): string => `credential:${teamId}`;

export interface Credential {
  id: string;
  teamId: string;
  name: string;
  url: string | null;
  username: string | null;
  password?: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const mapRow = (row: Record<string, unknown>, teamId: string, includePassword: boolean): Credential => {
  const credential: Credential = {
    id: row.id as string,
    teamId: row.team_id as string,
    name: row.name as string,
    url: row.url as string | null,
    username: row.username as string | null,
    notes: row.notes as string | null,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };

  if (includePassword) {
    credential.password = encryptionService.decrypt(
      {
        encryptedValue: row.encrypted_password as string,
        iv: row.iv as string,
        authTag: row.auth_tag as string,
      },
      keyContext(teamId)
    );
  }

  return credential;
};

export const getCredentialsByTeam = async (
  teamId: string,
  includePasswords: boolean
): Promise<Credential[]> => {
  const result = await query(
    `SELECT * FROM credentials WHERE team_id = $1 ORDER BY name`,
    [teamId]
  );
  return result.rows.map(row => mapRow(row, teamId, includePasswords));
};

// 사용자가 속한 모든 팀의 크리덴셜 (크롬 익스텐션 로그인 모드용)
export const getCredentialsForUser = async (
  userId: string
): Promise<Array<Credential & { teamName: string }>> => {
  const result = await query(
    `SELECT c.*, t.name AS team_name
     FROM credentials c
     JOIN teams t ON t.id = c.team_id
     JOIN team_members tm ON tm.team_id = c.team_id
     WHERE tm.user_id = $1
     ORDER BY c.name`,
    [userId]
  );
  return result.rows.map(row => ({
    ...mapRow(row, row.team_id as string, true),
    teamName: row.team_name as string,
  }));
};

export const createCredential = async (
  teamId: string,
  name: string,
  url: string | null,
  username: string | null,
  password: string,
  notes: string | null,
  userId: string
): Promise<Credential> => {
  if (!name) {
    throw new AppError('Name is required', 400);
  }
  if (!password) {
    throw new AppError('Password is required', 400);
  }

  const encrypted = encryptionService.encrypt(password, keyContext(teamId));

  const result = await query(
    `INSERT INTO credentials (team_id, name, url, username, encrypted_password, iv, auth_tag, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [teamId, name, url, username, encrypted.encryptedValue, encrypted.iv, encrypted.authTag, notes, userId]
  );

  await logActivity({
    userId,
    teamId,
    action: 'credential.created',
    resourceType: 'credential',
    resourceId: result.rows[0].id,
    details: { name, url },
  });

  return mapRow(result.rows[0], teamId, false);
};

export const updateCredential = async (
  teamId: string,
  credentialId: string,
  fields: { name?: string; url?: string | null; username?: string | null; password?: string; notes?: string | null },
  userId: string
): Promise<Credential> => {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  if (fields.name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(fields.name);
  }
  if (fields.url !== undefined) {
    updates.push(`url = $${paramCount++}`);
    values.push(fields.url);
  }
  if (fields.username !== undefined) {
    updates.push(`username = $${paramCount++}`);
    values.push(fields.username);
  }
  if (fields.password !== undefined && fields.password !== '') {
    const encrypted = encryptionService.encrypt(fields.password, keyContext(teamId));
    updates.push(`encrypted_password = $${paramCount++}`);
    values.push(encrypted.encryptedValue);
    updates.push(`iv = $${paramCount++}`);
    values.push(encrypted.iv);
    updates.push(`auth_tag = $${paramCount++}`);
    values.push(encrypted.authTag);
  }
  if (fields.notes !== undefined) {
    updates.push(`notes = $${paramCount++}`);
    values.push(fields.notes);
  }

  if (updates.length === 0) {
    throw new AppError('Nothing to update', 400);
  }

  updates.push('updated_at = NOW()');
  values.push(credentialId, teamId);

  const result = await query(
    `UPDATE credentials SET ${updates.join(', ')}
     WHERE id = $${paramCount} AND team_id = $${paramCount + 1}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw new AppError('Credential not found', 404);
  }

  await logActivity({
    userId,
    teamId,
    action: 'credential.updated',
    resourceType: 'credential',
    resourceId: credentialId,
    details: { name: result.rows[0].name, url: result.rows[0].url },
  });

  return mapRow(result.rows[0], teamId, false);
};

export const deleteCredential = async (
  teamId: string,
  credentialId: string,
  userId: string
): Promise<void> => {
  const result = await query(
    'DELETE FROM credentials WHERE id = $1 AND team_id = $2 RETURNING name, url',
    [credentialId, teamId]
  );

  if (result.rowCount === 0) {
    throw new AppError('Credential not found', 404);
  }

  await logActivity({
    userId,
    teamId,
    action: 'credential.deleted',
    resourceType: 'credential',
    resourceId: credentialId,
    details: { name: result.rows[0].name, url: result.rows[0].url },
  });
};
