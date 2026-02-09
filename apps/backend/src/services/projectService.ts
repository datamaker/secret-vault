import { query, getClient } from '../config/database';
import { Project, Environment, DefaultEnvironments } from '@secret-vault/shared';
import { AppError } from '../middleware/errorHandler';

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const createProject = async (
  teamId: string,
  name: string,
  description: string | undefined,
  userId: string
): Promise<Project> => {
  const slug = slugify(name);

  // Check if slug exists in team
  const existing = await query(
    'SELECT id FROM projects WHERE team_id = $1 AND slug = $2',
    [teamId, slug]
  );
  if (existing.rows.length > 0) {
    throw new AppError('A project with this name already exists in this team', 409);
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Create project
    const projectResult = await client.query(
      `INSERT INTO projects (team_id, name, slug, description, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, team_id, name, slug, description, created_by, created_at, updated_at`,
      [teamId, name, slug, description, userId]
    );

    const project = projectResult.rows[0];

    // Create default environments
    for (const env of DefaultEnvironments) {
      await client.query(
        `INSERT INTO environments (project_id, name, slug, color, order_index)
         VALUES ($1, $2, $3, $4, $5)`,
        [project.id, env.name, env.slug, env.color, env.orderIndex]
      );
    }

    await client.query('COMMIT');

    return {
      id: project.id,
      teamId: project.team_id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      createdBy: project.created_by,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const getProjectsByTeam = async (teamId: string): Promise<Project[]> => {
  const result = await query(
    `SELECT id, team_id, name, slug, description, created_by, created_at, updated_at
     FROM projects WHERE team_id = $1
     ORDER BY name`,
    [teamId]
  );

  return result.rows.map(row => ({
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const getProjectById = async (projectId: string): Promise<Project | null> => {
  const result = await query(
    `SELECT id, team_id, name, slug, description, created_by, created_at, updated_at
     FROM projects WHERE id = $1`,
    [projectId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const updateProject = async (projectId: string, name?: string, description?: string): Promise<Project> => {
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
  values.push(projectId);

  const result = await query(
    `UPDATE projects SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING id, team_id, name, slug, description, created_by, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) {
    throw new AppError('Project not found', 404);
  }

  const row = result.rows[0];
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const result = await query('DELETE FROM projects WHERE id = $1', [projectId]);
  if (result.rowCount === 0) {
    throw new AppError('Project not found', 404);
  }
};

// Environment functions
export const getEnvironmentsByProject = async (projectId: string): Promise<Environment[]> => {
  const result = await query(
    `SELECT id, project_id, name, slug, color, order_index, created_at
     FROM environments WHERE project_id = $1
     ORDER BY order_index`,
    [projectId]
  );

  return result.rows.map(row => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    slug: row.slug,
    color: row.color,
    orderIndex: row.order_index,
    createdAt: row.created_at,
  }));
};

export const createEnvironment = async (
  projectId: string,
  name: string,
  color?: string
): Promise<Environment> => {
  const slug = slugify(name);

  // Get max order_index
  const maxOrder = await query(
    'SELECT COALESCE(MAX(order_index), -1) as max FROM environments WHERE project_id = $1',
    [projectId]
  );

  const result = await query(
    `INSERT INTO environments (project_id, name, slug, color, order_index)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, project_id, name, slug, color, order_index, created_at`,
    [projectId, name, slug, color || '#6366f1', parseInt(maxOrder.rows[0].max) + 1]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    slug: row.slug,
    color: row.color,
    orderIndex: row.order_index,
    createdAt: row.created_at,
  };
};

export const getEnvironmentById = async (envId: string): Promise<Environment | null> => {
  const result = await query(
    `SELECT id, project_id, name, slug, color, order_index, created_at
     FROM environments WHERE id = $1`,
    [envId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    slug: row.slug,
    color: row.color,
    orderIndex: row.order_index,
    createdAt: row.created_at,
  };
};

export const deleteEnvironment = async (envId: string): Promise<void> => {
  const result = await query('DELETE FROM environments WHERE id = $1', [envId]);
  if (result.rowCount === 0) {
    throw new AppError('Environment not found', 404);
  }
};
