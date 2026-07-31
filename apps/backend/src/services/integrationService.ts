import { query } from '../config/database';
import { encryptionService } from './encryptionService';
import { getSecretsByEnvironment } from './secretService';
import { logActivity } from './auditService';
import { AppError } from '../middleware/errorHandler';

// 단방향 싱크: vault 환경 → CircleCI context 환경변수 (Doppler integrations 방식)
// CI는 평소처럼 환경변수만 읽으므로 배포 경로에 vault가 끼지 않는다.

// CIRCLECI_API_URL은 테스트용 오버라이드 (기본값은 실제 CircleCI)
const CIRCLECI_API = process.env.CIRCLECI_API_URL ?? 'https://circleci.com/api/v2';
const keyContext = (teamId: string): string => `integration:${teamId}`;

export interface Integration {
  id: string;
  teamId: string;
  type: string;
  name: string;
  environmentId: string;
  config: { ownerSlug: string; contextName: string; contextId?: string };
  autoSync: boolean;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  createdAt: Date;
  // 표시용 (조인)
  projectName?: string;
  environmentName?: string;
}

const mapRow = (row: Record<string, unknown>): Integration => ({
  id: row.id as string,
  teamId: row.team_id as string,
  type: row.type as string,
  name: row.name as string,
  environmentId: row.environment_id as string,
  config: row.config as Integration['config'],
  autoSync: row.auto_sync as boolean,
  lastSyncAt: row.last_sync_at as Date | null,
  lastSyncStatus: row.last_sync_status as string | null,
  lastSyncMessage: row.last_sync_message as string | null,
  createdAt: row.created_at as Date,
  projectName: row.project_name as string | undefined,
  environmentName: row.environment_name as string | undefined,
});

const circleci = async (
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> =>
  fetch(`${CIRCLECI_API}${path}`, {
    ...init,
    headers: {
      'Circle-Token': token,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

// context 이름 → id 조회 (없으면 에러)
export const resolveContextId = async (
  token: string,
  ownerSlug: string,
  contextName: string
): Promise<string> => {
  const res = await circleci(token, `/context?owner-slug=${encodeURIComponent(ownerSlug)}`);
  if (res.status === 401) {
    throw new AppError('CircleCI rejected the API token', 401);
  }
  if (!res.ok) {
    throw new AppError(`CircleCI context lookup failed (${res.status})`, 502);
  }

  const body = (await res.json()) as { items?: Array<{ id: string; name: string }> };
  const match = body.items?.find(c => c.name === contextName);
  if (!match) {
    const available = (body.items ?? []).map(c => c.name).join(', ');
    throw new AppError(
      `Context "${contextName}" not found in ${ownerSlug}. Available: ${available || '(none)'}`,
      404
    );
  }
  return match.id;
};

export const getIntegrationsByTeam = async (teamId: string): Promise<Integration[]> => {
  const result = await query(
    `SELECT i.*, e.name AS environment_name, p.name AS project_name
     FROM integrations i
     JOIN environments e ON e.id = i.environment_id
     JOIN projects p ON p.id = e.project_id
     WHERE i.team_id = $1
     ORDER BY i.created_at DESC`,
    [teamId]
  );
  return result.rows.map(mapRow);
};

export const createIntegration = async (
  teamId: string,
  name: string,
  environmentId: string,
  ownerSlug: string,
  contextName: string,
  token: string,
  userId: string
): Promise<Integration> => {
  if (!name || !environmentId || !ownerSlug || !contextName || !token) {
    throw new AppError('name, environmentId, ownerSlug, contextName, and token are required', 400);
  }

  // 환경이 이 팀 소속인지 확인
  const env = await query(
    `SELECT e.id FROM environments e JOIN projects p ON p.id = e.project_id
     WHERE e.id = $1 AND p.team_id = $2`,
    [environmentId, teamId]
  );
  if (env.rows.length === 0) {
    throw new AppError('Environment not found in this team', 404);
  }

  // 토큰이 유효하고 context가 실제로 있는지 먼저 검증한다
  const contextId = await resolveContextId(token, ownerSlug, contextName);

  const encrypted = encryptionService.encrypt(token, keyContext(teamId));

  const result = await query(
    `INSERT INTO integrations (team_id, name, environment_id, config, encrypted_token, iv, auth_tag, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      teamId,
      name,
      environmentId,
      JSON.stringify({ ownerSlug, contextName, contextId }),
      encrypted.encryptedValue,
      encrypted.iv,
      encrypted.authTag,
      userId,
    ]
  );

  await logActivity({
    userId,
    teamId,
    action: 'integration.created',
    resourceType: 'integration',
    resourceId: result.rows[0].id,
    details: { name, target: `${ownerSlug}/${contextName}` },
  });

  return mapRow(result.rows[0]);
};

export const deleteIntegration = async (
  teamId: string,
  integrationId: string,
  userId: string
): Promise<void> => {
  const result = await query(
    'DELETE FROM integrations WHERE id = $1 AND team_id = $2 RETURNING name',
    [integrationId, teamId]
  );
  if (result.rowCount === 0) {
    throw new AppError('Integration not found', 404);
  }

  await logActivity({
    userId,
    teamId,
    action: 'integration.deleted',
    resourceType: 'integration',
    resourceId: integrationId,
    details: { name: result.rows[0].name },
  });
};

export interface SyncResult {
  synced: number;
  failed: string[];
}

// vault 환경의 시크릿을 CircleCI context로 push한다.
// context에 이미 있는 다른 키는 건드리지 않는다 (upsert only).
export const syncIntegration = async (
  integrationId: string,
  userId?: string
): Promise<SyncResult> => {
  const result = await query(
    `SELECT i.*, e.project_id FROM integrations i
     JOIN environments e ON e.id = i.environment_id
     WHERE i.id = $1`,
    [integrationId]
  );
  if (result.rows.length === 0) {
    throw new AppError('Integration not found', 404);
  }

  const row = result.rows[0];
  const config = row.config as Integration['config'];
  const token = encryptionService.decrypt(
    { encryptedValue: row.encrypted_token, iv: row.iv, authTag: row.auth_tag },
    keyContext(row.team_id)
  );

  try {
    const contextId =
      config.contextId ?? (await resolveContextId(token, config.ownerSlug, config.contextName));

    const secrets = await getSecretsByEnvironment(row.environment_id, row.project_id, true);

    let synced = 0;
    const failed: string[] = [];

    for (const secret of secrets) {
      const res = await circleci(
        token,
        `/context/${contextId}/environment-variable/${encodeURIComponent(secret.key)}`,
        { method: 'PUT', body: JSON.stringify({ value: secret.value ?? '' }) }
      );
      if (res.ok) {
        synced++;
      } else {
        failed.push(secret.key);
      }
    }

    const status = failed.length === 0 ? 'success' : 'partial';
    const message =
      failed.length === 0
        ? `Synced ${synced} secrets to ${config.contextName}`
        : `Synced ${synced}, failed: ${failed.join(', ')}`;

    await query(
      `UPDATE integrations SET last_sync_at = NOW(), last_sync_status = $1, last_sync_message = $2,
       config = jsonb_set(config, '{contextId}', to_jsonb($3::text)), updated_at = NOW()
       WHERE id = $4`,
      [status, message, contextId, integrationId]
    );

    await logActivity({
      userId,
      teamId: row.team_id,
      action: 'integration.synced',
      resourceType: 'integration',
      resourceId: integrationId,
      details: { name: row.name, synced, failed: failed.length },
    });

    return { synced, failed };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    await query(
      `UPDATE integrations SET last_sync_at = NOW(), last_sync_status = 'error',
       last_sync_message = $1, updated_at = NOW() WHERE id = $2`,
      [message, integrationId]
    );
    throw error;
  }
};

// 시크릿 변경 시 자동 싱크 (fire-and-forget — 본 작업을 실패시키지 않는다)
export const syncEnvironmentIntegrations = async (environmentId: string): Promise<void> => {
  try {
    const result = await query(
      'SELECT id FROM integrations WHERE environment_id = $1 AND auto_sync = true',
      [environmentId]
    );
    for (const row of result.rows) {
      await syncIntegration(row.id).catch(error => {
        console.error(`Auto-sync failed for integration ${row.id}:`, error.message);
      });
    }
  } catch (error) {
    console.error('Auto-sync lookup failed:', error);
  }
};
