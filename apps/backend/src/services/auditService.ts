import { query } from '../config/database';

// 감사 로그 기록은 본 작업을 실패시키지 않는다 (기록 실패 시 콘솔 에러만)

export interface ActivityLogParams {
  userId?: string | null;
  teamId?: string | null;
  projectId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
}

export const logActivity = async (params: ActivityLogParams): Promise<void> => {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, team_id, project_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, $3, $4::audit_action, $5, $6, $7)`,
      [
        params.userId ?? null,
        params.teamId ?? null,
        params.projectId ?? null,
        params.action,
        params.resourceType ?? null,
        params.resourceId ?? null,
        params.details ? JSON.stringify(params.details) : null,
      ]
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};

// 시크릿 이벤트: env → project/team 컨텍스트를 조회해 이름과 함께 기록
export const logSecretActivity = async (
  environmentId: string,
  action: 'secret.created' | 'secret.updated' | 'secret.deleted',
  key: string,
  userId?: string
): Promise<void> => {
  try {
    const ctx = await query(
      `SELECT e.name AS env_name, p.id AS project_id, p.name AS project_name, p.team_id
       FROM environments e JOIN projects p ON p.id = e.project_id
       WHERE e.id = $1`,
      [environmentId]
    );
    const row = ctx.rows[0];
    await logActivity({
      userId,
      teamId: row?.team_id,
      projectId: row?.project_id,
      action,
      resourceType: 'secret',
      details: { key, environment: row?.env_name, project: row?.project_name },
    });
  } catch (error) {
    console.error('Failed to write secret audit log:', error);
  }
};

export interface ActivityEntry {
  id: string;
  action: string;
  userName: string | null;
  userEmail: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

export const getTeamActivity = async (
  teamId: string,
  limit: number = 50,
  offset: number = 0
): Promise<ActivityEntry[]> => {
  const result = await query(
    `SELECT a.id, a.action, a.details, a.created_at, u.name AS user_name, u.email AS user_email
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.team_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2 OFFSET $3`,
    [teamId, limit, offset]
  );

  return result.rows.map(row => ({
    id: row.id,
    action: row.action,
    userName: row.user_name,
    userEmail: row.user_email,
    details: row.details,
    createdAt: row.created_at,
  }));
};
