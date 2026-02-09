import { query } from '../config/database';
import { Team, TeamMember, TeamRole } from '@secret-vault/shared';
import { AppError } from '../middleware/errorHandler';

const slugify = (text: string): string => {
  let slug = text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // If slug is empty (e.g., only special chars), generate a random one
  if (!slug) {
    slug = `team-${Date.now().toString(36)}`;
  }

  return slug;
};

export const createTeam = async (name: string, description: string | undefined, userId: string): Promise<Team> => {
  const slug = slugify(name);

  // Check if slug exists
  const existing = await query('SELECT id FROM teams WHERE slug = $1', [slug]);
  if (existing.rows.length > 0) {
    throw new AppError('A team with this name already exists', 409);
  }

  const client = await (await import('../config/database')).getClient();

  try {
    await client.query('BEGIN');

    // Create team
    const teamResult = await client.query(
      `INSERT INTO teams (name, slug, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, slug, description, created_at, updated_at`,
      [name, slug, description]
    );

    const team = teamResult.rows[0];

    // Add creator as owner
    await client.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [team.id, userId]
    );

    await client.query('COMMIT');

    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      createdAt: team.created_at,
      updatedAt: team.updated_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getTeamsByUser = async (userId: string): Promise<Team[]> => {
  const result = await query(
    `SELECT t.id, t.name, t.slug, t.description, t.created_at, t.updated_at, tm.role
     FROM teams t
     JOIN team_members tm ON t.id = tm.team_id
     WHERE tm.user_id = $1
     ORDER BY t.name`,
    [userId]
  );

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const getTeamById = async (teamId: string): Promise<Team | null> => {
  const result = await query(
    `SELECT id, name, slug, description, created_at, updated_at
     FROM teams WHERE id = $1`,
    [teamId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const updateTeam = async (teamId: string, name?: string, description?: string): Promise<Team> => {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  if (name !== undefined) {
    updates.push(`name = $${paramCount}`);
    values.push(name);
    paramCount++;

    updates.push(`slug = $${paramCount}`);
    values.push(slugify(name));
    paramCount++;
  }

  if (description !== undefined) {
    updates.push(`description = $${paramCount}`);
    values.push(description);
    paramCount++;
  }

  if (updates.length === 0) {
    throw new AppError('No fields to update', 400);
  }

  updates.push(`updated_at = NOW()`);
  values.push(teamId);

  const result = await query(
    `UPDATE teams SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING id, name, slug, description, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) {
    throw new AppError('Team not found', 404);
  }

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const deleteTeam = async (teamId: string): Promise<void> => {
  const result = await query('DELETE FROM teams WHERE id = $1', [teamId]);
  if (result.rowCount === 0) {
    throw new AppError('Team not found', 404);
  }
};

export const getTeamMembers = async (teamId: string): Promise<TeamMember[]> => {
  const result = await query(
    `SELECT tm.id, tm.team_id, tm.user_id, tm.role, tm.created_at,
            u.email, u.name
     FROM team_members tm
     JOIN users u ON tm.user_id = u.id
     WHERE tm.team_id = $1
     ORDER BY tm.role, u.name`,
    [teamId]
  );

  return result.rows.map(row => ({
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role as TeamRole,
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      email: row.email,
      name: row.name,
      isActive: true,
      isAdmin: false,
      createdAt: row.created_at,
      updatedAt: row.created_at,
    },
  }));
};

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  invitedBy?: string;
  createdAt: Date;
  expiresAt: Date;
}

export const addTeamMember = async (
  teamId: string,
  email: string,
  role: TeamRole,
  invitedBy?: string
): Promise<TeamMember | TeamInvitation> => {
  const normalizedEmail = email.toLowerCase();

  // Find user by email
  const userResult = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);

  if (userResult.rows.length === 0) {
    // User doesn't exist - create invitation
    const existingInvite = await query(
      'SELECT id FROM team_invitations WHERE team_id = $1 AND email = $2',
      [teamId, normalizedEmail]
    );
    if (existingInvite.rows.length > 0) {
      throw new AppError('Invitation already sent to this email', 409);
    }

    const result = await query(
      `INSERT INTO team_invitations (team_id, email, role, invited_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, team_id, email, role, invited_by, created_at, expires_at`,
      [teamId, normalizedEmail, role, invitedBy]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      teamId: row.team_id,
      email: row.email,
      role: row.role as TeamRole,
      invitedBy: row.invited_by,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  const userId = userResult.rows[0].id;

  // Check if already a member
  const existing = await query(
    'SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );
  if (existing.rows.length > 0) {
    throw new AppError('User is already a member of this team', 409);
  }

  const result = await query(
    `INSERT INTO team_members (team_id, user_id, role)
     VALUES ($1, $2, $3)
     RETURNING id, team_id, user_id, role, created_at`,
    [teamId, userId, role]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role as TeamRole,
    createdAt: row.created_at,
  };
};

export const getTeamInvitations = async (teamId: string): Promise<TeamInvitation[]> => {
  const result = await query(
    `SELECT id, team_id, email, role, invited_by, created_at, expires_at
     FROM team_invitations
     WHERE team_id = $1 AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [teamId]
  );

  return result.rows.map(row => ({
    id: row.id,
    teamId: row.team_id,
    email: row.email,
    role: row.role as TeamRole,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
};

export const cancelInvitation = async (teamId: string, invitationId: string): Promise<void> => {
  const result = await query(
    'DELETE FROM team_invitations WHERE id = $1 AND team_id = $2',
    [invitationId, teamId]
  );
  if (result.rowCount === 0) {
    throw new AppError('Invitation not found', 404);
  }
};

export const processInvitationsForUser = async (userId: string, email: string): Promise<void> => {
  // Find all pending invitations for this email
  const invitations = await query(
    `SELECT team_id, role FROM team_invitations
     WHERE email = $1 AND expires_at > NOW()`,
    [email.toLowerCase()]
  );

  for (const inv of invitations.rows) {
    // Add user to team
    await query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO NOTHING`,
      [inv.team_id, userId, inv.role]
    );
  }

  // Delete processed invitations
  await query('DELETE FROM team_invitations WHERE email = $1', [email.toLowerCase()]);
};

export const updateTeamMemberRole = async (teamId: string, userId: string, role: TeamRole): Promise<void> => {
  // Prevent demoting the last owner
  if (role !== 'owner') {
    const ownerCount = await query(
      `SELECT COUNT(*) as count FROM team_members
       WHERE team_id = $1 AND role = 'owner' AND user_id != $2`,
      [teamId, userId]
    );
    const currentRole = await query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    if (currentRole.rows[0]?.role === 'owner' && parseInt(ownerCount.rows[0].count) === 0) {
      throw new AppError('Cannot demote the last owner', 400);
    }
  }

  const result = await query(
    'UPDATE team_members SET role = $3 WHERE team_id = $1 AND user_id = $2',
    [teamId, userId, role]
  );

  if (result.rowCount === 0) {
    throw new AppError('Team member not found', 404);
  }
};

export const removeTeamMember = async (teamId: string, userId: string): Promise<void> => {
  // Check if removing the last owner
  const member = await query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );

  if (member.rows[0]?.role === 'owner') {
    const ownerCount = await query(
      `SELECT COUNT(*) as count FROM team_members WHERE team_id = $1 AND role = 'owner'`,
      [teamId]
    );
    if (parseInt(ownerCount.rows[0].count) <= 1) {
      throw new AppError('Cannot remove the last owner', 400);
    }
  }

  const result = await query(
    'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );

  if (result.rowCount === 0) {
    throw new AppError('Team member not found', 404);
  }
};
